# Migração de dados `public` → `erp`

Ferramenta: `apps/migrador` (Node + TS, linha de comando). Copia os dados do sistema atual
(schema `public`, mais `auth.users`/`auth.identities` e o Vault) para o schema `erp` do sistema
novo, no mesmo Postgres, seguindo `docs/dados/de-para.md`. O `public` só é lido.

## Antes de rodar

1. Schema `erp` criado e catálogo semeado (o migrador confere e recusa se faltar):
   `bun run db:migrar` e `bun run --cwd packages/db semear`.
2. Variáveis de ambiente (arquivo `apps/migrador/.env` ou o ambiente do shell):

   | Variável                                       | O quê                                                                                                                   |
   | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
   | `MIGRADOR_ORIGEM_URL`                          | Conexão que **lê** `public`, `auth` e `vault.decrypted_secrets` (no Supabase: o papel `postgres`).                      |
   | `MIGRADOR_DESTINO_URL`                         | Conexão que **escreve** no `erp`: o papel `erp_migracao` (dono das tabelas, então o RLS não filtra a carga).             |
   | `SEGREDOS_CHAVES`, `SEGREDOS_CHAVE_ATUAL`      | As mesmas chaves mestras da API (`versão:base64 de 32 bytes`). Obrigatórias fora do `--dry-run`: os segredos de integração são gravados cifrados com elas. |
   | `LOG_NIVEL`                                    | Opcional (`info`).                                                                                                      |

3. Rodar de uma máquina perto do banco (a mesma região do Supabase): o tempo é dominado pela
   rede, não pela CPU.

## Como rodar

```bash
# simulação: lê e transforma tudo, não grava; relatório do que aconteceria (inclusive os erros)
bun run --cwd apps/migrador migrar --dry-run

# carga completa (retomável)
bun run --cwd apps/migrador migrar

# só algumas tabelas / só uma empresa / lote menor
bun run --cwd apps/migrador migrar --tabelas ctes,ocorrencias --empresa <uuid> --lote 500

# começar do zero (ignora o checkpoint; o upsert regrava igual)
bun run --cwd apps/migrador migrar --recomecar
```

`--ajuda` lista as opções. Saída em `--saida` (padrão `apps/migrador/.migrador/`):
`checkpoint.json` e `relatorio-<instante>.md` / `.json`. Código de saída: 0 sucesso,
1 falha (valor que não cabe no destino ou conferência que não bate), 2 uso/configuração.

**Segurança.** Se qualquer conexão apontar para o projeto de produção (`quyrhwmfbqikkpmiivuq`,
no host ou no usuário do pooler), o migrador recusa, a menos que se passe
`--confirmar-producao` (só na virada). Conexão, senha, segredo e hash nunca vão para o log nem
para o relatório; o log mostra só host/porta/banco.

## Como funciona

- **Lotes por keyset** na chave da origem (PK ou chave natural), **uma transação por lote**
  (upsert de todas as linhas do lote ou de nenhuma).
- **Idempotente:** upsert pela chave natural do destino (`id` preservado, ou empresa + sigla +
  número no CT-e, empresa + relatório + hash nas linhas de relatório...). Rodar de novo regrava
  igual.
- **Retomável:** checkpoint por tabela salvo depois de cada commit (última chave lida e
  contadores). Caiu no meio: rodar de novo continua da última chave; se caiu entre o commit e o
  checkpoint, o lote é relido e o upsert o regrava igual. O checkpoint fixa o **instante de
  referência** (usado nas janelas de retenção e nos carimbos que a origem não tinha), para a
  conferência e as retomadas verem o mesmo recorte.
- **Transformações** (`src/transformacoes`, `src/tabelas`): nomes e tipos do de-para, listas e
  JSON, `numeric` sem escala → `numeric(14,2)`/`numeric(12,3)`, `integer` → `smallint`. Valor que
  não cabe (mais casas decimais, fora da faixa, fora da lista fechada) **para a tabela**: o lote
  não é gravado e a linha vai para o relatório com coluna e valor. Nada é arredondado. Na
  simulação a leitura segue e o relatório junta todos esses valores.
- **FKs conferidas antes de gravar:** pai que não migrou (empresa nula, CT-e sem sigla...)
  descarta a linha filha ou zera a coluna, conforme o de-para; os dois casos entram no relatório.
  As FKs circulares (empresa × usuário, CT-e × CT-e em `duplicado_de`) são gravadas no passo
  `aposMigrar`, depois de todas as tabelas.
