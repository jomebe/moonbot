export type AppErrorCode =
  | 'INVALID_GAME_ID'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'NETWORK'
  | 'PARSE_FAILED'
  | 'SERVER_ERROR'
  | 'BAD_RESPONSE';

type AppErrorOptions = {
  status?: number;
  meta?: Record<string, unknown>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number | undefined;
  readonly meta: Record<string, unknown> | undefined;

  constructor(code: AppErrorCode, message: string, options?: AppErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options?.status;
    this.meta = options?.meta;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
