/** Token for `LoggerModule.forRoot()` options. */
export const LOGGER_OPTIONS = Symbol('LOGGER_OPTIONS');

export interface CustomLoggerOptions {
  /**
   * Overrides `LOG_LEVEL`. Same vocabulary (`trace`…`fatal`, `silent`),
   * so a later pino integration keeps working unchanged.
   */
  level?: string;
  /**
   * Field names stripped from logged objects. Replaces
   * `DEFAULT_SENSITIVE_FIELDS` (compared case-insensitively, as a
   * substring: `'password'` also catches `passwordHash`).
   */
  sensitiveFields?: readonly string[];
  /** Turn the automatic stripping off. Default `true`. */
  redact?: boolean;
}
