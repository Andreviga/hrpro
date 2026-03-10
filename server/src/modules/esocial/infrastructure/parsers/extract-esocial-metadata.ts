import { findAllByKey, findFirstStringByKeys } from '../../utils/deep-search';
import { safeGet } from '../../utils/safe-get';

const normalizeText = (value: unknown) => String(value ?? '').trim();

const findFirstAttributeId = (input: unknown): string | undefined => {
  const stack: unknown[] = [input];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    if (typeof current !== 'object') continue;
    const objectValue = current as Record<string, unknown>;

    for (const [key, value] of Object.entries(objectValue)) {
      if (key.toLowerCase() === '@_id') {
        const parsed = normalizeText(value);
        if (parsed) return parsed;
      }

      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return undefined;
};

export const extractEventType = (parsed: unknown): string | undefined => {
  const eventCandidates = findAllByKey(parsed, 'eSocial');
  for (const candidate of eventCandidates) {
    if (!candidate.value || typeof candidate.value !== 'object') continue;
    const keys = Object.keys(candidate.value as Record<string, unknown>)
      .filter((key) => !key.startsWith('@_'));
    const eventKey = keys.find((key) => /^evt/i.test(key));
    if (eventKey) return eventKey;
  }

  const firstEvt = findFirstStringByKeys(parsed, ['evtInfoEmpregador', 'evt2200', 'evt1200', 'evt1210']);
  return firstEvt;
};

export const extractEmployer = (parsed: unknown) => {
  const employerNode = safeGet<Record<string, unknown>>(parsed, [
    'eSocial.ideEmpregador',
    'envioLoteEventos.ideEmpregador',
    'retornoProcessamentoLote.ideEmpregador',
    'retornoEvento.ideEmpregador',
    'ideEmpregador'
  ]);

  const employerRegistrationType = normalizeText(
    safeGet(employerNode, ['tpInsc', 'tpinsc']) ?? findFirstStringByKeys(parsed, ['tpInsc'])
  );
  const employerRegistrationNumber = normalizeText(
    safeGet(employerNode, ['nrInsc', 'nrinsc']) ?? findFirstStringByKeys(parsed, ['nrInsc'])
  );

  return {
    employerRegistrationType: employerRegistrationType || undefined,
    employerRegistrationNumber: employerRegistrationNumber || undefined
  };
};

export const extractWorker = (parsed: unknown): string | undefined => {
  const cpf = findFirstStringByKeys(parsed, ['cpfTrab', 'cpfBenef', 'cpf']);
  const digits = String(cpf ?? '').replace(/\D/g, '');
  return digits.length >= 11 ? digits.slice(0, 11) : undefined;
};

export const extractReceipt = (parsed: unknown): string | undefined => {
  return findFirstStringByKeys(parsed, ['nrRecibo', 'recibo', 'numeroRecibo']);
};

export const extractProtocol = (parsed: unknown): string | undefined => {
  return findFirstStringByKeys(parsed, ['protocoloEnvio', 'nrProtocolo', 'protocolo']);
};

export const extractStatus = (parsed: unknown): { statusCode?: string; statusDescription?: string } => {
  const statusCode =
    safeGet<string>(parsed, [
      'retornoEvento.processamento.cdResposta',
      'retornoEvento.cdResposta',
      'retornoProcessamentoLote.status.cdRetorno',
      'retornoProcessamentoLote.status.cdResposta',
      'retornoEnvioLoteEventos.status.cdResposta',
      'status.cdResposta',
      'status.cdRetorno',
      'processamento.cdResposta',
      'cdResposta',
      'cdRetorno'
    ]) ?? findFirstStringByKeys(parsed, ['cdResposta', 'cdRetorno']);

  const statusDescription =
    safeGet<string>(parsed, [
      'retornoEvento.processamento.descResposta',
      'retornoEvento.descResposta',
      'retornoProcessamentoLote.status.descRetorno',
      'retornoProcessamentoLote.status.descResposta',
      'retornoEnvioLoteEventos.status.descResposta',
      'status.descResposta',
      'status.descRetorno',
      'processamento.descResposta',
      'descResposta',
      'descRetorno'
    ]) ?? findFirstStringByKeys(parsed, ['descResposta', 'descRetorno', 'descricao']);

  return {
    statusCode: statusCode ? String(statusCode).trim() : undefined,
    statusDescription: statusDescription ? String(statusDescription).trim() : undefined
  };
};

export const extractEventId = (parsed: unknown): string | undefined => {
  return findFirstAttributeId(parsed);
};

export const extractMetadata = (parsed: unknown) => {
  const employer = extractEmployer(parsed);
  const { statusCode, statusDescription } = extractStatus(parsed);

  return {
    eventType: extractEventType(parsed),
    eventId: extractEventId(parsed),
    employerRegistrationType: employer.employerRegistrationType,
    employerRegistrationNumber: employer.employerRegistrationNumber,
    workerCpf: extractWorker(parsed),
    receiptNumber: extractReceipt(parsed),
    protocolNumber: extractProtocol(parsed),
    statusCode,
    statusDescription
  };
};
