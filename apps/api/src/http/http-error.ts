import type { ErrorCode } from '@streamsync/shared';

/**
 * An error that carries an HTTP status and a stable, machine-readable code.
 * The Express error handler turns it into `{ code, message }` JSON.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
