import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RubricsController } from './rubrics.controller';
import { RubricsService } from './rubrics.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RubricsController],
  providers: [RubricsService],
  exports: [RubricsService],
})
export class RubricsModule {}
