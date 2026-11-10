# R6 — Ingestão (SSW, BI2, FTP/XML, webhook, Ahgora, agendamentos)

> Desde o ADR 0012, "worker" neste documento é o **worker-ssw** (repositório separado); no ERP
> ficam as telas, o cliente do HTTP interno e os jobs do ERP na API.

Especificação extraída do sistema atual para reimplementação no worker (BullMQ) e na API do
`erp-ssw`. Fontes: `erp-ssw-referencia/banco/funcoes/*.sql` (definição real), código em
`fr-transportes/.claude/worktrees/agent-ae0264d9f8203d8fa` (branch `feat/multiempresa`, F0–F6),
`docs/multiempresa/{f5-crons-producao.sql,F7-plano-de-virada.md §1.3,README.md §F5}`,
`fr-transportes@feat/vps:docs/vps/worker.md`, `docs/decisoes/*.md` e as memórias do projeto.

Regras do núcleo do CT-e (ocorrência efetiva, finalizadores, prazo, `fora_universo`, situação)
estão em `docs/regras/01-nucleo-ctrc.md`; aqui só se diz **quando** a ingestão precisa chamá-las.

> Convenção de status: **ATIVO** = roda hoje na produção; **PAUSADO** = código e cron existem,
> desligados por decisão do dono; **DESLIGADO** = rota responde 410 / flag desligada; **MORTO** =
> sem chamador. Seção 9 lista o que não portar.

---

## 0. Conceitos que valem para toda a ingestão

### 0.1 Empresa da ingestão

Toda execução (job, rota pública, botão manual) é de **uma** empresa. Origem: `?empresa=<slug|id>`,
cabeçalho `x-empresa`, ou `empresa`/`empresa_id` no corpo (nessa ordem; o primeiro não vazio vale).

```ts
// origem: src/lib/empresa-ingestao.ts (decidirEmpresaIngestao)
type TipoIntegracao = "sftp" | "ssw_api" | "ssw_bi2" | "ssw_webhook" | "ahgora" | "xml_cte";
const STATUS_QUE_INGERE = new Set(["ativa", "implantacao"]);

function decidirEmpresa(pedida: string | null, tipo: TipoIntegracao, empresas, integracoes) {
  if (pedida) {
    const e = ehUuid(pedida) ? empresas.find(id == pedida, case-insensitive)
                             : empresas.find(slug == pedida, case-insensitive);
    if (!e) return erro(404, "empresa_desconhecida", `Empresa "${pedida}" não encontrada.`);
    if (!STATUS_QUE_INGERE.has(e.status))
      return erro(403, "empresa_inativa", `Empresa ${e.nome} está ${e.status}: a ingestão não roda.`);
    const i = integracoes.get(e.id, tipo);
    if (!i?.ativo) return erro(409, "integracao_desligada", `A integração ${tipo} da empresa ${e.nome} está desligada.`);
    return ok(e, i.parametros);
  }
  // Sem empresa: só vale se UMA empresa tiver a integração ligada (crons antigos).
  const elegiveis = empresas.filter(e => STATUS_QUE_INGERE.has(e.status) && integracoes.get(e.id, tipo)?.ativo);
  if (elegiveis.length === 0) return erro(409, "integracao_desligada", `Nenhuma empresa com a integração ${tipo} ligada.`);
  if (elegiveis.length > 1)  return erro(400, "empresa_obrigatoria", `Mais de uma empresa com a integração ${tipo} ligada: informe ?empresa=<slug>.`);
  return ok(elegiveis[0]);
}
```

- Cache de 60 s por `(tipo, pedida)` (`resolverEmpresaIngestao`).
- Resposta de erro das rotas: `{ ok:false, motivo, erro: mensagem }` com o status acima.
- Segredo da integração: cofre da empresa (`integracao_segredo(empresa, tipo, nome="principal")`);
  sem valor no cofre, a variável de ambiente só vale se `parametros.usar_env === true|"true"`
  (transição da FR). No sistema novo o cofre é AES-256-GCM no backend (arquitetura.md).
- Toda gravação leva `empresa_id` explícito; todo casamento de CT-e é `(empresa_id, ...)`.

### 0.2 Identidade do CT-e: número, sigla e "estacionado"

O número do CTRC **não é único** entre séries/unidades (CAP033214 ≠ CAS033214; a CAS reinicia
em 999999→1). `ctrcs` tem `UNIQUE(numero_ctrc, empresa_id)`. Consequências (todas fiéis):

- Arquivos SSW (930/038/455) casam por **número**, mas por número vale a **série vigente**
  (CT-e de emissão mais recente). O CT-e mais antigo de outra série que ocupava o número é
  **estacionado**: `numero_ctrc = '<número>/<SIGLA>'` (ex.: `35123/CAS`), mantendo dados e
  ocorrências (ligadas por id). CT-e com `/` no número é estacionado.
- 455 CSV (`aplicar_partes_455`) casa por **sigla+número**, aceitando o estacionado.
- BI2 0017 casa por `numero_ctrc` **exato** + `data_emissao` (estacionado nunca casa).
- Webhook e 036 casam só por número (o 036 confere a sigla quando as duas existem).

```ts
// origem: ssw_num_ctrc / ssw_sigla_ctrc / ssw_norm_ctrc (SQL)
function numCtrc(ctrc: string | null): string | null {          // "CAP033214-5" -> "33214"
  if (ctrc == null) return null;
  const digitos = ctrc.trim().split("-")[0].replace(/\D/g, "");
  return digitos === "" ? null : String(BigInt(digitos));        // tira zeros à esquerda
}
function siglaCtrc(ctrc: string | null): string | null {        // "cap033214-5" -> "CAP"
  if (ctrc == null) return null;
  const m = /^([A-Za-z]+)/.exec(ctrc.trim());
  return m ? m[1].toUpperCase() : null;
}
const normCtrc = (c: string | null) => (c ?? "").trim() === "" ? null : numCtrc(c); // idem, vazio → null

// origem: src/lib/ctrc.ts normalizeNumeroCtrc (BI2, webhook)
function normalizarNumeroCtrc(v: unknown): string | null {
  const s = String(v ?? "").trim(); if (!s) return null;
  const semDv = s.split("-")[0].trim(); if (!semDv) return null;
  const d = semDv.replace(/\D+/g, ""); if (!d) return null;
  const n = parseInt(d, 10);                                     // atenção: Number, não BigInt (fiel)
  return Number.isFinite(n) ? String(n) : null;
}
```

### 0.3 Fonte da escrita em `ctrcs` (antes: `app.escrita_fonte` + gatilhos)

Hoje três gatilhos decidem o que cada fonte pode gravar. No sistema novo o repositório de
`ctrcs` recebe a fonte explicitamente e aplica as mesmas regras **em TS, antes do UPDATE/INSERT**:

```ts
type FonteEscrita = "ssw" | "bi2" | "bi2_0017_prazo_entregue" | "webhook" | "xml" | "manual";

// origem: _trg_ctrcs_bi2_nao_cria (BEFORE INSERT)  — o BI2 nunca cria CT-e (09/11/2026)
function podeInserir(fonte: FonteEscrita) { return fonte !== "bi2" && fonte !== "bi2_0017_prazo_entregue"; }
// (INSERT descartado em silêncio: sem erro, 0 linhas)

// origem: _trg_ctrcs_bi2_preserva_ssw (BEFORE UPDATE ... WHEN cardinality(old.campos_ssw) > 0)
function aplicarProtecaoSsw(antigo: Ctrc, novo: Ctrc, fonte: FonteEscrita): Ctrc | "descartar" {
  if ((antigo.campos_ssw?.length ?? 0) === 0) return novo;        // ATENÇÃO: sem marca, nada protege (fiel)
  const bi2 = fonte === "bi2" || fonte === "bi2_0017_prazo_entregue";
  // CT-e em andamento só muda pelos arquivos do SSW (regra do dono, 09/11/2026)
  if (bi2 && antigo.cancelado_em == null
         && !ehEntregue(antigo.data_entrega_realizada, antigo.ocorr_efetiva_codigo)            // 01-nucleo
         && !ehFinalizadoSemEntrega(antigo.data_entrega_realizada, antigo.ocorr_efetiva_codigo)) // 01-nucleo
    return "descartar";                                           // UPDATE inteiro ignorado
  if (fonte !== "bi2") return novo;                               // 'bi2_0017_prazo_entregue' passa tudo
  const manter = new Set(antigo.campos_ssw);
  if (manter.has("data_prevista_entrega")) { manter.add("prazo_fonte"); manter.add("data_base_prazo"); }
  manter.add("campos_ssw");                                       // o BI2 não mexe na própria marcação
  for (const c of manter) if (c in antigo) novo[c] = antigo[c];
  return novo;
}
```

`campos_ssw text[]` = colunas cujo valor atual veio dos arquivos SSW (marcadas por
`aplicar_staging_ssw` e `aplicar_partes_455`). Ver **dúvida D3** (a proteção só vale para CT-e com
`campos_ssw` não vazio).

### 0.4 Efeitos que hoje são gatilho e o caso de uso passa a chamar

Toda escrita da ingestão em `ctrcs`/`ocorrencias` precisa disparar, no mesmo caso de uso e na
mesma transação, os recálculos que hoje são gatilho (regras em `01-nucleo-ctrc.md`):

| Hoje (gatilho) | Quando | O que o worker faz |
| --- | --- | --- |
| `trg_aaa_ctrcs_data_minima_emissao` | INSERT em `ctrcs` | **descarta** o INSERT se `data_emissao < configuracoes.ctrc_data_minima_emissao` (da empresa; hoje 2026-09-01). Sem erro. |
| `trg_ctrcs_calc_cancelado_mesmo_dia`, `trg_ctrcs_zz_fora_universo`, `trg_ctrcs_prazo_padrao`, `trg_ctrcs_unidade_cidade_por_filial`, `trg_ctrcs_calc_ocorr_efetiva`, `trg_ctrcs_data_conclusao_efetiva` | INSERT/UPDATE das colunas citadas | recalcular os derivados (01-nucleo) |
| `trg_ctrcs_log_prazo` | UPDATE de `data_prevista_entrega` | gravar `ctrc_prazo_historico` (spec de prazo) |
| `trg_ctrcs_zzz_ignora_update_identico` | todo UPDATE | não gravar linha sem mudança (importa para `updated_at` e para o histórico) |
| `trg_aaa_guard_data_ocorrencia`, `trg_fill_ocorrencia_penaliza`, `trg_validar_ocorrencia_dominio` | INSERT em `ocorrencias` | quarentena se `data_hora` (SP) < emissão; `penaliza` pelo código; descarte de `origem='trackingdanfe'` fora do domínio (origem morta) |
| `trg_sync_status_atual`, `trg_sync_data_embarque`, `trg_sync_data_emissao_80`, `trg_ocorrencias_recompute_efetiva`, `trg_ocorrencias_recompute_cancelado` | INSERT/UPDATE/DELETE em `ocorrencias` | recalcular situação, embarque, emissão pelo 80, ocorrência efetiva, cancelado (01-nucleo) |
| `trg_036_saida_{ins,upd,del,trunc}` | escrita em `staging_036_romaneios` | manter `romaneio_saida_ctrc` (§3.9) |
| `trg_staging_*_dado_hash` | INSERT/UPDATE em staging | `dadoHash()` calculado em TS (§2.3) |
| `trg_bi2_raw_ignora_update_igual` | UPDATE em `bi2_raw` | não regravar se `payload, data_alvo, numero_ctrc, codigo_relatorio` iguais |
| `set_updated_at_xml_cte_orfaos`, `update_updated_at_column` | UPDATE | `updated_at = now()` no repositório |

### 0.5 Fuso e datas (armadilhas que mudam número)

- Relatórios SSW trazem hora de **São Paulo sem fuso**. `staging_930.ocorrencia_em/inclusao_em`
  são `timestamp without time zone` em hora de SP; para virar instante: `zonedToUtc(x, "America/Sao_Paulo")`.
  **Nunca** aplicar o fuso duas vezes.
- `data_entrega` do 930 é `date`; quando é ela que vira `data_entrega_realizada` (sem ocorrência
  1/18/67), o SQL faz `data_entrega::timestamptz` na sessão UTC = **00:00 UTC** (21:00 SP do dia
  anterior). Fiel: `new Date(data_entrega + "T00:00:00Z")`. Ver dúvida D7.
- `importado_em` é instante (timestamptz). Comparações com hora do 930 convertem o instante para
  hora local de SP (`toZonedNaive(importado_em, SP)`) e comparam valores ingênuos.
- BI2: `toIsoDateTime("dd/mm/aaaa hh:mm[:ss]")` → `aaaa-mm-ddThh:mm:ss-03:00`; ano de 2 dígitos → `20aa`.

---

## 1. Panorama

```
SSW deposita CSV no SFTP (/arquivos_import) a cada 30 min (:00/:30) ─┐
                                                                    ▼
 job ftp (Edge processar-ftp-xmls)  ──POST arquivo──▶ ftp-relatorio-import ──▶ staging_* (dedupe hash)
        │  (050 vai direto para `coletas`)                             └─▶ ssw_relatorio_arquivos / ssw_ciclo_importacao
        └──POST──▶ ssw-ciclo-aplicar ◀── job ssw_ciclo_aplicar (a cada minuto)
                         │  fila incremental → aplicar_staging_ssw (blocos 4000)
                         │  → aplicar_036_romaneio → aplicar_partes_455
                         ▼
                      ctrcs / ocorrencias
 jobs SQL: projeções do romaneio (:15/:45), unidade pelo 455 + SLA pelos arquivos (:08/:38),
           limpeza do 038 (03:40 SP), limpeza de logs (00:30 SP)
 BI2 (API CSV do SSW): só 0017 ATIVO (+ backfill pausado por config); 0174/0013/0016/0220/cadastros PAUSADOS
 Webhook SSW2181 (SSW → /api/public/ssw-ocorrencias): ATIVO, uma ocorrência por chamada
 SSW API (generateToken): heartbeat de hora em hora (faixa "Integração SSW indisponível")
 XML CT-e: FTP DESLIGADO (flag); upload manual na tela + fila de órfãos (sem cron)
 Ahgora: só leitura sob demanda pelas telas (sem job, sem gravação)
```

| Fonte | Status | Entrada | Grava em |
| --- | --- | --- | --- |
| 930 Ocorrências | ATIVO | SFTP CSV | `staging_930_ocorrencias` → `ctrcs`, `ocorrencias` |
| 038 Pendentes (por unidade ARA/CAP/RIO) | ATIVO | SFTP CSV | `staging_038_ctrcs_pendentes` → `ctrcs` |
| 455 CSV Expedidos/Recebidos | ATIVO | SFTP CSV (até ~39 MB, dividido) | `staging_455_csv` + espelho `staging_455_ctrcs_expedidos` → `ctrcs` |
| 455 largura fixa | sem arquivo desde 25/09/2026 | SFTP / upload | `staging_455_ctrcs_expedidos` |
| 306 SSWMobile | ATIVO | SFTP CSV | `staging_306_ssw_mobile` (lido pela projeção de motorista do romaneio) |
| 036 Romaneios | ATIVO | SFTP CSV | `staging_036_romaneios` → `romaneio_saida_ctrc`, projeções, `ctrcs.romaneio_*` |
| 050 Coletas | ATIVO | SFTP CSV / impresso ssw0157 | `coletas` |
| BI2 0017 | ATIVO | API CSV | `ctrcs` (entrega/previsão de encerrado), `bi2_raw`, `bi2_sync_log` |
| BI2 0174, 0013, 0016, 0220, 0246/0247 | PAUSADO | API CSV | — |
| Webhook SSW2181 | ATIVO | POST JSON do SSW | `ssw_webhook_eventos`, `ctrcs`, `ocorrencias` |
| SSW API token | ATIVO | `generateToken` | cofre + `ssw_config` |
| XML CT-e | FTP DESLIGADO; upload manual | `.xml`/`.zip` | `ctrcs` (só completa), `xml_cte_*` |
| Ahgora | sob demanda | API REST | nada |

---

## 2. Utilitários comuns

### 2.1 Texto e números dos relatórios SSW

