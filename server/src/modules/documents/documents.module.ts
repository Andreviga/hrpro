import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AuditModule } from '../audit/audit.module';
import { PayslipDataBuilder } from './payslip-data.builder';
import { PayslipPdfService } from './payslip-pdf.service';
import { DocumentStorageService } from './document-storage.service';

@Module({
  imports: [AuditModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, PayslipDataBuilder, PayslipPdfService, DocumentStorageService],
  exports: [DocumentsService, PayslipDataBuilder, PayslipPdfService, DocumentStorageService]
})
export class DocumentsModule {}
