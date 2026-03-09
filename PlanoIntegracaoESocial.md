# Plano de integracao eSocial

Data: 2026-02-05

## 1) Objetivos
- Gerar eventos eSocial por lote com base na folha e cadastro.
- Permitir exportacao XML (modo manual) e envio via WebService (modo integrado).
- Registrar protocolo, recibo, erros e reprocessamento.

## 2) Eventos suportados
- S-2200 (admissao CLT)
- S-2300 (estagiario/TSVE)
- S-1200 (remuneracao)
- S-1210 (pagamentos)
- S-2299 (desligamento CLT)
- S-2399 (desligamento TSVE)
- S-1299 (fechamento periodicos)

## 3) Fluxo operacional
1) Preparacao
   - Validar company_id e centro de custo (obrigatorio para envio).
   - Validar rubricas mapeadas para Tabela 03.

2) Geracao
   - Criar ESocialBatch por competencia.
   - Gerar ESocialEvent por empregado e por tipo.

3) Envio
   - Modo 1: exportar XML para envio manual.
   - Modo 2: enviar via WebService (A1/A3).

4) Retorno
   - Registrar protocolo e recibo.
   - Guardar erros (ESocialError).
   - Permitir reprocessar eventos com erro.

## 4) Regras de mapeamento
- Rubricas -> Tabela 03 (natureza) + incidencias (INSS/IRRF/FGTS).
- Competencia -> S-1200 e S-1210.
- Contratos -> S-2200 e S-2300.
- Desligamentos -> S-2299 / S-2399.

## 5) Filas (BullMQ)
- esocial.generate
- esocial.submit
- esocial.retry

## 6) Validacoes obrigatorias
- Centro de custo informado.
- Rubricas com natureza e incidencias.
- Empregados com CPF, PIS, dados contratuais.
- Estagiarios com termo de compromisso e vigencia.

## 7) Armazenamento de evidencias
- XML gerado (storage)
- Protocolo e recibo
- Logs de retorno

## 8) Testes
- Mock de WebService para homolog.
- Validacao XSD antes de envio.
- Cenarios de erro e reprocessamento.

---
Fim do documento.