```ts
const limpa = (v?: string) => (v ?? "").replace(/^[\s ]+|[\s ]+$/g, ""); // trim + NBSP
const txt   = (v?: string) => { const s = limpa(v); return s === "" ? null : s; };
// numBR: "10.753.951,07" -> 10753951.07   (036, 455 CSV, BI2)
const numBR = (v?: string) => { const s = limpa(v).replace(/\s/g, ""); if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
// numPonto (038): Number(s) direto — o 038 vem com ponto decimal; "1,5" vira null (fiel)
// dataBR: "dd/mm/aaaa" -> "aaaa-mm-dd"; 930 e 455 CSV aceitam também "dd/mm/aa" (século 20)
// timestampBR(930): data + "h:mm|hh:mm" -> "aaaa-mm-ddThh:mm:00" (sem fuso); hora inválida -> 00:00
// codigoOcorrencia(texto): só dígitos -> int; vazio -> null   (SQL: nullif(regexp_replace(cod,'\D','','g'),'')::int)
```

### 2.2 Unidade pela localização (038)

```ts
// origem: ssw_unidade_de_localizacao(loc, dominio)   — "FRT CAP - EM TRANSITO" -> "CAP"
function unidadeDeLocalizacao(loc: string | null, dominio: string | null): string | null {
  const v = (loc ?? "").trim(); if (!v) return null;
  let pref: string;
  const p = v.indexOf(" - ");
  if (p >= 0) pref = v.slice(0, p).trim();
  else { const q = v.indexOf("-"); if (q < 0) return null; pref = v.slice(0, q).trim(); }
  if (!pref) return null;
  const dom = (dominio ?? "").trim().toUpperCase() || null;
  if (dom && pref.toUpperCase().startsWith(dom + " ")) pref = pref.slice(dom.length + 1).trim();
  return pref || null;
}
```
(A versão sem domínio, `ssw_unidade_de_localizacao(loc)` com `'FRT '` fixo, é MORTA.)

### 2.3 Hash de deduplicação das stagings (`dado_hash`)

`md5(concat_ws(chr(31), coalesce(campo::text, ''), ...))` na ordem abaixo. Linha com o mesmo
`(dado_hash, empresa_id)` é a mesma linha.

| Staging | Campos do hash, nesta ordem |
| --- | --- |
| 930 | ctrc, emissao_ctrc, serie_cte, nro_cte, serie_nota_fiscal, nro_nota_fiscal, pedido, empr_ocor, unid_ocor, inclusao_em, ocorrencia_em, usuario_ocor, cod_ocor, descricao_ocor, complemento_ocor, data_entrega, descr_item, primeiro_manifesto, cancelado, cnpj_pagador, nome_pagador |
| 038 | sem_prazo_definido, ctrc, nota_fiscal, remetente, destinatario, endereco, cidade, bairro, cep, setor, valor_mercadoria, quantidade_volumes, peso, prazo_entrega, atraso, ultima_ocorrencia, localizacao |
| 306 | placa, ctrc_coleta, data, motorista, remetente, uf_cidade_origem, setor_origem, destinatario, uf_cidade_destino, unidade_destino, setor_destino, data_previsao_entrega, ocorrencia_mobile, ocorrencia_atual |
| 036 | romaneio, data_emissao, hora_emissao, situacao, placa, placa_carreta, motorista, cpf_motorista, seguradora, autorizacao, validade, ctrc, tipo_frete, nome_remetente, nome_destinatario, cnpj_pagador, nome_pagador, cidade_pagador, cidade_entrega, cep_entrega, local_entrega, bairro, setor_dest, cod_ocorr_rom, desc_ocorr_rom, data_ocorr_rom, hora_ocorr_rom, cod_ocorr_ctrc, desc_ocorr_ctrc, data_ocorr_ctrc, hora_ocorr_ctrc, frete_ctrc_origem, frete_ctrc, peso_calculo, qtde_vol, vlr_merc, cod_merc, serie_nf, numero_nf, nro_pedido, conferente, ajudante, ajudante_2, ajudante_3, emitido_por, prev_entrega_ctrc |
| 455 CSV | todas as colunas **exceto** id, lote_id, arquivo_origem, importado_em, criado_em, linha_bruta, dado_hash (hoje `md5(to_jsonb(row) - [...])`, inclui `empresa_id`) |
| 455 largura fixa | sem hash: chave única = (tp, ctrc, inclusao_texto, inclusao, vendedor, remetente, destinatario, praca, cidade, uf, pagador, nota_fiscal, peso_calc, base_icms_iss, icms_iss, icms_st, base_ibs_cbs, ibs_mun, ibs_est, cbs, frete, valor_mercadoria, ocorrencia, previsao_entrega_texto, previsao_entrega, status_letra, empresa_id) `NULLS NOT DISTINCT` |

Formato textual dos valores (para bater com o Postgres): `date` → `aaaa-mm-dd`; `timestamp` →
`aaaa-mm-dd hh:mm:ss`; boolean → `true/false`; numeric → como gravado. **Recomendação:** o
migrador recalcula `dado_hash` de todas as linhas migradas com a função TS (o hash só precisa ser
consistente dentro do sistema novo; o do 455 CSV hoje depende da serialização do `jsonb`).

---

## 3. Por fonte

### 3.1 Coleta no SFTP — job `ftp` (hoje Edge `processar-ftp-xmls`)

Configuração SFTP da empresa (integração `sftp`): `parametros.host|porta(22)|usuario|caminho_xml("/")|relatorios_path("/arquivos_import")|importados_path("/importados")`, senha no cofre; com `usar_env`, `SFTP_*` do ambiente.

```ts
// origem: supabase/functions/processar-ftp-xmls/index.ts
const MAX_PARTE_BYTES = 3_000_000, MAX_RELATORIOS = 24, ORCAMENTO_RELATORIOS_MS = 120_000;
const RETENCAO_DIAS = 3, LOCK_STALE_MS = 4 * 60_000, ESTABILIDADE_MS = 20_000;

async function jobFtp(empresa, { manual, retroativo }) {
  // 1. Pausa: configuracoes(empresa).ftp_sync_ativo == "false" e não manual
  //    -> log {status:"pausado", mensagem:"Sincronização pausada pelo administrador"}; fim.
  //    Erro lendo a config: segue (fail-open).
  // 2. xmlCteAtivo = configuracoes.xml_cte_ativo == "true" (hoje false: §3.19)
  // 3. Sem segredo/host/usuário/senha -> log erro "Segredos FTP/INGEST não configurados".
  // 4. Trava: configuracoes.ftp_sync_rodando=="true" e updated_at há < 4 min -> {status:"ja_rodando"}.
  //    Grava ftp_sync_rodando="true" (no fim, SEMPRE "false" em finally).
  //    No worker novo: substituir por lock Redis `ftp:<empresa>` TTL 4 min + singleton BullMQ,
  //    mantendo a linha de configuracoes para a tela (lock_ativo) e o botão "liberar trava".
  // 5. progresso(fase:"conectando") ; conecta SFTP (readyTimeout 15 s);
  //    falha -> log erro "SFTP indisponível: <msg>", resposta 502 sftp_offline.
  // 6. [XML, só se xmlCteAtivo] — ver §3.19 (não portar o ramo FTP).
  // 7. Relatórios (pasta relatorios_path; se não existe: nada a fazer):
  //    a. retenção: apaga subpastas aaaa-mm-dd de importados_path com nome <= hojeSP-3 dias.
  //    b. estabilidade: lista *.csv (só arquivo regular), espera 20 s, lista de novo;
  //       pronto = mesmo tamanho e mtime nas duas leituras e tamanho > 0.
  //    c. rodízio por tipo: agrupa por prefixo antes do 1º "_" (036, 038, 455...), ordena por nome,
  //       pega 1 de cada grupo em round-robin até 24; depois reordena: tamanho <= 3 MB primeiro,
  //       maiores por último.
  //    d. para cada arquivo, até 120 s desde o início do bloco:
  //       - baixa; se > 3 MB: divide (dividirCsv), grava cada parte como `<nome>_parteNN_<carimbo>.csv`
  //         (put em `.tmp` + rename; parte existente é apagada antes), move o original para
  //         importados/<hojeSP>/ e segue (as partes entram nas próximas passadas). Status "processado".
  //       - senão: POST ftp-relatorio-import {empresa, nome, base64, sha256, tamanho, mtime}
  //         (em processo no worker novo). ok -> move para importados/<hojeSP>/<nome>
  //         (status "duplicado" se a rota respondeu "ignorado", senão "movido"); erro -> fica no FTP.
  //    e. SEMPRE depois: chama ssw-ciclo-aplicar (§3.13) para a empresa; erro vira item de log.
  //    f. retroativo (só job ftp_retroativo): lista nomes já em ssw_relatorio_arquivos (paginado),
  //       varre importados/<aaaa-mm-dd>/*.csv e reenvia (enviarRelatorio) o que não está lá
  //       (arquivo grande: basta `nomeParte(nome,1)` estar registrado). Mesmo orçamento de 120 s.
  // 8. Log em ftp_xml_sync_log {triggered_by: manual?"manual":"cron", status, duracao_ms,
  //    arquivos_processados = movidos+duplicados, arquivos_movidos (=processados), pastas_limpas,
  //    arquivos_com_erro, ctrcs_processados, mensagem, erros[]}.
  //    status = com_erro==0 ? "ok" : processados>0 ? "parcial" : "erro".
  //    mensagem: "Nenhum arquivo pendente no FTP[; N pasta(s) antiga(s) removida(s)]"
  //              ou "<movidos> movido(s), <comErro> com erro[, N pasta(s) antiga(s) removida(s)]".
  // 9. progresso(fase:"concluido", finalizado_em) em finally.
}

function dividirCsv(buf: Uint8Array): Uint8Array[] {
  // linhas = split por "\n" mantendo o "\n"; cabeçalho = linhas que começam com "0;" ou "1;"
  // cada parte = cabeçalhos + linhas de dado, até 3_000_000 bytes (contando os cabeçalhos)
}
function nomeParte(nome: string, i: number) {
  // "455_csv_e_2026-10-27_1330.csv" -> "455_csv_e_parte01_2026-10-27_1330.csv" (carimbo no fim)
  const m = /^(.*)_(\d{4}-\d{2}-\d{2}_\d{4}\.csv)$/i.exec(nome);
  const nn = String(i).padStart(2, "0");
  return m ? `${m[1]}_parte${nn}_${m[2]}` : `${nome.replace(/\.csv$/i, "")}_parte${nn}.csv`;
}
// enviarRelatorio de arquivo > 3 MB (só na revarredura retroativa): envia parte a parte;
// esgotou o tempo entre partes -> {adiado:true} (fica para a próxima); parte com erro -> para.
```

`ftp_sync_progresso` (uma linha por empresa): `fase` (conectando|processando|relatorios|retroativo|concluido),
`total_arquivos`, `arquivo_atual_index/nome`, `xmls_no_arquivo_total/index`, `mensagem`,
`iniciado_em`, `heartbeat_em` (a cada atualização), `finalizado_em`. Arquivo grande escreve
"Baixando arquivo grande (N s)", "Dividindo", "Gravando parte i de n".

Idempotência: o arquivo só sai de `/arquivos_import` depois de a rota responder ok; reprocessar o
mesmo arquivo é barrado por nome+sha256 (§3.2) e, dentro da staging, por hash.

### 3.2 Recepção de um arquivo — rota `ftp-relatorio-import` / `processarArquivoRelatorio`

```ts
// origem: src/routes/api/public/ftp-relatorio-import.ts + src/features/ssw/server/ciclo.server.ts
async function receberArquivo(empresaId, { nome, base64, sha256, tamanho, mtime }) {
  const bytes = base64Decode(base64.includes(",") ? base64.split(",", 2)[1] : base64);
  let conteudo = new TextDecoder("iso-8859-1").decode(bytes);
  if (pareceRelatorio050(conteudo)) return importarRelatorio050(empresaId, conteudo, nome); // §3.10, fora do ciclo

  const visto = await arquivos.porNome(empresaId, nome);         // ssw_relatorio_arquivos
  if (visto?.status === "importado" && visto.sha256 === sha256)
    return { ok:true, status:"ignorado", mensagem:"arquivo já importado anteriormente", gravados: visto.linhas };

  const det = await detectarRelatorioBytes(nome, bytes);        // §3.2.1 ; tenta latin-1 e depois UTF-8
  if (det.tipo_confirmado) conteudo = det.conteudo;
  const ciclo = det.ciclo_chave ?? "sem-carimbo";
  // unidade só para tipo com ssw_relatorio_tipos.por_unidade (hoje só o 038)
  const unidade = det.unidade && tipos[det.tipo_confirmado]?.por_unidade ? det.unidade : null;

  if (!det.tipo_confirmado) {
    registrar("erro", 0, det.motivo, det.tipo);                 // upsert por (nome_arquivo, empresa)
    garantirCiclo(ciclo); ciclo.status = "erro"; ciclo.motivo = `${nome}: ${det.motivo}`;
    return { ok:false, status:"erro", mensagem: det.motivo };
  }
  garantirCiclo(ciclo);                                         // insere {status:"aberto"} se não existe
  // tentativa anterior que não terminou: apaga as linhas do lote antigo
  if (visto?.lote_id && visto.status !== "importado") {
    staging(det.tipo_confirmado).deleteWhere({ lote_id: visto.lote_id });
    if (det.tipo_confirmado === "455csv") staging455Espelho.deleteWhere({ lote_id: visto.lote_id });
  }
  const loteId = uuid();
  registrar("importando", 0, null, det.tipo_confirmado, loteId); // telas que leem staging ignoram este lote
  try {
    const r = await gravarStaging(empresaId, det.tipo_confirmado, conteudo, nome, loteId); // §3.3
    if (det.tipo_confirmado === "455csv") await espelhar455CsvNo455(empresaId, loteId);   // §3.6; falha = erro do arquivo
    registrar("importado", r.gravados,
      det.divergencia_nome_cabecalho ? `nome sugeria ${det.tipo}, cabeçalho confirmou ${det.tipo_confirmado}` : null,
      det.tipo_confirmado, loteId);
    ciclo.arquivos_importados += 1; ciclo.linhas_importadas += r.gravados;
    ciclo.ultimo_arquivo_em = now(); ciclo.status = "importando";
    return { ok:true, status:"importado", tipo: det.tipo_confirmado, gravados: r.gravados };
  } catch (e) {
    registrar("erro", 0, msg(e), det.tipo_confirmado, loteId);  // mantém o lote: linhas parciais ficam identificáveis
    ciclo.status = "erro"; ciclo.motivo = `${nome}: ${msg(e)}`;
    return { ok:false, status:"erro", mensagem: msg(e) };
  }
}
// registrar(): upsert ssw_relatorio_arquivos {nome_arquivo, ciclo_chave, tipo_codigo, unidade, tamanho,
//   mtime: trunc, sha256, status, linhas, mensagem, visto_em: now, importado_em: status=="importado"?now:null, lote_id}
```

Telas que leem a staging direto (aba Hoje do romaneio, projeções) **excluem lotes cujo arquivo não
está `importado`** — o worker deve manter esse contrato (status do arquivo é o "commit" do lote).

#### 3.2.1 Detecção do tipo

```ts
const TIPOS = ["036", "038", "306", "455", "455csv", "930"] as const;
const RE_NOME = /^(\d{3})_([a-z0-9_]*?)_?(?:([A-Z]{2,4})_)?(\d{4}-\d{2}-\d{2})_(\d{4})\.csv$/i;
// nome: tipo = código de 3 dígitos se estiver em TIPOS ("455csv" nunca vem do nome), unidade = grupo 3 (maiúsculo),
//       ciclo_chave = "aaaa-mm-dd_hhmm". Ex.: 038_pendentes_ARA_2026-11-10_0930.csv -> 038, ARA, 2026-11-10_0930
// cabeçalho decide: testa primeiro o tipo do nome e depois os demais na ordem de TIPOS;
//   vale o 1º parser com cabecalho_divergente == false. Parser que lança = incompatível.
// bytes: tenta "iso-8859-1" e depois "utf-8"; nenhum -> motivo
//   "Nenhum parser reconheceu o cabeçalho (testado latin-1 e UTF-8). bytes=N hex[0..96]=... · amostra: [enc] 3 linhas"
// 050: detectado antes, pelo conteúdo: /^ssw0157\s+RELACAO DAS COLETAS/m ou /^﻿?UNIDADE;COLETA;TIPO;/ nos 2000 primeiros caracteres.
```

