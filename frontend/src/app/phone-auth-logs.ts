type PhoneAuthEvent = "phone_auth_timing" | "phone_auth_error";
export type PhoneAuthLog = Readonly<{
  timestamp: string;
  event: PhoneAuthEvent;
  data: Readonly<Record<string, unknown>>;
}>;

// Only sanitized diagnostics from web-one-click.ts belong here. Do not intercept
// console output: SDK messages and unrelated application logs can hold secrets.
let entries: readonly PhoneAuthLog[] = [];
const listeners = new Set<() => void>();

export const phoneAuthLogs = {
  getSnapshot: () => entries,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  clear() {
    entries = [];
    listeners.forEach((listener) => listener());
  },
};

export function recordPhoneAuthLog(
  event: PhoneAuthEvent,
  data: Readonly<Record<string, unknown>>,
) {
  // Keep the last 100 entries in this tab's memory; refreshing clears them.
  entries = [
    ...entries.slice(-99),
    {
      timestamp: new Date().toISOString(),
      event,
      data,
    },
  ];
  listeners.forEach((listener) => listener());
  if (event === "phone_auth_error") console.warn(event, data);
  else console.info(event, data);
}
