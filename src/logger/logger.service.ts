import {
  Inject,
  Injectable,
  Optional,
  type LoggerService,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { DEFAULT_SENSITIVE_FIELDS, redactSensitive } from '../utils/redact.js';
import { getRequestContext } from './request-context.js';
import { LOGGER_OPTIONS, type CustomLoggerOptions } from './logger.options.js';

const LEVELS = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'] as const;
type Level = (typeof LEVELS)[number];

/**
 * Maps the `LOG_LEVEL` env (pino-compatible, so a later pino integration
 * needs no config change) onto Nest levels. `silent` disables everything.
 */
function parseLevel(raw: string): Level | null {
  switch (raw) {
    case 'trace':
      return 'verbose';
    case 'debug':
      return 'debug';
    case 'info':
      return 'log';
    case 'warn':
      return 'warn';
    case 'error':
      return 'error';
    case 'fatal':
      return 'fatal';
    case 'silent':
      return null;
    default:
      throw new Error(
        `invalid LOG_LEVEL '${raw}': expected trace, debug, info, warn, error, fatal or silent`,
      );
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * The application's logger (`app.useLogger()` in `main.ts`, so `new
 * Logger()` in filters and services lands here too).
 *
 * Every plain object or array passed in is deep-cloned with sensitive
 * fields (`password`, `pinCode`, `token`, … — see `DEFAULT_SENSITIVE_FIELDS`)
 * replaced by `'[Redacted]'`, so `logger.log({ body })` can never leak a
 * secret. `Error`s keep their stack, class instances pass through, the
 * input is never mutated. Disable per application with
 * `LoggerModule.forRoot({ redact: false })`, not per call.
 */
@Injectable()
export class AppLogger implements LoggerService {
  private readonly minIndex: number;
  private readonly fields: readonly string[];
  private readonly redact: boolean;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Optional() @Inject(LOGGER_OPTIONS) options?: CustomLoggerOptions,
  ) {
    const envLevel: string = config.get('LOG_LEVEL');
    const level = parseLevel(options?.level ?? envLevel);
    this.minIndex = level === null ? Number.POSITIVE_INFINITY : LEVELS.indexOf(level);
    this.fields = options?.sensitiveFields ?? DEFAULT_SENSITIVE_FIELDS;
    this.redact = options?.redact ?? true;
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.write('verbose', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.write('debug', message, params);
  }

  log(message: unknown, ...params: unknown[]): void {
    this.write('log', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.write('warn', message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    this.write('error', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.write('fatal', message, params);
  }

  private write(level: Level, message: unknown, params: unknown[]): void {
    if (LEVELS.indexOf(level) < this.minIndex) return;
    const rest = [...params];
    // Nest convention: a trailing string is the context (`new Logger('Ctx')`).
    const context =
      rest.length > 0 && typeof rest[rest.length - 1] === 'string'
        ? (rest.pop() as string)
        : undefined;
    const segments = [this.format(message), ...rest.map((param) => this.format(param))].filter(
      (segment) => segment.length > 0,
    );
    const reqId = getRequestContext()?.reqId;
    const line =
      `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(7)}` +
      (context ? ` [${context}]` : '') +
      (reqId ? ` [${reqId}]` : '') +
      (segments.length > 0 ? ` ${segments.join(' ')}` : '');
    if (level === 'error' || level === 'fatal' || level === 'warn') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }

  private format(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    if (value === null || value === undefined) return '';
    if (value instanceof Error) {
      return value.stack ?? `${value.name}: ${value.message}`;
    }
    const safe =
      this.redact && (isPlainObject(value) || Array.isArray(value))
        ? redactSensitive(value, { fields: [...this.fields], replaceDefaults: true })
        : value;
    if (typeof safe === 'object') {
      try {
        return JSON.stringify(safe) ?? '[Unserializable]';
      } catch {
        return '[Unserializable]';
      }
    }
    // Symbols and functions reach here; both stringify meaningfully.
    return String(safe as symbol | ((...args: never[]) => unknown));
  }
}