### 3.3 Gravação em staging (comum)

```ts
// origem: gravar-staging.server.ts
async function gravarStaging(empresaId, tipo, conteudo, arquivo_origem, lote_id) {
  const a = analisar(tipo, conteudo);                            // parsers §3.4–3.9
  if (a.cabecalho_divergente) throw new Error(`Cabeçalho do relatório ${tipo} divergente do esperado — arquivo não importado.`);
  const importado_em = now();
  const linhas = dedupe(a.registros, r => JSON.stringify(r))      // repetida no próprio arquivo sai
                 .map(r => ({ ...r, lote_id, arquivo_origem, importado_em, empresa_id, dado_hash: dadoHash(tipo, r) }));
  for (const bloco of chunks(linhas, 250))                       // até 2 tentativas, 1,5 s entre elas
    await upsertStaging(tipo, bloco);
  registrarErrosParsing(tipo, a.erros_parsing, { lote_id, etapa: "gravacao", arquivo_origem }); // blocos de 500, best-effort
  return { gravados: linhas.length, erros_parsing: a.erros_parsing.length };
}
```

| Tipo | Conflito | Em conflito |
| --- | --- | --- |
| 036, 038, 306, 930 | `(dado_hash, empresa_id)` | **atualiza** a linha existente com o lote novo (`lote_id`, `arquivo_origem`, `importado_em`, `linha_bruta`): linha idêntica "passa para o lote mais novo". Por isso o último arquivo 038 de cada unidade é a foto completa dos pendentes. |
| 455csv | `(dado_hash, empresa_id)` | **nada** (`DO NOTHING`): só o que mudou entra no lote (o arquivo traz o mês inteiro). |
| 455 largura fixa | 27 colunas (§2.3) | atualiza com o lote novo |

Erros de parsing: `staging_036_romaneios_erros_parsing`, `staging_038_erros_parsing`,
`staging_306_erros_parsing`, `staging_455_erros_parsing` (455 e 455csv), `staging_930_erros_parsing`
com `{lote_id, etapa, arquivo_origem, numero_linha, linha_bruta, motivo}`.

### 3.4 930 — Ocorrências (CSV)

- Linhas: `0;` = cabeçalho de colunas; `1;` = dado; vazia ignorada; qualquer outro prefixo =
  erro `linha não começa com "0;" nem "1;" (prefixo encontrado: "X")`. CSV com aspas (`""` escapa).
- 24 campos exatos (`esperado 24 campos, encontrado N`). Cabeçalho esperado:
  `0;CTRC;EMISSAO_CTRC;SERIE_CTE;NRO_CTE;SERIE_NOTA_FISCAL;NRO_NOTA_FISCAL;PEDIDO;EMPR_OCOR;UNID_OCOR;DIA_INCLUSAO_OCOR;HORA_INCLUSAO_OCOR;DATA_OCOR;HORA_OCOR;USUARIO_OCOR;COD_OCOR;DESCRICAO_OCOR;COMPLEMENTO_OCOR;DATA_ENTREGA;DESCR_ITEM;PRIMEIRO_MANIFESTO;CANCELADO;CNPJ_PAGADOR;NOME_PAGADOR`
  (divergência por coluna; ausência = `Linha de cabeçalho de colunas (iniciada por "0;") não encontrada no arquivo.`).
- Mapeamento: `inclusao_em = timestampBR(DIA_INCLUSAO_OCOR, HORA_INCLUSAO_OCOR)`,
  `ocorrencia_em = timestampBR(DATA_OCOR, HORA_OCOR)` (hora SP sem fuso), `emissao_ctrc/data_entrega = dataBR` (aa → 20aa); demais `txt`.
- O 930 traz **só o dia corrente** (um a cada 30 min + o grande das ~23:30 SP). Lançamento depois
  do último arquivo do dia ou com data retroativa nunca chega (memória "baixa perdida"); o
  `ftp_retroativo` só reprocessa o que já está no FTP.

### 3.5 038 — Pendentes de entrega (por unidade)

- `0`/`9` ignoradas; `1` = cabeçalho (validação); `2` = dado com **17 campos** (`split(";")`, sem aspas).
  Outro tipo = `tipo de linha desconhecido`.
- Cabeçalho: `CTRC;NOTA FISCAL;REMETENTE;DESTINATARIO;ENDERECO;CIDADE;BAIRRO;CEP;SETOR;VALOR MERCADORIA;QUANTIDADE VOLUMES;PESO;PRAZO ENTREGA;ATRASO;ULTIMA OCORRENCIA;LOCALIZACAO`.
- `PRAZO ENTREGA == "31/12/2050"` ⇒ `sem_prazo_definido = true`, `prazo_entrega = null`, `atraso = null`.
- Números com `Number()` (ponto decimal); `quantidade_volumes`/`atraso` truncados.
- **Limpeza diária** (`limpar_staging_038_superadas(p_dias=7, p_lote=20000)`): apaga, em blocos de
  20 000 até sobrar < 20 000, linhas com `importado_em < now()-7d`, `numCtrc(ctrc) != null` e que tenham
  outra linha com **o mesmo texto de `ctrc`** e mesma empresa importada depois. Todas as empresas.

### 3.6 455 CSV — Expedidos e recebidos (colunas configuráveis)

Formato: `;` com aspas, `0;` = título, `1;` = nomes das colunas, `2;` = dado; outras linhas são
contadas como ignoradas; dado antes do `1;` = erro `linha de dado antes da linha de cabeçalho de colunas (1;...)`.
**Mapeamento por nome** (normaliza: sem acento, espaços colapsados, minúsculo). Coluna desconhecida
é só informada; coluna esperada ausente vira `null`. `cabecalho_divergente` só quando não há `1;`
ou nenhuma coluna conhecida. Tipos: `num` = numBR, `int` = trunc(numBR), `date` = dd/mm/aa(aa).

Colunas lidas (cabeçalho SSW → coluna): todas as de `COLUNAS_455_CSV` (126 do layout original +
4 de situação: `Previsao de Entrega`, `Compr. de Entrega Escaneado`, `Data do Escaneamento`,
`Hora do Escaneamento`). Lista completa e tipos: `src/features/ssw/server/parse-455-csv.server.ts`
(copiar literalmente; é dado, não regra). As demais 17 colunas do layout de 147 ficam como
"não reconhecidas" por decisão do dono (TDE CTRC Origem e comissões recusadas).

Desde 27/10/2026 (13:30) o arquivo chegou com o mês inteiro (~21 mil linhas, ~39 MB); desde 28/10
cada arquivo traz só CT-e emitidos no dia. A divisão em partes (§3.1) vale para qualquer CSV > 3 MB.

#### 3.6.1 Espelho para o formato do 455 antigo (`espelhar_455csv_no_455`)

Chamado para cada lote 455csv gravado (só as linhas novas desse lote). Converte para
`staging_455_ctrcs_expedidos` (é de lá que a aplicação tira frete, pagador, UF etc.):

```ts
// origem: espelhar_455csv_no_455(p_empresa, p_lote, p_importado_em = null)
for (const c of staging455Csv.doLote(empresa, lote).filter(c => (c.serie_numero_ctrc ?? "").trim() !== "")) {
  const hhmm = /^[0-2][0-9]:[0-5][0-9]$/.test(c.hora_de_emissao ?? "") ? c.hora_de_emissao : null;
  const semCodigo = (s) => trimOrNull(s?.trim().replace(/^[0-9]{3,}-/, ""));   // "001989-TORCH" -> "TORCH"
  linha = {
    lote_id, importado_em: p_importado_em ?? c.importado_em, arquivo_origem, linha_bruta,
    tp: trimOrNull(c.tipo_do_frete), ctrc: c.serie_numero_ctrc.trim(),
    inclusao_texto: c.data_de_emissao ? fmt(c.data_de_emissao, "dd/MM") + (hhmm ? " " + hhmm : "") : null,
    inclusao: c.data_de_emissao ? zonedToUtc(`${c.data_de_emissao} ${hhmm ?? "00:00"}`, SP) : null,
    remetente: semCodigo(c.cliente_remetente), destinatario: semCodigo(c.cliente_destinatario),
    praca: trimOrNull(c.praca_de_destino),
    cidade: trimOrNull(trimOrNull(c.cidade_de_entrega) ?? c.cidade_do_destinatario),
    uf: trimOrNull(trimOrNull(c.uf_de_entrega) ?? c.uf_do_destinatario),
    pagador: semCodigo(c.cliente_pagador), nota_fiscal: trimOrNull(c.numero_da_nota_fiscal),
    peso_calc: c.peso_calculado_em_kg, base_icms_iss: c.base_calculo_icms_iss,
    icms_iss: (c.valor_do_icms ?? 0) + (c.valor_do_iss ?? 0),
    base_ibs_cbs: c.base_calculo_ibs_cbs, ibs_mun: c.valor_ibs_municipal, ibs_est: c.valor_ibs_estadual, cbs: c.valor_cbs,
    frete: c.valor_do_frete, valor_mercadoria: c.valor_da_mercadoria,
    status_letra: trimOrNull(c.tipo_de_baixa?.trim().slice(0, 1)),
    cnpj_pagador: digitsOrNull(c.cnpj_pagador), tipo_documento: upperTrimOrNull(c.tipo_do_documento),
    previsao_entrega_texto: c.previsao_de_entrega ? fmt(c.previsao_de_entrega, "dd/MM") : null,
    previsao_entrega: c.previsao_de_entrega,
    // vendedor, icms_st, ocorrencia: null
  };
}
// DISTINCT pelas colunas de dado (sem cnpj_pagador/tipo_documento) e
// upsert na chave de 27 colunas: em conflito -> lote_id, importado_em, arquivo_origem, linha_bruta,
//   cnpj_pagador = novo; tipo_documento = coalesce(novo, antigo).
```

#### 3.6.2 Partes do CT-e pelo 455 (`aplicar_partes_455`) — fim de cada ciclo aplicado

Janela: linhas de `staging_455_csv` com `importado_em >= now() - 2 dias`. Não derruba o ciclo
(erro só é logado). Retorna contadores `{casados, alterados, parceiro, remetente, destinatario, tde, comprovante, setor, chave, placa_coleta, unidade_origem}`.

