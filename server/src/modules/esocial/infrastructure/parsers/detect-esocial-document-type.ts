import { EsocialDocumentType } from '../../domain/enums/esocial-document-type.enum';

export interface EsocialDocumentDetectionResult {
  documentType: EsocialDocumentType;
  rootTag: string;
  namespaceUri?: string;
  layoutVersion?: string;
}

const normalize = (value: string) => value.toLowerCase();

const extractNamespaceUri = (rootValue: unknown): string | undefined => {
  if (!rootValue || typeof rootValue !== 'object') return undefined;

  for (const [key, value] of Object.entries(rootValue as Record<string, unknown>)) {
    if (key.toLowerCase().startsWith('@_xmlns')) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
  }

  return undefined;
};

const extractLayoutVersion = (namespaceUri?: string): string | undefined => {
  if (!namespaceUri) return undefined;
  const match = namespaceUri.match(/s-\d+(?:\.\d+)+/i);
  return match ? match[0].toUpperCase() : undefined;
};

const detectByRootTag = (rootTag: string): EsocialDocumentType | undefined => {
  const lowered = normalize(rootTag);

  if (lowered === 'envioloteeventos') return EsocialDocumentType.LOTE_ENVIO;
  if (lowered === 'retornoenvioloteeventos') return EsocialDocumentType.RETORNO_RECEPCAO_LOTE;
  if (lowered === 'retornoprocessamentolote') return EsocialDocumentType.RETORNO_PROCESSAMENTO_LOTE;
  if (lowered === 'retornoevento') return EsocialDocumentType.RETORNO_PROCESSAMENTO_EVENTO;
  if (lowered.includes('consulta')) return EsocialDocumentType.CONSULTA;

  return undefined;
};

const detectInsideEsocialTag = (rootValue: unknown): EsocialDocumentType => {
  if (!rootValue || typeof rootValue !== 'object') return EsocialDocumentType.DESCONHECIDO;

  const keys = Object.keys(rootValue as Record<string, unknown>).filter((key) => !key.startsWith('@_'));
  const loweredKeys = keys.map((key) => normalize(key));

  if (loweredKeys.some((key) => key.startsWith('evt'))) return EsocialDocumentType.EVENT_XML;
  if (loweredKeys.includes('envioloteeventos')) return EsocialDocumentType.LOTE_ENVIO;
  if (loweredKeys.includes('retornoenvioloteeventos')) return EsocialDocumentType.RETORNO_RECEPCAO_LOTE;
  if (loweredKeys.includes('retornoprocessamentolote')) return EsocialDocumentType.RETORNO_PROCESSAMENTO_LOTE;
  if (loweredKeys.includes('retornoevento')) return EsocialDocumentType.RETORNO_PROCESSAMENTO_EVENTO;
  if (loweredKeys.some((key) => key.includes('consulta'))) return EsocialDocumentType.CONSULTA;

  return EsocialDocumentType.DESCONHECIDO;
};

export const detectDocumentType = (parsed: unknown): EsocialDocumentDetectionResult => {
  if (!parsed || typeof parsed !== 'object') {
    return {
      documentType: EsocialDocumentType.DESCONHECIDO,
      rootTag: 'unknown'
    };
  }

  const rootTag =
    Object.keys(parsed as Record<string, unknown>).find((key) => key !== '?xml') ??
    Object.keys(parsed as Record<string, unknown>)[0] ??
    'unknown';
  const rootValue = (parsed as Record<string, unknown>)[rootTag];
  const byRootTag = detectByRootTag(rootTag);
  const namespaceUri = extractNamespaceUri(rootValue);

  let documentType = byRootTag;
  if (!documentType && normalize(rootTag) === 'esocial') {
    documentType = detectInsideEsocialTag(rootValue);
  }

  return {
    documentType: documentType ?? EsocialDocumentType.DESCONHECIDO,
    rootTag,
    namespaceUri,
    layoutVersion: extractLayoutVersion(namespaceUri)
  };
};
