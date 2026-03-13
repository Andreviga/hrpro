import { EsocialDocumentType } from '../../domain/enums/esocial-document-type.enum';
import { EsocialOccurrence } from '../../domain/interfaces/esocial-occurrence.interface';
import { findAllByKey } from '../../utils/deep-search';
import { safeGetAll } from '../../utils/safe-get';
import { toArray } from '../../utils/to-array';
import { classifyEsocialOccurrence } from './classify-esocial-occurrence';

interface ExtractOccurrencesInput {
  parsed: unknown;
  documentType: EsocialDocumentType;
  statusCode?: string;
  hasFailureStatus?: boolean;
}

const normalizeString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const parsed = String(value).trim();
  return parsed || undefined;
};

const inferSourceType = (logicalPath: string): string => {
  const path = logicalPath.toLowerCase();
  if (path.includes('retornoprocessamentolote')) return 'lote';
  if (path.includes('retornoevento')) return 'evento';
  if (path.includes('retornoenvioloteeventos')) return 'recepcao';
  if (path.includes('consulta')) return 'consulta';
  return 'desconhecido';
};

const extractFields = (node: unknown) => {
  if (!node || typeof node !== 'object') {
    return {
      occurrenceTypeCode: undefined,
      code: undefined,
      description: normalizeString(node) ?? 'Ocorrência sem descrição',
      location: undefined
    };
  }

  const objectNode = node as Record<string, unknown>;

  const occurrenceTypeCode = normalizeString(
    objectNode.tipo ?? objectNode.tpOcorr ?? objectNode.tpocorr
  );

  const code = normalizeString(
    objectNode.codigo ?? objectNode.cod ?? objectNode.codResp ?? objectNode.codMensagem ?? objectNode.nrOcorr
  );

  const description =
    normalizeString(
      objectNode.descricao ??
        objectNode.desc ??
        objectNode.mensagem ??
        objectNode.dsc ??
        objectNode.descricaoOcorrencia ??
        objectNode['#text']
    ) ?? 'Ocorrência sem descrição';

  const location = normalizeString(
    objectNode.localizacao ?? objectNode.localizacaoErro ?? objectNode.campo ?? objectNode.tag
  );

  return {
    occurrenceTypeCode,
    code,
    description,
    location
  };
};

export const extractOccurrences = (input: ExtractOccurrencesInput): EsocialOccurrence[] => {
  const candidatePaths = [
    'retornoEvento.processamento.ocorrencias.ocorrencia',
    'retornoEvento.ocorrencias.ocorrencia',
    'retornoProcessamentoLote.ocorrencias.ocorrencia',
    'retornoEnvioLoteEventos.ocorrencias.ocorrencia',
    'status.ocorrencias.ocorrencia',
    'ocorrencias.ocorrencia'
  ];

  const pathNodes: Array<{ value: unknown; path: string }> = [];
  for (const candidatePath of candidatePaths) {
    const values = safeGetAll(input.parsed, [candidatePath]);
    for (const value of values) {
      for (const occurrenceNode of toArray(value as unknown)) {
        pathNodes.push({ value: occurrenceNode, path: candidatePath });
      }
    }
  }

  const recursiveMatches = findAllByKey(input.parsed, 'ocorrencia')
    .flatMap((match) => toArray(match.value).map((value) => ({ value, path: match.path })));

  const allNodes = [...pathNodes, ...recursiveMatches];
  const uniqueKeys = new Set<string>();
  const occurrences: EsocialOccurrence[] = [];

  for (const node of allNodes) {
    const fields = extractFields(node.value);
    const signature = JSON.stringify([
      fields.occurrenceTypeCode ?? '',
      fields.code ?? '',
      fields.description,
      fields.location ?? '',
      node.path
    ]);

    if (uniqueKeys.has(signature)) continue;
    uniqueKeys.add(signature);

    const classification = classifyEsocialOccurrence({
      occurrenceTypeCode: fields.occurrenceTypeCode,
      statusCode: input.statusCode,
      documentType: input.documentType,
      hasFailureStatus: input.hasFailureStatus
    });

    occurrences.push({
      sourceType: inferSourceType(node.path),
      occurrenceTypeCode: fields.occurrenceTypeCode,
      occurrenceTypeLabel: classification.occurrenceTypeLabel,
      severity: classification.severity,
      code: fields.code,
      description: fields.description,
      location: fields.location,
      logicalXpath: node.path,
      isBlocking: classification.isBlocking,
      isSuccessCompatible: classification.isSuccessCompatible,
      rawFragment: JSON.stringify(node.value)
    });
  }

  return occurrences;
};
