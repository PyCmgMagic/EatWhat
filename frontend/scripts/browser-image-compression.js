async (page) => {
  const engine = page.context().browser().browserType().name();
  const context = await page.context().browser().newContext();
  const p = await context.newPage();
  await context.route((url) => url.origin !== "http://127.0.0.1:5173", (route) => route.abort());
  try {
    await p.goto("http://127.0.0.1:5173/?demo=1#/");
    return await p.evaluate(async (engine) => {
      const { compressImage } = await import("/src/api/image-compression.ts");
      const { uploadFile, uploadFiles } = await import("/src/api/service.ts");
      const { demoUpload } = await import("/src/demo/transport.ts");
      const assert = (ok, message) => { if (!ok) throw Error(message); };
      const activeUrls = new Set();
      const nativeCreate = URL.createObjectURL.bind(URL);
      const nativeRevoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = nativeCreate(blob);
        activeUrls.add(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        activeUrls.delete(url);
        nativeRevoke(url);
      };
      const canvas = document.createElement("canvas");
      const encode = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
      const inspect = async (file) => {
        const url = URL.createObjectURL(file);
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const sample = document.createElement("canvas");
          sample.width = sample.height = 1;
          const ctx = sample.getContext("2d");
          ctx.drawImage(img, 0, 0);
          return {
            width: img.naturalWidth, height: img.naturalHeight,
            alpha: ctx.getImageData(0, 0, 1, 1).data[3],
            bytes: file.size, type: file.type, name: file.name,
          };
        } finally { URL.revokeObjectURL(url); }
      };
      try {
        // A noisy transparent PNG exercises lossy compression, resizing and alpha.
        canvas.width = 3000; canvas.height = 1500;
        const ctx = canvas.getContext("2d");
        const pixels = ctx.createImageData(canvas.width, canvas.height);
        let seed = 12345;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = canvas.width / 2; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            pixels.data[i] = seed & 255;
            pixels.data[i + 1] = (seed >>> 8) & 255;
            pixels.data[i + 2] = (seed >>> 16) & 255;
            pixels.data[i + 3] = 255;
          }
        }
        ctx.putImageData(pixels, 0, 0);
        const source = new File([await encode("image/png")], "透明照片.png", { type: "image/png" });
        assert(source.size < 10 * 1024 * 1024, "Fixture exceeds the existing original file limit");
        const ordinary = await inspect(await compressImage(source, "foods"));
        const avatar = await inspect(await compressImage(source, "avatar"));
        assert(ordinary.width <= 1920 && ordinary.bytes <= 1024 * 1024 && ordinary.bytes < source.size, "Photo was not compressed");
        assert(avatar.width <= 768 && avatar.bytes <= 256 * 1024 && avatar.bytes < ordinary.bytes, "Avatar limits were not applied");
        assert(ordinary.alpha === 0 && avatar.alpha === 0, "Transparency was lost");
        assert(Math.abs(ordinary.width / ordinary.height - 2) < 0.01, "Photo was cropped or stretched");

        // Canvas must retain the original if recompression would make a small file worse.
        canvas.width = 32; canvas.height = 16;
        const small = new File([await encode("image/png")], "small.png", { type: "image/png" });
        assert(await compressImage(small, "foods") === small, "Small image was needlessly encoded");

        // Exif orientation 6: the camera's 2400x1200 JPEG is displayed as 1200x2400.
        canvas.width = 2400; canvas.height = 1200;
        ctx.fillStyle = "#e74321"; ctx.fillRect(0, 0, 1200, 1200);
        ctx.fillStyle = "#2167e7"; ctx.fillRect(1200, 0, 1200, 1200);
        const jpeg = new Uint8Array(await (await encode("image/jpeg", 0.95)).arrayBuffer());
        const exif = new Uint8Array([
          255, 225, 0, 34, 69, 120, 105, 102, 0, 0,
          73, 73, 42, 0, 8, 0, 0, 0, 1, 0,
          18, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
        ]);
        const oriented = new File([jpeg.slice(0, 2), exif, jpeg.slice(2)], "camera.JPG", { type: "image/jpeg" });
        const camera = await inspect(await compressImage(oriented, "foods"));
        assert(camera.width === 960 && camera.height === 1920 && camera.type === "image/jpeg", "Camera orientation was lost");

        // Mimic Safari builds without WebP encoding: inspect actual returned MIME.
        const nativeToBlob = HTMLCanvasElement.prototype.toBlob;
        let fallback;
        try {
          HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
            return nativeToBlob.call(this, callback, type === "image/webp" ? "image/png" : type, quality);
          };
          fallback = await inspect(await compressImage(source, "feedback"));
          assert(fallback.type === "image/png" && fallback.name.endsWith(".png") && fallback.alpha === 0 && fallback.bytes <= 1024 * 1024, "PNG fallback has wrong metadata or alpha");
        } finally { HTMLCanvasElement.prototype.toBlob = nativeToBlob; }

        const signed = [], sent = [], confirmed = [];
        const api = {
          presign: async (data) => {
            signed.push(data);
            return { key: "avatar/one", putUrl: "https://storage.test/one" };
          },
          presignBatch: async (data) => {
            signed.push(...data.files);
            return { files: data.files.map((_, i) => ({ key: `foods/${i}`, putUrl: `https://storage.test/${i}` })) };
          },
          complete: async (key) => { confirmed.push(key); return { key }; },
        };
        // No real storage or API requests: inspect the exact File passed to fetch.
        const fetcher = async (_url, options) => {
          const file = options.body;
          sent.push({ fileName: file.name, contentType: file.type, fileSize: file.size });
          assert(options.headers["Content-Type"] === file.type && options.credentials === "omit", "PUT metadata is inconsistent");
          return new Response(null, { status: 200 });
        };
        await uploadFile(api, source, "avatar", undefined, fetcher);
        await uploadFiles(api, [source, oriented], "foods", undefined, fetcher);
        assert(JSON.stringify(signed.map(({ fileName, contentType, fileSize }) => ({ fileName, contentType, fileSize }))) === JSON.stringify(sent), "Presigned metadata differs from PUT bytes");
        assert(confirmed.length === 3, "Upload confirmation was skipped");

        const demoKey = await demoUpload(source, "comments");
        const data = localStorage.getItem(`eatwhat-demo-media-v4:${demoKey}`);
        const demo = await inspect(await (await fetch(data)).blob());
        assert(demo.width <= 1920 && demo.bytes <= 1024 * 1024 && demo.alpha === 0, "Demo bypasses compression");

        const abort = new AbortController();
        abort.abort();
        let cancelled = false;
        try { await uploadFile(api, source, "foods", abort.signal, fetcher); }
        catch (error) { cancelled = error.name === "AbortError"; }
        assert(cancelled && confirmed.length === 3, "Cancelled image was uploaded");
        let rejected = false;
        try { await uploadFiles(api, [small, new File(["broken"], "bad.png", { type: "image/png" })], "foods", undefined, fetcher); }
        catch (error) { rejected = error.message.includes("图片读取失败"); }
        assert(rejected && signed.length === 3 && sent.length === 3, "Invalid batch requested signatures or uploaded originals");
        assert(activeUrls.size === 0, "Image object URLs were leaked");
        return { engine, originalBytes: source.size, ordinary, avatar, camera, fallback, demo, uploads: sent.length, checks: ["small images", "alpha", "EXIF orientation", "unsupported WebP fallback", "matching presign/PUT metadata", "single and batch", "demo comments", "cancellation", "corrupt batch rejection", "URL cleanup"] };
      } finally {
        canvas.width = canvas.height = 0;
        URL.createObjectURL = nativeCreate;
        URL.revokeObjectURL = nativeRevoke;
      }
    }, engine);
  } finally { await context.close(); }
}