- **Conferência por tabela** (no fim): relê a origem, transforma de novo (sem gravar) e lê o
  destino no escopo da tabela. Compara **quantidade** e **checksum** (soma do SHA-256 de cada linha
  em forma canônica, independente da ordem). Diferença = falha no relatório, nunca correção
  silenciosa.

## Ordem

Dependências primeiro (`src/tabelas/registro.ts`):

1. **Fundação:** `empresas` → `usuarios` (+ `usuarios_perfil`) → `identidades_externas` (Google)
   → `plataforma_admins` → `cargos` e `cargo_telas` (globais de hoje copiados para cada empresa,
   Q30) → `departamentos`, `departamento_telas` → `unidades` → `empresa_usuarios` (com o setor do
   perfil, ADR 0003) → `usuario_telas` → `empresa_modulos` → `empresa_integracoes` (+ Vault +
   `ssw_config`) → `configuracoes` → `auditoria`.
2. **Cadastros:** `filiais`, `filiais_apelidos`, `parceiros`, `prazos_configurados`, `equipes`,
   `equipe_membros`, `codigos_ocorrencia`, `feriados`, `anotacoes`, `metas`, bonificação (5).
3. **CT-e:** `ctes`, `cte_prazo_historico`.
4. **Operação:** `ocorrencias`, `coletas`, `romaneio_saidas_cte` (cópia direta).
5. **Ingestão e logs:** `bi2_bruto`, `bi2_sincronizacoes`, `ingestao_*` (inclusive as 5 stagings
   → `ingestao_linhas`), `xml_*`, `ssw_webhook_eventos`, `ssw_sincronizacoes`.
6. **Pós-migração:** `criado_por`/`atualizado_por` das empresas, `duplicado_de` dos CT-e,
   sequência de `auditoria.id`.
7. **Passos finais:** `conferir-colunas-calculadas` (recálculo pelo núcleo; não roda no
   `--dry-run`) e `reconstruir-projecoes`, que só deixa no relatório o lembrete de rodar o comando
   do worker-ssw (ver abaixo).
8. **Conferência** de cada tabela.

### Usuários e senhas

`auth.users.id` é preservado (tudo referencia ele). E-mail normalizado; nome = perfil → metadado
→ e-mail; `ativo` = `usuarios_perfil.ativo` e não banido. O hash bcrypt vai para `senha_hash` com
`senha_algoritmo = 'bcrypt'` **só de quem entra por senha hoje** (hash bcrypt válido e e-mail
confirmado); o login novo valida o bcrypt no primeiro acesso e regrava em argon2id. Quem não
tinha senha (só Google, convite pendente) continua sem. Os casos sem hash aparecem no relatório
como ajuste (sem o hash).

### Integrações

O segredo principal sai do Vault (`empresa_integracoes.segredo_id`); sem ele, a senha (SSW API)
ou o segredo do webhook do `ssw_config`. É cifrado com AES-256-GCM (`packages/db/src/segredos.ts`,
contexto `<empresa_id>:<tipo>`). Domínio, usuário, CNPJ EDI, CNPJs aceitos e a última verificação
do `ssw_config` completam `parametros` quando a integração não os tem. `ssw_config` sem integração
gera a integração (`ssw_api` se tem senha, `ssw_webhook` se tem segredo). O token de sessão do SSW
não migra (expira em 4 h; o worker-ssw gera outro).

## Tempo estimado

Pelos volumes do DEVELOP (`erp-ssw-referencia/banco/tabelas-tamanho.txt`), com lote de 1000 e a
máquina na mesma região do banco:

| Tabela                                       | Linhas na origem              | Carga       |
| -------------------------------------------- | ----------------------------- | ----------- |
| `ocorrencias`                                | 1,52 mi                       | 8–15 min    |
| `ingestao_linhas` (6 stagings, 60 dias)      | ≈ 0,5–0,6 mi (de 2,9 mi)      | 5–10 min    |
| `cte_prazo_historico`                        | 447 mil                       | 2–4 min     |
| `ctes` (≈ 100 colunas)                       | 252 mil                       | 3–6 min     |
| `romaneio_saidas_cte`                        | 270 mil                       | 1–2 min     |
| `bi2_bruto` (jsonb)                          | 216 mil (384 MB)              | 3–6 min     |
| logs com retenção (`ftp_xml_sync_log`, `bi2_sync_log`, `ssw_aplicacao_log`...) | dezenas de milhares | 1–3 min |
| fundação e cadastros                         | centenas                      | segundos    |

Total da carga ≈ 25–45 min; a conferência relê origem e destino e leva tempo parecido. Conte
**1 a 1,5 h** para a execução completa. A primeira simulação (`--dry-run`) leva ≈ o tempo da
carga e mostra os problemas antes de gravar qualquer coisa.

