import { Prisma, PrismaClient, SalaryType, EmployeeStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { cnpj: '00.000.000/0001-00' },
    update: {},
    create: {
      name: 'HRPro Demo',
      cnpj: '00.000.000/0001-00'
    }
  });

  const adminPassword = await bcrypt.hash('123456', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hrpro.com' },
    update: {},
    create: {
      companyId: company.id,
      fullName: 'Admin RH',
      email: 'admin@hrpro.com',
      passwordHash: adminPassword,
      role: UserRole.admin
    }
  });

  const joaoUser = await prisma.user.upsert({
    where: { email: 'joao@hrpro.com' },
    update: {},
    create: {
      companyId: company.id,
      fullName: 'Joao Silva',
      email: 'joao@hrpro.com',
      passwordHash: adminPassword,
      role: UserRole.employee
    }
  });
  void joaoUser;

  await prisma.employee.upsert({
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
      status: EmployeeStatus.active,
      salaryType: SalaryType.hourly,
      hourlyRate: 31.44,
      weeklyHours: 25,
      dependents: 0,
      unionFee: false,
      transportVoucherValue: 204.86,
      mealVoucherValue: 180
    }
  });

  await prisma.employee.upsert({
    where: { cpf: '37024665840' },
    update: {
      fullName: 'Gustavo Takashi Moraes Assano',
      rg: '350276912',
      birthDate: new Date('1988-02-28'),
      email: 'gustavo.assano@gmail.com',
      phone: '11984923087',
      admissionDate: new Date('2026-01-27'),
      addressLine: 'Avenida Itacira, 2173',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '04061002',
      position: 'Professor de Portugues',
      department: 'centro_educacional',
      status: EmployeeStatus.active,
      salaryType: SalaryType.monthly,
      baseSalary: 2144.16,
      weeklyHours: 15,
      transportVoucherValue: 0,
      mealVoucherValue: 180
    },
    create: {
      companyId: company.id,
      fullName: 'Gustavo Takashi Moraes Assano',
      cpf: '37024665840',
      rg: '350276912',
      birthDate: new Date('1988-02-28'),
      email: 'gustavo.assano@gmail.com',
      phone: '11984923087',
      employeeCode: 'PROF002',
      admissionDate: new Date('2026-01-27'),
      addressLine: 'Avenida Itacira, 2173',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '04061002',
      position: 'Professor de Portugues',
      department: 'centro_educacional',
      status: EmployeeStatus.active,
      salaryType: SalaryType.monthly,
      baseSalary: 2144.16,
      weeklyHours: 15,
      dependents: 0,
      unionFee: false,
      transportVoucherValue: 0,
      mealVoucherValue: 180
    }
  });

  const joaoEmployee = await prisma.employee.upsert({
    where: { cpf: '11144477735' },
    update: {},
    create: {
      companyId: company.id,
      fullName: 'Joao Silva',
      cpf: '11144477735',
      email: 'joao@hrpro.com',
      employeeCode: 'PROF003',
      admissionDate: new Date('2023-03-01'),
      position: 'Professor de Matematica',
      department: 'centro_educacional',
      status: EmployeeStatus.active,
      salaryType: SalaryType.monthly,
      baseSalary: 2800.0,
      weeklyHours: 20,
      dependents: 0,
      unionFee: false,
      transportVoucherValue: 0,
      mealVoucherValue: 180
    }
  });

  await prisma.user.update({
    where: { email: 'joao@hrpro.com' },
    data: { employeeId: joaoEmployee.id }
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

  for (const month of [1, 2, 3]) {
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
  }

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: adminUser.id,
      action: 'seed',
      entity: 'system',
      entityId: null,
      before: Prisma.JsonNull,
      after: { message: 'Seed completed' }
    }
  });

  const esocialCatalogSeed = [
    {
      code: 'MS0030',
      officialDescription: 'Lote recebido com sucesso.',
      humanExplanation: 'O lote foi recebido pelo ambiente nacional e segue para processamento.',
      probableCause: 'Fluxo normal de recepcao.',
      suggestedAction: 'Aguardar retorno de processamento do lote.',
      category: 'LOTE'
    },
    {
      code: 'MS1001',
      officialDescription: 'Evento recebido com sucesso.',
      humanExplanation: 'O evento foi aceito no retorno de recepcao.',
      probableCause: 'XML valido na etapa de recepcao.',
      suggestedAction: 'Aguardar retorno final de processamento do evento.',
      category: 'EVENTO'
    },
    {
      code: 'MS0155',
      officialDescription: 'Inconsistencia de dados no evento.',
      humanExplanation: 'Existe ao menos um campo do XML em desconformidade com regra de validacao.',
      probableCause: 'Dados obrigatorios ausentes, formato invalido ou regra de negocio violada.',
      suggestedAction: 'Corrigir os campos apontados nas ocorrencias e reenviar o evento.',
      category: 'VALIDACAO'
    }
  ];

  for (const entry of esocialCatalogSeed) {
    await prisma.esocialMessageCatalog.upsert({
      where: { code: entry.code },
      update: {
        officialDescription: entry.officialDescription,
        humanExplanation: entry.humanExplanation,
        probableCause: entry.probableCause,
        suggestedAction: entry.suggestedAction,
        category: entry.category
      },
      create: entry
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

