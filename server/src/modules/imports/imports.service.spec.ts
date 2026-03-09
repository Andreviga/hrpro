import { ImportsService } from './imports.service';
import * as XLSX from 'xlsx';

jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn()
  }
}));

describe('ImportsService', () => {
  const prisma = {
    employee: {
      findMany: jest.fn()
    },
    importBatch: {
      create: jest.fn(),
      update: jest.fn()
    },
    importItem: {
      create: jest.fn()
    },
    payrollRun: {
      findFirst: jest.fn()
    }
  } as any;

  const audit = { log: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks payroll import when competence is closed', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.importBatch.create.mockResolvedValue({ id: 'batch-1' });
    prisma.payrollRun.findFirst.mockResolvedValue({ id: 'run-closed', status: 'closed' });

    (XLSX.read as jest.Mock).mockReturnValue({
      SheetNames: ['Folha de pagamento fevereiro 2026'],
      Sheets: { 'Folha de pagamento fevereiro 2026': {} }
    });

    (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
      { CPF: '123', Nome: 'Ana' }
    ]);

    const service = new ImportsService(prisma, audit);

    await expect(service.importWorkbook({
      buffer: Buffer.from('test'),
      fileName: 'Folha de pagamento de fevereiro 2026.xlsm',
      companyId: 'c1',
      userId: 'u1'
    })).rejects.toMatchObject({
      response: { code: 'PAYROLL_COMPETENCE_CLOSED' }
    });

    expect(prisma.importItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        batchId: 'batch-1',
        status: 'error'
      })
    }));

    expect(prisma.importBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: expect.objectContaining({ status: 'failed' })
    });
  });
});

