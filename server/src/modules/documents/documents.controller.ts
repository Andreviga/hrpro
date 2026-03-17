import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  Res,
  UseInterceptors,
  UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOkResponse, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Response } from 'express';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  @Get('templates')
  @Roles('admin', 'rh', 'manager')
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'includeDeleted', required: false })
  async listTemplates(
    @Query() query: { type?: string; status?: string; includeDeleted?: string },
    @Req() req: { user: { companyId: string } }
  ) {
    return this.documents.listTemplates(req.user.companyId, {
      type: query.type,
      status: query.status,
      includeDeleted: query.includeDeleted === 'true'
    });
  }

  @Post('templates/bootstrap/informe-rendimentos')
  @Roles('admin', 'rh', 'manager')
  async bootstrapIncomeStatementTemplate(
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.documents.ensureIncomeStatementTemplate({
      companyId: req.user.companyId,
      userId: req.user.sub,
      reason: body?.reason
    });
  }

  @Get('templates/:id')
  @Roles('admin', 'rh', 'manager')
  async getTemplate(
    @Param('id') id: string,
    @Query() query: { includeDeleted?: string },
    @Req() req: { user: { companyId: string } }
  ) {
    return this.documents.getTemplate(id, req.user.companyId, query.includeDeleted === 'true');
  }

  @Get('templates/:id/versions')
  @Roles('admin', 'rh', 'manager')
  async listTemplateVersions(@Param('id') id: string, @Req() req: { user: { companyId: string } }) {
    return this.documents.listTemplateVersions(id, req.user.companyId);
  }

  @Post('templates')
  @Roles('admin', 'rh', 'manager')
  async createTemplate(
    @Body()
    body: {
      type: string;
      name: string;
      description?: string;
      content: string;
      status?: string;
      requiredPlaceholders?: string[];
      reason?: string;
    },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.documents.createTemplate({
      companyId: req.user.companyId,
      userId: req.user.sub,
      type: body.type,
      name: body.name,
      description: body.description,
      content: body.content,
      status: body.status as any,
      requiredPlaceholders: body.requiredPlaceholders,
      reason: body.reason
    });
  }

  @Patch('templates/:id')
  @Roles('admin', 'rh', 'manager')
  async updateTemplate(
    @Param('id') id: string,
    @Body() body: { reason?: string } & Record<string, any>,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.documents.updateTemplate(id, {
      ...body,
      companyId: req.user.companyId,
      userId: req.user.sub
    });
  }

  @Delete('templates/:id')
  @Roles('admin', 'rh', 'manager')
  async deleteTemplate(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.documents.softDeleteTemplate(id, req.user.companyId, req.user.sub, body?.reason);
  }

  @Post('templates/:id/restore')
  @Roles('admin', 'rh', 'manager')
  async restoreTemplate(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.documents.restoreTemplate(id, req.user.companyId, req.user.sub, body?.reason);
  }

  @Get()
  @Roles('admin', 'rh', 'manager', 'employee', 'intern')
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  async listDocuments(
    @Query() query: { employeeId?: string; month?: string; year?: string; type?: string; status?: string },
    @Req() req: { user: { companyId: string; sub: string; role: string } }
  ) {
    return this.documents.listDocuments(
      req.user.companyId,
      {
        employeeId: query.employeeId,
        month: query.month ? Number(query.month) : undefined,
        year: query.year ? Number(query.year) : undefined,
        type: query.type,
        status: query.status
      },
      req.user.sub,
      req.user.role
    );
  }

  @Get('my')
  @Roles('admin', 'rh', 'manager', 'employee', 'intern')
  @ApiQuery({ name: 'type', required: false })
  async listMyDocuments(
    @Query() query: { type?: string },
    @Req() req: { user: { sub: string } }
  ) {
    return this.documents.listUserDocuments(req.user.sub, query.type);
  }

  @Get('users/:userId')
  @Roles('admin', 'rh', 'manager')
  @ApiQuery({ name: 'type', required: false })
  async listDocumentsByUser(
    @Param('userId') userId: string,
    @Query() query: { type?: string }
  ) {
    return this.documents.listUserDocuments(userId, query.type);
  }

  @Post('employee/:employeeId/upload')
  @Roles('admin', 'rh', 'manager')
  @UseInterceptors(FileInterceptor('file'))
  async uploadEmployeeDocument(
    @Param('employeeId') employeeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      category?: string;
      layoutHint?: string;
      title?: string;
      month?: string;
      year?: string;
      reason?: string;
    },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.documents.uploadEmployeeDocumentFile({
      companyId: req.user.companyId,
      userId: req.user.sub,
      employeeId,
      file,
      category: body.category,
      layoutHint: body.layoutHint,
      title: body.title,
      month: body.month ? Number(body.month) : undefined,
      year: body.year ? Number(body.year) : undefined,
      reason: body.reason
    });
  }

  @Post('employee/:employeeId/import-folder')
  @Roles('admin', 'rh', 'manager')
  async importEmployeeDocumentsFromFolder(
    @Param('employeeId') employeeId: string,
    @Body() body: { folderPath?: string; category?: string; layoutHint?: string; reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.documents.importEmployeeDocumentsFromFolder({
      companyId: req.user.companyId,
      userId: req.user.sub,
      employeeId,
      folderPath: body.folderPath,
      category: body.category,
      layoutHint: body.layoutHint,
      reason: body.reason
    });
  }

  @Get(':id/file')
  @Roles('admin', 'rh', 'manager', 'employee', 'intern')
  async exportOriginalFile(
    @Param('id') id: string,
    @Req() req: { user: { companyId: string; sub: string; role: string } },
    @Res() res: Response
  ) {
    const result = await this.documents.exportOriginalDocumentFile({
      id,
      companyId: req.user.companyId,
      userId: req.user.sub,
      role: req.user.role
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  }

  @Get(':id')
  @Roles('admin', 'rh', 'manager', 'employee', 'intern')
  async getDocument(
    @Param('id') id: string,
    @Req() req: { user: { companyId: string; sub: string; role: string } }
  ) {
    return this.documents.getDocumentForUser(id, req.user.companyId, req.user.sub, req.user.role);
  }

  @Get(':id/versions')
  @Roles('admin', 'rh', 'manager')
  async listDocumentVersions(@Param('id') id: string, @Req() req: { user: { companyId: string } }) {
    return this.documents.listDocumentVersions(id, req.user.companyId);
  }

  @Post()
  @Roles('admin', 'rh', 'manager')
  async createDocument(
    @Body()
    body: {
      templateId: string;
      employeeId: string;
      title?: string;
      placeholders: Record<string, string>;
      month?: number;
      year?: number;
      eventDate?: string;
      reason?: string;
    },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.documents.createDocumentFromTemplate({
      companyId: req.user.companyId,
      userId: req.user.sub,
      employeeId: body.employeeId,
      templateId: body.templateId,
      title: body.title,
      placeholders: body.placeholders ?? {},
      month: body.month,
      year: body.year,
      eventDate: body.eventDate,
      reason: body.reason
    });
  }

  @Patch(':id')
  @Roles('admin', 'rh', 'manager')
  async updateDocument(
    @Param('id') id: string,
    @Body() body: { reason?: string } & Record<string, any>,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.documents.updateDocument(id, {
      ...body,
      companyId: req.user.companyId,
      userId: req.user.sub
    });
  }

  @Post(':id/status')
  @Roles('admin', 'rh', 'manager')
  async changeStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
    @Req() req: { user: { companyId: string; sub: string; role: string } }
  ) {
    return this.documents.transitionStatus({
      documentId: id,
      companyId: req.user.companyId,
      userId: req.user.sub,
      role: req.user.role,
      status: body.status as any,
      reason: body.reason
    });
  }

  @Post(':id/reopen')
  @Roles('admin', 'rh', 'manager')
  async reopen(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string; role: string } }
  ) {
    return this.documents.transitionStatus({
      documentId: id,
      companyId: req.user.companyId,
      userId: req.user.sub,
      role: req.user.role,
      status: 'reopened',
      reason: body.reason
    });
  }

  @Post(':id/sign')
  @Roles('admin', 'rh', 'manager', 'employee', 'intern')
  async sign(
    @Param('id') id: string,
    @Body()
    body: {
      signatureType: 'digital' | 'token' | 'biometric';
      tokenHash?: string;
      ipAddress?: string;
      deviceInfo?: string;
      employeeId?: string;
      reason?: string;
    },
    @Req() req: { user: { companyId: string; sub: string; role: string } }
  ) {
    return this.documents.signDocument({
      documentId: id,
      companyId: req.user.companyId,
      userId: req.user.sub,
      role: req.user.role,
      employeeId: body.employeeId,
      signatureType: body.signatureType,
      tokenHash: body.tokenHash,
      ipAddress: body.ipAddress,
      deviceInfo: body.deviceInfo,
      reason: body.reason
    });
  }

  @Get(':id/export')
  @Roles('admin', 'rh', 'manager', 'employee', 'intern')
  async exportDocument(
    @Param('id') id: string,
    @Req() req: { user: { companyId: string; sub: string; role: string } }
  ) {
    return this.documents.exportDocumentPayload(id, req.user.companyId, req.user.sub, req.user.role);
  }

  @Get(':id/export/pdf')
  @Roles('admin', 'rh', 'manager', 'employee', 'intern')
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Arquivo PDF do documento',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
        examples: { sample: { summary: 'PDF', value: 'binary' } }
      }
    }
  })
  async exportDocumentPdf(
    @Param('id') id: string,
    @Req() req: { user: { companyId: string; sub: string; role: string } },
    @Res() res: Response
  ) {
    const result = await this.documents.exportDocumentFile({
      id,
      companyId: req.user.companyId,
      userId: req.user.sub,
      role: req.user.role,
      format: 'pdf'
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  }

  @Get(':id/export/docx')
  @Roles('admin', 'rh', 'manager', 'employee', 'intern')
  @ApiProduces('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  @ApiOkResponse({
    description: 'Arquivo DOCX do documento',
    content: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        schema: { type: 'string', format: 'binary' },
        examples: { sample: { summary: 'DOCX', value: 'binary' } }
      }
    }
  })
  async exportDocumentDocx(
    @Param('id') id: string,
    @Req() req: { user: { companyId: string; sub: string; role: string } },
    @Res() res: Response
  ) {
    const result = await this.documents.exportDocumentFile({
      id,
      companyId: req.user.companyId,
      userId: req.user.sub,
      role: req.user.role,
      format: 'docx'
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  }
}
