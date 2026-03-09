import { Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ImportsService } from './imports.service';

@Controller('imports')
@UseGuards(AuthGuard('jwt'))
export class ImportsController {
  constructor(private imports: ImportsService) {}

  @Post('xlsx')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.imports.importWorkbook({
      buffer: file.buffer,
      fileName: file.originalname,
      companyId: req.user.companyId,
      userId: req.user.sub
    });
  }
}
