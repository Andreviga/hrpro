"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const company = await prisma.company.upsert({
        where: { cnpj: '00.000.000/0001-00' },
        update: {},
        create: {
            name: 'HRPro Demo',
            cnpj: '00.000.000/0001-00'
        }
    });
    const adminPassword = await bcryptjs_1.default.hash('123456', 10);
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@hrpro.com' },
        update: {},
        create: {
            companyId: company.id,
            fullName: 'Admin RH',
            email: 'admin@hrpro.com',
            passwordHash: adminPassword,
            role: client_1.UserRole.admin
        }
    });
    await prisma.user.upsert({
        where: { email: 'joao@hrpro.com' },
        update: {},
        create: {
            companyId: company.id,
            fullName: 'Joao Silva',
            email: 'joao@hrpro.com',
            passwordHash: adminPassword,
            role: client_1.UserRole.employee
        }
    });
    const employee = await prisma.employee.upsert({
        where: { cpf: '48158420869' },
        update: {},
        create: {
            companyId: company.id,
            fullName: 'Amauri Hernandes Junior',
            cpf: '48158420869',
            rg: '521915910',
            email: 'amauri@colegioraizes-objetivo.com.br',
            phone: '11995047274',
            employeeCode: 'PROF001',
            admissionDate: new Date('2022-01-27'),
            ctps: '12345678901',
            pis: '12939814815',
            position: 'Professor de Historia',
            department: 'centro_educacional',
            status: client_1.EmployeeStatus.active,
            salaryType: client_1.SalaryType.hourly,
            hourlyRate: 31.44,
            weeklyHours: 25,
            dependents: 0,
            unionFee: false,
            transportVoucherValue: 204.86,
            mealVoucherValue: 180
        }
    });
    await prisma.user.update({
        where: { email: 'joao@hrpro.com' },
        data: { employeeId: employee.id }
    });
    const inssRows = [
        { minValue: 0, maxValue: 1412.0, rate: 0.075, deduction: 0 },
        { minValue: 1412.01, maxValue: 2666.68, rate: 0.09, deduction: 21.18 },
        { minValue: 2666.69, maxValue: 4000.03, rate: 0.12, deduction: 101.18 },
        { minValue: 4000.04, maxValue: 7786.02, rate: 0.14, deduction: 181.18 }
    ];
    const irrfRows = [
        { minValue: 0, maxValue: 2259.2, rate: 0, deduction: 0, dependentDeduction: 189.59 },
        { minValue: 2259.21, maxValue: 2826.65, rate: 0.075, deduction: 169.44, dependentDeduction: 189.59 },
        { minValue: 2826.66, maxValue: 3751.05, rate: 0.15, deduction: 381.44, dependentDeduction: 189.59 },
        { minValue: 3751.06, maxValue: 4664.68, rate: 0.225, deduction: 662.77, dependentDeduction: 189.59 },
        { minValue: 4664.69, maxValue: 999999, rate: 0.275, deduction: 896.0, dependentDeduction: 189.59 }
    ];
    const month = 1;
    const year = 2026;
    for (const row of inssRows) {
        await prisma.taxTableInss.upsert({
            where: {
                companyId_month_year_minValue: {
                    companyId: company.id,
                    month,
                    year,
                    minValue: row.minValue
                }
            },
            update: {},
            create: {
                companyId: company.id,
                month,
                year,
                minValue: row.minValue,
                maxValue: row.maxValue,
                rate: row.rate,
                deduction: row.deduction
            }
        });
    }
    for (const row of irrfRows) {
        await prisma.taxTableIrrf.upsert({
            where: {
                companyId_month_year_minValue: {
                    companyId: company.id,
                    month,
                    year,
                    minValue: row.minValue
                }
            },
            update: {},
            create: {
                companyId: company.id,
                month,
                year,
                minValue: row.minValue,
                maxValue: row.maxValue,
                rate: row.rate,
                deduction: row.deduction,
                dependentDeduction: row.dependentDeduction
            }
        });
    }
    await prisma.auditLog.create({
        data: {
            companyId: company.id,
            userId: adminUser.id,
            action: 'seed',
            entity: 'system',
            entityId: null,
            before: client_1.Prisma.JsonNull,
            after: { message: 'Seed completed' }
        }
    });
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
