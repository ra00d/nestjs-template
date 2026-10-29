/** Resolves after `ms` milliseconds; the `setTimeout` you can `await`. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  /** Total attempts including the first (`3` = 1 try + 2 retries). */
  attempts?: number;
  /** Base delay between attempts, ms; grows by `factor` each retry. */
  delayMs?: number;
  /** Backoff multiplier (`2` = exponential). Jitter (±25%) always applies. */
  factor?: number;
  /** Ceiling for any single delay, ms. */
  maxDelayMs?: number;
  /** Return `false` for errors that must not retry (e.g. 4xx). */
  retryIf?: (error: unknown, attempt: number) => boolean;
}

/**
 * Retries `fn` with exponential backoff + jitter (thundering-herd safe).
 * Rethrows the last error when attempts run out or `retryIf` declines.
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    attempts = 3,
    delayMs = 200,
    factor = 2,
    maxDelayMs = 10_000,
    retryIf = () => true,
  } = options;
  if (attempts < 1) throw new RangeError('attempts must be >= 1');
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !retryIf(error, attempt)) throw error;
      const backoff = Math.min(delayMs * factor ** (attempt - 1), maxDelayMs);
      await sleep(backoff * (0.75 + Math.random() / 2));
    }
  }
}

/**
 * Races `promise` against `ms`: rejects with `onTimeout()` (default
 * `Error('operation timed out')`) when the deadline hits first. For HTTP
 * handlers prefer the global `TimeoutInterceptor` (408s); this is for
 * jobs, scripts, and startup probes.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => Error = () => new Error('operation timed out'),
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
