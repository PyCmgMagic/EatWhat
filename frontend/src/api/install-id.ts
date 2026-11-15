/**
 * 安装 ID 与设备登记（移动端方案《设备标识与风控》，网页版这一端）。
 * 安装 ID 是首次打开时生成的 UUID v7，存在 localStorage，清除浏览器数据后重新生成；三端用同一个键关联设备。
 * 只在用户同意隐私政策后才发出去：登录、注册时随请求体发，登录后登记一次设备，档案变了再登记。
 * 网页版没有硬件标识，也取不到型号和系统版本。
 */
const INSTALL_KEY = "eatwhat.installId";
const REGISTERED_KEY = "eatwhat.deviceRegistered";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let memory: string | undefined;

/** UUID v7：48 位毫秒时间戳 + 随机数。 */
export function uuidV7(now = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let t = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = t % 256;
    t = Math.floor(t / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 读不到或不合法就重新生成；存储不可用（隐私模式）时只在本次打开内保持不变。 */
export function installId(): string {
  try {
    const saved = localStorage.getItem(INSTALL_KEY);
    if (saved && UUID.test(saved)) return saved;
    const fresh = uuidV7();
    localStorage.setItem(INSTALL_KEY, fresh);
    return fresh;
  } catch {
    return (memory ??= uuidV7());
  }
}

export interface DeviceProfile {
  installId: string;
  platform: "web";
  screenWidth?: number;
  screenHeight?: number;
  pixelRatio?: number;
}

export function deviceProfile(): DeviceProfile {
  const size = (n: unknown) =>
    typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 100_000
      ? n
      : undefined;
  const ratio =
    typeof devicePixelRatio === "number" &&
    devicePixelRatio >= 0.5 &&
    devicePixelRatio <= 10
      ? Math.round(devicePixelRatio * 1000) / 1000
      : undefined;
  return {
    installId: installId(),
    platform: "web",
    screenWidth: size(globalThis.screen?.width),
    screenHeight: size(globalThis.screen?.height),
    pixelRatio: ratio,
  };
}

type Send = (body: DeviceProfile) => Promise<unknown>;
let pending: Promise<void> | undefined;

/**
 * 登记设备：只在没登记过或档案变了时发；失败静默，下次再试。同一时刻只发一次。
 * 调用方负责只在用户同意隐私政策后调用（登录成功、同意政策、已登录打开页面）。
 */
export function registerDevice(send: Send): Promise<void> {
  if (pending) return pending;
  const run = (async () => {
    try {
      const profile = deviceProfile();
      const digest = JSON.stringify(profile);
      let last: string | null = null;
      try {
        last = localStorage.getItem(REGISTERED_KEY);
      } catch {
        /* 存储不可用时每次打开都登记，服务端按安装 ID 去重 */
      }
      if (last === digest) return;
      await send(profile);
      try {
        localStorage.setItem(REGISTERED_KEY, digest);
      } catch {
        /* 同上 */
      }
    } catch {
      /* 设备登记不影响任何功能 */
    }
  })();
  pending = run;
  // 先赋值再清理：没有要发的时候 run 会立即完成
  void run.then(() => {
    if (pending === run) pending = undefined;
  });
  return run;
}
