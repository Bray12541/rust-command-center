import fs from "node:fs";
import path from "node:path";
import pino, { type Logger } from "pino";

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVES = 4;

function rotateAtStartup(logFile: string): void {
  if (!fs.existsSync(logFile) || fs.statSync(logFile).size < MAX_LOG_BYTES) return;
  for (let index = MAX_ARCHIVES - 1; index >= 1; index -= 1) {
    const source = `${logFile}.${index}`;
    const destination = `${logFile}.${index + 1}`;
    if (fs.existsSync(source)) fs.renameSync(source, destination);
  }
  fs.renameSync(logFile, `${logFile}.1`);
}

export function createLogger(userDataPath: string, isDevelopment: boolean): Logger {
  const logDirectory = path.join(userDataPath, "logs");
  fs.mkdirSync(logDirectory, { recursive: true });
  const logFile = path.join(logDirectory, "rust-command-center.log");
  rotateAtStartup(logFile);

  const streams: pino.StreamEntry[] = [
    { level: "debug", stream: pino.destination({ dest: logFile, sync: false, mkdir: true }) },
  ];
  if (isDevelopment) streams.push({ level: "debug", stream: process.stdout });

  return pino(
    {
      level: isDevelopment ? "debug" : "info",
      base: { product: "rust-command-center", pid: process.pid },
      redact: {
        paths: ["playerToken", "credentials", "token", "password", "authorization"],
        censor: "[REDACTED]",
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams),
  );
}
