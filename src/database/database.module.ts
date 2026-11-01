import { Global, Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { ConfigService } from '@nestjs/config';
import { Env } from '@/config/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DrizzleModule } from '@nestjs/drizzle';

/**
 * Exposes {@link TransactionService} application-wide once imported after
 * `DrizzleModule`.
 */
@Global()
@Module({
  imports: [
    // The Drizzle database, on a pg pool the module closes when the application shuts down.
    // Migrations run here only when DB_MIGRATE_ON_BOOT=true; otherwise use `pnpm db:migrate`.
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService<Env, true>) => {
        const connection: string = config.get('DATABASE_URL');
        const db = drizzle(connection, {});
        if (config.get('DB_MIGRATE_ON_BOOT')) {
          await migrate(db, { migrationsFolder: './drizzle' });
        }
        return {
          db,
        };
      },
    }),
  ],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class DatabaseModule {}
