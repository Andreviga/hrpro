import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { calculatePayrollForEmployee } from './modules/payroll/payroll.utils';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

new Worker(
  'payroll.calculate',
  async (job) => {
    const { payrollRunId, userId } = job.data as { payrollRunId: string; userId?: string };

    const payrollRun = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!payrollRun) return;

    const employees = await prisma.employee.findMany({
      where: { companyId: payrollRun.companyId, status: 'active' }
    });

    const inssTable = await prisma.taxTableInss.findMany({
      where: { companyId: payrollRun.companyId, month: payrollRun.month, year: payrollRun.year },
      orderBy: { minValue: 'asc' }
    });

    const irrfTable = await prisma.taxTableIrrf.findMany({
      where: { companyId: payrollRun.companyId, month: payrollRun.month, year: payrollRun.year },
      orderBy: { minValue: 'asc' }
    });

    const resultIds = await prisma.payrollResult.findMany({
      where: { payrollRunId },
      select: { id: true }
    });

    await prisma.$transaction([
      prisma.payrollEvent.deleteMany({
        where: { payrollResultId: { in: resultIds.map((item) => item.id) } }
      }),
      prisma.payrollResult.deleteMany({ where: { payrollRunId } })
    ]);

    for (const employee of employees) {
      const calc = calculatePayrollForEmployee({ employee, inssTable, irrfTable });

      const payrollResult = await prisma.payrollResult.create({
        data: {
          payrollRunId,
          employeeId: employee.id,
          grossSalary: calc.grossSalary,
          totalDeductions: calc.totalDeductions,
          netSalary: calc.netSalary,
          fgts: calc.fgts
        }
      });

      for (const item of calc.earnings) {
        await prisma.payrollEvent.create({
          data: {
            payrollResultId: payrollResult.id,
            code: item.code,
            description: item.description,
            type: 'earning',
            amount: item.amount
          }
        });
      }

      for (const item of calc.deductions) {
        await prisma.payrollEvent.create({
          data: {
            payrollResultId: payrollResult.id,
            code: item.code,
            description: item.description,
            type: 'deduction',
            amount: item.amount
          }
        });
      }
    }

    await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'calculated' }
    });

    await prisma.auditLog.create({
      data: {
        companyId: payrollRun.companyId,
        userId: userId ?? null,
        action: 'calculate',
        entity: 'payroll_run',
        entityId: payrollRunId,
        after: { status: 'calculated' }
      }
    });
  },
  { connection }
);

// eslint-disable-next-line no-console
console.log('Payroll worker running');