```ts
// origem: aplicar_partes_455(p_empresa, p_desde = now()-2d, p_dry_run=false); fonte de escrita "ssw"
const proprios = cnpjsProprios(empresa);  // dígitos de empresas.cnpj + integração xml_cte.parametros.cnpjs_emitentes
// última linha por (num, sigla) — importado_em DESC, id DESC; ignora num/sigla nulos
for (const s of ultimaPorSiglaNumero(staging455Csv.desde(p_desde))) {
  const p = ctrcs.find(empresa, numero_ctrc IN [s.num, `${s.num}/${s.sigla}`], sigla_ctrc == s.sigla);
  if (!p) continue;
  const t = {
    cnpj_remetente: formatarCnpjCpf(s.cnpj_remetente), cidade_remetente: trimOrNull, uf_remetente: trimOrNull,
    cep_remetente: digitsOrNull(s.cep_do_remetente), cnpj_destinatario: formatarCnpjCpf(s.cnpj_destinatario),
    cnpj_expedidor: formatarCnpjCpf(s.cnpj_expedidor),
    nome_expedidor: trimOrNull(s.cliente_expedidor?.trim().replace(/^[0-9]{3,}-/, "")),
    tde: s.tde,
    setor_destino: (s.setor_de_destino ?? "").trim().split(" ")[0] || null,   // "R07 R07" -> "R07"
    chave_cte: /^\d{44}$/.test(s.chave_ct_e?.trim() ?? "") ? s.chave_ct_e.trim() : null,
    placa_coleta: upperTrimOrNull(s.placa_de_coleta), unidade_origem: upperTrimOrNull(s.unidade_emissora),
  };
  // parceiro = expedidor, exceto quando é o próprio remetente (comparação do texto formatado)
  //            ou um CNPJ da própria empresa (comparação por dígitos)
  const parceiro_cnpj = t.cnpj_expedidor && t.cnpj_expedidor !== t.cnpj_remetente
                        && !proprios.includes(digits(t.cnpj_expedidor)) ? t.cnpj_expedidor : null;
  const parceiro_nome = parceiro_cnpj ? t.nome_expedidor : null;

  // (a) remetente/destinatário/parceiro — só se algo difere
  if (t.cnpj_remetente) { p.cnpj_remetente = t.cnpj_remetente;
    p.cidade_remetente = t.cidade_remetente ?? p.cidade_remetente; p.uf_remetente = t.uf_remetente ?? p.uf_remetente;
    p.cep_remetente = t.cep_remetente ?? p.cep_remetente; }
  if (t.cnpj_destinatario) p.cnpj_destinatario = t.cnpj_destinatario;
  if (t.cnpj_expedidor) { p.parceiro_cnpj = parceiro_cnpj; p.parceiro_nome = parceiro_nome; } // pode zerar
  // (b) tde: sobrescreve se t.tde != null e diferente
  // (c) setor: só preenche se p.setor == null
  // (d) chave_cte: só se p.chave_cte == null, nenhum outro CT-e da empresa tem a chave
  //     e a chave não aparece em dois CT-e diferentes neste lote (índice único chave_cte+empresa)
  // (e) placa_coleta: sobrescreve se t.placa != null e diferente (455 vence: BI2 trazia "ARMAZEM")
  // (f) unidade_origem: sobrescreve se t.unidade_origem != null e diferente
  // (g) comprovante: última linha por (num,sigla) COM `compr_de_entrega_escaneado` preenchido:
  //     comprovante_escaneado = upper(trim(x)[0]) == "S";
  //     comprovante_escaneado_em = data_do_escaneamento ? zonedToUtc(data + (hh:mm do início de hora_do_escaneamento ?? "00:00"), SP) : null
  //     grava se qualquer um dos dois difere (casa num ou num/sigla + sigla).
  // (h) campos_ssw += cnpj_remetente; cidade/uf/cep_remetente (se t.cnpj_remetente e o valor != null);
  //     cnpj_destinatario; parceiro_cnpj e parceiro_nome (se t.cnpj_expedidor); chave_cte (se gravada igual);
  //     placa_coleta; unidade_origem  — união ordenada e sem repetição; só grava se surgir marca nova.
}

// origem: formatar_cnpj_cpf
function formatarCnpjCpf(doc: string | null): string | null {
  if (/[A-Za-z]/.test((doc ?? "").trim())) return doc!.trim().toUpperCase(); // CNPJ alfanumérico (jul/2026+)
  const d = (doc ?? "").replace(/\D/g, "");
  if (d === "" || /^0+$/.test(d)) return null;
  const cpf = d.length === 11 || (d.length === 14 && d.startsWith("000")) ? d.slice(-11) : null;
  if (cpf && dvCpfOk(cpf)) return `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return d;                                    // (o DV do CNPJ é calculado mas não muda o resultado)
}
```

#### 3.6.3 Unidade pelo 455 (`ctrcs_unidade_pelo_455(p_horas=48)`) — job `sla_arquivos`, :08 e :38

Todas as empresas. Última linha por `(empresa, num, sigla)` de `staging_455_csv` com
`importado_em >= now() - 48h`. Para o CT-e com `numero_ctrc == num` (exato) e mesma sigla:
`filial = upper(trim(unidade_emissora))` quando não nula, diferente da atual e
(`filial` atual nula **ou** não é filial própria em `filiais_ssw`); junto,
`unidade_destino = coalesce(unidade_destino, upper(trim(unidade_receptora)))`. Fonte "ssw".

### 3.7 455 de largura fixa (legado)

Parser `parse-455.server.ts` (posições fixas, linha de dado = `/^[A-Z]{2} [A-Z]{2,6}\d{5,7}-\d/`).
Não chega arquivo desde 25/09/2026; segue reconhecido na detecção e no upload manual. Ver **D9**.

### 3.8 306 — Situação de uso do SSWMobile

- 1ª linha não vazia = cabeçalho literal
  `PLACA;CTRC/COLETA;DATA;MOTORISTA;REMETENTE;UF/CIDADE ORIGEM;SETOR ORIGEM;DESTINATARIO;UF/CIDADE DESTINO;UNIDADE DESTINO;SETOR DESTINO;DATA PREVISAO ENTREGA;OCORRENCIA MOBILE;OCORRENCIA ATUAL`
  (só espaço à direita difere ⇒ "Cabeçalho difere do esperado (diferença apenas de espaçamento)." e é divergente).
- Linha `9` sem mais nada = fim. Demais: 14 campos exatos.
- `numero_ctrc_norm` (hoje coluna gerada): se `trim(ctrc_coleta)` casa `^[A-Z]{2,4}[0-9]` → `numCtrc`, senão null.
- Não altera `ctrcs`. É lida pela projeção "motorista por CT-e" do romaneio
  (`romaneio_ctrc_motorista_306`: por `(empresa, numero_ctrc_norm)` a linha de `data DESC NULLS LAST, importado_em DESC`).

### 3.9 036 — Romaneios e CT-e de entrega

- `0` título e `9` fim ignorados; `1` = cabeçalho (comparado ao literal de 46 colunas, ver
  `CABECALHO_LITERAL_036`); `2` = dado com 47 campos (`split(";")`); outro marcador = erro.
- Datas `dd/mm/aaaa`; `frete_ctrc_origem, frete_ctrc, peso_calculo, vlr_merc` = numBR;
  `qtde_vol` = inteiro sem pontos; `prev_entrega_ctrc` = data.

**`romaneio_saida_ctrc`** (hoje gatilho de comando na staging 036), por empresa:
chave `(numero_ctrc = numCtrc(ctrc), sigla_ctrc = siglaCtrc(ctrc), data_saida = data_emissao)`,
para linhas com `ctrc`, `data_emissao`, número válidos e `situacao != 'CANCELADO'`.
- INSERT de linhas na staging → inserir as chaves (ignora existentes).
- DELETE (ex.: descarte de ciclo, limpeza de lote parcial) → remover as chaves que ficaram sem
  nenhuma linha válida na staging.
- UPDATE → remover chaves antigas que não reaparecem e não têm mais linha válida; inserir as novas.

**`aplicar_036_romaneio(empresa)`** — no fim de cada ciclo aplicado (e no último bloco da aplicação manual):

```ts
// origem: aplicar_036_romaneio ; lê mv_romaneio_036_ctrc (via view romaneio_036_ctrc)
// v = por (empresa, numCtrc(ctrc)) a linha de staging_036 com ordem:
//   importado_em DESC, romaneio DESC, (situacao=='BAIXADO') DESC, data_ocorr_ctrc DESC NULLS LAST,
//   hora_ocorr_ctrc DESC NULLS LAST, data_emissao DESC NULLS LAST
//   data_ocorr = data_ocorr_ctrc ? zonedToUtc(`${data_ocorr_ctrc} ${hora_ocorr_ctrc || "12:00"}`, SP) : null
for (const p of ctrcs.where(empresa, numero_ctrc == v.numero_ctrc /* exato */,
                           p.sigla_ctrc == null || v.sigla_ctrc == null || p.sigla_ctrc == v.sigla_ctrc)) {
  if (differ(p.romaneio_numero, v.romaneio) || differ(p.romaneio_situacao, v.situacao) ||
      differ(p.ajudante_nome, v.ajudante) || differ(p.ajudante_2_nome, v.ajudante_2) ||
      differ(p.ajudante_3_nome, v.ajudante_3) || differ(p.ocorr_036_codigo, v.cod_ocorr_ctrc) ||
      differ(p.ocorr_036_data, v.data_ocorr))
    update(p, { romaneio_numero, romaneio_situacao, ajudante_nome, ajudante_2_nome, ajudante_3_nome,
                ocorr_036_codigo, ocorr_036_descricao: v.desc_ocorr_ctrc, ocorr_036_data });   // -> ocorr. efetiva (01-nucleo)
}
```

Hoje a matview é atualizada pelo cron `:15/:45`, então o `aplicar_036` do ciclo usa a foto da
última atualização (atraso de até 30 min). No sistema novo, calcular `v` direto da staging no
momento da aplicação (mesma ordenação) — ver **D8**. As demais projeções do romaneio
(`mv_romaneio_viagem_ctrc`, `mv_romaneio_ctrc_motorista`, `mv_ctrc_staging_enriquecido`) são da
spec de romaneio; aqui só o agendamento (§4).

### 3.10 050 — Relação das coletas

Fora do ciclo e **sem registro em `ssw_relatorio_arquivos`** (a revarredura retroativa reenvia os
050 dos últimos 3 dias; é idempotente). Parser `src/features/coletas/parse-050.ts` (impresso
ssw0157 de largura fixa ou CSV `UNIDADE;COLETA;TIPO;...` do FTP; datas `dd/mm` ganham o ano da
emissão do relatório, e data > emissão + 60 dias volta um ano). Regras de tela/prazo na spec de coletas.

```ts
// origem: importar-050.server.ts + importar_coletas_050 ; blocos de 500
// por bloco: DISTINCT por (unidade, numero) (unidade e numero não nulos);
// upsert em coletas (unidade, numero, empresa) com tipo = tipo ?? "NORMAL", prejudicada_horario ?? false,
//   historico ?? [], relatorio_emitido_em = emitido_em do arquivo, arquivo_origem;
// em conflito, SÓ SE coletas.relatorio_emitido_em <= novo (mais novo vence; nada é apagado):
//   sobrescreve tudo, exceto ctrc_sigla/ctrc_numero/romaneio = coalesce(novo, antigo)
//   e prejudicada_horario = novo OR antigo.
// resposta: {lidas, gravadas, ignoradas = lidas - gravadas}; rota: mensagem "<lidas> coleta(s) lida(s), <ignoradas> já atualizada(s)"
```

### 3.11 Aplicação da staging em `ctrcs`/`ocorrencias` (`aplicar_staging_ssw`)

Coração da ingestão. Roda por empresa, em blocos de números de CTRC tirados da **fila**.

#### 3.11.1 Fila (`ssw_aplicacao_fila` + `ssw_fila_controle`)

```ts
// fila: (num, empresa_id) único, seq crescente, criado_em, processado_em
// origem: ssw_fila_preparar(empresa, reset)
function prepararFilaCompleta(empresa) {
  fila.deleteAll(empresa);
  fila.insertIgnore(distinct(numCtrc(ctrc) of staging_038 ∪ staging_455_espelho ∪ staging_930 da empresa) - null,
                    ordenado por num /* texto */);
  controle.upsert(empresa, { ultima_preparacao_em: now, ultima_completa_em: now, ultimo_modo: "completa",
                             ultimo_resultado: { total, pendentes } });
}
// origem: ssw_fila_preparar_incremental(empresa, margem=2h, hora_completa=03:00, forcar=false)
function prepararFilaIncremental(empresa) {
  lock(`ssw_fila_preparar:${empresa}`);                       // serializa automático × botão
  let corte = hojeSP() + 03:00 (SP); if (now < corte) corte -= 1 dia;
  const c = controle.get(empresa);
  if (forcar || !c?.ultima_preparacao_em || !c?.ultima_completa_em || c.ultima_completa_em < corte)
    return { ...prepararFilaCompleta(empresa), modo: "completa" };   // 1x por dia, depois das 03:00 SP
  const desde = c.ultima_preparacao_em - 2h;
  // números com linha gravada/regravada desde `desde` nas 3 stagings:
  // novo -> entra; já aplicado -> volta a pendente no FIM (seq novo, criado_em=now); pendente -> fica onde está
  enfileirar(nums(importado_em >= desde));
  controle.update(empresa, { ultima_preparacao_em: now, ultimo_modo: "incremental",
                             ultimo_resultado: { modo, desde, enfileirados, total, pendentes } });
}
```

Como 036/038/306/930 "movem" linhas idênticas para o lote novo (§3.3), cada novo 038 reenfileira
todos os CT-e da foto. Isso é esperado.

#### 3.11.2 Algoritmo de um bloco

```ts
// origem: aplicar_staging_ssw(p_empresa, p_dry_run=true, p_limite=null, p_log_id=null, p_offset=0)
// fonte de escrita "ssw"; timeout de comando 600 s; tudo numa transação
async function aplicarBloco(empresa, { dryRun, limite = 1_000_000, offset = 0, logId }) {
  const dominio = empresas.get(empresa).dominio_ssw;           // inexistente -> "Empresa da ingestão inexistente: <id>"
  if (!fila.temPendente(empresa)) prepararFilaCompleta(empresa); // ATENÇÃO: reset da fila inteira (manual)
  const keys = fila.pendentes(empresa).orderBy(seq).offset(dryRun ? offset : 0).limit(limite).map(f => f.num);

  // (1) Série vigente por número
  //   candidatos: 930 (sigla, emissao_ctrc), 455 espelho (sigla, data SP de inclusao), 038 (sigla, null)
  //   por num: sigla não nula, ordem em DESC NULLS LAST, sigla ASC  -> vig[num] = {sigla, em}
  //   CT-e já em ctrcs com numero_ctrc==num, sigla != vig.sigla, sigla e data_emissao não nulas e
  //   (vig.em == null || p.data_emissao >= vig.em)  -> vig[num] = {p.sigla, p.data_emissao} (o atual continua vigente)
  const vig = serieVigente(keys);

  // (2) Estornos 86: ids de staging_930 anulados (§3.12)
  const anul = anuladas930(empresa, keys);

  // (3) Estacionamento (só real): CT-e com numero_ctrc==num, sigla != vig.sigla (ambas não nulas),
  //     data_emissao não nula, e sem outro CT-e já em `${num}/${sigla}`  -> numero_ctrc = `${num}/${sigla}`
  if (!dryRun) estacionar(vig);

  // (4) Agregados por número, só com linhas da série vigente (ou todas, se vig[num] não existe)
  const c = agregar930(keys, vig, anul);   // abaixo
  const b = agregar455(keys, vig);         // abaixo
  const a = ultimo038(keys, vig);          // linha de maior importado_em, id DESC
  const cand = fullJoin(c, b, a).map(montarCandidato);   // abaixo; prod = ctrcs(empresa, numero_ctrc == num)

  // (5) Ignorados
  //   sigla_divergente: prod existe, prod.sigla não nula e difere de qualquer sigla não nula (cand, a, b, c)
  //   sem_data_emissao: !prod && cand.data_emissao == null
  //   chave_irrecuperavel: se offset==0 e (dryRun || nada processado na fila), uma entrada por
  //     linha das 3 stagings com numCtrc(ctrc)==null (conta em "ignorados")
  const ok = cand.filter(x => !x.sigla_divergente && (x.prod || x.data_emissao));
  const ins = ok.filter(x => !x.prod), upd = ok.filter(x => x.prod).map(diff).filter(nonEmpty);
  const oc = ocorrenciasNovas(ok, anul);    // (7)

  if (!dryRun) {
    inserir(ins);                          // (6a) ; ON CONFLICT (numero_ctrc, empresa) DO NOTHING ; data mínima §0.4
    atualizar(upd);                        // (6b)
    marcarCamposSsw(ok);                   // (6c)
    garantirCodigos(oc);                   // (7)
    inserirOcorrencias(oc);
    aplicarEstornos(empresa, ok.filter(x => x.tem_anulada).map(x => x.num)); // §3.12
    fila.marcarProcessado(empresa, keys);
  }
  const payload = { dry_run: dryRun, offset, processados: keys.length, candidatos: cand.length,
    pendentes: fila.contarPendentes(empresa),
    totais: { inserir: ins.length, atualizar: upd.length, ocorrencias: oc.length, ignorados: ign.length },
    inserir: top500(ins, "num"), atualizar: top500(upd, "num"), ocorrencias: top500(oc, ["num","data_hora"]),
    ignorados: top500(ign, ["motivo","num"]) };
  if (!logId) log.insert({ empresa, aplicado_por, dry_run, status: "concluido", iniciado_em: now,
                           finalizado_em: now, total_*: payload.totais, payload });
  return payload;
}
```

```ts
// 930 por número (linhas da série vigente)
function agregar930(rows) {
  const cod = r => codigoOcorrencia(r.cod_ocor), ok = r => !anul.has(r.id);
  return {
    sigla: max(siglaCtrc(r.ctrc)), emissao_ctrc: max(r.emissao_ctrc),
    ev80_data: dateOf(min(r.ocorrencia_em where cod==80)),
    entrega_em: max(r.ocorrencia_em where cod in [1,18,67] && ok),             // hora SP ingênua
    data_entrega: max(r.data_entrega where ok && cod !== 86 /* inclui cod nulo */),
    tem_anulada: any(!ok(r)),
    nro_cte, serie_cte, nro_nota_fiscal, serie_nota_fiscal, cnpj_pagador, nome_pagador, primeiro_manifesto:
      max(texto) de cada coluna,                                           // max lexicográfico (fiel)
    // agendamento do cliente (código 15): "...AGENDADA P/ dd/mm/aa..."
    agendada_para: dataEntregaAgendada(complemento) da linha cod==15 com data válida de maior
                   (coalesce(inclusao_em, ocorrencia_em) DESC, ocorrencia_em DESC),
    agendada_em: max(coalesce(inclusao_em, ocorrencia_em)) dessas linhas,
  };
}
// origem: ssw_data_entrega_agendada
const dataEntregaAgendada = (comp) => { const m = /AGENDADA P\/ (\d{2}\/\d{2}\/\d{2})/.exec(comp ?? "");
  return m ? parseOuNull(m[1], "dd/MM/yy") : null; };   // data inválida -> null

// 455 (espelho) por número (linhas da série vigente)
function agregar455(rows) {
  // b_dedup: uma linha por (num, lote_id): importado_em DESC, id DESC
  // inclusao_min = min(inclusao) por num
  // por (num, sigla): tipo_documento_ult = 1º não nulo por importado_em DESC, id DESC
  //                   previsao_ult = 1º previsao_entrega não nula por importado_em DESC, id DESC
  //                   previsao_ult_em = max(importado_em) das linhas com previsao_entrega não nula
  // escolhida por num: inclusao DESC NULLS LAST, importado_em DESC, id DESC
}

