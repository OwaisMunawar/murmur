/**
 * Every failure the UI can react to has a code. Screens switch on the code,
 * never on message text, so copy can change without breaking behaviour.
 */
export const ErrorCodes = [
  'DB_MIGRATION_FAILED',
  'NOTE_NOT_FOUND',
  'MIC_PERMISSION_DENIED',
  'RECORDING_FAILED',
  'AUDIO_DECODE_FAILED',
  'MODEL_NOT_INSTALLED',
  'MODEL_DOWNLOAD_FAILED',
  'MODEL_DOWNLOAD_NEEDS_WIFI',
  'TRANSCRIPTION_FAILED',
  'GENERATION_FAILED',
  'ENRICHMENT_INVALID_OUTPUT',
  'EMBEDDING_FAILED',
  'CANCELLED',
  'UNKNOWN',
] as const;

export type ErrorCode = (typeof ErrorCodes)[number];

export class AppError extends Error {
  override readonly name = 'AppError';
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

export function isAppError(error: unknown, code?: ErrorCode): error is AppError {
  return error instanceof AppError && (code === undefined || error.code === code);
}

/**
 * Normalises anything thrown (native module errors arrive as plain objects or
 * strings after crossing JSI) into an AppError, keeping the original as cause.
 */
export function toAppError(error: unknown, fallback: ErrorCode, message?: string): AppError {
  if (error instanceof AppError) return error;
  const detail = error instanceof Error ? error.message : String(error);
  return new AppError(fallback, message ?? detail, { cause: error });
}
