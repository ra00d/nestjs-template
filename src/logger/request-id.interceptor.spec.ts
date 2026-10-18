import { of } from 'rxjs';
import { AppLogger } from './logger.service';
import { RequestIdInterceptor } from './request-id.interceptor';
import { getRequestContext } from './request-context';

describe('RequestIdInterceptor', () => {
  const silentLogger = { log: () => {}, warn: () => {} } as unknown as AppLogger;
  const interceptor = new RequestIdInterceptor(silentLogger);
  const contextFor = (request: unknown, reply: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
    }) as never;

  const run = (request: unknown, reply: unknown, body: unknown = 'ok') =>
    new Promise<unknown>((resolve, reject) => {
      let seen: string | undefined;
      const handler = {
        handle: () => {
          seen = getRequestContext()?.reqId;
          return of(body);
        },
      } as never;
      interceptor.intercept(contextFor(request, reply), handler).subscribe({
        next: (value) => resolve({ value, seen }),
        error: reject,
      });
    });

  it('uses Fastify request.id and echoes it', async () => {
    const headers: Record<string, string> = {};
    await expect(
      run({ id: 'req-9', headers }, { header: (n: string, v: string) => (headers[n] = v) }),
    ).resolves.toEqual({ value: 'ok', seen: 'req-9' });
    expect(headers['x-request-id']).toBe('req-9');
  });

  it('honors a client-sent x-request-id without a server id', async () => {
    const headers: Record<string, string> = {};
    await expect(
      run(
        { headers: { 'x-request-id': 'client-1' } },
        { header: (n: string, v: string) => (headers[n] = v) },
      ),
    ).resolves.toEqual({ value: 'ok', seen: 'client-1' });
    expect(headers['x-request-id']).toBe('client-1');
  });

  it('generates a UUID when nothing identifies the request', async () => {
    const seen = (
      (await run({ headers: {} }, {})) as { seen: string }
    ).seen;
    expect(seen).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('logs one access line with method, url and status', async () => {
    const calls: string[] = [];
    const probe = new RequestIdInterceptor({
      log: (message: unknown) => {
        calls.push(String(message));
      },
      warn: () => {},
    } as unknown as AppLogger);
    const reply = { statusCode: 200 };
    await new Promise<unknown>((resolve, reject) => {
      probe
        .intercept(
          contextFor(
            { id: 'req-1', method: 'GET', url: '/items?page=2' },
            reply,
          ),
          { handle: () => of('ok') } as never,
        )
        .subscribe({ next: resolve, error: reject });
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^GET \/items 200 \d+ms$/);
  });

  it('skips the access line for the health probe', async () => {
    const calls: string[] = [];
    const probe = new RequestIdInterceptor({
      log: (message: unknown) => {
        calls.push(String(message));
      },
      warn: () => {},
    } as unknown as AppLogger);
    await new Promise<unknown>((resolve, reject) => {
      probe
        .intercept(
          contextFor(
            { id: 'req-1', method: 'GET', url: '/health' },
            { statusCode: 200 },
          ),
          { handle: () => of('ok') } as never,
        )
        .subscribe({ next: resolve, error: reject });
    });
    expect(calls).toHaveLength(0);
  });
});