function montarCandidato(c, b, a, prod) {
  const t = trimOrNull;
  const agendaVale = c.agendada_para != null
    && (!prod || prod.data_entrega_realizada == null)                       // só CT-e em aberto
    && (c.emissao_ctrc == null || c.agendada_para >= c.emissao_ctrc)
    && (a == null || c.agendada_em > toZonedNaive(a.importado_em, SP))
    && (b?.previsao_ult_em == null || c.agendada_em > toZonedNaive(b.previsao_ult_em, SP));
  const previsao = agendaVale ? c.agendada_para
    : (b?.previsao_ult != null && (a == null || a.prazo_entrega == null || b.previsao_ult_em > a.importado_em))
      ? b.previsao_ult
      : (a?.prazo_entrega ?? b?.previsao_ult ?? null);
  return {
    num, sigla: c.sigla ?? b.sigla ?? a.sigla,
    data_emissao: c.emissao_ctrc ?? c.ev80_data ?? dataSP(b.inclusao_min) ?? dataSP(b.inclusao),
    numero_nf: digitsToBigint(c.nro_nota_fiscal ?? b.nota_fiscal ?? a.nota_fiscal),
    serie_nf: t(c.serie_nota_fiscal), numero_cte: zeroToNull(digitsToBigint(c.nro_cte)), sigla_cte: t(c.serie_cte),
    remetente: t(a.remetente ?? b.remetente), destinatario: t(a.destinatario ?? b.destinatario),
    cidade_destino: t(a.cidade ?? b.cidade), uf_destino: t(b.uf), bairro_destino: t(a.bairro),
    logradouro_destino: t(a.endereco), cep_destinatario: t(a.cep), setor: t(a.setor),
    peso: a.peso ?? b.peso_calc, volumes: a.quantidade_volumes,
    valor_mercadoria: b.valor_mercadoria ?? a.valor_mercadoria, valor_frete: b.frete,
    pagador_nome: t(c.nome_pagador ?? b.pagador),
    pagador_cnpj: digitsOrNull(t(c.cnpj_pagador) ?? b.cnpj_pagador),        // 930 primeiro; senão 455 CSV
    data_prevista_entrega: previsao, tipo_documento_455: b.tipo_documento_ult, atraso_dias: a.atraso,
    primeiro_manifesto: t(c.primeiro_manifesto),
    data_entrega_realizada: c.entrega_em ? zonedToUtc(c.entrega_em, SP)
                          : c.data_entrega ? new Date(c.data_entrega + "T00:00:00Z") : null,   // §0.5
    localizacao_atual: t(a.localizacao),
    unidade_atual: a.localizacao == null ? null : unidadeDeLocalizacao(a.localizacao, dominio),
    tem_anulada: c.tem_anulada ?? false, prod,
    sigla_divergente: !!prod?.sigla_ctrc && [sigla, a?.sigla, b?.sigla, c?.sigla].some(s => s && s !== prod.sigla_ctrc),
  };
}
```

**(6a) INSERT** (CT-e novo):
`filial = sigla_ctrc = sigla`, todos os campos do candidato, `prazo_entrega = data_prevista_entrega`,
`numero_nf` como int, `prazo_origem='proprio'`, `prazo_fonte='ssw_manual'`, `fonte_performance='ssw_manual'`.

**(6b) UPDATE** — o que cada campo faz quando o CT-e já existe (`p` = atual, `c` = candidato):

| Campo | Regra |
| --- | --- |
| `data_emissao` | **sobrescreve** se `c` não nulo e diferente (vale a dos arquivos; corrige a do BI2/UTC) |
| `numero_nf`, `numero_cte` (0 = vazio), `peso`, `volumes`, `valor_mercadoria`, `valor_frete`, `data_entrega_realizada` | só preenche vazio |
| `serie_nf`, `sigla_cte`, `remetente`, `destinatario`, `cidade_destino`, `uf_destino`, `bairro_destino`, `logradouro_destino`, `cep_destinatario`, `setor`, `pagador_nome`, `pagador_cnpj`, `primeiro_manifesto`, `localizacao_atual`, `unidade_atual` | só preenche vazio (vazio = null ou só espaços) |
| `data_prevista_entrega` | `c` não nulo e (`p` nulo **ou** (`p` em aberto e diferente)): em aberto → sobrescreve; entregue → só preenche vazio |
| `prazo_entrega` | mesma regra, comparando com `p.prazo_entrega` (em entregue vazio é preenchido — fiel; ver memória "previsão 038 + agendamento") |
| `prazo_fonte` | `'ssw_manual'` quando a previsão entrou no diff e (`p` em aberto ou `p.data_prevista_entrega` nulo) |
| `atraso_dias` | **sobrescreve** sempre que o 038 traz e difere (foto do SSW; telas não leem mais) |
| `tipo_documento_455` | **sobrescreve** quando difere |

Linha sem nenhuma diferença não é atualizada.

**(6c) `campos_ssw`**: para cada `ok` (casando `numero_ctrc == num` depois do UPDATE), acrescenta
o nome de cada coluna em que o valor gravado **é igual** ao do candidato (para texto, comparando
`trim`): `sigla_ctrc, data_emissao, numero_nf, serie_nf, numero_cte, sigla_cte, remetente,
destinatario, cidade_destino, uf_destino, bairro_destino, logradouro_destino, cep_destinatario,
setor, peso, volumes, valor_mercadoria, valor_frete, pagador_nome, pagador_cnpj,
data_prevista_entrega, prazo_entrega (compara com a previsão), atraso_dias, primeiro_manifesto,
data_entrega_realizada, localizacao_atual, unidade_atual`. União ordenada; grava só se houver marca nova.

**(7) Ocorrências do 930**:

```ts
// linhas 930 dos `ok`, com ocorrencia_em não nula, não anuladas, da sigla do candidato (ou qualquer, se nula),
// codigo entre 0 e 99. DISTINCT (num, codigo, data_hora = zonedToUtc(ocorrencia_em, SP),
//   descricao = trim, complemento = trim, filial = trim(unid_ocor), emissao = emissao_ctrc)
// remove as que já existem: ctrcs(numero_ctrc=num, data_emissao=emissao) com ocorrencia (codigo, data_hora)
// garantir_codigo_ocorrencia(empresa, codigo, max(descricao)) para cada código:
//   0..99; insere se não existe {descricao: trim || "Recebido via SSW", responsavel:"outro", penaliza:false,
//   letra_responsavel:"O", pendente_classificacao:true, ativo:true}; existente não muda.
// insere ocorrencias {ctrc_id: CT-e com numero_ctrc==num E data_emissao==emissao da linha,
//   codigo, descricao, data_hora, responsavel: codigos_ocorrencia.responsavel ?? "sistema",
//   origem:"ssw_930", complemento, filial} ON CONFLICT (ctrc_id, codigo, data_hora) DO NOTHING
//   (duas linhas iguais na chave com descrição diferente: fica uma, ordem indefinida — fiel)
// => a ocorrência só liga ao CT-e cuja emissão é a mesma do 930 (930 de CT-e estacionado não liga).
```

Depois: recálculos do §0.4 (situação, ocorrência efetiva, emissão pelo 80, embarque).

#### 3.11.3 Log da aplicação (`ssw_aplicacao_log`)

`ssw_aplicacao_log_iniciar(empresa, dry_run)` → linha `{status:'em_andamento', aplicado_por, iniciado_em}`
em transação **separada**, antes do bloco; `ssw_aplicacao_log_finalizar(id, 'concluido'|'erro', payload, erro)`
depois, gravando `finalizado_em`, `erro` (até 4000 caracteres), `payload` e `total_*` de `payload.totais`.
Status fora de `concluido|erro` → erro. A tentativa que falha fica registrada com o motivo.

### 3.12 Estorno de baixa (código 86)

Decisão de 03/11/2026 (`docs/decisoes/estorno-de-baixa-2026-11-03.md`): baixa lançada antes de um
estorno não vale; estorno seguido de nova baixa sai; estorno sem baixa depois deixa o CT-e aberto
e sem entrega. Só o 930 é desfeito (o que veio do BI2 0174 não).

```ts
const FINALIZADORES = [1, 18, 67, 12, 36, 61, 77, 92, 93, 94, 99]; // entrega + baixa (01-nucleo)
// origem: ssw_930_anuladas(empresa, nums) -> ids de staging_930 que não valem
function anuladas930(empresa, nums) {
  const rows = staging930(empresa, numCtrc(ctrc) in nums)
    .map(s => ({ id: s.id, ctrc: s.ctrc.trim() /* texto inteiro, com sigla e DV */,
                 cod: codigoOcorrencia(s.cod_ocor), incl: s.inclusao_em ?? s.ocorrencia_em }));
  const out = new Set<string>();
  for (const [ctrc, g] of groupBy(rows, "ctrc")) {
    if (!g.some(r => r.cod === 86)) continue;
    const ultEstorno = max(g.filter(r => r.cod === 86).map(r => r.incl));
    const ultBaixa   = max(g.filter(r => FINALIZADORES.includes(r.cod)).map(r => r.incl));
    for (const r of g) {
      if (FINALIZADORES.includes(r.cod) && r.incl < ultEstorno) out.add(r.id);   // baixa antes do estorno
      if (r.cod === 86 && ultBaixa != null && r.incl <= ultBaixa) out.add(r.id);  // estorno já superado
    }
  }
  return out;
}

// origem: ssw_aplicar_estornos(empresa, nums) — chamado no fim do bloco para os `ok` com tem_anulada
function aplicarEstornos(empresa, nums) {
  // L = linhas 930 dos nums ligadas ao CT-e (numero_ctrc == numCtrc, data_emissao == emissao_ctrc,
  //     sigla do CT-e nula ou igual), com flag anulada; mantém só CT-e que têm alguma anulada
  // 1) apaga de `ocorrencias` cada anulada (ctrc_id, codigo, data_hora = zonedToUtc(ocorrencia_em, SP)),
  //    EXCETO se existe linha NÃO anulada do mesmo CT-e com o mesmo código e a mesma ocorrencia_em
  //    (baixa relançada idêntica = mesma linha em ocorrencias)
  // 2) entrega: tem_baixa = existe não anulada com cod em FINALIZADORES
  //    nova = tem_baixa ? (zonedToUtc(max ocorrencia_em das não anuladas 1/18/67, SP)
  //                        ?? new Date(max data_entrega das não anuladas com cod != 86 + "T00:00:00Z")) : null
  //    grava data_entrega_realizada = nova se (nova != null || !tem_baixa) e difere do atual
  // 3) status_atual = descrição (ocorrencia.descricao ?? codigos_ocorrencia.descricao) da ocorrência
  //    de maior data_hora que sobrou, se não nula e diferente
  // 4) recalcular ocorrência efetiva de cada CT-e (01-nucleo)
  // retorna nº de CT-e afetados
}
```

### 3.13 Ciclo automático (rota `ssw-ciclo-aplicar` → job `ssw_ciclo_aplicar`)

"Ciclo" = rótulo `aaaa-mm-dd_hhmm` do nome do arquivo. Não há conferência de lote completo nem
freio: o ciclo sempre pode ser aplicado (decisão "automático faz exatamente o que o manual faz",
01/09/2026). A fila é **da empresa**, não do ciclo.

```ts
// origem: ciclo.server.ts fecharEAplicarCiclos / aplicarCiclo / avaliarCiclo
const BLOCO = 4000, ORCAMENTO_CICLO_MS = 40_000, ORCAMENTO_RODADA_MS = 60_000;
const ABERTOS = ["aberto","importando","aplicando","travado","pausado_freio","erro"];

async function jobSswCicloAplicar(empresa) {          // lease `ssw_aplicar_ciclo:<empresa>` TTL 180 s
  if (!lease.adquirir(...)) return { ok:true, status:"ja_rodando", resultados:[] };
  try {
    const inicio = now();
    for (const ciclo of ciclos(empresa).where(status in ABERTOS).orderBy(ciclo_chave).limit(50)) {
      const st = avaliarCiclo(empresa, ciclo);        // faltantes: informativo
      if (!st.pode_fechar) continue;                  // nenhum arquivo "importado" no ciclo
      ciclo.update({ faltantes: st.faltantes, motivo: st.motivo });
      const r = await aplicarCiclo(empresa, ciclo);
      if (r.status === "aguardando" || r.status === "erro") break;   // devolve o controle
      if (now() - inicio >= ORCAMENTO_RODADA_MS) break;
    }
  } finally { lease.liberar(); }
}

async function aplicarCiclo(empresa, ciclo) {
  if (ciclo.status === "aplicado") return "nada_a_fazer";
  const ant = ciclo.totais ?? {};                     // estado retomável: _blocos, _fila_pronta, _fila_iniciada_em, _processados, inserir...
  ciclo.update({ status:"aplicando", motivo:null, fechado_em: ciclo.status === "aplicando" ? undefined : now });
  try {
    if (!ant._fila_pronta) { filaIniciadaEm = now; prepararFilaIncremental(empresa); zera _processados/_blocos; persistir(); }
    // NÃO chamar aplicarBloco com a fila vazia (ele resetaria a fila e o ciclo recomeçaria sempre)
    let pendentes = fila.contarPendentes(empresa); const t0 = now();
    while (pendentes > 0) {
      const logId = logIniciar(empresa, false);
      const r = aplicarBloco(empresa, { dryRun:false, limite: BLOCO, logId });  // erro -> logFinalizar("erro") e relança
      logFinalizar(logId, "concluido", r);
      acumula totais; _processados += r.processados; _blocos++; pendentes = r.pendentes; persistir();
      if (r.processados === 0 || pendentes === 0 || now() - t0 >= ORCAMENTO_CICLO_MS) break;
    }
    if (pendentes > 0) return { status:"aguardando", motivo:`aplicação em andamento: ${proc} documentos aplicados, ${pendentes} na fila` };
    totais.romaneio_036 = aplicar036Romaneio(empresa);                 // erro derruba o ciclo
    try { totais.partes_455 = aplicarPartes455(empresa).alterados; } catch (e) { log(e); } // não derruba
    ciclo.update({ status:"aplicado", aplicado_em: now, totais: {...totais, _blocos, _processados, _fila_iniciada_em} });
    // todos os ciclos abertos cujo ultimo_arquivo_em <= filaIniciadaEm foram cobertos pela mesma fila:
    ciclos(empresa).where(status in ABERTOS, ultimo_arquivo_em <= filaIniciadaEm).update({ status:"aplicado", aplicado_em: now });
    return "aplicado";
  } catch (e) {
    ciclo.update({ status:"erro", motivo: msg(e), totais: {...totais, _blocos, _fila_pronta:true, _processados} });
    return "erro";                                 // o bloco que falhou é desfeito; a fila marca o que já foi
  }
}
// avaliarCiclo: para cada ssw_relatorio_tipos ativo e obrigatorio_no_ciclo, presente = arquivo "importado"
//   do ciclo com tipo (e unidade, se por_unidade com unidades_esperadas); faltantes "038/RIO", "930"...
//   motivo = completo ? null : `relatórios ausentes neste lote: ${faltantes.join(", ")}`; pode_fechar = algum arquivo importado
```

A "última atualização" mostrada nas telas (`SyncStatusBadge`, "Dados atualizados em…") é
`max(aplicado_em)` de `ssw_ciclo_importacao` com `status='aplicado'`.

**Descarte de ciclo** (tela, só Plataforma; `descartar_ciclo_importacao`): ciclo inexistente →
`Ciclo X não encontrado`; já aplicado → `Ciclo X já foi aplicado à produção em <data> — descarte não permitido`.
Senão apaga das 10 tabelas (`staging_036_romaneios`, `staging_036_romaneios_erros_parsing`,
`staging_038_ctrcs_pendentes`, `staging_038_erros_parsing`, `staging_306_ssw_mobile`,
`staging_306_erros_parsing`, `staging_455_ctrcs_expedidos`, `staging_455_erros_parsing`,
`staging_930_ocorrencias`, `staging_930_erros_parsing`) as linhas cujo `lote_id` ou
`arquivo_origem` pertence aos arquivos do ciclo; arquivos → `status='descartado'`,
`mensagem += ' [ciclo descartado]'`; ciclo → `status='descartado'`,
`motivo = '<motivo> — removidas N linhas de staging: {por tabela}'`. Retorna `{ok, ciclo_chave, total_removido, por_tabela}`.
(Não apaga `staging_455_csv`: fiel. Ver D10.)

**"Retomar ciclo"** (tela): `aplicarCiclo(empresa, ciclo)` direto.

**Aplicação manual** (tela "Aplicar staging", só Plataforma): mesmo `aplicarBloco` com
`limite`/`offset` da tela; prévia = `dryRun:true` (paginada por `offset`; não estaciona, então
mostra `sigla_divergente` onde o real estacionaria); `tem_mais = dryRun ? limite!=null && processados==limite : pendentes>0 && processados>0`;
`aplicar036Romaneio(dryRun)` só no último bloco; **não** chama `aplicar_partes_455`.

### 3.14 BI2 — base comum

- URL: `https://ssw.inf.br/api/bi2/<DOMINIO>/<recurso>?codigo=<cod>&data=<AAAAMMDD>`; domínio =
  `empresas.dominio_ssw` (ou `parametros.dominio`), maiúsculo, `^[A-Z0-9]{2,10}$` senão
  `Domínio SSW inválido: "X".` / `Domínio SSW da empresa não configurado (Plataforma → Empresa → Dados).`
- Auth: `Authorization: Basic <token>` (token do cofre `ssw_bi2`; transição: `SSW_BI2_TOKEN` com `usar_env`).
  Sem token → log `erro` "Token do BI2 não configurado para esta empresa".
- Timeout 30 s. Corpo latin-1. Vazio ou `"9"` = dia vazio.
- CSV: `0;razão;tipo;data` meta; `1;...` cabeçalho; `2;`/`3;` dado; `split(";")` sem aspas;
  coluna por nome case-insensitive; `raw` = colunas não vazias (trim).
- `bi2_sync_log`: uma linha por (data, relatório) `{data_alvo, modo, codigo_relatorio, status ok|erro|vazio, total_linhas, criados, atualizados, erro, iniciado_em, finalizado_em}`.
- `bi2_raw`: upsert `(numero_ctrc, codigo_relatorio, empresa)` com `{data_alvo, payload: raw, atualizado_em}` em
  blocos de 300 (o detalhe do CT-e lê `bi2_raw` **só pelo número**).
- Lease global `bi2_pesado` (TTL 180 s; 600 s no 0174): só um job BI2 pesado por vez **em todas as
  empresas**; quem chega com a trava ocupada devolve `{ok:true, ignorado:true, motivo:"outro job pesado em execução (escopo bi2_pesado)"}`.
  Execução manual (modo não `cron*`) não usa a trava. Falha ao pegar a trava → segue sem trava.

### 3.15 BI2 0017 — Performance dos entregues (ATIVO)

