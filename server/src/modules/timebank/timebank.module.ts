import { Module } from '@nestjs/common';
import { TimeBankService } from './timebank.service';
import { TimeBankController } from './timebank.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TimeBankController],
  providers: [TimeBankService]
})
export class TimeBankModule {}
