export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogMessage = {
  level: LogLevel;
  message: string;
  time?: Date;
  extras?: Record<string, any>;
};

export class Logger {
  private levels: LogLevel[];
  constructor(levels: LogLevel[]) {
    this.levels = levels;
  }

  log = (
    level: LogLevel,
    message: string,
    extras?: object,
    flushImmediately?: boolean
  ): void => {
    if (this.levels.includes(level)) {
      console.log(level, message, extras);
    }
  };
}