Recurso `cliente`, código `17`. `data` = data de **fechamento**; conteúdo = entregas de D-1.

```ts
// origem: bi2-0017-ingest.server.ts + bi2_0017_aplicar_lote
// colunas (1º nome presente): CTRC|NUMERO CTRC|NR CTRC ; DATA AUTORIZACAO|DT AUTORIZACAO|DATA_AUTORIZACAO ;
//   DATA PREVENTR|PREVISAO ENTREGA|DT PREV ENTREGA ; DATA ENTREGA|DT ENTREGA ; PERFORMANCE|PERF|PERFORMANCE DIAS ;
//   RESP CLIENTE|RESPONSABILIDADE CLIENTE|RESP_CLIENTE
async function ingest0017(ctx, dataFechamento, modo) {
  const res = await fetchBi2("cliente", "17", dataFechamento);
  if (res.status === 404 && (conteudoEmFimDeSemana(dataFechamento) /* D-1 é sáb/dom */ || dataFechamento === hojeSP()))
    return log("vazio");                                  // esperado
  if (res.status !== 200) return log("erro", `HTTP ${status}: ${body.slice(0,500)}`);
  const rows = parse(res).map(r => ({
    numero_ctrc: normalizarNumeroCtrc(r.CTRC),           // linha sem número sai
    data_emissao: toIsoDate(r["DATA AUTORIZACAO"]),
    data_prevista_entrega: toIsoDateTime(r["DATA PREVENTR"]) /* usado como date */,
    data_entrega_realizada: toIsoDateTime(r["DATA ENTREGA"]),
    performance_dias: toInt(r.PERFORMANCE), no_prazo: perf == null ? null : perf <= 0,
    responsabilidade_cliente: /^s(im)?$/i.test(r["RESP CLIENTE"] ?? ""),
  }));
  const linhas = rows.filter(r => r.data_emissao != null);  // sem autorização: ignora (número reciclado)
  for (const lote of chunks(linhas, 500)) aplicarLote0017(ctx.empresa, lote);   // erro de lote -> segue
  bi2Raw.upsert(rows com raw, codigo "17", data_alvo);
  log(erros && atualizados==0 ? "erro" : "ok", total_linhas: rows.length, atualizados: casados,
      erro: erros[0..3].join(" | ").slice(0,500) || (ignorados ? `ignorados_sem_autorizacao=${n}` : null));
}

// origem: bi2_0017_aplicar_lote(empresa, linhas)  — UPDATE-only (nunca cria)
function aplicarLote0017(empresa, linhas) {
  const l = ultimaPor(linhas, ["numero_ctrc", "data_emissao"]);   // última ocorrência no lote vence
  // Passo 1 — fonte "bi2" (sujeito à proteção §0.3):
  for (const x of l) for (const p of ctrcs(empresa, numero_ctrc == x.numero_ctrc, data_emissao == x.data_emissao)) {
    const entrega  = p.campos_ssw.includes("data_entrega_realizada") ? p.data_entrega_realizada : x.data_entrega_realizada;
    const previsao = p.campos_ssw.includes("data_prevista_entrega") ? p.data_prevista_entrega : (x.data_prevista_entrega ?? p.data_prevista_entrega);
    if (differ([p.data_entrega_realizada, p.data_prevista_entrega], [entrega, previsao]))
      gravar(p, { data_entrega_realizada: entrega, data_prevista_entrega: previsao }, "bi2");
  }   // casados = nº de CT-e casados ; alterados = nº gravados
  // Passo 2 — prazo ajustado depois da entrega (06/11/2026), fonte "bi2_0017_prazo_entregue":
  for (const x of l) for (const p of ctrcs(empresa, numero_ctrc == x.numero_ctrc, data_emissao == x.data_emissao)) {
    if (p.data_entrega_realizada != null && x.data_prevista_entrega != null
        && x.data_prevista_entrega >= p.data_emissao && p.data_prevista_entrega !== x.data_prevista_entrega)
      gravar(p, { data_prevista_entrega: x.data_prevista_entrega,
                  prazo_entrega: p.prazo_entrega === p.data_prevista_entrega /* null==null conta */ ? x.data_prevista_entrega : p.prazo_entrega,
                  prazo_fonte: "bi2" }, "bi2_0017_prazo_entregue");
  }
  return { casados, alterados, previsao_entregues };
}
// performance_dias, no_prazo, responsabilidade_cliente NÃO são gravados (o SLA vem de calcular_sla_arquivos).
```

**Rota/job `bi2_0017`** (body `{data?: "AAAA-MM-DD"|"AAAAMMDD", modo?, lookback?}`):
data inválida → 400 `{ok:false,error:"data inválida"}`; sem data: `modo=cron_continuo` → hoje SP,
senão ontem SP. Depois da data principal, `lookback` dias anteriores (padrão 2 em
`cron_continuo`/`cron_manha`, 0 nos demais; limitado a 0..7), cada um isolado (erro não para).
Resposta `{ok: status!="erro", ...resultado, lookback:[{data,status,total_linhas}]}`.
`modo` começando com `cron` usa a lease `bi2_pesado`.

**Backfill 0017** (`bi2_0017_backfill`, cron a cada 5 min): um tick processa a data do cursor
e anda **um dia para trás**:

```ts
// origem: backfill-tick.server.ts (config da empresa em configuracoes)
// chaves: bi2_0017_backfill_cursor, _pausado (padrão "true"), _data_final (padrão "2026-01-01"),
//         _tentativas_cursor, _tentativas_data ; grupo "bi2_backfill"; sob lease bi2_pesado
if (pausado) return { ok:true, pausado:true, motivo:"bi2_0017_backfill_pausado=true" };
if (!cursor) return { ok:true, pausado:true, motivo:"cursor vazio — clique em iniciar" };
if (cursor < dataFinal) { pausado = "true"; return { ok:true, concluido:true, cursor, data_final } }
tentativa = (tentativas_data == cursor ? tentativas_cursor : 0) + 1; grava tentativa e data;
if (tentativa > 3) { bi2_sync_log erro "Pulado automaticamente após 3 tentativas consecutivas (worker timeout).";
                     cursor -= 1 dia; tentativas = 0; return { pulado:true, ... } }
r = ingest0017(cursor, "backfill"); if (r.status !== "erro") { cursor -= 1 dia; tentativas = 0 }
```
Hoje pausado no cursor 2026-04-16 (memória "número de CTRC não é único"). Ver D4.

### 3.16 BI2 pausados — 0174, 0013, 0016, 0220, cadastros, reprocesso 0174

Pausados em 09/11/2026 por decisão do dono (BI2 só pode mexer em CT-e encerrado; 0174/0016
criavam CT-e e o gatilho `bi2_nao_cria` já os deixou inertes). Resumo para o caso de o dono
mandar portar (D2):

| Job | O que fazia | Peculiaridades |
| --- | --- | --- |
| `bi2_ctrc` (0174, recurso `ctrc`) | upsert de `ctrcs` por `numero_ctrc`, reconciliação de "esqueletos" do webhook pela NF, `ult_ocorr_*_0174`, `situacao_bi2`, placas, manifesto, `filial = fil_dest`; `bi2_raw` | `data` = emissão, URL pede emissão+1; `cron_continuo` lookback 2; `modo:"somente_bruto"` devolve as linhas sem gravar (usado nas cargas retroativas) |
| `bi2_0013` (recurso `cliente`, 13) | snapshot de atrasados: `atraso_dias`, unidades, `ultima_ocorr_*_0013`, `status_atual` | também roda o 0016 quando manual ou 09:00–09:29 SP |
| 0016 | devoluções atrasadas; **criava** CT-e | — |
| `bi2_0220` (recurso `caminhao`, 220) | `bi2_viagens` (CTRB/OS) | nenhuma tela lê `bi2_viagens` |
| `bi2_cadastros` (`tabelas` 0246/0247) | `codigos_ocorrencia` (descrição), `filiais_ssw` | dono: "não precisa" |
| `bi2_0174_reprocess`, `bi2_0220_backfill` | ticks de reprocesso por cursor | pausados por config |

Os `ult_ocorr_*_0174`/`ultima_ocorr_*_0013` já gravados continuam lidos pela ocorrência efetiva
(01-nucleo) — são dado migrado, não ingestão.

### 3.17 Webhook SSW2181 — Recepção de ocorrências (ATIVO)

Rota `POST /api/public/ssw-ocorrencias` (o SSW chama). `GET` devolve
`{ok:true, endpoint, metodo:"POST", mensagem:"Webhook SSW2181 ativo. Envie o token no header Authorization ou em ?secret=<token> na URL."}`.
Toda resposta tem `Cache-Control: no-store`. Formato de resposta do SSW (array de 1 elemento):
`[{ retorno: { codigo, descricao, numeroNFe, pedido, dataHora: <agora ISO>, protocolo } }]`.

```ts
// origem: src/routes/api/public/ssw-ocorrencias.ts + webhook-process.server.ts
async function webhook(req) {
  const ip = req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"] ?? "?";
  let empresaId: string | null = null;
  // TODA saída grava ssw_webhook_eventos {empresa_id (pode ser null), ip, user_agent, auth_ok,
  //   motivo_rejeicao, status_http, payload_bruto, erro_processamento, ctrc_id, ocorrencia_id}
  const raw = await req.text();
  const body = tryJson(raw); if (!body) { log(400, "json_invalido", { raw: raw.slice(0,2000) });
    return erro(400, "NAO FOI POSSIVEL PROCESSAR A REQUISICAO (json invalido)"); }

  const auth = extrairTokensAuthorization(req.headers.authorization);  // bearer|token|basic(user, senha, "user:senha")|raw
  const secretQuery = (url.searchParams.get("secret") ?? "").trim();
  let esperado = "";
  if (empresaInformada) {                                              // ?empresa=
    try { empresaId = resolver("ssw_webhook", empresaInformada); esperado = cofre(empresaId,"ssw_webhook").trim(); }
    catch (e) { log(401, e.motivo ?? "empresa_invalida"); return erro(401, "EMPRESA INVALIDA OU WEBHOOK DESLIGADO", { motivo }); }
    if (!esperado) { log(503, "webhook_nao_configurado");
      return erro(503, "WEBHOOK NAO CONFIGURADO — cadastre o segredo em Plataforma → Empresa → Integrações"); }
  }
  if (!req.headers.authorization && !secretQuery) { log(401,"autorizacao_ausente");
    return erro(401, "AUTORIZACAO AUSENTE — envie header 'Authorization: Bearer <token>' ou parametro ?secret=<token>", { motivo }); }
  if (req.headers.authorization && auth.scheme !== "raw" && auth.tokens.length === 0 && !secretQuery) { log(401,"token_header_vazio");
    return erro(401, "TOKEN DO HEADER VAZIO — Authorization foi recebido sem credencial valida apos o esquema", { motivo }); }
  if (!empresaInformada)                                               // dona do segredo (comparação exata)
    for (const t of [secretQuery, ...auth.tokens].filter(Boolean)) { const e = empresaPorSegredo("ssw_webhook", t); if (e) { empresaId = e; esperado = t; break; } }
  const okExato = esperado && auth.tokens.includes(esperado);
  const okContem = esperado && !okExato && headerContemSegredo(authHeader, esperado); // só se segredo >= 32 chars
  const okQuery = esperado && secretQuery === esperado;
  if (!empresaId || !(okExato || okContem || okQuery)) { log(401, "token_incorreto");
    const origem = auth.tokens.length ? "header" : "query";
    return erro(401, `TOKEN INVALIDO — valor recebido via ${origem} nao confere com o configurado`,
                { motivo:"token_incorreto", origem, comprimento_recebido }); }
  // CNPJ da transportadora: parametros.cnpjs_aceitos da integração; vazio -> ssw_config.cnpjs_transportadora_aceitos; vazio -> aceita
  if (allowlist.length && !allowlist.map(digits).includes(digits(body.cnpjTransportadora))) { log(401, "cnpj_nao_autorizado", authOk:true);
    return erro(401, `CNPJ TRANSPORTADORA NAO AUTORIZADO — '${cnpj || "(vazio)"}' nao esta na allowlist`, { motivo, cnpj_recebido }); }

  const r = processarOcorrencia(body, empresaId);
  if (!r.ok) { log(r.status, r.motivo, r.erro, r.ctrcId);
    if (r.motivo === "ctrc_desconhecido") return ok200(r.descricao, protocolo:"");  // 200 para o SSW não reenviar
    return erro(r.status, r.descricao); }
  sync_state(empresa).update({ ultima_hot: agora, ultima_hot_status: "ok" });       // "última atividade do webhook"
  log(200, authOk:true, ctrc_id, ocorrencia_id);
  return [{ retorno: { codigo:200, descricao:"OCORRENCIA PROCESSADA COM SUCESSO", numeroNFe, pedido, dataHora, protocolo } }];
}
// status HTTP das respostas de erro: 401→401, 503→503, 500→500, qualquer outro→400

function processarOcorrencia(body, empresaId) {
  if (!empresaId) return falha(400, "empresa_obrigatoria", "EVENTO SEM EMPRESA IDENTIFICADA");
  const chaveNFe = trimOrNull(body.nf?.chaveNFe);
  const cnpjRemDaChave = /^\d{44}$/.test(chaveNFe ?? "") ? chaveNFe.slice(6, 20) : "";
  // número: cte.numeroCTe || cte.numeroSSW (ignorando "0"/""), senão nf.numeroNFe -> normalizarNumeroCtrc; fonte "cte"|"nf"
  const { numero, fonte } = extrairNumero(body);
  const codigo = parseInt(String(body.ocorrencia?.codigo ?? ""), 10);
  const dataHora = parseSswDateTime(body.ocorrencia?.dataHoraEvento);
  //   "d-m-aaaa h:m:s" (SP) | ISO sem fuso (= SP) | ISO com fuso
  const filial = codigo === 84 && complemento ? filialDoComplemento(empresa, complemento) : null;  // spec de ocorrências
  if (!numero) return falha(400, "ctrc_obrigatorio", "NF/CTE OBRIGATORIO");
  if (!(codigo >= 0 && codigo <= 99)) return falha(400, "codigo_invalido", "CODIGO DE OCORRENCIA INVALIDO");
  if (!dataHora) return falha(400, "data_invalida", "DATA/HORA DO EVENTO INVALIDA");

  let ctrc = ctrcs.porNumero(empresa, numero);        // número exato, sem sigla (fonte "webhook")
  if (ctrc) {
    patch = {}; if (/^\d{44}$/.test(chaveNFe)) patch.chave_nfe = chaveNFe;          // sempre sobrescreve
    if (!ctrc.cnpj_transportadora && cnpjTransp) patch.cnpj_transportadora = cnpjTransp;
    if (!ctrc.numero_nf && numeroNFe) patch.numero_nf = numeroNFe;
    if (!ctrc.serie_nf && serieNFe) patch.serie_nf = serieNFe;
    if (cnpjRemDaChave.length === 14) patch.cnpj_remetente = cnpjRemDaChave;       // sobrescreve (sem máscara!)
  } else {
    // anti-fantasma: só cria CT-e se o número veio de cte.*, tem >= 4 caracteres e != numeroNFe
    if (fonte !== "cte" || numero.length < 4 || (numeroNFe > 0 && Number(digits(numero)) === numeroNFe))
      return falha(202, "ctrc_desconhecido", "EVENTO REGISTRADO SEM VINCULO — numero recebido nao corresponde a um CT-e conhecido");
    ctrc = inserir({ numero_ctrc: numero, data_emissao: dataHora.slice(0,10) /* data UTC do ISO */,
      prazo_origem:"proprio", status_atual: descricao, chave_nfe, cnpj_transportadora, numero_nf, serie_nf,
      cnpj_remetente: cnpjRemDaChave.length === 14 ? cnpjRemDaChave : null });   // data mínima §0.4 pode descartar
    // erro -> falha(500, "erro_criando_ctrc", "ERRO INTERNO AO REGISTRAR CTRC")
  }
  garantirCodigoOcorrencia(empresa, codigo, descricao ?? "");
  const protocolo = (Date.now().toString(36) + random36(6)).slice(0, 16);
  ocorrencias.upsert({ ctrc_id, codigo, descricao, data_hora: dataHora, protocolo_ssw: protocolo, complemento,
    latitude, longitude /* "," -> "." */, nome_recebedor, doc_recebedor, origem:"webhook",
    payload_bruto: body, filial }, onConflict ["ctrc_id","codigo","data_hora"], ATUALIZA);
  // erro -> falha(500, "erro_gravando_ocorrencia", `ERRO AO GRAVAR OCORRENCIA: ${msg}`)
  if (descricao && !existeOcorrenciaMaisNova(ctrc_id, dataHora)) ctrc.status_atual = descricao;
  return { ok:true, protocolo, ctrcId, ocorrenciaId };
}
```

