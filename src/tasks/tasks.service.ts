import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Env } from '../config/env.js';

/**
 * Recurring housekeeping. Cron expressions run in the server timezone —
 * pin `TZ` in production if that matters.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Nightly sweep of the multipart staging dir: files older than
   * `UPLOAD_MAX_AGE_DAYS` are orphans (completed uploads move to storage).
   * Top level only; never follows subdirectories. Missing dir is fine.
   */
  @Cron('0 3 * * *')
  async cleanupUploads(): Promise<{ scanned: number; deleted: number }> {
    const dir: string = this.config.get('UPLOAD_DIR');
    const maxAgeDays: number = this.config.get('UPLOAD_MAX_AGE_DAYS');
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    let entries;
    try {
      entries = await readdir(dir);
    } catch {
      this.logger.debug(`upload dir ${dir} missing, skipping sweep`);
      return { scanned: 0, deleted: 0 };
    }

    let scanned = 0;
    let deleted = 0;
    for (const entry of entries) {
      const path = join(dir, entry);
      let mtime: number;
      try {
        const info = await stat(path);
        if (!info.isFile()) continue;
        mtime = info.mtimeMs;
      } catch {
        continue;
      }
      scanned += 1;
      if (mtime >= cutoff) continue;
      try {
        await unlink(path);
        deleted += 1;
      } catch (error) {
        this.logger.warn(
          `upload sweep: cannot delete ${path}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.logger.log(`upload sweep: ${deleted}/${scanned} stale files deleted`);
    return { scanned, deleted };
  }
}
