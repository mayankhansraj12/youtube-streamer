export type OriginCallback = (error: Error | null, allow?: boolean) => void;

/**
 * Allows browser requests from the configured origins. Requests without an
 * Origin header (curl, health probes, server-to-server calls) are not CORS
 * requests, so they are always accepted.
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  return !origin || allowedOrigins.includes(origin);
}

export function createCorsOriginCheck(allowedOrigins: readonly string[]) {
  return (origin: string | undefined, callback: OriginCallback) =>
    callback(null, isOriginAllowed(origin, allowedOrigins));
}
