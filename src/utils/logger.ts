type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  level: LogLevel;
  message: string;
  timestamp?: string;
  requestId?: string;
  [key: string]: unknown;
};

const format = (payload: LogPayload): string => {
  const { level, message, ...rest } = payload;
  return JSON.stringify({
    level,
    message,
    ...rest,
  });
};

const withTimestamp = (payload: Partial<LogPayload>): LogPayload => ({
  level: payload.level || "info",
  message: payload.message || "",
  timestamp: payload.timestamp || new Date().toISOString(),
  ...payload,
});

export const logger = {
  info(data: Partial<LogPayload>): void {
    console.log(format(withTimestamp({ level: "info", ...data })));
  },
  warn(data: Partial<LogPayload>): void {
    console.warn(format(withTimestamp({ level: "warn", ...data })));
  },
  error(data: Partial<LogPayload>): void {
    console.error(format(withTimestamp({ level: "error", ...data })));
  },
};