O de-para sugere criar os índices secundários de `ocorrencias` depois da carga. O migrador não
faz DDL (o schema é das migrations): se a carga de `ocorrencias` ficar lenta, apagar e recriar
esses índices é um passo manual do DBA, fora da ferramenta.

## Conferência e relatório

O relatório (`.md` para ler, `.json` completo) traz, por tabela: lidas, migradas, descartadas
por motivo (com as chaves das linhas), ajustadas (coluna zerada, senha não levada...), valores que
não couberam (chave, coluna, valor) e a conferência origem × destino (quantidade e checksum).
Também traz as notas do pós-migração, as pendências dos passos finais e a lista do que fica fora
por decisão do de-para. Só identificadores (ids, chaves) aparecem como exemplo de linha.

## Rollback

O `public` nunca é escrito: o sistema atual continua igual, não há o que desfazer nele. O schema
`erp` é descartável:

- refazer tudo: `--recomecar` (o upsert regrava) ou, para limpar, `drop schema erp cascade`,
  `bun run db:migrar`, `semear` e apagar o `checkpoint.json`;
- refazer uma tabela: apagar as linhas dela no `erp` (respeitando as FKs: filhas antes) e rodar
  com `--tabelas <nome> --recomecar`.

## Depois da carga

- **Logo das empresas:** `empresas.logo_caminho` guarda o mesmo caminho do Storage do Supabase;
  o arquivo precisa ser copiado para o S3 com a mesma chave.
- **Projeções** (`romaneio_viagens_cte`, `romaneio_cte_atual`, `cte_dados_relatorios`,
  `romaneio_conferente_cte`): são do worker-ssw (ADR 0012) e o migrador não as grava. Na virada,
  depois da carga e antes de ligar a ingestão, roda o comando `reconstruir-projecoes` do
  worker-ssw por empresa (docs/deploy.md §10); o relatório do migrador traz o lembrete. A projeção
  é o estado acumulado: conferir com o worker-ssw se o comando lê toda a staging do `public` ou só
  os 60 dias de `ingestao_linhas`, e comparar a contagem de cada projeção com a matview de hoje
  (fazer `REFRESH` delas antes).
- **Colunas calculadas** (`fora_universo`, `ocorr_efetiva_*`, `data_conclusao_efetiva`,
  `prazo_padrao_*`, `penaliza`, `quarentena`...): copiadas como estão, para o primeiro dia bater.
  As três colunas novas de `ctes` (`filial_efetiva`, `pagador_cnpj_digitos`,
  `ocorr_efetiva_codigo_num`) são calculadas pelo migrador com as funções do núcleo
  (`@erp/dominio/nucleo`). `previsao_ssw_*` só é copiada quando `prazo_fonte` não é regra
  configurada: com regra, a previsão do SSW de antes não está na origem e fica nula (ajuste no
  relatório) até o próximo 038/BI2. O passo `conferir-colunas-calculadas` recalcula cada CT-e
  gravado com `recalcularDerivadosDoCte` e lista, por campo, quantos mudariam (até 20 exemplos):
  é relatório, não correção (Q20/Q52 explicam parte das diferenças). `penaliza` e `quarentena`
  das ocorrências são decididas na gravação e ficam como estão.

## Riscos

| Risco                                                                                     | Mitigação                                                                                                                              |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Apontar para produção por engano                                                          | Recusa por host e por usuário do pooler; só passa com `--confirmar-producao`.                                                          |
| Valor de dinheiro/peso com mais casas que o destino                                       | Falha explícita com a lista; rodar `--dry-run` antes e decidir caso a caso (corrigir na origem ou aceitar a mudança com o dono).        |
| CT-e sem sigla, com sigla ambígua no 455 ou duplicado em sigla + número                   | Descartado com motivo e chave no relatório (o duplicado fica o atualizado por último); ocorrências dele também ficam de fora.           |
| Código de ocorrência que não está no catálogo da empresa                                  | Ocorrência descartada e listada (a FK do destino não aceitaria).                                                                       |
| Sistema atual continua escrevendo durante a carga                                         | Rodar de novo antes da virada: o upsert traz o que mudou (linhas apagadas na origem não são apagadas no destino; na virada, `--recomecar` sobre um `erp` limpo). |
| Chaves de segredo diferentes das da API                                                   | A API e o worker-ssw não decifram as integrações; usar exatamente `SEGREDOS_CHAVES`/`SEGREDOS_CHAVE_ATUAL` da API (as mesmas do worker-ssw). |
