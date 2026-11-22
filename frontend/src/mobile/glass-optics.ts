/** One rounded cross-section drives both the lens and its reflected light.
 * This is an art-directed, single-interface Snell model, not a ray tracer.
 * Distances and displacement are CSS pixels, independent of raster density.
 */
const material = {
  bezel: 13,
  crown: 24,
  base: 7,
  index: 1.5,
  magnificationX: 0.045,
  magnificationY: 0.2,
};

const lightLength = Math.hypot(-0.45, -0.7, 0.55);
const light = [-0.45 / lightLength, -0.7 / lightLength, 0.55 / lightLength];
const halfLength = Math.hypot(light[0], light[1], light[2] + 1);
const halfway = [
  light[0] / halfLength,
  light[1] / halfLength,
  (light[2] + 1) / halfLength,
];
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function sampleGlassSurface(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const radius = Math.min(width, height) / 2;
  const px = x - width / 2;
  const py = y - height / 2;
  const qx = Math.max(Math.abs(px) - (width / 2 - radius), 0);
  const qy = Math.max(Math.abs(py) - (height / 2 - radius), 0);
  const length = Math.hypot(qx, qy);
  const distance = radius - length;
  const bezel = Math.min(material.bezel, radius * 0.44);
  const position = clamp(distance / bezel);
  const arc = Math.sqrt(Math.max(0.0001, 1 - (1 - position) ** 2));
  const slope = ((material.crown / bezel) * (1 - position)) / arc;
  const normalLength = Math.hypot(slope, 1);
  const nx = ((qx / (length || 1)) * Math.sign(px) * slope) / normalLength;
  const ny = ((qy / (length || 1)) * Math.sign(py) * slope) / normalLength;
  const nz = 1 / normalLength;

  // Air -> glass, viewed head-on. Travel through the local glass thickness
  // projects the refracted ray onto the live background underneath it.
  const eta = 1 / material.index;
  const ray = eta * nz - Math.sqrt(1 - eta * eta * (1 - nz * nz));
  const travel = (material.base + material.crown * arc) / (eta - ray * nz);
  const dx = -px * material.magnificationX + ray * nx * travel;
  const dy = -py * material.magnificationY + ray * ny * travel;

  const facing = clamp(nx * light[0] + ny * light[1] + nz * light[2]);
  const specular = clamp(nx * halfway[0] + ny * halfway[1] + nz * halfway[2]);
  // A grazing reflection from the opposite side catches the outer lip.
  const returnLight = clamp(nx * 0.48 + ny * 0.8 + nz * 0.36);
  const curvature = 1 - nz;
  const rim = clamp((1 - position) * 4);
  const highlight = clamp(
    rim * (0.82 * specular ** 96 + 0.08 * specular ** 16) +
      0.64 * returnLight ** 80 +
      curvature ** 3 * (0.28 + 0.6 * facing),
  );
  const shade = curvature ** 3 * (0.06 + 0.3 * (1 - facing));
  return { dx, dy, highlight, shade, distance };
}

export function rasterizeGlass(width: number, height: number, density = 1) {
  const ratio = Math.max(1, Math.min(2, density));
  const pixelWidth = Math.ceil(width * ratio);
  const pixelHeight = Math.ceil(height * ratio);
  const count = pixelWidth * pixelHeight;
  const offsets = new Float32Array(count * 2);
  const lighting = new Uint8ClampedArray(count * 4);
  let maximum = 0;

  for (let y = 0; y < pixelHeight; y++) {
    for (let x = 0; x < pixelWidth; x++) {
      const sample = sampleGlassSurface(
        ((x + 0.5) * width) / pixelWidth,
        ((y + 0.5) * height) / pixelHeight,
        width,
        height,
      );
      const pixel = y * pixelWidth + x;
      offsets[pixel * 2] = sample.dx;
      offsets[pixel * 2 + 1] = sample.dy;
      maximum = Math.max(maximum, Math.abs(sample.dx), Math.abs(sample.dy));
      const { highlight, shade } = sample;
      const alpha = highlight + shade * (1 - highlight);
      // A warm dark return beside the white reflection reveals thickness.
      // Keep it in a separate overlay: backdrop brightness must not dim light.
      const shadowWeight = shade * (1 - highlight);
      for (let channel = 0; channel < 3; channel++) {
        lighting[pixel * 4 + channel] = alpha
          ? (255 * highlight + [35, 29, 24][channel] * shadowWeight) / alpha
          : 0;
      }
      lighting[pixel * 4 + 3] =
        255 * alpha * clamp(sample.distance * ratio + 0.5);
    }
  }

  // Fit the entire field, including wide previews, without clipping RG values.
  const scale = Math.max(1, Math.ceil(maximum + 1) * 2);
  const displacement = new Uint8ClampedArray(count * 4);
  for (let pixel = 0; pixel < count; pixel++) {
    displacement[pixel * 4] = 255 * (0.5 + offsets[pixel * 2] / scale);
    displacement[pixel * 4 + 1] = 255 * (0.5 + offsets[pixel * 2 + 1] / scale);
    displacement[pixel * 4 + 2] = 128;
    displacement[pixel * 4 + 3] = 255;
  }
  return {
    width: pixelWidth,
    height: pixelHeight,
    displacement,
    lighting,
    scale,
  };
}
