export type ChasmLogger = Pick<Console, "error" | "info" | "warn">;

export const logger: ChasmLogger = console;
