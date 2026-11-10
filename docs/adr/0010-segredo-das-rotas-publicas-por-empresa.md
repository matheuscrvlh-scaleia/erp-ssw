# ADR 0010 — Segredo das rotas públicas da ingestão por empresa

**Status:** aceita (10/11/2026)

## Contexto
`ftp-relatorio-import`, `ssw-ciclo-aplicar` e `xml-orfaos-retry` aceitavam um segredo global
(`FTP_INGEST_SECRET` no ambiente, ou `configuracoes.backfill_cron_token` em texto no banco) e a
empresa vinha do pedido (`?empresa=`, `x-empresa` ou corpo). Quem tivesse o segredo de uma empresa
gravava arquivo em qualquer outra.

## Decisão
- Integração nova `ingestao_publica`, uma por empresa, com o segredo cifrado pelo cofre
  (AES-256-GCM, contexto `empresa:ingestao_publica`), cadastrado em Plataforma → Empresa →
  Integrações e ligado pelo `ativo`.
- A rota acha a empresa pelo segredo recebido (`x-ftp-ingest-secret`; nas rotas de cron também
  `x-cron-token`), comparado em tempo constante, no `onRequest`. A empresa pedida só vale se for a
  dona do segredo (outra dá 404); sem empresa pedida, vale a dona.
- `FTP_INGEST_SECRET` e o uso de `backfill_cron_token` saem. Não fica segredo global: a
  compatibilidade com quem chama hoje vem de cadastrar, para a FR, o mesmo valor de hoje.

## Consequências
- Quem chama não muda nada se o valor cadastrado for o atual. Empresa nova precisa do seu próprio
  segredo para usar as rotas.
- Nenhum segredo cadastrado: 503 `ingest_secret_nao_configurado` com onde cadastrar.
- Segredos decifrados ficam 60 s em memória na API (como o cadastro do webhook).
