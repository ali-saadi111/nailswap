/** Structured JSON logger (stdout) — Vercel/Sentry pick these up as searchable fields. */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ level, msg, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") emit("debug", msg, fields);
  },
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
