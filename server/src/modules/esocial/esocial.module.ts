import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EsocialController } from './presentation/controllers/esocial.controller';
import { EsocialService } from './application/services/esocial.service';
import { EsocialMessageCatalogService } from './application/services/esocial-message-catalog.service';
import { EsocialRepository } from './infrastructure/repositories/esocial.repository';
import { ParseEsocialXmlService } from './infrastructure/parsers/parse-esocial-xml';
import { FastXmlParserAdapter } from './infrastructure/parsers/fast-xml-parser.adapter';
import { NormalizeEsocialDocumentService } from './infrastructure/parsers/normalize-esocial-document';
import { ValidateEsocialXsdService } from './infrastructure/parsers/validate-esocial-xsd';

@Module({
  imports: [AuditModule],
  controllers: [EsocialController],
  providers: [
    EsocialService,
    EsocialMessageCatalogService,
    EsocialRepository,
    ParseEsocialXmlService,
    NormalizeEsocialDocumentService,
    ValidateEsocialXsdService,
    {
      provide: 'XML_PARSER_ADAPTER',
      useClass: FastXmlParserAdapter
    }
  ]
})
export class EsocialModule {}
