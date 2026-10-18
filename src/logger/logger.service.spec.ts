import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppLogger } from './logger.service';
import { LOGGER_OPTIONS } from './logger.options';
import { runWithRequestContext } from './request-context';

describe('AppLogger', () => {
  let stdout: ReturnType<typeof vi.spyOn>;
  let stderr: ReturnType<typeof vi.spyOn>;
  let module: TestingModule;

  const createLogger = async (env: Record<string, string> = {}, options = {}) => {
    module = await Test.createTestingModule({
      providers: [
        AppLogger,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] ?? 'info' },
        },
        { provide: LOGGER_OPTIONS, useValue: options },
      ],
    }).compile();
    return module.get(AppLogger);
  };

  beforeEach(() => {
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await module?.close();
  });

  const out = () =>
    stdout.mock.calls.map((call) => String(call[0])).join('');

  const errOut = () =>
    stderr.mock.calls.map((call) => String(call[0])).join('');

  it('strips password-like fields from logged objects', async () => {
    const logger = await createLogger();
    logger.log({ email: 'a@b.co', password: 's3cret', pinCode: '1234' });
    expect(out()).toContain('"password":"[Redacted]"');
    expect(out()).toContain('"pinCode":"[Redacted]"');
    expect(out()).toContain('"email":"a@b.co"');
    expect(out()).not.toContain('s3cret');
  });

  it('never mutates the logged object', async () => {
    const logger = await createLogger();
    const body = { password: 's3cret' };
    logger.log(body);
    expect(body).toEqual({ password: 's3cret' });
  });

  it('keeps error stacks and appends the request id', async () => {
    const logger = await createLogger();
    const error = new Error('boom');
    runWithRequestContext({ reqId: 'req-1' }, () => {
      logger.error('failed', error, 'Ctx');
    });
    const written = out() + errOut();
    expect(written).toContain('[Ctx]');
    expect(written).toContain('[req-1]');
    expect(written).toContain('boom');
  });

  it('writes errors to stderr and info to stdout', async () => {
    const logger = await createLogger();
    logger.log('hello');
    logger.error('bad');
    expect(out()).toContain('hello');
    expect(errOut()).toContain('bad');
  });

  it('filters below LOG_LEVEL and honors silent', async () => {
    const warnOnly = await createLogger({ LOG_LEVEL: 'warn' });
    warnOnly.log('hidden');
    warnOnly.warn('shown');
    expect(out()).not.toContain('hidden');
    await module.close();
    stderr.mockClear();
    stdout.mockClear();
    const silent = await createLogger({ LOG_LEVEL: 'silent' });
    silent.error('hidden too');
    expect(stderr.mock.calls).toHaveLength(0);
    expect(stdout.mock.calls).toHaveLength(0);
  });

  it('rejects an unknown level fast', async () => {
    await expect(createLogger({ LOG_LEVEL: 'nope' })).rejects.toThrow(
      "invalid LOG_LEVEL 'nope'",
    );
  });

  it('accepts a custom strip list', async () => {
    const logger = await createLogger({}, { sensitiveFields: ['internal'] });
    logger.log({ internal: 'x', password: 'p' });
    expect(out()).toContain('"internal":"[Redacted]"');
    expect(out()).toContain('"password":"p"');
  });
});
