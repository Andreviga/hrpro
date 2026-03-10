import { FastXmlParserAdapter } from './fast-xml-parser.adapter';
import { ParseEsocialXmlService } from './parse-esocial-xml';
import { NormalizeEsocialDocumentService } from './normalize-esocial-document';
import { EsocialDocumentType } from '../../domain/enums/esocial-document-type.enum';
import { EsocialOccurrenceSeverity } from '../../domain/enums/esocial-occurrence-severity.enum';

const parserAdapter = new FastXmlParserAdapter();
const parser = new ParseEsocialXmlService(parserAdapter as any);
const normalizer = new NormalizeEsocialDocumentService();

const normalizeXml = (xml: string) => {
  const parsed = parser.execute(xml);
  return normalizer.execute({
    rawXml: xml,
    parsed: parsed.parsed,
    detection: parsed.detection
  });
};

describe('eSocial XML parser and normalizer', () => {
  it('parses XML with namespace and identifies processamento de evento', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <retornoEvento xmlns="http://www.esocial.gov.br/schema/lote/eventos/retornoEvento/v1_2_1">
      <processamento>
        <cdResposta>409</cdResposta>
        <descResposta>Falha de validacao</descResposta>
        <ocorrencias>
          <ocorrencia>
            <tipo>1</tipo>
            <codigo>MS0155</codigo>
            <descricao>CPF invalido</descricao>
            <localizacao>/evt2200/trabalhador/cpfTrab</localizacao>
          </ocorrencia>
        </ocorrencias>
      </processamento>
    </retornoEvento>`;

    const normalized = normalizeXml(xml);
    expect(normalized.documentType).toBe(EsocialDocumentType.RETORNO_PROCESSAMENTO_EVENTO);
    expect(normalized.statusCode).toBe('409');
    expect(normalized.occurrences).toHaveLength(1);
    expect(normalized.occurrences[0].severity).toBe(EsocialOccurrenceSeverity.ERROR);
  });

  it('parses XML sem namespace', () => {
    const xml = `
    <retornoProcessamentoLote>
      <status>
        <cdResposta>201</cdResposta>
        <descResposta>Lote processado</descResposta>
      </status>
    </retornoProcessamentoLote>`;

    const normalized = normalizeXml(xml);
    expect(normalized.documentType).toBe(EsocialDocumentType.RETORNO_PROCESSAMENTO_LOTE);
    expect(normalized.statusCode).toBe('201');
  });

  it('captures multiple occurrences from repeated tags', () => {
    const xml = `
    <retornoEvento>
      <ocorrencias>
        <ocorrencia>
          <tipo>2</tipo>
          <codigo>MS1001</codigo>
          <descricao>Advertencia 1</descricao>
        </ocorrencia>
        <ocorrencia>
          <tipo>3</tipo>
          <codigo>MS2001</codigo>
          <descricao>Historico 1</descricao>
        </ocorrencia>
      </ocorrencias>
    </retornoEvento>`;

    const normalized = normalizeXml(xml);
    expect(normalized.occurrences).toHaveLength(2);
    expect(normalized.occurrences.map((item) => item.severity)).toEqual([
      EsocialOccurrenceSeverity.WARNING,
      EsocialOccurrenceSeverity.INFO
    ]);
  });

  it('captures occurrence when tag appears as single object', () => {
    const xml = `
    <retornoEvento>
      <ocorrencias>
        <ocorrencia>
          <tipo>2</tipo>
          <codigo>MS2010</codigo>
          <descricao>Tag unica</descricao>
        </ocorrencia>
      </ocorrencias>
    </retornoEvento>`;

    const normalized = normalizeXml(xml);
    expect(normalized.occurrences).toHaveLength(1);
    expect(normalized.occurrences[0].code).toBe('MS2010');
  });

  it('detects lote envio and consulta types', () => {
    const envio = normalizeXml(`<envioLoteEventos><ideEmpregador><tpInsc>1</tpInsc></ideEmpregador></envioLoteEventos>`);
    expect(envio.documentType).toBe(EsocialDocumentType.LOTE_ENVIO);

    const consulta = normalizeXml(`<consultaLoteEventos><protocoloEnvio>123</protocoloEnvio></consultaLoteEventos>`);
    expect(consulta.documentType).toBe(EsocialDocumentType.CONSULTA);
  });

  it('identifies event XML and extracts event type/id', () => {
    const xml = `<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evt2200/v_S_1_2">
      <evt2200 Id="ID2200-1">
        <ideEmpregador><tpInsc>1</tpInsc><nrInsc>12345678000190</nrInsc></ideEmpregador>
        <trabalhador><cpfTrab>12345678901</cpfTrab></trabalhador>
      </evt2200>
    </eSocial>`;

    const normalized = normalizeXml(xml);
    expect(normalized.documentType).toBe(EsocialDocumentType.EVENT_XML);
    expect(normalized.eventType).toBe('evt2200');
    expect(normalized.eventId).toBe('ID2200-1');
  });

  it('supports different schema versions by namespace', () => {
    const xmlV12 = `<retornoEvento xmlns="http://www.esocial.gov.br/schema/lote/eventos/retornoEvento/S-1.2"></retornoEvento>`;
    const xmlV13 = `<retornoEvento xmlns="http://www.esocial.gov.br/schema/lote/eventos/retornoEvento/S-1.3"></retornoEvento>`;

    const normalizedV12 = normalizeXml(xmlV12);
    const normalizedV13 = normalizeXml(xmlV13);

    expect(normalizedV12.layoutVersion).toBe('S-1.2');
    expect(normalizedV13.layoutVersion).toBe('S-1.3');
  });

  it('throws parsing error for malformed XML', () => {
    const invalidXml = '<retornoEvento><status></retornoEvento>';
    expect(() => parser.execute(invalidXml)).toThrow();
  });
});
