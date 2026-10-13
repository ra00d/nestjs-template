/** Minimal request shape; Fastify and Express both satisfy it. */
export interface ClientRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

/**
 * Best-effort client IP: first entry of `x-forwarded-for` (set by the
 * load balancer), else the socket address. Only trust the header behind a
 * proxy you control — otherwise clients can spoof it.
 */
export function getClientIp(req: ClientRequest): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded)
    ? forwarded[0]?.split(',')[0]?.trim()
    : forwarded?.split(',')[0]?.trim();
  if (first) return first;
  if (req.ip) return req.ip;
  return req.socket?.remoteAddress ?? 'unknown';
}

/** Raw `User-Agent`, or `'unknown'` when absent (bots, health probes). */
export function getUserAgent(
  req: Pick<ClientRequest, 'headers'>,
): string {
  const header = req.headers?.['user-agent'];
  const value = Array.isArray(header) ? header[0] : header;
  return value && value.length > 0 ? value : 'unknown';
}
