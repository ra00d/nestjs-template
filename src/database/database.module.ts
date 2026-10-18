import { Global, Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';

/**
 * Exposes {@link TransactionService} application-wide once imported after
 * `DrizzleModule`.
 */
@Global()
@Module({
  providers: [TransactionService],
  exports: [TransactionService],
})
export class DatabaseModule {}
