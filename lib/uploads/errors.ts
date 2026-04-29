export class UploadError extends Error {
  readonly code: string;
  readonly recoverable: boolean;

  constructor(message: string, opts: { code: string; recoverable: boolean }) {
    super(message);
    this.code = opts.code;
    this.recoverable = opts.recoverable;
  }
}

export function isUploadError(err: unknown): err is UploadError {
  return err instanceof UploadError;
}
