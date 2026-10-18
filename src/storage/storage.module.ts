import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LocalDisk,
  S3Disk,
  StorageModule as VendorStorageModule,
} from '@nestjs/storage';
import type { Env } from '../config/env';

/**
 * File storage, driven by env: a local disk (`STORAGE_DIR`, created at
 * startup) by default, S3-compatible when `STORAGE_DRIVER=s3`.
 *
 * Inject the default disk with `Storage` from `@nestjs/storage`
 * (`storage.put(key, body)`, `storage.get(key)`, `storage.url(key)`), or
 * a named disk with `@InjectDisk('uploads')`. The disk is global, like
 * the cache and Redis store.
 */
@Module({})
export class StorageModule {
  static forRoot() {
    return VendorStorageModule.forRootAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        default: 'uploads',
        disks: { uploads: buildDisk(config) },
      }),
    });
  }
}

function buildDisk(config: ConfigService<Env, true>) {
  if (config.get('STORAGE_DRIVER') !== 's3') {
    const dir: string = config.get('STORAGE_DIR');
    return new LocalDisk({ root: dir });
  }
  const bucket: string | undefined = config.get('S3_BUCKET');
  if (!bucket) {
    throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
  }
  return new S3Disk({
    bucket,
    region: config.get('S3_REGION') ?? undefined,
    endpoint: config.get('S3_ENDPOINT') ?? undefined,
    forcePathStyle: true,
    credentials: buildCredentials(config),
  });
}

function buildCredentials(config: ConfigService<Env, true>) {
  const accessKeyId: string | undefined =
    config.get('S3_ACCESS_KEY_ID') ?? undefined;
  const secretAccessKey: string | undefined =
    config.get('S3_SECRET_ACCESS_KEY') ?? undefined;
  // Absent, and the SDK falls back to its default chain (env, IRSA, SSO).
  if (!accessKeyId || !secretAccessKey) return undefined;
  return { accessKeyId, secretAccessKey };
}
