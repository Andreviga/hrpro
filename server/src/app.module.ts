import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ImportsModule } from './modules/imports/imports.module';
import { TimeBankModule } from './modules/timebank/timebank.module';
import { AuditModule } from './modules/audit/audit.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { RubricsModule } from './modules/rubrics/rubrics.module';
import { TaxTablesModule } from './modules/tax-tables/tax-tables.module';
import { SupportModule } from './modules/support/support.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { EsocialModule } from './modules/esocial/esocial.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    PayrollModule,
    ImportsModule,
    TimeBankModule,
    AuditModule,
    DocumentsModule,
    RubricsModule,
    TaxTablesModule,
    SupportModule,
    SystemConfigModule,
    EsocialModule,
  ]
})
export class AppModule {}
