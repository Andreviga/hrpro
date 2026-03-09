import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [AuditModule, DocumentsModule],
  providers: [PayrollService],
  controllers: [PayrollController],
  exports: [PayrollService]
})
export class PayrollModule {}
