export class AuthorizationError extends Error {
  readonly status: 401 | 403 | 409;
  readonly challenge?: string;
  readonly code?: string;
  constructor(
    message: string,
    {
      cause,
      code,
      chalange: challenge,
    }: { cause?: any; code?: any; chalange?: any },
  ) {
    super(message, cause === undefined ? undefined : { cause });
    /**
     * 401, or 409 for `MfaAlreadyEnrolledError`: the caller's fault, not an
     * outage, so other packages classify it without importing this class
     * (`@nestjs/resilience` neither retries it nor counts it against a
     * circuit breaker).
     */
    this.status = 401;
    this.name = new.target.name;
    if (challenge !== undefined) {
      this.challenge = challenge;
    }
    if (code !== undefined) {
      this.code = code;
    }
  }
}
