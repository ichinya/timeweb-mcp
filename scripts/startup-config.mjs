export const timeoutVariable = "TIMEWEB_SMOKE_START_TIMEOUT_MS";

export function readStartupTimeout(value) {
  if (value === undefined) return { timeoutMs: 5_000 };
  if (typeof value === "string" && value.length > 0 && !/[^0-9]/.test(value)) {
    const timeoutMs = Number(value);
    if (Number.isSafeInteger(timeoutMs) && timeoutMs >= 1_000 && timeoutMs <= 30_000) return { timeoutMs };
  }
  return { status: "configuration_error", variable: timeoutVariable,
    message: "Expected an ASCII decimal integer from 1000 to 30000 milliseconds." };
}
