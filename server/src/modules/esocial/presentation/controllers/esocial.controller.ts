import { Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { EsocialService } from '../../application/services/esocial.service';
import { ImportEsocialXmlDto } from '../dtos/import-esocial-xml.dto';
import { QueryEsocialDocumentsDto } from '../dtos/query-esocial-documents.dto';
import { QueryEsocialOccurrencesDto } from '../dtos/query-esocial-occurrences.dto';
import { SyncEsocialCatalogDto } from '../dtos/sync-esocial-catalog.dto';

@Controller('esocial')
@UseGuards(AuthGuard('jwt'))
export class EsocialController {
  constructor(private readonly service: EsocialService) {}

  @Post('xml/import')
  @UseInterceptors(FileInterceptor('file'))
  async importXml(
    @Body() dto: ImportEsocialXmlDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.service.importXml({
      dto,
      file,
      companyId: req.user.companyId,
      userId: req.user.sub
    });
  }

  @Get('documents')
  async listDocuments(
    @Query() query: QueryEsocialDocumentsDto,
    @Req() req: { user: { companyId: string } }
  ) {
    return this.service.listDocuments(req.user.companyId, query);
  }

  @Get('documents/:id')
  async getDocument(
    @Param('id') id: string,
    @Req() req: { user: { companyId: string } }
  ) {
    return this.service.getDocument(req.user.companyId, id);
  }

  @Get('documents/:id/occurrences')
  async listDocumentOccurrences(
    @Param('id') id: string,
    @Req() req: { user: { companyId: string } }
  ) {
    return this.service.listDocumentOccurrences(req.user.companyId, id);
  }

  @Get('occurrences')
  async listOccurrences(
    @Query() query: QueryEsocialOccurrencesDto,
    @Req() req: { user: { companyId: string } }
  ) {
    return this.service.listOccurrences(req.user.companyId, query);
  }

  @Post('catalog/sync')
  async syncCatalog(@Body() body: SyncEsocialCatalogDto) {
    return this.service.syncCatalog(body.messages);
  }
}
