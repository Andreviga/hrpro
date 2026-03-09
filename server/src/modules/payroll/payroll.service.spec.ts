import { PayrollService } from './payroll.service';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() }))
}));

jest.mock('ioredis', () => jest.fn());

describe('PayrollService document generation', () => {
  const prisma = {
    payrollRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn()
    },
    documentTemplate: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    payrollResult: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn()
    },
    payrollEvent: {
      deleteMany: jest.fn()
    },
    employeeDocument: {
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    company: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  } as any;

  const audit = { log: jest.fn() } as any;
  const documents = { createDocumentFromTemplate: jest.fn(), ensureIncomeStatementTemplate: jest.fn(), ensurePaystubTemplate: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg)));
    prisma.employeeDocument.updateMany.mockResolvedValue({ count: 0 });
  });

  it('generates documents idempotently', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 'run-1',
      companyId: 'c1',
      month: 2,
      year: 2026
    });

    prisma.documentTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      companyId: 'c1',
      type: 'trct',
      name: 'TRCT',
      version: 1
    });

    prisma.payrollResult.findMany.mockResolvedValue([
      {
        employeeId: 'e1',
        grossSalary: 1000,
        totalDeductions: 0,
        netSalary: 1000,
        fgts: 80,
        employee: { fullName: 'Ana', cpf: '111', position: 'Dev', department: 'TI' }
      },
      {
        employeeId: 'e2',
        grossSalary: 1200,
        totalDeductions: 0,
        netSalary: 1200,
        fgts: 96,
        employee: { fullName: 'Bruno', cpf: '222', position: 'RH', department: 'RH' }
      }
    ]);

    prisma.employeeDocument.findMany.mockResolvedValue([
      { employeeId: 'e1', type: 'trct', id: 'doc-1' }
    ]);

    documents.createDocumentFromTemplate.mockResolvedValue({ id: 'doc-2' });

    const service = new PayrollService(prisma, audit, documents);

    const result = await service.generateDocumentsForRun({
      payrollRunId: 'run-1',
      companyId: 'c1',
      userId: 'u1',
      documentType: 'trct',
      idempotent: true
    });

    expect(result.createdCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(documents.createDocumentFromTemplate).toHaveBeenCalledTimes(1);
    expect(documents.createDocumentFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ payrollRunId: 'run-1' })
    );
    });

  it('auto-bootstraps default holerite template for payroll batch generation', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 'run-hol-1',
      companyId: 'c1',
      month: 2,
      year: 2026
    });

    documents.ensurePaystubTemplate.mockResolvedValue({
      created: true,
      template: {
        id: 'tpl-hol-1',
        companyId: 'c1',
        type: 'holerite',
        name: 'Holerite Padrao (Automatico)'
      }
    });

    prisma.payrollResult.findMany.mockResolvedValue([
      {
        employeeId: 'e1',
        grossSalary: 3200,
        totalDeductions: 420,
        netSalary: 2780,
        fgts: 256,
        employee: { fullName: 'Ana', cpf: '111', position: 'Docente', department: 'pedagogico' }
      }
    ]);

    documents.createDocumentFromTemplate.mockResolvedValue({ id: 'doc-hol-1' });

    const service = new PayrollService(prisma, audit, documents);

    const result = await service.generateDocumentsForRun({
      payrollRunId: 'run-hol-1',
      companyId: 'c1',
      userId: 'u1',
      documentType: 'holerite'
    });

    expect(result.createdCount).toBe(1);
    expect(documents.ensurePaystubTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'c1',
        userId: 'u1',
        reason: 'bootstrap_holerite'
      })
    );
    expect(documents.createDocumentFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'tpl-hol-1',
        payrollRunId: 'run-hol-1',
        employeeId: 'e1'
      })
    );
  });

  it('generates annual income statements from closed runs', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', cnpj: '12345678000199', name: 'Escola X' });

    documents.ensureIncomeStatementTemplate.mockResolvedValue({
      created: true,
      template: { id: 'tpl-income', companyId: 'c1' }
    });

    prisma.payrollResult.findMany.mockResolvedValue([
      {
        employeeId: 'e1',
        grossSalary: 3000,
        employee: { id: 'e1', fullName: 'Ana', cpf: '111', position: 'Professora' },
        payrollRun: { month: 1, year: 2025 },
        events: [
          { code: 'BASE', description: 'Salario base', type: 'earning', amount: 2800 },
          { code: 'DECIMO_13', description: '13o salario', type: 'earning', amount: 200 },
          { code: 'INSS', description: 'INSS', type: 'deduction', amount: 300 },
          { code: 'IRRF', description: 'IRRF', type: 'deduction', amount: 120 }
        ]
      }
    ]);

    prisma.employeeDocument.findMany.mockResolvedValue([]);
    documents.createDocumentFromTemplate.mockResolvedValue({ id: 'doc-income-1' });

    const service = new PayrollService(prisma, audit, documents);

    const result = await service.generateIncomeStatementsForYear({
      companyId: 'c1',
      year: 2025,
      userId: 'u1',
      idempotent: true
    });

    expect(result.templateCreated).toBe(true);
    expect(result.createdCount).toBe(1);
    expect(documents.ensureIncomeStatementTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'c1' })
    );
    expect(documents.createDocumentFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'tpl-income',
        employeeId: 'e1',
        year: 2025,
        month: 12
      })
    );
  });

  it('creates a payroll run for the competence', async () => {
    prisma.payrollRun.create.mockResolvedValue({ id: 'run-3', month: 2, year: 2026, companyId: 'c1' });

    const service = new PayrollService(prisma, audit, documents);
    const result = await service.createRun('c1', 2, 2026);

    expect(prisma.payrollRun.create).toHaveBeenCalledWith({
      data: { companyId: 'c1', month: 2, year: 2026 }
    });
    expect(result).toEqual({ id: 'run-3', month: 2, year: 2026, companyId: 'c1' });
  });

  it('blocks duplicate close for the same competence', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 'run-4',
      companyId: 'c1',
      month: 2,
      year: 2026,
      status: 'calculated'
    });
    prisma.payrollRun.findFirst.mockResolvedValue({ id: 'run-closed' });

    const service = new PayrollService(prisma, audit, documents);

    await expect(service.closeRun('run-4', 'u1')).rejects.toMatchObject({
      response: { code: 'PAYROLL_CLOSE_DUPLICATE' }
    });
  });

  it('opens a competence when no closed run exists', async () => {
    prisma.payrollRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.payrollRun.create.mockResolvedValue({ id: 'run-open', month: 3, year: 2026, status: 'draft' });

    const service = new PayrollService(prisma, audit, documents);

    const result = await service.openRun('c1', 3, 2026, 'u1');

    expect(result).toEqual({ id: 'run-open', month: 3, year: 2026, status: 'draft' });
    expect(prisma.payrollRun.create).toHaveBeenCalledWith({
      data: { companyId: 'c1', month: 3, year: 2026 }
    });
  });

  it('blocks opening when competence is already closed', async () => {
    prisma.payrollRun.findFirst.mockResolvedValueOnce({ id: 'run-closed', status: 'closed' });

    const service = new PayrollService(prisma, audit, documents);

    await expect(service.openRun('c1', 2, 2026, 'u1')).rejects.toMatchObject({
      response: { code: 'PAYROLL_COMPETENCE_CLOSED' }
    });
  });

  it('reopens a closed payroll run', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 'run-10',
      companyId: 'c1',
      month: 4,
      year: 2026,
      status: 'closed'
    });
    prisma.payrollRun.findFirst.mockResolvedValue(null);
    prisma.payrollRun.update.mockResolvedValue({
      id: 'run-10',
      status: 'calculated'
    });

    const service = new PayrollService(prisma, audit, documents);
    const result = await service.reopenRun('run-10', 'u1');

    expect(result.status).toBe('calculated');
    expect(prisma.payrollRun.update).toHaveBeenCalledWith({
      where: { id: 'run-10' },
      data: { status: 'calculated', closedAt: null }
    });
  });

  it('returns summary totals for a competence', async () => {
    prisma.payrollRun.findFirst.mockResolvedValueOnce({
      id: 'run-20',
      month: 5,
      year: 2026,
      status: 'closed',
      closedAt: new Date('2026-05-31T10:00:00Z')
    });
    prisma.payrollResult.aggregate.mockResolvedValue({
      _sum: {
        grossSalary: 10000,
        totalDeductions: 2000,
        netSalary: 8000,
        fgts: 800
      },
      _count: { _all: 5 }
    });

    const service = new PayrollService(prisma, audit, documents);
    const result = await service.getRunSummary('c1', 5, 2026);

    expect(result.payrollRunId).toBe('run-20');
    expect(result.totals.netSalary).toBe(8000);
    expect(result.employeesCount).toBe(5);
  });

  it('removes payroll result and soft-deletes linked run documents', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 'run-rm-1',
      companyId: 'c1',
      status: 'draft'
    });

    prisma.payrollResult.findUnique.mockResolvedValue({
      id: 'result-1',
      employee: { fullName: 'Ana' }
    });

    prisma.payrollEvent.deleteMany.mockResolvedValue({ count: 3 });
    prisma.payrollResult.delete.mockResolvedValue({ id: 'result-1' });
    prisma.employeeDocument.updateMany.mockResolvedValue({ count: 2 });

    const service = new PayrollService(prisma, audit, documents);

    const result = await service.removeEmployeeFromRun({
      payrollRunId: 'run-rm-1',
      employeeId: 'emp-1',
      companyId: 'c1',
      userId: 'u1',
      reason: 'ajuste'
    });

    expect(result).toMatchObject({
      removed: true,
      removedPayrollResult: true,
      deletedDocumentsCount: 2,
      employeeName: 'Ana'
    });

    expect(prisma.employeeDocument.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          payrollRunId: 'run-rm-1',
          employeeId: 'emp-1',
          deletedAt: null
        }),
        data: expect.objectContaining({
          deletedBy: 'u1',
          deletedReason: 'ajuste'
        })
      })
    );

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'remove_employee_from_run',
        after: expect.objectContaining({
          removedPayrollResult: true,
          deletedDocumentsCount: 2
        })
      })
    );
  });

  it('marks removal when only linked documents exist', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 'run-rm-2',
      companyId: 'c1',
      status: 'draft'
    });

    prisma.payrollResult.findUnique.mockResolvedValue(null);
    prisma.employeeDocument.updateMany.mockResolvedValue({ count: 1 });

    const service = new PayrollService(prisma, audit, documents);

    const result = await service.removeEmployeeFromRun({
      payrollRunId: 'run-rm-2',
      employeeId: 'emp-2',
      companyId: 'c1',
      userId: 'u1'
    });

    expect(result).toMatchObject({
      removed: true,
      removedPayrollResult: false,
      deletedDocumentsCount: 1
    });
  });
  it('auto-generates documents on close', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 'run-2',
      companyId: 'c1',
      month: 2,
      year: 2026,
      status: 'draft'
    });

    prisma.payrollRun.findFirst.mockResolvedValue(null);

    prisma.payrollRun.update.mockResolvedValue({
      id: 'run-2',
      companyId: 'c1',
      month: 2,
      year: 2026,
      status: 'closed',
      closedAt: new Date('2026-02-06T10:00:00Z')
    });

    prisma.payrollResult.findMany.mockResolvedValue([
      {
        employeeId: 'e1',
        employee: { status: 'dismissed' },
        events: []
      },
      {
        employeeId: 'e2',
        employee: { status: 'active' },
        events: [{ code: 'FERIAS', description: 'Ferias vencidas' }]
      }
    ]);

    const service = new PayrollService(prisma, audit, documents);
    const spy = jest.spyOn(service, 'generateDocumentsForRun').mockResolvedValue({
      createdCount: 1,
      skippedCount: 0,
      documents: []
    } as any);

    const result = await service.closeRun('run-2', 'u1');

    expect(result.payrollRun.status).toBe('closed');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      payrollRunId: 'run-2',
      documentType: 'trct',
      idempotent: true,
      source: 'auto_close'
    }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      payrollRunId: 'run-2',
      documentType: 'recibo_ferias',
      idempotent: true,
      source: 'auto_close'
    }));
  });
});

