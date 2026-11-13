# ADR 0018 — Relatórios do SSW web baixados pelo worker-ssw, por empresa

- Situação: aceita (11/11/2026, decisão do dono; renumerada de 0013 em 13/11/2026)
- Complementa: ADR 0012 (lista de jobs e contrato do HTTP interno)

## Contexto

Os relatórios 036, 038, 050, 306, 455 e 930 chegam hoje por um script à parte (`ssw-download`,
Python + Playwright, cron de 30 min numa VPS): entra no SSW web com um usuário fixo no `.env`,
baixa os relatórios e sobe no SFTP, de onde o `sincronizar-ftp` importa. Serve a uma empresa só.
O ERP vai receber várias empresas que usam o SSW, e o cadastro e a configuração de cada uma devem
ficar só no ERP.

## Decisão

1. **Integração nova `ssw_web`** em `empresa_integracoes` (sem migration: o `tipo` não tem
   CHECK). Parâmetros: `dominio` (vazio = `empresas.dominio_ssw`), `cpf`, `usuario`,
   `unidade_matriz` (vazio = `MTZ`), `unidades_038`, `unidades_038_so_com_dados` e
   `unidades_050` (listas). Segredo: a senha do SSW, cifrada como as outras. O ERP cadastra e
   liga; o worker-ssw só lê.
2. **Job novo `baixar-relatorios-ssw`** no worker-ssw, por empresa com `ssw_web` ligada, às :00 e
   :30 (UTC, o mesmo relógio do script). Entra no SSW web com o Chromium (Playwright), baixa os
   relatórios e os entrega **direto à recepção da ingestão** (a mesma do `sincronizar-ftp`, com os
   mesmos nomes de arquivo, então o ciclo e a detecção não mudam). Depois roda o ciclo de
   aplicação. Sem SFTP no caminho: a empresa só precisa da credencial do SSW.
3. `baixar-relatorios-ssw` entra em `JOBS_PEDIVEIS` (`dados: {}`): o ERP pode pedir uma rodada à
   mão, que também serve para testar a credencial.
4. O catálogo ganha `alternativas`: `aplicar-ciclos`, `sla-arquivos` e `limpar-ingestao-arquivos`
   rodam na empresa com `sftp` **ou** `ssw_web` ligada. O Diagnóstico SSW considera a integração
   ligada se qualquer uma estiver (`integracoesDoJob`).
5. Concorrência: até 2 navegadores por vez em todo o worker-ssw (memória); a fila deduplica por
   empresa, então uma rodada atrasada não acumula outra.

## Consequências

- A imagem do worker-ssw passa a levar o Chromium (base `mcr.microsoft.com/playwright`).
- O script `ssw-download` sai de cena quando a empresa ligar `ssw_web`. As duas fontes juntas na
  mesma empresa duplicariam os arquivos (a recepção ignora o repetido pelo nome e pelo SHA-256,
  mas os carimbos de hora diferem): ligar uma ou outra.
- O SSW web não tem API para esses relatórios; mudança de tela no SSW quebra o job, e a falha
  aparece em Diagnóstico SSW (`ultimasFalhas`).
