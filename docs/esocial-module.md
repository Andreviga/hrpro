# Modulo eSocial

## Visao Geral
O modulo eSocial implementa intake, parsing, normalizacao, classificacao de ocorrencias, persistencia e consulta com foco em capturar todas as ocorrencias retornadas no XML.

## Camadas Implementadas
- **Inbound/Intake**: endpoint `POST /esocial/xml/import` aceita XML por string, base64 ou upload de arquivo.
- **Detector de Tipo**: identifica por tag raiz, estrutura e namespace.
- **Parser XML**: adapter com `fast-xml-parser`, resiliente a namespace e versao.
- **Normalizacao**: converte em objeto padrao de documento e ocorrencias.
- **Regra de Negocio**: classifica ocorrencias em ERROR/WARNING/INFO/UNKNOWN.
- **Catalogo**: tabela local e enrichment sem sobrescrever mensagem original.
- **Persistencia**: tabelas `esocial_documents`, `esocial_occurrences`, `esocial_message_catalog`.
- **API de Consulta**: listagem por documento e por ocorrencia com filtros.
- **XSD**: validacao opcional com selecao de schema por versao/tipo.

## Endpoints
- `POST /esocial/xml/import`
- `GET /esocial/documents`
- `GET /esocial/documents/:id`
- `GET /esocial/documents/:id/occurrences`
- `GET /esocial/occurrences`
- `POST /esocial/catalog/sync`

## Filtros Disponiveis
### Documentos
- `documentType`
- `eventType`
- `processingResult`
- `statusCode`
- `receiptNumber`
- `protocolNumber`
- `workerCpf`
- `page`, `pageSize`

### Ocorrencias
- `severity`
- `code`
- `sourceType`
- `documentId`
- `workerCpf`
- `receiptNumber`
- `protocolNumber`
- `page`, `pageSize`

## Estrutura de Persistencia
- `esocial_documents`: XML bruto, JSON parseado, hash, status, protocolo, recibo, versao/layout, resultado.
- `esocial_occurrences`: tipo, codigo, descricao original, localizacao, severidade, bloqueio, fragmento bruto.
- `esocial_message_catalog`: descricao oficial e sugestoes enriquecidas.

## Regras de Classificacao
- tipo `1` => `ERROR`
- tipo `2` => `WARNING`
- tipo `3` => `INFO`
- sem tipo => inferencia por contexto/status.

## XSD
Schemas devem ficar em `server/src/modules/esocial/infrastructure/xsd/` (pastas versionadas).
A validacao e opcional e nao bloqueia parse funcional por padrao.

## Auditoria
Cada import salva:
- XML bruto
- JSON parseado
- hash SHA-256
- ocorrencias extraidas
- erro de parsing (quando existir)
- resultado de validacao XSD (quando habilitada)

## Testes
Cobertura de cenarios:
- namespace e sem namespace
- ocorrencia unica e multipla
- erro, advertencia e historico de validacao
- lote e evento
- XML invalido
- variacao de versao de schema
