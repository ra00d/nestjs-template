import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { mkdtemp, rm, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Env } from '../config/env.js';
import { TasksService } from './tasks.service.js';

describe('TasksService.cleanupUploads', () => {
  let module: TestingModule;
  let tasks: TasksService;
  let dir: string;

  const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uploads-'));
    await writeFile(join(dir, 'old.tmp'), 'stale');
    await utimes(join(dir, 'old.tmp'), past, past);
    await writeFile(join(dir, 'fresh.tmp'), 'new');

    module = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: keyof Env) =>
              key === 'UPLOAD_DIR' ? dir : key === 'UPLOAD_MAX_AGE_DAYS' ? 7 : undefined,
          },
        },
      ],
    }).compile();
    tasks = module.get(TasksService);
  });

  afterEach(async () => {
    await module.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('deletes stale staged files and keeps fresh ones', async () => {
    await expect(tasks.cleanupUploads()).resolves.toEqual({
      scanned: 2,
      deleted: 1,
    });
  });

  it('tolerates a missing directory', async () => {
    await rm(dir, { recursive: true, force: true });
    await expect(tasks.cleanupUploads()).resolves.toEqual({
      scanned: 0,
      deleted: 0,
    });
  });
});
