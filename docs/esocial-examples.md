# Exemplos eSocial

## Importacao via JSON
```json
{
  "xml": "<retornoEvento>...</retornoEvento>",
  "validateXsd": true,
  "sourceLabel": "retorno-api"
}
```

## Importacao via multipart/form-data
- Campo `file`: arquivo `.xml`
- Campo opcional `validateXsd`: `true|false`
- Campo opcional `sourceLabel`: texto livre

## Exemplo de retorno com ocorrencia
```xml
<retornoEvento xmlns="http://www.esocial.gov.br/schema/lote/eventos/retornoEvento/S-1.2">
  <processamento>
    <cdResposta>409</cdResposta>
    <descResposta>Falha</descResposta>
    <ocorrencias>
      <ocorrencia>
        <tipo>1</tipo>
        <codigo>MS0155</codigo>
        <descricao>CPF invalido</descricao>
        <localizacao>/evt2200/trabalhador/cpfTrab</localizacao>
      </ocorrencia>
    </ocorrencias>
  </processamento>
</retornoEvento>
```

## Consultas uteis
- `GET /esocial/occurrences?severity=ERROR`
- `GET /esocial/occurrences?code=MS0155`
- `GET /esocial/documents?workerCpf=12345678901`
- `GET /esocial/documents?receiptNumber=1.2.0000000000000000001`
