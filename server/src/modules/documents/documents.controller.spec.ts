import { Test } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

const documentsServiceMock = {
  listTemplates: jest.fn(),
  ensureIncomeStatementTemplate: jest.fn(),
  exportDocumentFile: jest.fn()
};

describe('DocumentsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists templates with filters', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: documentsServiceMock }]
    }).compile();

    const controller = moduleRef.get(DocumentsController);
    documentsServiceMock.listTemplates.mockResolvedValueOnce([{ id: 't1' }]);

    const result = await controller.listTemplates(
      { type: 'trct', status: 'draft', includeDeleted: 'true' },
      { user: { companyId: 'c1' } } as any
    );

    expect(result).toEqual([{ id: 't1' }]);
    expect(documentsServiceMock.listTemplates).toHaveBeenCalledWith('c1', {
      type: 'trct',
      status: 'draft',
      includeDeleted: true
    });
  });

  it('bootstraps income statement template', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: documentsServiceMock }]
    }).compile();

    const controller = moduleRef.get(DocumentsController);
    documentsServiceMock.ensureIncomeStatementTemplate.mockResolvedValueOnce({
      created: true,
      template: { id: 'tpl-1' }
    });

    const result = await controller.bootstrapIncomeStatementTemplate(
      { reason: 'modelo oficial' },
      { user: { companyId: 'c1', sub: 'u1' } } as any
    );

    expect(result).toEqual({ created: true, template: { id: 'tpl-1' } });
    expect(documentsServiceMock.ensureIncomeStatementTemplate).toHaveBeenCalledWith({
      companyId: 'c1',
      userId: 'u1',
      reason: 'modelo oficial'
    });
  });

  it('exports document as pdf', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: documentsServiceMock }]
    }).compile();

    const controller = moduleRef.get(DocumentsController);
    const res = { setHeader: jest.fn(), send: jest.fn() } as any;

    documentsServiceMock.exportDocumentFile.mockResolvedValueOnce({
      buffer: Buffer.from('pdf'),
      filename: 'trct_123_022026_1.pdf',
      contentType: 'application/pdf'
    });

    await controller.exportDocumentPdf(
      'doc-1',
      { user: { companyId: 'c1', sub: 'u1', role: 'admin' } } as any,
      res
    );

    expect(documentsServiceMock.exportDocumentFile).toHaveBeenCalledWith({
      id: 'doc-1',
      companyId: 'c1',
      userId: 'u1',
      role: 'admin',
      format: 'pdf'
    });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename=trct_123_022026_1.pdf'
    );
    expect(res.send).toHaveBeenCalled();
  });

  it('exports document as docx', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: documentsServiceMock }]
    }).compile();

    const controller = moduleRef.get(DocumentsController);
    const res = { setHeader: jest.fn(), send: jest.fn() } as any;

    documentsServiceMock.exportDocumentFile.mockResolvedValueOnce({
      buffer: Buffer.from('docx'),
      filename: 'trct_123_022026_1.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    await controller.exportDocumentDocx(
      'doc-2',
      { user: { companyId: 'c1', sub: 'u1', role: 'admin' } } as any,
      res
    );

    expect(documentsServiceMock.exportDocumentFile).toHaveBeenCalledWith({
      id: 'doc-2',
      companyId: 'c1',
      userId: 'u1',
      role: 'admin',
      format: 'docx'
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename=trct_123_022026_1.docx'
    );
    expect(res.send).toHaveBeenCalled();
  });
});
