# ADR 0007 — Ingestão SSW num pacote próprio, com fila e travas no Redis

**Status:** aceita (10/11/2026)

## Contexto
A ingestão SSW (spec 06) roda em dois lugares: no worker (FTP, ciclo de aplicação, manutenção) e
na API (rota pública `ftp-relatorio-import` e telas de importação manual, aplicação manual e XML).
Hoje a fila de aplicação (`ssw_aplicacao_fila`), as leases (`job_lease_*`) e a trava do FTP
(`ftp_sync_rodando`) são tabelas e funções no Postgres, e o banco novo não aceita função nem
gatilho.

## Decisão
- **`packages/ingestao`** guarda tudo da ingestão SSW: leitores puros dos relatórios
  (`./relatorios`, também usados pelo navegador na prévia do importador), regras puras de
  aplicação (`./aplicacao`), leitor/regras do XML (`./xml-cte`), casos de uso com portas
  (`./casos-de-uso`) e as implementações Drizzle/Redis/SFTP/BullMQ (`./infra`). API e worker
  montam as mesmas portas; os testes usam os falsos de `./testes`. As pastas `src/bi2` e
  `src/ssw-api` ficam para a ingestão BI2/SSW API.
- **Fila de aplicação no Redis**: conjunto ordenado por empresa (`SIGLA|NUMERO`). Preparação
  completa 1×/dia após 03:00 de Brasília; incremental = chaves com linha `aplicado_em` nulo
  (linha regravada por arquivo novo volta a ficar pendente). Depois do bloco, as linhas ganham
  `aplicado_em` na mesma transação e a chave sai da fila; se o Redis perder a fila, a próxima
  preparação a refaz pelo banco.
- **Travas no Redis** (`SET NX PX` + liberação só pelo dono): ciclo `ssw_aplicar_ciclo:<empresa>`
  180 s (também usada pela aplicação manual) e FTP `ftp:<empresa>` 4 min. O progresso do FTP fica
  num hash do Redis (some em 7 dias).
- **Disparo manual e rota pública** enfileiram o job com deduplicação por empresa + tipo
  (singleton). O 050 e as projeções do romaneio são jobs de outros domínios
  (`coletas.importar-050`, `projecoes.recalcular`).

## Consequências
- Sem Redis a API não registra as rotas da ingestão (desenvolvimento sem Redis segue funcionando).
- Os jobs (`ftp`, `ftp_retroativo`, `ssw_ciclo_aplicar`, `sla_arquivos`, `limpar_staging_038`,
  `xml_orfaos_retry`) usam os nomes, filas e horários do catálogo `@erp/shared/ingestao`; quem
  agenda é o despachante do worker, uma execução por empresa com a integração ligada. Nascem
  desligados: `AGENDAMENTOS_LIGADOS=true` e o job listado em `INGESTAO_JOBS_LIGADOS`.
- A senha do SFTP vem do cofre do worker (`SEGREDOS_CHAVES`/`SEGREDOS_CHAVE_ATUAL`, contexto
  `contextoDoSegredo(empresa, "sftp")`); `SFTP_*` só com `parametros.usar_env`.