Reprocessar evento (tela, só Plataforma): roda `processarOcorrencia(payload_bruto, empresa do evento ?? empresa ativa)`
e atualiza o evento (`status_http`, `erro_processamento`, `motivo_rejeicao`, `ctrc_id`, `ocorrencia_id`).
"Reprocessar todos com token_incorreto": o mesmo em lote.

### 3.18 SSW API — token de sessão (heartbeat, ATIVO)

Mantém o token da SSW API válido; a faixa "Integração SSW indisponível" (`getSswHealth`) usa
`ssw_config.token_atualizado_em` (TTL 4 h).

```ts
// origem: src/routes/api/public/hooks/ssw-token-check.ts + ssw-token.server.ts + ssw-client.server.ts
async function jobSswTokenCheck(empresa) {
  const cfg = sswConfig(empresa); const token = cofre(empresa, "ssw_api", "token");
  const restante = cfg.token_atualizado_em ? 4h - (now - cfg.token_atualizado_em) : null;
  const gravar = (ok, msg) => cfg.id && sswConfig.update({ ultima_verificacao_em: now, ultima_verificacao_ok: ok,
      ultima_verificacao_mensagem: msg.slice(0,500), ultima_verificacao_origem: "cron" });
  if (token && restante != null && restante > 90 * 60_000) {
    gravar(true, `Token válido, expira em ${round(restante/60000)} min. Sem renovação.`); return { ok:true, renovado:false };
  }
  try {
    const { token, fromCache } = obterToken(empresa, { forcar: true });
    const t = consultaCep(token);       // GET https://ssw.inf.br/api/consultaGenerica/consultaCep?idCep=80000000
    if (!t.ok) gravar(false, `Token gerado mas smoke test falhou: ${t.diagnostico} - ${t.mensagem ?? "sem detalhe"}`);
    else gravar(true, fromCache ? "Token cacheado revalidado com sucesso." : "Token renovado com sucesso via generateToken.");
  } catch (e) { gravar(false, `Falha ao renovar token SSW${kind ? ` (${kind})` : ""}: ${msg}`); }
}
// obterToken: credenciais = parametros.dominio (ou empresas.dominio_ssw) / usuario / cnpj_edi (+ ssw_config legado),
//   senha do cofre; env SSW_* só com usar_env. dominio maiúsculo e sem acento; usuario sem acento; cnpj 14 dígitos
//   (senão "CNPJ EDI inválido: esperado 14 dígitos, recebido N.").
//   POST https://ssw.inf.br/api/generateToken  {domain, username, password, cnpj_edi} (nesta ordem), timeout 20 s;
//   sucesso = (sucess===true || success===true) && token em token|dados|dados.token.
//   upstream indisponível (HTTP >= 500, texto de indisponibilidade ou rede/timeout): até 3 tentativas, espera 1 s e 3 s;
//     sem forçar e com token antigo -> devolve o antigo; senão erro kind "upstream_unavailable".
//   mensagem com "cliente sem acesso" -> kind "permission_denied"; demais -> "auth_failed".
//   Sucesso: grava token no cofre (ssw_api/token) e ssw_config.token_atualizado_em = now.
```

### 3.19 XML CT-e

**FTP: DESLIGADO** desde a Fase 1 (03/09/2026): `configuracoes.xml_cte_ativo` padrão `false` e a
rota `ftp-xml-import` responde 410. **Upload manual** na tela Admin → XML CT-e (só Plataforma)
segue existindo (ver D5). Regras do importador, se portado:

- Entrada `.xml` ou `.zip` (todos os `*.xml` de dentro). Arquivo: dedupe por `sha256` — só bloqueia
  se o arquivo anterior foi `sucesso`; XML individual já `sucesso` (por sha256 do texto) é pulado.
- Classificação: nome `-cte.xml`/`_cte.xml` → CT-e; `-can.xml`/`_can.xml` → cancelamento; senão pela raiz
  (`procEventoCTe`/`evCancCTe` → can; `cteProc`/`CTe` → cte). CT-e antes de cancelamentos.
- Casamento (nunca pelo `numero_ctrc`): 1) `chave_cte`; 2) `numero_cte == nCT` com candidato único
  **e** CNPJ emitente da chave (posições 6–19) igual ao CNPJ da filial (`filiais_ssw.cnpj` da `filial`
  do candidato); 3) `chave_nfe` com candidato único sem `chave_cte` e sem `numero_cte` (esqueleto do webhook).
  Sem casamento → **não cria**; vai para a fila de órfãos (5 dias).
- Atualização: sobrescreve `chave_cte` e `prazo_origem` (`'parceiro'` se expedidor válido de terceiro,
  senão `'proprio'`); só preenche vazio: `data_emissao, remetente, cnpj/cep/cidade/uf_remetente,
  destinatario, cnpj/cep_destinatario, cidade/uf/bairro/logradouro/numero_endereco/complemento_destino,
  tomador_nome/cnpj, chave_cte_anterior, data_entrega_negociada, peso, volumes, valor_frete,
  data_prevista_entrega, parceiro_cnpj/nome`. `chave_nfe` **não** é gravada (incoerência do código, D5).
- Parceiro = expedidor, exceto se igual ao remetente ou CNPJ próprio (`parametros.cnpjs_emitentes`).
- Cancelamento: casa por `chave_cte` ou `numero_cte == chave[25..34]` → `status_atual='CANCELADO'`,
  `cancelado_em = dhEvento`, `motivo_cancelamento = xJust`.
- Fila de órfãos (`xml_cte_orfaos`): `{sha256_xml, nome_xml, tipo, chave_cte, xml_conteudo, status:'pendente', expira_em: +5 dias}`;
  reprocesso (`processarFilaOrfaos(limite 200, 1..1000)`): expira os vencidos, tenta os 200 mais antigos,
  casado → `status='casado'`, promove `xml_cte_itens_processados` de `orfao` para `sucesso`.
- `xml_orfaos_stats(empresa)` → `{pendentes, expirados, casados, mais_antigo (pendente)}`; mostrado no
  `SyncStatusBadge` (com `mostrarOrfaos`).

### 3.20 Ahgora (ponto) — sob demanda

Sem job e sem gravação: as telas de ponto/bonificação consultam `https://api.ahgora.com.br`
(`/employees`, `/shifts?limit=100`, `/schedulesAndShifts/between`, `/punches/between`) com
`Authorization: Basic base64(usuario:senha)` (usuário em `parametros.usuario` da integração
`ahgora`, senha no cofre; env `AHGORA_API_*` só com `usar_env`), timeout 30 s, erros
"Tempo limite excedido ao consultar a API do Ahgora." / "Acesso negado pela API do Ahgora. Verifique as credenciais configuradas." /
"Erro na API do Ahgora (HTTP n): ...". A apuração é da spec de ranking/bonificação.

---

## 4. Pipeline e agendamentos no worker

### 4.1 Despachante (hoje `ingestao_despachar(job)` + `pg_net`)

Cada agendamento enfileira **uma execução por empresa** com `status ∈ {ativa, implantacao}` e a
integração do job ligada. Jobs BI2 vão em **rodízio**: a cada disparo só a empresa de posição
`floor(epoch_minutos) % total` (ordem `empresas.criado_em, id`) — a lease `bi2_pesado` é global
de propósito. O corpo/modo de cada job é o do despachante.

| Job (fila `ingestao.<job>`) | Integração | Cron (UTC, hoje) | Ativo hoje | Corpo/modo | Lease / trava | Timeout hoje |
| --- | --- | --- | :-: | --- | --- | --- |
| `ftp` | sftp | `1-29,31-59 * * * *` (todo minuto, exceto :00 e :30) | sim | `{}` | `ftp_sync_rodando` (4 min) | 30 s (HTTP; a Edge segue) |
| `ftp_retroativo` | sftp | `10 6 * * *` (03:10 SP) | sim | `retroativo=1` | idem | 30 s |
| `ssw_ciclo_aplicar` | sftp | `* * * * *` | sim | `{}` | `ssw_aplicar_ciclo:<empresa>` 180 s | 110 s |
| `ssw_token_check` | ssw_api | `25 * * * *` | sim | `{}` | — | 30 s |
| `bi2_0017` | ssw_bi2 (rodízio) | `12,42 * * * *` | sim | `{modo:"cron_continuo", lookback:2}` | `bi2_pesado` 180 s | 30 s |
| `bi2_0017_backfill` | ssw_bi2 (rodízio) | `1-56/5 * * * *` | sim (pausado por config) | `{}` | `bi2_pesado` | 30 s |
| `bi2_ctrc` | ssw_bi2 | `7,22,37,52 * * * *` | **não** | `{modo:"cron_continuo", lookback:2}` | `bi2_pesado` 600 s | 30 s |
| `bi2_0220` | ssw_bi2 | `3 * * * *` | **não** | `{modo:"cron_continuo", lookback:2}` | `bi2_pesado` | 30 s |
| `bi2_0013` | ssw_bi2 | `27,57 * * * *` | **não** | `{modo:"cron_tarde"}` | `bi2_pesado` | 30 s |
| `bi2_cadastros` | ssw_bi2 | `20 12 * * *` | **não** | `{}` | — | 30 s |
| `bi2_0174_reprocess` | ssw_bi2 | `4-59/5 * * * *` | **não** | `{acao:"tick"}` | `bi2_pesado` | 60 s |
| `bi2_0220_backfill` | ssw_bi2 | `33 * * * *` | **não** | `{}` | `bi2_pesado` | 30 s |
| `xml_orfaos_retry` | xml_cte | — (sem cron) | — | `{limite?}` | — | 60 s |

Jobs que hoje são SQL no `pg_cron` e passam para o worker (sem empresa no despacho; percorrem
todas as empresas):

| Job | Cron (UTC) | O que faz | Duração hoje |
| --- | --- | --- | --- |
| `romaneio_projecoes` | `15,45 * * * *` | reconstrói as projeções do romaneio (hoje `refresh_romaneio_matviews`: mv_romaneio_036_ctrc, mv_romaneio_viagem_ctrc, mv_romaneio_ctrc_motorista e, em bloco próprio que pode estourar sem derrubar os outros, mv_ctrc_staging_enriquecido). Regras: spec de romaneio. Não empilha (trava). | média 93 s, máx. 125 s |
| `sla_arquivos` | `8,38 * * * *` | `ctrcsUnidadePelo455(48h)` (§3.6.3) **e depois** `calcular_sla_arquivos()` (spec de prazo/SLA) | média 9 s |
| `limpar_staging_038` | `40 6 * * *` (03:40 SP) | §3.5 | 4,5 s |
| `limpeza_logs` | `30 3 * * *` (00:30 SP) | apaga `sync_log` > 30 dias (o resto era histórico do pg_cron) — ver §9 | 0,2 s |

### 4.2 Regras de execução (BullMQ)

- **Singleton por empresa+tipo**: no máximo uma execução rodando e uma esperando por
  `(job, empresa)` (`jobId` determinístico / deduplicação). Disparo que chega com uma já na fila é
  descartado (equivale ao `ja_rodando` de hoje).
- **Leases que continuam valendo** (lock Redis com TTL e dono único `job#uuid8`; liberar/renovar só o próprio):
  `ssw_aplicar_ciclo:<empresa>` (180 s), `bi2_pesado` global (180 s; 600 s no 0174), trava do FTP
  (4 min, espelhada em `configuracoes.ftp_sync_rodando` para a tela). Trava ocupada = sucesso sem
  trabalho (não é erro, não re-tenta).
- **Retry**: só em exceção/5xx, backoff 30 s × 2ⁿ, teto 10 min (worker.md). Respostas de regra
  (empresa desligada 409, empresa inexistente 404, data inválida 400, `ignorado`) não re-tentam.
  `ssw_ciclo_aplicar` não precisa de retry (roda todo minuto e retoma pela fila).
- **Timeouts de trabalho**: Edge FTP — 120 s para relatórios + 20 s de estabilidade; ciclo — 40 s
  por ciclo / 60 s por rodada (orçamentos internos, não timeout duro); bloco de aplicação até 600 s
  (timeout de comando SQL); `aplicar_partes_455`/`romaneio`/`limpeza` 300–600 s.
- **Ordem**: dentro do `ftp`, os arquivos entram antes de chamar o ciclo; o ciclo roda
  fila → blocos → 036 → partes 455. `ctrcs_unidade_pelo_455` antes de `calcular_sla_arquivos`.
  Projeções do romaneio são independentes (leem staging e ctrcs).
- **Janelas**: preparação completa da fila 1×/dia após 03:00 SP; retroativo do FTP 03:10 SP;
  limpeza do 038 03:40 SP. BI2 0017: 404 de fim de semana e do fechamento de hoje = "vazio".
- **Pausa do FTP**: `configuracoes(empresa).ftp_sync_ativo`. **Intervalo do FTP** (tela):
  `ftp_sync_intervalo_minutos` + reagendar o job `ftp` com `minutosParaCron`:
  1–59 → `*/n * * * *`; 60 → `0 * * * *`; 1440 → `0 6 * * *`; múltiplo de 60 (2–23 h) → `0 */h * * *`;
  outro → erro "Intervalo deve ser entre 1 e 1440 minutos." / "Para intervalos ≥ 60 min, use múltiplos de 60 (60, 120, 180, 360, 720) ou 1440.".
  Hoje o agendamento é **um só para todas as empresas** (D6).
- **Disparo manual** (tela "Rodar agora" do FTP): enfileira `ftp` com `manual=true` (ignora a pausa).
  Botão "liberar trava": `ftp_sync_rodando=false` + progresso resetado.
- Ligar/desligar agendamentos: `AGENDAMENTOS_ATIVOS` / `JOBS_AGENDADOS` (worker.md); os 8 jobs BI2
  pausados nascem desligados.

---

## 5. Diagnósticos e estatísticas das telas de ingestão

| Tela / componente | Dado | Origem |
| --- | --- | --- |
| Faixa de "dados atualizados em" (`SyncStatusBadge`, a cada 60 s) | `max(aplicado_em)` dos ciclos aplicados; órfãos XML (a cada 120 s) | §3.13; `xml_orfaos_stats` |
| Admin → Importação SSW → Pipeline automático | 10 últimos ciclos (`ciclo_chave DESC`), 25 últimos arquivos (`visto_em DESC`, colunas nome, ciclo, tipo, unidade, status, linhas, mensagem, visto_em, importado_em), tipos | `ssw_ciclo_importacao`, `ssw_relatorio_arquivos`, `ssw_relatorio_tipos`; ações retomar/descartar |
| Admin → Importação SSW → importadores manuais 036/038/306/455/455csv/930/050 | análise (prévia de parse) e gravação na staging; listar lote | §3.3 (o 038 manual também dispara as projeções do romaneio) |
| Admin → Importação SSW → Aplicar staging | prévia/aplicação em blocos + histórico `ssw_aplicacao_log` | §3.11, §3.13 |
| Admin → XML CT-e → Sincronização FTP | config (ativo, intervalo, schedule), última execução (`ftp_xml_sync_log`), progresso (`ftp_sync_progresso` + `lock_ativo`), rodar agora, liberar trava | §3.1, §4.2 |
| Admin → Ingestão → BI2 | status/rodar 0174 e extras, reprocesso por código | §3.15/3.16 (`bi2_sync_log`, `configuracoes`) |
| Admin → Ingestão → Credenciais SSW / saúde | credenciais da SSW API, `getSswHealth` (`configurado`, `token_valido`, motivo `sem_credenciais|sem_token|token_expirado`) | §3.18 |
| Admin → Ingestão → Últimos eventos do webhook | lista de `ssw_webhook_eventos` da empresa, reprocessar | §3.17 |
| Admin → Ingestão → cabeçalho | `getIngestStatus`: `sync_state`, 50 `sync_log`, totais de ctrcs/ocorrências/ocorrências com `penaliza` nulo, última emissão; detecção de falha de credencial por regex `/401|usuario\/senha|usuário\/senha|unauthorized|generateToken|token inv/i` nos logs erro/parcial, anulada por log ok mais novo | `sync_log` só recebe dado do caminho morto (D11) |

