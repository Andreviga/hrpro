import { EsocialService } from './esocial.service';
import { EsocialDocumentType } from '../../domain/enums/esocial-document-type.enum';
import { EsocialProcessingResult } from '../../domain/enums/esocial-processing-result.enum';

describe('EsocialService', () => {
  const parser = { execute: jest.fn() } as any;
  const normalizer = { execute: jest.fn() } as any;
  const xsdValidator = { execute: jest.fn() } as any;
  const repository = {
    findDocumentByHash: jest.fn(),
    createDocument: jest.fn(),
    listDocuments: jest.fn(),
    getDocument: jest.fn(),
    listDocumentOccurrences: jest.fn(),
    listOccurrences: jest.fn()
  } as any;
  const catalogService = {
    enrichOccurrences: jest.fn(),
    syncDefaultCatalog: jest.fn(),
    syncCatalog: jest.fn()
  } as any;
  const audit = { log: jest.fn() } as any;

  const service = new EsocialService(
    parser,
    normalizer,
    xsdValidator,
    repository,
    catalogService,
    audit
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findDocumentByHash.mockResolvedValue(null);
    xsdValidator.execute.mockResolvedValue({ status: 'skipped', errors: [] });
    catalogService.enrichOccurrences.mockImplementation(async (items: any[]) => items);
    repository.createDocument.mockResolvedValue({ id: 'doc-1', occurrences: [] });
  });

  it('returns duplicated=true when xml hash already exists', async () => {
    repository.findDocumentByHash.mockResolvedValue({ id: 'existing-1', occurrences: [] });

    const result = await service.importXml({
      dto: { xml: '<retornoEvento />' },
      companyId: 'c1',
      userId: 'u1'
    });

    expect(result.duplicated).toBe(true);
    expect(repository.createDocument).not.toHaveBeenCalled();
  });

  it('imports, normalizes and persists occurrences', async () => {
    parser.execute.mockReturnValue({
      parsed: { retornoEvento: { processamento: { cdResposta: '409' } } },
      detection: {
        documentType: EsocialDocumentType.RETORNO_PROCESSAMENTO_EVENTO,
        rootTag: 'retornoEvento'
      }
    });

    normalizer.execute.mockReturnValue({
      documentType: EsocialDocumentType.RETORNO_PROCESSAMENTO_EVENTO,
      eventId: 'ID1',
      eventType: 'evt2200',
      employerRegistrationType: '1',
      employerRegistrationNumber: '12345678000190',
      workerCpf: '12345678901',
      protocolNumber: 'P1',
      receiptNumber: 'R1',
      statusCode: '409',
      statusDescription: 'Erro de validacao',
      occurrences: [
        {
          sourceType: 'evento',
          occurrenceTypeCode: '1',
          occurrenceTypeLabel: 'ERRO',
          severity: 'ERROR',
          code: 'MS0155',
          description: 'CPF invalido',
          isBlocking: true,
          isSuccessCompatible: false,
          rawFragment: '{}'
        }
      ],
      totals: [],
      rawXml: '<retornoEvento />',
      parsedJson: { ok: true },
      layoutVersion: 'S-1.2',
      namespaceUri: 'urn:test',
      createdAt: new Date(),
      processingResult: EsocialProcessingResult.FAILED
    });

    const result = await service.importXml({
      dto: { xml: '<retornoEvento />', validateXsd: false },
      companyId: 'c1',
      userId: 'u1'
    });

    expect(result.duplicated).toBe(false);
    expect(repository.createDocument).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalled();
  });

  it('stores parsing error separately from eSocial functional errors', async () => {
    parser.execute.mockImplementation(() => {
      throw new Error('Malformed XML');
    });

    await service.importXml({
      dto: { xml: '<invalid>' },
      companyId: 'c1',
      userId: 'u1'
    });

    expect(repository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        parsingError: 'Malformed XML',
        processingResult: EsocialProcessingResult.FAILED
      })
    );
  });
});
