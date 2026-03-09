import { Test } from '@nestjs/testing';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

const payrollServiceMock = {
  generateDocumentsForRun: jest.fn(),
  reprocessDocumentsForRun: jest.fn(),
  generateIncomeStatementsForYear: jest.fn(),
  closeRun: jest.fn()
};

describe('PayrollController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queues document generation for a payroll run', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.generateDocumentsForRun.mockResolvedValueOnce({ createdCount: 1 });

    const result = await controller.generateDocuments(
      'run-1',
      {
        documentType: 'trct',
        templateId: 'tpl-1',
        employeeIds: ['emp-1'],
        reason: 'gerar trct'
      },
      { user: { companyId: 'c1', sub: 'u1' } } as any
    );

    expect(result).toEqual({ createdCount: 1 });
    expect(payrollServiceMock.generateDocumentsForRun).toHaveBeenCalledWith({
      payrollRunId: 'run-1',
      companyId: 'c1',
      userId: 'u1',
      documentType: 'trct',
      templateId: 'tpl-1',
      employeeIds: ['emp-1'],
      extraPlaceholders: undefined,
      reason: 'gerar trct'
    });
  });

  it('reprocesses document generation for a payroll run', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.reprocessDocumentsForRun.mockResolvedValueOnce({ createdCount: 1, skippedCount: 0 });

    const result = await controller.reprocessDocuments(
      'run-2',
      {
        documentType: 'recibo_ferias',
        templateId: 'tpl-2',
        employeeIds: ['emp-2'],
        reason: 'reprocessar'
      },
      { user: { companyId: 'c1', sub: 'u1' } } as any
    );

    expect(result).toEqual({ createdCount: 1, skippedCount: 0 });
    expect(payrollServiceMock.reprocessDocumentsForRun).toHaveBeenCalledWith({
      payrollRunId: 'run-2',
      companyId: 'c1',
      userId: 'u1',
      documentType: 'recibo_ferias',
      templateId: 'tpl-2',
      employeeIds: ['emp-2'],
      extraPlaceholders: undefined,
      reason: 'reprocessar'
    });
  });

  it('generates annual income statements', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.generateIncomeStatementsForYear.mockResolvedValueOnce({ createdCount: 2, skippedCount: 1 });

    const result = await controller.generateIncomeStatements(
      {
        year: 2025,
        employeeIds: ['emp-1', 'emp-2'],
        reason: 'informe anual',
        idempotent: true
      },
      { user: { companyId: 'c1', sub: 'u1' } } as any
    );

    expect(result).toEqual({ createdCount: 2, skippedCount: 1 });
    expect(payrollServiceMock.generateIncomeStatementsForYear).toHaveBeenCalledWith({
      companyId: 'c1',
      year: 2025,
      userId: 'u1',
      employeeIds: ['emp-1', 'emp-2'],
      reason: 'informe anual',
      idempotent: true
    });
  });

  it('closes a payroll run', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.closeRun.mockResolvedValueOnce({ payrollRun: { id: 'run-3', status: 'closed' } });

    const result = await controller.closeRun('run-3', { user: { sub: 'u1' } } as any);

    expect(result).toEqual({ payrollRun: { id: 'run-3', status: 'closed' } });
    expect(payrollServiceMock.closeRun).toHaveBeenCalledWith('run-3', 'u1');
  });
});