---

## 6. Rotas públicas (mesmos caminhos no sistema novo)

Todas sob `/api/public/`. Empresa conforme §0.1. Segredos comparados em tempo constante.
Limite de corpo: 64 MB nas rotas com arquivo base64; 1 MB nas demais.

| Rota | Método | Autenticação | Corpo | Quem chama | Status |
| --- | --- | --- | --- | --- | --- |
| `ssw-ocorrencias` | POST (GET informativo) | segredo do webhook da empresa em `Authorization` (Bearer/Token/Basic/cru) ou `?secret=`; `?empresa=` opcional | JSON SSW2181 (`cnpjTransportadora`, `cnpjPagador`, `nf{numeroNFe,serieNFe,chaveNFe,pedido}`, `cte{numeroCTe,numeroSSW}`, `ocorrencia{codigo,descricao,dataHoraEvento,complemento,latitude,longitude,nomeRecebedor,docRecebedor}`) | **SSW (externo)** | ATIVO |
| `ftp-relatorio-import` | POST | `x-ftp-ingest-secret` (= `FTP_INGEST_SECRET`; sem ele 503 `ingest_secret_nao_configurado`; errado 401 `token_invalido`) | `{empresa?, nome, base64, sha256, tamanho, mtime}`; JSON ruim 400 `json_invalido`; sem nome/base64 400 `nome_ou_base64_ausentes`; base64 ruim 400 `base64_invalido`; exceção 500 `excecao_no_pipeline`/`excecao_no_050` | job `ftp` | ATIVO |
| `ssw-ciclo-aplicar` | POST | `x-ftp-ingest-secret` **ou** `x-cron-token` (= `configuracoes.backfill_cron_token` global) | `{empresa?}` → `{ok, resultados}` / `{ok:true,status:"ja_rodando"}` | jobs `ftp`, `ssw_ciclo_aplicar` | ATIVO |
| `hooks/ssw-token-check` | POST (GET informativo) | `x-cron-token` | — → `{ok, renovado, mensagem[, kind]}`; 401 `{ok:false,error:"Unauthorized"}` | job `ssw_token_check` | ATIVO |
| `bi2-0017` | POST (GET informativo) | `x-ingest-secret` (= `SSW_INGEST_SECRET`) ou `x-cron-token` | `{data?, modo?, lookback?}` | job `bi2_0017` | ATIVO |
| `bi2-0017-backfill` | POST (GET) | idem | — | job `bi2_0017_backfill` | ATIVO (pausado por config) |
| `bi2-ctrc`, `bi2-0013`, `bi2-0220`, `bi2-cadastros`, `bi2-0174-reprocess`, `bi2-0220-backfill` | POST (GET) | idem | ver §3.16 | jobs pausados | PAUSADO (D2) |
| `bi2-diag-0017`, `bi2-diag-0220` | GET | hoje **aberta**; no porte: `x-ingest-secret` ou `x-cron-token` (worker.md §4) | `?data=` | diagnóstico manual | ver D2 |
| `xml-orfaos-retry` | POST | hoje `apikey` = chave publicável (insegura); no porte: `x-ftp-ingest-secret` ou `x-cron-token` | `{empresa?, limite? (1..1000, padrão 200)}` | nenhum cron | ver D5 |
| `xml-recuperar-orfaos` | POST | `x-ftp-ingest-secret` | `{empresa?, nome, base64}` | Edge `recuperar-xml-backup` (uso pontual) | MORTO (§9) |
| `ftp-xml-import`, `ssw-ingest`, `enriquecer-85`, `enriquecer-periodo` | POST/GET | — | — | ninguém | responde **410** `{ok:false, error:"desativado", fase:1, endpoint, mensagem}` — manter a resposta só se o dono quiser (D12) |

Respostas comuns: `Cache-Control: no-store` nas rotas BI2/webhook/token. Erro de empresa:
`{ok:false, motivo, erro}` com 400/403/404/409 (§0.1); nas rotas BI2, outra falha de contexto →
400 `{ok:false, motivo:"empresa_bi2", erro}`.

---

## 7. Configurações (`configuracoes`) usadas pela ingestão

| Chave | Escopo | Uso |
| --- | --- | --- |
| `backfill_cron_token` | global (empresa nula) | segredo `x-cron-token` das rotas |
| `app_base_url`, `edge_functions_url`, `edge_apikey` | global | despachante via HTTP — **somem** com o worker em processo |
| `ftp_sync_ativo` (padrão "true"), `ftp_sync_intervalo_minutos` (padrão 5), `ftp_sync_rodando` | empresa | §3.1, §4.2 |
| `xml_cte_ativo` (padrão "false") | empresa | §3.19 |
| `ctrc_data_minima_emissao` | empresa | trava de INSERT (§0.4) |
| `bi2_0017_backfill_{cursor,pausado,data_final,tentativas_cursor,tentativas_data}` e equivalentes do 0174/0220 | empresa | §3.15/3.16 |

`ssw_relatorio_tipos` (dado migrado): `codigo, descricao, prefixo_arquivo, por_unidade, unidades_esperadas[], obrigatorio_no_ciclo, tabela_staging, parser_id, ativo`.

---

## 8. Cargas únicas históricas (não entram no sistema novo)

Feitas uma vez, à mão, com scripts fora do repositório; os dados resultantes chegam pelo migrador
`public → erp`. Não portar rotina para elas:

- Carga retroativa jan–out/2026 (455 CSV mensal, 930 do FTP `/retroativos`, 306, 036, BI2 0174
  `somente_bruto`), roteiro na memória "carga retroativa mensal" e `docs/migracao/*.sql`.
- `docs/migracao/10` (reconstrução 02/10), `/11` (partes do CT-e), `/12` (duplicados → `duplicado_de`),
  `/14` (entrega pelo `bi2_raw` 0017), `/19` (desfaz `prazo_entrega` de entregues), `/22`
  (reprocessa estornos), `/24` (prazo ajustado pós-entrega), `/25` (chave/placa/origem pelo 455),
  `/26` (desliga BI2 0013/0016/0220).
- Retroativo do 050 (`/retroativo_050`, 06/11) e da coluna `tipo_documento_455` (02/10).
- Edge `recuperar-xml-backup` + rota `xml-recuperar-orfaos` ("uso pontual, item C do plano de recuperação de órfãos").

---

## 9. Código morto — não portar (com a prova)

| Item | Prova |
| --- | --- |
| `ssw-ingest.server.ts` (hot/warm/cold/backfill), rota `ssw-ingest`, `runIngestNow`, `togglePausa`, `resetCircuitBreaker`, `getBackfillStatus`, `setBackfillConfig`, `retryFailedBackfill`, `getSswLastSyncSummary` | Fase 1 (03/09/2026): rota 410; server functions só exportadas no barrel `src/features/ssw/index.ts`, sem componente que as chame (grep) |
| `ssw-enriquecimento.server.ts` (trackingdanfe, consultaClientes, consultaPrazo) | Fase 1: "saem do caminho de execução"; webhook passa `undefined` (`webhook-process.server.ts`) |
| `enriq-periodo.functions.ts`, `EnriqPeriodoCard`, `IngestaoNovaCard`, `importarOcorrenciasCsv`, `getWebhookInfo` | componentes não usados por nenhuma rota (grep: só o próprio arquivo/barrel) |
| `avaliar-freio.server.ts` | nenhum import (grep) |
| `get_ingest_diagnostics`, `set_cron_job_active`, `get_ssw_ingest_secret` | chamados só por `getIngestDiagnostics`/`setCronJobActive`/`getIngestSecret`, sem componente; `set_cron_job_active` só aceita `ssw-ingest-*` (jobs inexistentes); dependem de `pg_net`/`cron`/Vault |
| `get_webhook_ssw_stats` | nenhum chamador em `src/` |
| `backfill_enriquecimento_{concluir,set_ativo,reiniciar,status}`, `backfill_prazo_{concluir,registrar_rodada,set_ativo,status}` | nenhum chamador em `src/`; apontam para rotas 410 (`xml-cte-backfill-*`) |
| `listar_enriq_alvos_85`, `listar_enriq_periodo_alvos`, `contar_enriq_periodo_restantes`, `desagendar_enriq_periodo` | rotas `enriquecer-85/periodo` = 410; `contar_*` só em `enriq-periodo.functions.ts` (morto) |
| `ssw_unidade_de_localizacao(loc)` (1 argumento) | substituída pela de 2 argumentos (F5); nenhum chamador |
| `ssw_norm_ctrc` | só em `limpar_staging_038_superadas`, onde é redundante (`s2.ctrc = s1.ctrc` já implica) — portar a limpeza sem ela |
| `get_ftp_cron_schedule`, `reagendar_ftp_cron` | viram configuração do agendador do worker (§4.2) |
| `ingestao_despachar`, `job_lease_{adquirir,renovar,liberar}` | viram despachante e lock do worker (§4) |
| `cleanup_sync_log` | metade apaga `cron.job_run_details` (não existe no novo); `sync_log` só é escrito pelo `ssw-ingest` morto. Portar só se o dono quiser manter `sync_log` (D11) |
| `ssw_aplicacao_log_iniciar/finalizar`, `staging_*_set_dado_hash`, `_trg_bi2_raw_ignora_update_igual`, `set_updated_at_xml_cte_orfaos`, `_trg_ctrcs_bi2_*` | não são código morto: viram TS (§0.3, §0.4, §2.3, §3.11.3) |
| Ramo XML do `processar-ftp-xmls` | `xml_cte_ativo=false` desde 03/09; `ftp-xml-import` = 410 |
| 0174/0013/0016/0220/cadastros/reprocessos BI2 | PAUSADOS (decisão de 09/11) — D2 |
| Edge `recuperar-xml-backup`, rota `xml-recuperar-orfaos` | uso pontual (cabeçalho do arquivo), sem cron, sem tela |

---

## 10. Dúvidas para o dono

- **D1 — Webhook casa só pelo número e cria CT-e sem sigla.** Com a série vigente e os estacionados,
  uma ocorrência do webhook pode cair no CT-e de outra série com o mesmo número. Portar igual (paridade)
  ou casar pelo número + sigla do CT-e quando o payload trouxer?
- **D2 — BI2 pausados.** 0174, 0013/0016, 0220, cadastros e os reprocessos estão parados. Portar
  desligados (código vivo, cron off) ou não portar? Recomendo não portar (BI2 só fica no 0017) e
  manter `bi2-diag-*` só se alguém usa o diagnóstico.
- **D3 — Proteção "BI2 nunca altera CT-e em andamento" só vale quando `campos_ssw` não está vazio**
  (cláusula `WHEN` do gatilho). CT-e sem marca (criado pelo webhook, antigo) pode ser alterado pelo 0017.
  Portar igual ou aplicar a regra a todos?
- **D4 — Backfill 0017** roda a cada 5 min e hoje só devolve "pausado". Manter o job (tela de backfill)
  ou retirar?
- **D5 — XML CT-e.** O FTP está desligado; a tela de upload manual e a fila de órfãos seguem no ar.
  Portar o upload manual? Se sim: o código não grava `chave_nfe` (o comentário diz que deveria) —
  corrigir ou manter?
- **D6 — Intervalo do FTP** é por empresa na tela, mas o agendamento é um só para todas. Manter global?
  E o horário da produção (`1-29,31-59`) não é gerável pela tela (que só produz `*/n`): qual vale?
- **D7 — Entrega pela data (sem hora) do 930** vira 00:00 UTC (21:00 do dia anterior em SP). Manter
  (paridade de números) ou gravar 00:00 de SP?
- **D8 — Romaneio do CT-e (`aplicar_036`) lê a projeção** atualizada a cada 30 min, então o romaneio em
  `ctrcs` atrasa até 30 min em relação à staging. No novo, calcular direto da staging (fica mais atual,
  números iguais depois de 30 min) — de acordo?
- **D9 — 455 de largura fixa** não chega desde 25/09. Retirar o parser e o importador manual?
- **D10 — Descarte de ciclo** não apaga `staging_455_csv` (só o espelho). Manter?
- **D11 — `sync_log`/`sync_state`/cabeçalho da tela Ingestão**: só o webhook atualiza `sync_state.ultima_hot`;
  `sync_log` está vazio desde a Fase 1. Retirar o cabeçalho e as tabelas?
- **D12 — Rotas 410** (`ftp-xml-import`, `ssw-ingest`, `enriquecer-85`, `enriquecer-periodo`): alguém de
  fora ainda chama? Se não, não recriar (404 em vez de 410).
- **D13 — Heartbeat da SSW API**: com o enriquecimento desligado, o token só alimenta a faixa
  "Integração SSW indisponível". Manter o heartbeat e a faixa?
- **D14 — 050 não é registrado em `ssw_relatorio_arquivos`** (a memória diz para procurá-lo lá; o código
  atual não grava). Registrar no novo (aparece no painel de arquivos) ou manter?

---

## 11. Casos-limite para os testes (vitest)

1. `numCtrc("CAP033214-5") = "33214"`, `numCtrc("  -  ") = null`, `siglaCtrc("cap1") = "CAP"`, `siglaCtrc("123") = null`.
2. Série vigente: 930 CAS de mar e 455 CAP de set com o mesmo número → vigente CAP; CT-e CAS em `ctrcs`
   é estacionado como `33214/CAS` e o CAP é inserido; dry-run mostra `sigla_divergente`.
3. CT-e em `ctrcs` mais novo que todas as linhas de staging com outra sigla → ele segue vigente.
4. Previsão: 038 importado 10:00 com prazo 12/11; 930 cód. 15 "ENTREGA AGENDADA P/ 15/11/26" incluído 10:30 → 15/11;
   incluído 09:30 → 12/11; CT-e entregue → agendamento ignorado; agendada antes da emissão → ignorada.
5. 455 CSV com previsão importado depois do 038 → vence o 455; 038 sem prazo (`31/12/2050`) → vence o 455.
6. Estorno: baixa 1 às 10:00, 86 às 11:00 → baixa anulada, CT-e sem entrega, ocorrência 1 apagada;
   + nova baixa 1 às 12:00 → 86 anulado, entrega = 12:00; baixa relançada idêntica (mesmo código e hora) não é apagada.
7. Entrega só por `DATA_ENTREGA` (cód. 99, sem 1/18/67) → `aaaa-mm-ddT00:00:00Z`.
8. Ocorrência do 930 com `emissao_ctrc` diferente da do CT-e → não liga.
9. Update: `atraso_dias` e `tipo_documento_455` sobrescrevem; `remetente` só preenche vazio; `data_emissao` sobrescreve.
10. `campos_ssw` só ganha a coluna quando o valor gravado é igual ao do candidato.
11. Partes 455: expedidor = remetente → parceiro nulo (zera o anterior); CNPJ próprio → nulo; CPF com "000" → máscara de CPF.
12. Chave CT-e duplicada no lote ou já usada por outro CT-e → não grava.
13. Fila incremental: antes das 03:00 SP com completa de ontem 03:05 → incremental; depois das 03:00 → completa;
    número já aplicado volta ao fim da fila; pendente não muda de posição.
14. Ciclo: fila vazia → não chama a aplicação; erro no 036 → ciclo `erro` e `_fila_pronta` mantido.
15. BI2 0017: 404 com fechamento numa segunda (conteúdo domingo) → "vazio"; linha sem DATA AUTORIZACAO ignorada;
    CT-e em aberto com `campos_ssw` → nada muda; entregue com previsão BI2 nova ≥ emissão → previsão e prazo
    (se eram iguais) trocados, `prazo_fonte='bi2'`.
16. Webhook: sem auth → 401 `autorizacao_ausente`; número só da NF → 200 sem vínculo; número = NF → 200 sem vínculo;
    `Basic base64(usuario:segredo)` aceito; segredo de 48 chars embutido num header de 74 → aceito.
17. 050: relatório mais velho que o gravado não sobrescreve; `ctrc_numero` vazio no novo mantém o antigo.
18. FTP: arquivo que muda de tamanho nos 20 s não é processado; 24 arquivos no máximo em rodízio por tipo;
    CSV de 39 MB vira partes com as linhas `0;`/`1;` repetidas e nome `_parteNN_<carimbo>`.
