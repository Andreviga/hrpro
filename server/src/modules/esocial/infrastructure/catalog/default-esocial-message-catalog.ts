export interface DefaultCatalogEntry {
  code: string;
  officialDescription: string;
  humanExplanation: string;
  probableCause: string;
  suggestedAction: string;
  category: string;
}

export const DEFAULT_ESOCIAL_MESSAGE_CATALOG: DefaultCatalogEntry[] = [
  {
    code: 'MS0030',
    officialDescription: 'Lote recebido com sucesso.',
    humanExplanation: 'O lote foi recebido pelo ambiente nacional e segue para processamento.',
    probableCause: 'Fluxo normal de recepcao.',
    suggestedAction: 'Aguardar retorno de processamento do lote.',
    category: 'LOTE'
  },
  {
    code: 'MS1001',
    officialDescription: 'Evento recebido com sucesso.',
    humanExplanation: 'O evento foi aceito no retorno de recepcao.',
    probableCause: 'XML valido na etapa de recepcao.',
    suggestedAction: 'Aguardar retorno final de processamento do evento.',
    category: 'EVENTO'
  },
  {
    code: 'MS0155',
    officialDescription: 'Inconsistencia de dados no evento.',
    humanExplanation: 'Existe ao menos um campo do XML em desconformidade com regra de validacao.',
    probableCause: 'Dados obrigatorios ausentes, formato invalido ou regra de negocio violada.',
    suggestedAction: 'Corrigir os campos apontados nas ocorrencias e reenviar o evento.',
    category: 'VALIDACAO'
  }
];
