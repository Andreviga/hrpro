import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { TaxTablesController } from './tax-tables.controller';
import { TaxTablesService } from './tax-tables.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [TaxTablesController],
  providers: [TaxTablesService],
  exports: [TaxTablesService],
})
export class TaxTablesModule {}
