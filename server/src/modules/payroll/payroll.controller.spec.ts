import { Test } from '@nestjs/testing';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

const payrollServiceMock = {
  generateDocumentsForRun: jest.fn(),
  reprocessDocumentsForRun: jest.fn(),
  generateIncomeStatementsForYear: jest.fn(),
  closeRun: jest.fn(),
  listPaystubsByEmployee: jest.fn(),
  listPaystubsByCompany: jest.fn(),
  listPaystubsForCompany: jest.fn(),
  removeEmployeeFromRun: jest.fn(),
  updatePaystubEvent: jest.fn(),
  sendPaystubByEmail: jest.fn()
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
    expect(payrollServiceMock.generateDocumentsForRun).toHaveBeenCalledWith(expect.objectContaining({
      payrollRunId: 'run-1',
      companyId: 'c1',
      userId: 'u1',
      documentType: 'trct',
      templateId: 'tpl-1',
      employeeIds: ['emp-1'],
      extraPlaceholders: undefined,
      reason: 'gerar trct'
    }));
  });

  it('queues holerite generation for a payroll run', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.generateDocumentsForRun.mockResolvedValueOnce({ createdCount: 27 });

    const result = await controller.generateDocuments(
      'run-hol-1',
      {
        documentType: 'holerite',
        reason: 'emitir holerites'
      },
      { user: { companyId: 'c1', sub: 'u1' } } as any
    );

    expect(result).toEqual({ createdCount: 27 });
    expect(payrollServiceMock.generateDocumentsForRun).toHaveBeenCalledWith(expect.objectContaining({
      payrollRunId: 'run-hol-1',
      companyId: 'c1',
      userId: 'u1',
      documentType: 'holerite',
      templateId: undefined,
      employeeIds: undefined,
      extraPlaceholders: undefined,
      reason: 'emitir holerites'
    }));
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
    expect(payrollServiceMock.reprocessDocumentsForRun).toHaveBeenCalledWith(expect.objectContaining({
      payrollRunId: 'run-2',
      companyId: 'c1',
      userId: 'u1',
      documentType: 'recibo_ferias',
      templateId: 'tpl-2',
      employeeIds: ['emp-2'],
      extraPlaceholders: undefined,
      reason: 'reprocessar'
    }));
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

  it('lists only own paystubs on default endpoint', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.listPaystubsByEmployee.mockResolvedValueOnce([{ id: 'p1' }]);

    const result = await controller.listPaystubs({
      user: { role: 'admin', companyId: 'c1', employeeId: 'emp-1' }
    } as any);

    expect(result).toEqual([{ id: 'p1' }]);
    expect(payrollServiceMock.listPaystubsByEmployee).toHaveBeenCalledWith('emp-1');
    expect(payrollServiceMock.listPaystubsByCompany).not.toHaveBeenCalled();
  });

  it('lists company paystubs on admin endpoint with filters', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.listPaystubsForCompany.mockResolvedValueOnce([{ id: 'p99' }]);

    const result = await controller.listPaystubsAdmin(
      { user: { companyId: 'c1' } } as any,
      '2',
      '2026',
      'emp-1',
      'Andre'
    );

    expect(result).toEqual([{ id: 'p99' }]);
    expect(payrollServiceMock.listPaystubsForCompany).toHaveBeenCalledWith({
      companyId: 'c1',
      month: 2,
      year: 2026,
      employeeId: 'emp-1',
      employeeName: 'Andre'
    });
  });

  it('removes an employee from payroll run via controller', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.removeEmployeeFromRun.mockResolvedValueOnce({ removed: true });

    const result = await controller.removeEmployeeFromRun(
      'run-1',
      'emp-1',
      { reason: 'ajuste' },
      { user: { companyId: 'c1', sub: 'u1' } } as any
    );

    expect(result).toEqual({ removed: true });
    expect(payrollServiceMock.removeEmployeeFromRun).toHaveBeenCalledWith({
      payrollRunId: 'run-1',
      employeeId: 'emp-1',
      companyId: 'c1',
      userId: 'u1',
      reason: 'ajuste'
    });
  });
  it('updates a paystub event via controller', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.updatePaystubEvent.mockResolvedValueOnce({ paystubId: 'p1' });

    const result = await controller.updatePaystubEvent(
      'p1',
      'ev1',
      { amount: 200, description: 'Ajuste' },
      { user: { companyId: 'c1', sub: 'u1' } } as any
    );

    expect(result).toEqual({ paystubId: 'p1' });
    expect(payrollServiceMock.updatePaystubEvent).toHaveBeenCalledWith({
      paystubId: 'p1',
      eventId: 'ev1',
      companyId: 'c1',
      userId: 'u1',
      amount: 200,
      description: 'Ajuste',
      reason: undefined
    });
  });

  it('sends paystub by email via controller', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollServiceMock }]
    }).compile();

    const controller = moduleRef.get(PayrollController);
    payrollServiceMock.sendPaystubByEmail.mockResolvedValueOnce({ sent: true, to: 'ana@example.com' });

    const result = await controller.sendPaystubByEmail(
      'p1',
      { email: 'ana@example.com', subject: 'Holerite', message: 'Segue anexo.' },
      { user: { companyId: 'c1', role: 'admin', sub: 'u1' } } as any
    );

    expect(result).toEqual({ sent: true, to: 'ana@example.com' });
    expect(payrollServiceMock.sendPaystubByEmail).toHaveBeenCalledWith({
      paystubId: 'p1',
      requester: { companyId: 'c1', role: 'admin', sub: 'u1' },
      userId: 'u1',
      recipientEmail: 'ana@example.com',
      subject: 'Holerite',
      message: 'Segue anexo.'
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
