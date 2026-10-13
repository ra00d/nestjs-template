import { StreamableFile } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor.js';

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor();
  const context = {} as never;
  const handle = (body: unknown) => ({ handle: () => of(body) }) as never;

  const intercept = (body: unknown) =>
    lastValueFrom(interceptor.intercept(context, handle(body)));

  it('wraps a plain object as { data }', async () => {
    await expect(intercept({ id: 1 })).resolves.toEqual({
      data: { id: 1 },
    });
  });

  it('passes paginated { data, meta } results through untouched', async () => {
    const page = { data: [1, 2], meta: { page: 1 } };
    await expect(intercept(page)).resolves.toBe(page);
  });

  it.each([undefined, null, 'Hello World!'])(
    'passes %p through untouched',
    async (body) => {
      await expect(intercept(body)).resolves.toBe(body);
    },
  );

  it('passes files and buffers through untouched', async () => {
    const file = new StreamableFile(Buffer.from('bytes'));
    await expect(intercept(file)).resolves.toBe(file);
    const buffer = Buffer.from('bytes');
    await expect(intercept(buffer)).resolves.toBe(buffer);
  });

  it('wraps arrays as { data }', async () => {
    await expect(intercept([1, 2])).resolves.toEqual({ data: [1, 2] });
  });
});
