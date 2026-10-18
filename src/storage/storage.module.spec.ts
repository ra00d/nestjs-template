import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { Storage } from '@nestjs/storage';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { envSchema } from '../config/env';
import { StorageModule } from './storage.module';

const readBody = async (body: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

describe('StorageModule (local disk)', () => {
  let module: TestingModule;
  let storage: Storage;
  let dir: string;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'storage-'));
    savedEnv = {};
    const vars: Record<string, string> = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://localhost:5432/test',
      JWT_SECRET: 'test-secret-32-chars-minimum-ok!',
      SESSION_SECRET: 'test-secret-32-chars-minimum-ok!',
      SESSION_SALT: 'test-salt',
      STORAGE_DRIVER: 'local',
      STORAGE_DIR: dir,
    };
    for (const [key, value] of Object.entries(vars)) {
      savedEnv[key] = process.env[key];
      process.env[key] = value;
    }
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validationSchema: envSchema,
        }),
        StorageModule.forRoot(),
      ],
    }).compile();
    storage = module.get(Storage);
  });

  afterEach(async () => {
    await module?.close();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(dir, { recursive: true, force: true });
  });

  it('resolves the configured uploads disk', () => {
    expect(storage.names()).toEqual(['uploads']);
    expect(storage.defaultDisk).toBe('uploads');
  });

  it('round-trips a file through put/get/delete', async () => {
    const disk = storage.disk();
    await disk.put('hello.txt', Buffer.from('hello storage'));
    const download = await disk.get('hello.txt');
    await expect(readBody(download.body)).resolves.toBe('hello storage');
    await disk.delete('hello.txt');
    await expect(disk.get('hello.txt')).rejects.toThrow();
  });
});
