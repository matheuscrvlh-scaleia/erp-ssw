# R1 — Núcleo do CT-e

Especificação das regras do CT-e que todas as telas usam. Foi extraída das funções e gatilhos do
Postgres do sistema atual (`erp-ssw-referencia/banco/funcoes/*.sql` e `schema-public.sql`), do
código TS do `fr-transportes` (branch `feat/vps`, worktree `agent-ae0264d9f8203d8fa`), de
`docs/decisoes/*.md` e das memórias do projeto. É o contrato para a onda 1: a regra em TS tem de
devolver **os mesmos valores** do SQL, inclusive nos NULLs e nos empates.

Cada regra cita a função de origem. Quando o SQL tem um comportamento estranho (fuso da sessão,
`UPDATE OF`, ordem de gatilho), ele está descrito como é hoje e listado em §14 (Dúvidas). Nada
foi "corrigido" em silêncio.

---

## 0. Convenções da especificação

```ts
type DataISO = string;           // 'YYYY-MM-DD' — coluna `date` do Postgres
type Instante = Date;            // coluna `timestamptz`
type CodigoTexto = string | null; // código de ocorrência guardado como texto (0174, 0013, 036, efetiva)

/** (i AT TIME ZONE 'America/Sao_Paulo')::date */
function diaSp(i: Instante): DataISO; // Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })

/** (now() AT TIME ZONE 'America/Sao_Paulo')::date — `agora` sempre injetado (relógio), nunca new Date() solto */
function hojeSp(agora: Instante): DataISO;

/** date - date do Postgres: inteiro, sem arredondamento */
function difDias(a: DataISO, b: DataISO): number;

/** date + int do Postgres */
function somarDiasCorridos(d: DataISO, n: number): DataISO;
```

- **NULL**: em SQL, comparação com NULL dá NULL e `WHERE`/`CASE` tratam como falso. Em cada
  regra o pseudocódigo já resolve isso explicitamente; não confie em `undefined == null` do JS.
- **Fuso**: toda conta de "dia" é em `America/Sao_Paulo` (sem horário de verão desde 2019, UTC−3).
  Exceções que hoje usam o fuso da **sessão** do banco estão marcadas ⚠ (§14, D1).
- **Empresa**: toda leitura de cadastro (`codigos_ocorrencia`, `configuracoes`, `filiais_ssw`,
  `filial_alias`, `prazos_configurados`) é da empresa do CT-e, salvo onde o SQL de hoje não filtra
  (marcado ⚠).
- **Dois mundos para a mesma regra**: muitas regras são usadas (a) linha a linha (página do CT-e,
  caso de uso de gravação) e (b) dentro de agregações de 250 mil CT-e. Para as de (b) esta spec dá
  também o **fragmento SQL** equivalente, que o backend monta com `sql` parametrizado (o banco só
  executa; a regra continua escrita no TS). As duas formas precisam de teste com os mesmos casos.

---

## 1. Glossário

| Termo | Significado no sistema |
| --- | --- |
| **CT-e / CTRC** | Conhecimento de transporte. Linha de `ctrcs`. Identidade real = **sigla + número** (`CAP033214` ≠ `CAS033214`); hoje a tabela tem `UNIQUE(numero_ctrc)` e isso já causou mistura de dados (memória *ctrc-numero-nao-e-unico*). |
| **Sigla** | Unidade emissora do CT-e (`sigla_ctrc`, ex.: CAP, ARA, RIO; série S grava CAS/ARS/RIS). |
| **Filial / unidade** | `filial` = sigla da filial de destino (vem do BI2 0174; o SSW grava a sigla do CTRC só no INSERT). Unidade "das telas" = `COALESCE(unidade_destino, unidade_atual, filial)`. |
| **Filial própria** | `filiais_ssw.propria = true` da empresa. As telas operacionais só agrupam/filtram filiais próprias. |
| **Ocorrência** | Evento do SSW sobre o CT-e: código 0–99 + data/hora. Tabela `ocorrencias` (origens `webhook`, `ssw_930`, `trackingdanfe`, `manual`…). Também chegam "ocorrências-foto" gravadas em colunas do CT-e: **0174** (`ult_ocorr_*_0174`, BI2, foto D+1), **0013** (`ultima_ocorr_*_0013`, BI2, pausado e limpo em 09/11) e **036** (`ocorr_036_*`, romaneio). |
| **Código de ocorrência** | Cadastro por empresa em `codigos_ocorrencia` (`tipo_ssw`, `processo_ssw`, `responsavel`, `penaliza`…). `tipo_ssw` ∈ ENTREGA, PRE_ENTREGA, INFORMATIVA, PENDENCIA_CLIENTE, PENDENCIA_TRANSPORTADORA, BAIXA. |
| **Quarentena** | Ocorrência marcada `quarentena = true` na gravação (data antes da emissão; ou trackingdanfe muito anterior à criação do CT-e). Não entra na ocorrência efetiva. |
| **Ocorrência efetiva** | A ocorrência que "vale" para o CT-e, escolhida entre todas as fontes: **entrega/baixa vence o que vier depois**; depois, a mais recente; empate, a fonte de maior prioridade. Gravada em `ocorr_efetiva_*`. Todas as telas decidem aberto/entregue por ela. |
| **Conclusivo** | Ocorrência que encerra o CT-e: código de entrega (1, 18, 67) ou `tipo_ssw = 'BAIXA'`. |
| **Finalizador / código finalizador** | Entrega = **1, 18, 67** (fixos); baixa sem entrega = códigos com `tipo_ssw = 'BAIXA'` (hoje 12, 36, 61, 77, 92, 93, 94, 99). `processo_ssw = 'FINALIZADORA'` **não** é a regra. O 02 é informativo. (decisão *codigos-finalizadores-2026-10-08*) |
| **Entregue** | `data_entrega_realizada` preenchida **ou** efetiva ∈ {1, 18, 67}. |
| **Baixado / finalizado sem entrega** | Sem data de entrega e efetiva com `tipo_ssw = 'BAIXA'` (exceto 1). Não tem pontualidade nem atraso. |
| **Em aberto** | Nem entregue nem finalizado sem entrega. |
| **Estorno (86)** | Código 86 desfaz a baixa anterior (ordem de inclusão do 930). Aplicado na ingestão (`ssw_aplicar_estornos`, spec de ingestão); depois dele a efetiva é recalculada (§4). |
| **Previsão** | `data_prevista_entrega`: previsão **atual** do SSW (038, agendamento 930 código 15, 455, BI2 0017 pós-entrega) ou de regra configurada. `prazo_fonte` diz de onde veio. Toda mudança com valor anterior não nulo vai para `ctrc_prazo_historico`. |
| **Prazo padrão / mínimo 48 h** | `prazo_padrao_dias` (2, ou NULL para TROCA) e `prazo_padrao_data` (= emissão + 2 dias corridos). Base do "nascido em atraso". O nome "prazo padrão por cidade" é histórico (decisões de 08–13/10). |
| **Nascido em atraso** | `data_prevista_entrega < prazo_padrao_data` (emitido a menos de 48 h corridas da previsão). |
| **Prazo configurado** | Regra do admin em `prazos_configurados` (tipo `unidade`, `transbordo`, `parceiro`) que **sobrescreve** a previsão (`prazo_fonte = regra_*`). |
| **Prazo ajustado** | Previsão trocada no SSW depois da entrega (estorno 86 "AJUSTE DE PRAZO" + rebaixa); só chega pelo BI2 0017 (`bi2_0017_prazo_entregue`). |
| **Atraso** | Sempre pela previsão atual: entregue = dia da entrega (SP) − previsão; aberto = hoje (SP) − previsão; baixado = vazio. `ctrcs.atraso_dias` é foto do 0013/038 e **nenhuma tela lê** (decisão *atraso-pela-previsao-atual-2026-11-05*). |
| **Sem movimento** | Em aberto, sem responsabilidade do cliente, atraso > limite e dias desde a última movimentação (efetiva, ou emissão) > limite. Limite por empresa (`alerta_dias_sem_movimento`, padrão 3). |
| **Cancelado no mesmo dia** | Tem ocorrência 99 cujo dia (SP) = dia da emissão. Sai do universo. |
| **Duplicado** | `duplicado_de` preenchido (cópia de outro CT-e; marcação manual/carga). Sai do universo. |
| **Fora do universo** | `fora_universo = cancelado_mesmo_dia OR duplicado_de IS NOT NULL`. Todas as telas filtram `NOT fora_universo`. Nunca gravar direto. |
| **Data mínima de emissão** | Configuração por empresa (`ctrc_data_minima_emissao`): CT-e com emissão anterior **não é criado** (descartado em silêncio). |
| **campos_ssw** | Colunas cujo valor veio dos arquivos do SSW; o BI2 não pode sobrescrevê-las. |
| **TROCA** | Cliente de raiz de CNPJ `00193687`; fora do indicador "nascido em atraso". |

---

## 2. Primitivas

### 2.1 `normCodigoOcorr` — origem `norm_codigo_ocorr(text) → int`

Tira **todo** caractere que não é dígito e converte.

```ts
function normCodigoOcorr(txt: string | null): number | null {
  const d = (txt ?? "").replace(/\D/g, "");
  return d === "" ? null : Number.parseInt(d, 10); // atalho: > 2^31 dá erro no PG; códigos têm ≤ 2 dígitos
}
```

| entrada | saída |
| --- | --- |
| `"01"` | 1 |
| `"85"` | 85 |
| `"A-18"` | 18 |
| `"1a2"` | 12 |
| `""`, `null`, `"abc"` | null |

Fragmento SQL: não precisa — a efetiva gravada já é só dígitos sem zero à esquerda (§4). Para
colunas cruas use `NULLIF(regexp_replace(COALESCE(col,''), '\D', '', 'g'), '')::int`.

### 2.2 `normalizaCodigoOcorr` — origem `_normaliza_codigo_ocorr(text) → int`

Diferente da anterior: só remove **zeros à esquerda** e converte; texto com letra **dá erro** no
PG (`invalid input syntax for type integer`).

```ts
function normalizaCodigoOcorr(txt: string | null): number | null {
  const s = (txt ?? "").replace(/^0+(?=[0-9])/, "");
  if (s === "") return null;
  if (!/^\s*[+-]?\d+\s*$/.test(s)) throw new Error("código de ocorrência inválido"); // = erro do cast
  return Number.parseInt(s, 10);
}
```

Casos: `"007"` → 7; `"0"` → 0; `"00"` → 0; `""`/`null` → null; `"8A"` → erro.
Recomendação: no novo, usar **uma** função (`normCodigoOcorr`) em todo lugar; as duas só diferem
em entrada com letra, que não ocorre nas colunas lidas (efetiva, 0013, 0174 vêm só com dígitos).

### 2.3 Filtro de texto com vários valores — origem `texto_casa_filtro(valor, filtro)`

Usado pelos filtros Remetente e Destino (separador `|`). Hoje o padrão é montado **no SQL** e o
`ILIKE` **não escapa** `%`, `_` nem `\` digitados pelo usuário (são curingas). Replicar.

```ts
/** Padrões ILIKE equivalentes ao SQL. btrim do PG tira só espaço (' '), não tab. */
function padroesTextoFiltro(filtro: string): string[] {
  const t = filtro.replace(/^ +| +$/g, "");
  if (!filtro.includes("|")) return [`%${t}%`];
  return `%${t.replace(/\s*\|\s*/g, "%|%")}%`.split("|");
}
// casa = valor !== null && padroes.some(p => ilike(valor, p))   (ILIKE: sem acento-insensível)
```

| filtro | padrões | observação |
| --- | --- | --- |
| `"grendene"` | `["%grendene%"]` | igual ao `ILIKE '%x%'` antigo |
| `" Grendene "` | `["%Grendene%"]` | |
| `"a \| b"` | `["%a%","%b%"]` | |
| `"a\|\|b"` | `["%a%","%%","%b%"]` | `%%` casa com tudo (atalho conhecido; a tela nunca manda) |
| `"a\|"` | `["%a%","%%"]` | idem |

- `valor` NULL → não casa. `filtro` NULL → não casa (o chamador só aplica o filtro quando
  preenchido).
- No front, `lerFiltroTexto` (fr-transportes `src/lib/filtro-texto.ts`) já descarta vazios e
  duplicados antes de mandar; manter essa normalização no contrato zod da rota.
- Fragmento SQL: `col ILIKE ANY($padroes::text[])` com `$padroes = padroesTextoFiltro(filtro)`.

### 2.4 `normalizarNome` — origem `normalizar_nome(text)`

```ts
const DE = "áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ";
const PARA = "aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC";
function normalizarNome(t: string | null): string {
  let s = t ?? "";
  s = [...s].map((ch) => { const i = DE.indexOf(ch); return i >= 0 ? PARA[i] : ch; }).join("");
  return s.toUpperCase(); // upper do PG (UTF-8): ñ→Ñ etc.; só os acentos da lista são removidos
}
```

`null` → `""`; `"João Ação"` → `"JOAO ACAO"`; `"Muñoz"` → `"MUÑOZ"` (ñ não está na lista).
Usado por `listar_pagadores_ctrcs` e `romaneio_performance_motorista` (agrupar nomes).

### 2.5 `formatarCnpjCpf` — origem `formatar_cnpj_cpf(text)`

```ts
function formatarCnpjCpf(doc: string | null): string | null {
  const bruto = (doc ?? "").replace(/^ +| +$/g, "");
  if (/[A-Za-z]/.test(bruto)) return bruto.toUpperCase();     // CNPJ alfanumérico (jul/2026): como veio
  const d = (doc ?? "").replace(/\D/g, "");
  if (d === "" || /^0+$/.test(d)) return null;
  // CPF: 11 dígitos, ou 14 começando com "000" (o 455 manda CPF assim). CPF válido vence CNPJ.
  if (d.length === 11 || (d.length === 14 && d.startsWith("000"))) {
    const c = d.slice(-11);
    if (cpfValido(c)) return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}`;
  }
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return d;
}
function cpfValido(c: string): boolean {
  let s = 0; for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let r = (s * 10) % 11; if ((r === 10 ? 0 : r) !== +c[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  r = (s * 10) % 11; return (r === 10 ? 0 : r) === +c[10];
}
```

O SQL também calcula `cnpj_ok` (dígito do CNPJ) mas **nunca usa** o resultado: todo número de 14
dígitos sai com máscara de CNPJ, válido ou não. Não portar o cálculo.

| entrada | saída |
| --- | --- |
| `"11222333000181"` | `"11.222.333/0001-81"` |
| `"11.222.333/0001-81"` | `"11.222.333/0001-81"` |
| `"11222333000199"` (DV errado) | `"11.222.333/0001-99"` |
| `"52998224725"` | `"529.982.247-25"` |
| `"00052998224725"` | `"529.982.247-25"` |
| `"52998224726"` (CPF inválido) | `"52998224726"` |
| `"00052998224726"` (CPF inválido) | `"00.052.998/2247-26"` |
| `"12345"` | `"12345"` |
| `"0000"`, `""`, `null` | `null` |
| `" 12.abc.345/0001-x "` | `"12.ABC.345/0001-X"` |

Usado na ingestão (`aplicar_partes_455`) para gravar CNPJ de remetente/destinatário/expedidor.

### 2.6 `tipoDocumentoEfetivo` — origem `tipo_documento_efetivo(tipo_455, tipo_bi2)`

Tipo do 455; sem ele, o do BI2; maiúsculas. (decisão *tipo-documento-pela-classificacao-do-455*)

```ts
const vazio = (s: string | null) => { const t = (s ?? "").replace(/^ +| +$/g, ""); return t === "" ? null : t; };
function tipoDocumentoEfetivo(t455: string | null, tBi2: string | null): string | null {
  const v = vazio(t455) ?? vazio(tBi2);
  return v === null ? null : v.toUpperCase();
}
```

`("SUBC REC FORM LISO", "SUBCONTRATO")` → `"SUBC REC FORM LISO"`; `("  ", "subcontrato")` →
`"SUBCONTRATO"`; `(null, null)` → `null` (vira "Sem tipo"/`__SEM_TIPO__` nos filtros).
Fragmento SQL: `upper(coalesce(nullif(btrim(c.tipo_documento_455),''), nullif(btrim(c.tipo_documento),'')))`.
Filtro de tipos (`filtroTiposPostgrest` em `performance-utils.ts`): seleção normalizada com
`trim().toUpperCase()`, sem duplicados; `__SEM_TIPO__` = efetivo NULL/vazio.

### 2.7 Relógio e fuso da sessão ⚠

Três funções do SQL usam o **fuso da sessão** do banco (o Supabase roda em UTC por padrão — a
confirmar, §14 D1), não o de São Paulo:

- `_bucket_faixa_prev`: `CURRENT_DATE` = dia em UTC. Entre 21:00 e 23:59 de SP, "hoje" já é amanhã.
- `_romaneio_em_rota` e `_ctrc_ocorrencia_status`: `data_hora >= data_emissao::timestamptz` =
  meia-noite **UTC** do dia da emissão = 21:00 SP do dia anterior.

Para paridade numérica exata o TS usa `inicioDoDiaUtc(d) = new Date(d + "T00:00:00Z")` e
`hojeUtc(agora)`; a recomendação (D1) é trocar por SP e aceitar a diferença naquelas 3 h.

---

## 3. Finalização do CT-e (entregue, baixado, aberto)

### 3.1 `estaEntregue` — origem `_is_entregue(timestamptz, text)`

```ts
const CODIGOS_ENTREGA = [1, 18, 67] as const; // fixos (tipo_ssw ENTREGA); IMMUTABLE no SQL
function estaEntregue(dataEntrega: Instante | null, codigoEfetivo: CodigoTexto): boolean {
  if (dataEntrega !== null) return true;
  const c = normCodigoOcorr(codigoEfetivo);
  return c !== null && CODIGOS_ENTREGA.includes(c);
}
```

Fragmento SQL: `COALESCE(c.data_entrega_realizada IS NOT NULL OR NULLIF(c.ocorr_efetiva_codigo,'')::int IN (1,18,67), false)`.

Exemplos: `(2026-11-05T15:00Z, "85")` → true; `(null, "18")` → true; `(null, "01")` → true;
`(null, "2")` → false; `(null, null)` → false.

### 3.2 `estaFinalizadoSemEntrega` — origem `_is_finalizado_sem_entrega(timestamptz, text)`

```ts
function estaFinalizadoSemEntrega(
  dataEntrega: Instante | null, codigoEfetivo: CodigoTexto, codigosBaixa: ReadonlySet<number>,
): boolean {
  if (dataEntrega !== null) return false;
  const c = normCodigoOcorr(codigoEfetivo);
  return c !== null && c !== 1 && codigosBaixa.has(c);
}
```

- `codigosBaixa` = códigos com `tipo_ssw = 'BAIXA'`. ⚠ Hoje o SQL consulta `codigos_ocorrencia`
  **sem filtrar empresa** (qualquer empresa com o código como BAIXA conta). No novo: da empresa do
  CT-e (§14 D4). Para a FR o conjunto esperado é {12, 36, 61, 77, 92, 93, 94, 99}.
- O SQL exclui só o 1 (não 18/67) — sem efeito prático, 18/67 não são BAIXA. Manter igual.
- Fragmento SQL (como `performance_alertas` faz): `COALESCE(c.data_entrega_realizada IS NULL AND x.cod IS NOT NULL AND x.cod NOT IN (1,18,67) AND x.cod = ANY($codigosBaixa), false)`.

Exemplos (baixa = {12,36,61,77,92,93,94,99}): `(null,"12")` → true; `(null,"99")` → true;
`(2026-11-05T15:00Z,"12")` → false; `(null,"85")` → false; `(null,"1")` → false; `(null,null)` → false.

**Aberto** = `!estaEntregue(...) && !estaFinalizadoSemEntrega(...)`.

### 3.3 `codigoSituacao` — origem `codigo_situacao_ctrc(data_entrega, ocorr, tipo_ssw)`

Código usado pelo seletor "Ocorrência", filtro de códigos e gráfico por código da Listagem: CT-e
com data de entrega mas efetiva que não é ENTREGA/BAIXA conta como **1** (caso das entregas que
vieram só pelo BI2 e ficaram com 88/85/34 de última ocorrência).

```ts
function codigoSituacao(dataEntrega: Instante | null, codigoEfetivo: CodigoTexto, tipoSswDaEfetiva: TipoSsw | null): number | null {
  if (dataEntrega !== null && tipoSswDaEfetiva !== "ENTREGA" && tipoSswDaEfetiva !== "BAIXA") return 1;
  return normCodigoOcorr(codigoEfetivo);
}
```

`tipoSswDaEfetiva` = `tipo_ssw` do cadastro do código efetivo (empresa do CT-e). Exemplos:
`(entrega, "88", "INFORMATIVA")` → 1; `(entrega, "88", null)` → 1; `(entrega, "12", "BAIXA")` → 12;
`(null, "85", "PRE_ENTREGA")` → 85; `(null, null, null)` → null.

### 3.4 `dataConclusaoEfetiva` — origem `_calc_data_conclusao_efetiva` (gatilho)

```ts
function dataConclusaoEfetiva(c: {
  data_entrega_realizada: Instante | null; ocorr_efetiva_codigo: CodigoTexto; ocorr_efetiva_data: Instante | null;
}, codigosBaixa: ReadonlySet<number>): DataISO | null {
  if (c.data_entrega_realizada) return diaSp(c.data_entrega_realizada);
  const encerrado = estaEntregue(null, c.ocorr_efetiva_codigo)
    || estaFinalizadoSemEntrega(null, c.ocorr_efetiva_codigo, codigosBaixa);
  return encerrado && c.ocorr_efetiva_data ? diaSp(c.ocorr_efetiva_data) : null;
}
```

Gravada em `ctrcs.data_conclusao_efetiva`; é a coluna de período "conclusão" de Performance,
Romaneio, Comprovantes etc. Exemplos: entrega `2026-11-06T02:59Z` (23:59 SP de 05/11) →
`2026-11-05`; sem entrega, efetiva `"12"` em `2026-11-07T12:00Z` → `2026-11-07`; efetiva `"85"` →
`null`; efetiva `"1"` sem data → `null`.

### 3.5 Regras de exibição da página do CT-e (front, `ctrc.$numero.tsx`)

Ficam no web/`packages/shared` (não são SQL), mas usam as mesmas constantes:

- `finalizacaoCtrc`: `entregue = !!data_entrega_realizada || CODIGOS_ENTREGA.has(efetiva)`;
  `baixa = !entregue && efetiva ∈ CODIGOS_BAIXA (lista fixa do front)`; `aberto = !entregue && !baixa`.
- Pílula de status: "Entregue" › "Baixado sem entrega · NN descrição" (código com 2 dígitos) ›
  `status_atual` › "Sem status".
- Pontualidade: responsabilidade do cliente › baixado e `no_prazo` nulo ("fora da pontualidade") ›
  `no_prazo` true/false › "Em trânsito"/"Em apuração".
- Selo de prazo (`PrazoStatusBadge`): sem previsão → "Sem previsão"; sem entrega e com baixa
  (efetiva ou qualquer ocorrência BAIXA) → "Baixado sem entrega"; com entrega (ocorrência de
  entrega mais recente › `data_entrega_realizada` › data da efetiva se for entrega): no prazo se
  `entrega ≤ previsão 23:59:59` (hora local do navegador), senão `ceil(diff/1 dia)` (mínimo 1)
  dias de atraso; aberto: previsão ≥ hoje → "No prazo", senão "Atrasado N dias" (dias de
  calendário locais).
- "Nascido em atraso": aviso quando `previsão < prazo_padrao_data` (comparação de texto
  `YYYY-MM-DD`). "Prazo mínimo (48h)": data, ou "não avaliado (previsão anterior à emissão)" se
  `prazo_padrao_dias` não nulo e data nula, ou "não avaliado (TROCA)".
- Lista de ocorrências da página: esconde quarentena e as com `diaSp(data_hora) < data_emissao`;
  ordena por `data_hora` desc.

---

## 4. Ocorrência efetiva

### 4.1 `calcularOcorrenciaEfetiva` — origem `_calc_ocorr_efetiva` (+ `_trg_ctrcs_calc_ocorr_efetiva`, `recompute_ocorr_efetiva`)

**Entradas**: a linha do CT-e (`id`, `empresa_id`, `data_emissao`, colunas 0174, 0013, 036), as
ocorrências do CT-e (tabela `ocorrencias`) e o cadastro `codigos_ocorrencia` da empresa.
**Saída**: `{ codigo, descricao, data_hora, fonte, local }` ou tudo `null`; gravada em
`ocorr_efetiva_codigo/descricao/data/fonte/local`.

Quatro candidatas, com prioridade de fonte: **036 = 4 › 0174 = 3 › 0013 = 2 › webhook (tabela
`ocorrencias`) = 1**. O nome "webhook" vale para qualquer linha de `ocorrencias` (930, webhook,
trackingdanfe…).

```ts
type Fonte = "ssw_036" | "bi2_0174" | "bi2_0013" | "webhook";
type Conclusivo = boolean | null; // NULL do SQL importa na escolha entre ocorrências (ver passo 1)
interface Candidata { codigo: number; descricao: string | null; dataHora: Instante | null; fonte: Fonte; local: string | null; prio: 1 | 2 | 3 | 4; conclusivo: Conclusivo; }

/** (co.tipo_ssw = 'BAIXA' OR código ∈ ENTREGA) com lógica de 3 valores do SQL */
function conclusivoDe(codigo: number, tipoSsw: TipoSsw | null): Conclusivo {
  if (CODIGOS_ENTREGA.includes(codigo)) return true;
  if (tipoSsw === null) return null;            // código sem cadastro OU cadastrado sem tipo_ssw
  return tipoSsw === "BAIXA";
}
const passaEmissao = (dh: Instante | null, emissao: DataISO | null) =>
  emissao === null || dh === null || diaSp(dh) >= emissao;

function calcularOcorrenciaEfetiva(ct: CtrcFontes, ocorrencias: Ocorrencia[], cad: (cod: number) => CodigoCadastro | null) {
  const emissao = ct.data_emissao;

  // 1) webhook: melhor linha de `ocorrencias`
  const wh = ocorrencias
    .filter((o) => o.quarentena !== true && passaEmissao(o.data_hora, emissao))
    .map((o): Candidata => ({
      codigo: o.codigo, descricao: o.descricao ?? cad(o.codigo)?.descricao ?? null,
      dataHora: o.data_hora, fonte: "webhook", local: null, prio: 1,
      conclusivo: conclusivoDe(o.codigo, cad(o.codigo)?.tipo_ssw ?? null),
    }))
    // ORDER BY conclusivo DESC NULLS LAST, data_hora DESC NULLS LAST  →  true > false > NULL
    .sort(por((x) => rank3(x.conclusivo), "desc").depois((x) => x.dataHora, "desc-nulls-last")
                                                .depois(desempateOcorrencia))[0];

  // 2) 0174 e 0013 (colunas do CT-e)
  const c0174 = candidataColuna(ct.ult_ocorr_codigo_0174, ct.ult_ocorr_data_0174, "bi2_0174", 3,
    (cod) => ct.ult_ocorr_descricao_0174 ?? cad(cod)?.descricao ?? null,  // '' NÃO vira null aqui
    vazioParaNull(ct.ult_ocorr_instrucao_0174) ?? ct.ult_ocorr_local_0174);
  const c0013 = candidataColuna(ct.ultima_ocorr_codigo_0013, ct.ultima_ocorr_data_0013, "bi2_0013", 2,
    (cod) => cad(cod)?.descricao ?? null, null);
  // candidataColuna: só existe se data não nula, normCodigoOcorr(código) não nulo e passaEmissao(data)

  // 3) melhor entre 0174, 0013 e webhook — aqui NULL de conclusivo vale false
  const melhorOutros = [c0174, c0013, wh].filter(Boolean)
    .sort(por((x) => x.conclusivo === true, "desc").depois((x) => x.dataHora, "desc-nulls-last").depois((x) => x.prio, "desc"))[0];

  // 4) 036, que não pode tirar uma ENTREGA do lugar com algo que não é entrega
  let c036 = candidataColuna(ct.ocorr_036_codigo, ct.ocorr_036_data, "ssw_036", 4,
    (cod) => vazioParaNull(ct.ocorr_036_descricao) ?? cad(cod)?.descricao ?? null, null);
  if (c036 && melhorOutros && CODIGOS_ENTREGA.includes(melhorOutros.codigo) && !CODIGOS_ENTREGA.includes(c036.codigo)) c036 = null;

  // 5) final
  const v = [melhorOutros, c036].filter(Boolean)
    .sort(por((x) => x.conclusivo === true, "desc").depois((x) => x.dataHora, "desc-nulls-last").depois((x) => x.prio, "desc"))[0];
  return v ? { codigo: String(v.codigo), descricao: v.descricao, data_hora: v.dataHora, fonte: v.fonte, local: v.local }
           : { codigo: null, descricao: null, data_hora: null, fonte: null, local: null };
}
```

Detalhes que mudam número se errados:

- **Código gravado** é o inteiro normalizado em texto (`"1"`, nunca `"01"`).
- **Cadastro** = `codigos_ocorrencia` da empresa do CT-e (`p_empresa`, ou a da linha gravada).
- **Três valores no passo 1**: dentro das linhas de `ocorrencias`, uma linha com código sem
  `tipo_ssw` (ex.: criado por `garantir_codigo_ocorrencia`, `pendente_classificacao`) perde para
  uma linha mais antiga com tipo não-BAIXA. Nos passos 3 e 5, NULL = false.
- **Filtro de emissão**: ocorrência/foto com `diaSp(data) < data_emissao` não entra; ocorrência
  sem data entra (na tabela `data_hora` é NOT NULL, então não acontece).
- **Quarentena** só existe na tabela; as fotos (0174/0013/036) não têm quarentena.
- **Descrição**: webhook `o.descricao ?? cadastro`; 0174 `descricao_0174 ?? cadastro` (string
  vazia é mantida); 0013 só cadastro; 036 `nullif(descricao_036,'') ?? cadastro`.
- **Local**: só o 0174 tem (`instrução` não vazia, senão `local`).
- **Empate** com mesmo conclusivo e mesma data: fonte de maior `prio` vence. Entre duas linhas de
  `ocorrencias` com mesmo conclusivo e mesma `data_hora` o SQL **não define** a ordem
  (`LIMIT 1` arbitrário). `desempateOcorrencia` = `created_at` desc, depois `id` desc (proposta,
  §14 D8).
- Nenhuma candidata → os cinco campos `null`.

**Exemplos (testes)** — empresa com 12/99 = BAIXA, 85 = PRE_ENTREGA, 88 = INFORMATIVA, 50 sem
tipo; emissão `2026-11-03` salvo dito; datas em UTC:

| # | Entradas | Efetiva esperada |
| --- | --- | --- |
| E1 | webhook 12 em 11-05T13:00; webhook 88 em 11-06T13:00 | `12`, webhook (baixa vence o 88 posterior) |
| E2 | 0174 `"85"` em 11-05T11:00; webhook 1 em 11-04T15:00 | `1`, webhook (conclusivo vence mais recente) |
| E3 | 0174 `"01"` em 11-05T13:00; webhook 1 em 11-05T13:00 | `1`, **bi2_0174** (empate → prio 3 > 1) |
| E4 | webhook 1 em 11-05T13:00; 036 `"12"` em 11-06T13:00 | `1`, webhook (036 não-entrega descartado diante de entrega) |
| E5 | webhook 12 em 11-05T13:00; 036 `"1"` em 11-04T13:00 | `12`, webhook (os dois conclusivos; mais recente) |
| E6 | webhook 85 em 11-03T01:00 (= 02/11 22:00 SP); nada mais | todos `null` (antes da emissão) |
| E7 | webhook 85 quarentena em 11-05; 0013 `"82"` em 11-04 | `82`, bi2_0013 |
| E8 | webhook 85 em 11-05T13:00; webhook 50 (sem tipo) em 11-06T13:00 | `85`, webhook (false > NULL no passo 1) |
| E9 | 0174 `"85"` em 11-06T10:00, desc `""`, instr `""`, local `"RIO"` | `85`, descrição `""`, local `"RIO"` |
| E10 | 036 `"85"` em 11-06T10:00; 0174 `"85"` em 11-06T10:00 | `85`, **ssw_036** (prio 4) |
| E11 | sem nenhuma fonte | todos `null` |

### 4.2 Leitura em lote — origem `ultima_ocorrencia_efetiva_batch(uuid[])`

Lê a efetiva **gravada** (não recalcula) para a lista do Romaneio, exportação e Performance:

```ts
// para cada CT-e da empresa em ids, com normCodigoOcorr(ocorr_efetiva_codigo) não nulo:
{ ctrc_id, codigo: normCodigoOcorr(c.ocorr_efetiva_codigo),
  descricao: vazioParaNull(c.ocorr_efetiva_descricao) ?? cad(codigo)?.descricao ?? null,
  data_hora: c.ocorr_efetiva_data, responsavel: cad(codigo)?.responsavel ?? null,
  fonte: c.ocorr_efetiva_fonte, local: c.ocorr_efetiva_local }
```

CT-e sem efetiva não volta linha. O chamador (`ultima-ocorrencia.server.ts`) consulta em blocos
de 2000 ids e aceita só as fontes `bi2_0174`, `bi2_0013`, `webhook` (036 vira `fonte = null`).

### 4.3 `status_atual` — origem `sync_status_atual_from_ocorrencia` (gatilho)

**Não** é a efetiva: é a descrição da ocorrência mais recente por `data_hora` na tabela
`ocorrencias`, **inclusive quarentena**, sem 0174/0013/036. Exceção visível conhecida (pílula da
página do CT-e quando não está encerrado).

```ts
const ult = ocorrencias.filter((o) => o.data_hora !== null).sort(desc(data_hora), desempateOcorrencia)[0];
const desc = ult ? (ult.descricao ?? cad(ult.codigo)?.descricao ?? null) : null;
if (desc !== null && desc !== ct.status_atual) ct.status_atual = desc; // nunca grava null
```

Roda depois de INSERT/UPDATE de ocorrência (não em DELETE).

---

## 5. Atraso, sem movimento e recortes de situação

### 5.1 `atrasoDias` — origem `atraso_lista_dias(prevista, entrega, ocorr, performance_dias)` e `src/lib/atraso.ts`

```ts
const CODIGOS_BAIXA_FIXOS = [12, 36, 61, 77, 92, 93, 94, 99] as const; // fixos no SQL por desempenho
function atrasoDias(prevista: DataISO | null, entrega: Instante | null, codigoEfetivo: CodigoTexto,
                    performanceDias: number | null, agora: Instante): number | null {
  if (prevista === null) return null;
  if (entrega !== null) return difDias(diaSp(entrega), prevista);   // dia da entrega em SP
  const c = codigoEfetivo === null ? null : codigoEfetivo.replace(/^0+/, ""); // ltrim(p,'0')
  if (c !== null && ["1", "18", "67"].includes(c)) return performanceDias;   // pode ser null
  if (c !== null && CODIGOS_BAIXA_FIXOS.map(String).includes(c)) return null;
  return difDias(hojeSp(agora), prevista);
}
```

Fragmento SQL: o mesmo `CASE` de `atraso_lista_dias`, com `(now() AT TIME ZONE 'America/Sao_Paulo')::date`
trocado por um parâmetro `$hoje` calculado no TS (assim o teste controla o relógio).
⚠ Aqui a baixa é **lista fixa**; em §3.2 vem do cadastro. Para a FR são iguais (§14 D4).

| prevista | entrega | efetiva | perf | hoje SP | atraso |
| --- | --- | --- | --- | --- | --- |
| 2026-11-05 | 2026-11-06T02:59Z | 1 | — | — | 0 (23:59 SP de 05/11) |
| 2026-11-05 | 2026-11-07T15:00Z | 1 | — | — | 2 |
| 2026-11-05 | null | `"85"` | — | 2026-11-10 | 5 |
| 2026-11-12 | null | `"85"` | — | 2026-11-10 | −2 (ainda no prazo) |
| 2026-11-05 | null | `"1"` | 2 | — | 2 |
| 2026-11-05 | null | `"18"` | null | — | null |
| 2026-11-05 | null | `"12"` | — | — | null |
| 2026-11-05 | null | null | — | 2026-11-10 | 5 |
| null | qualquer | qualquer | — | — | null |

`ctrcs.atraso_dias` **não** é lido por nenhuma regra/tela (foto do 0013/038).

### 5.2 `estaSemMovimento` — regra viva, escrita inline em `_lista_ctrcs_detalhado_filtro` e `performance_alertas` (a função `_is_ctrc_sem_movimento` não é chamada, §13)

```ts
function estaSemMovimento(c: CtrcLeitura, limite: number, codigosBaixa: ReadonlySet<number>, agora: Instante): boolean {
  if (estaEntregue(c.data_entrega_realizada, c.ocorr_efetiva_codigo)) return false;
  if (estaFinalizadoSemEntrega(c.data_entrega_realizada, c.ocorr_efetiva_codigo, codigosBaixa)) return false;
  if (c.responsabilidade_cliente === true) return false;
  const atraso = atrasoDias(c.data_prevista_entrega, c.data_entrega_realizada, c.ocorr_efetiva_codigo, c.performance_dias, agora);
  if (atraso === null || !(atraso > limite)) return false;
  const ultimoMovimento = c.ocorr_efetiva_data ? diaSp(c.ocorr_efetiva_data) : c.data_emissao; // desde 09/11/2026
  return difDias(hojeSp(agora), ultimoMovimento) > limite;
}
```

- `limite` = `limiteSemMovimento(empresa)` (§5.3), salvo quando a tela manda
  `p_dias_sem_movimento` (Performance).
- Exemplo (limite 3, hoje 2026-11-10): previsão 11-05, efetiva 85 em 11-06T13:00 → atraso 5 > 3 e
  10−6 = 4 > 3 → **true**. Efetiva em 11-08 → 2 → false. Sem efetiva, emissão 11-01 → 9 → true.
  Previsão 11-08 → atraso 2 → false. `responsabilidade_cliente = true` → false.

### 5.3 `limiteSemMovimento` — origem `_alerta_dias_sem_movimento()`

`configuracoes.valor` da chave `alerta_dias_sem_movimento` da empresa; vazio/ausente → **3**;
texto não numérico → erro (no novo: validar na gravação da configuração).

### 5.4 Faixa de previsão — origem `_bucket_faixa_prev(date)` ⚠ D1

```ts
function faixaPrevisao(prev: DataISO | null, hoje: DataISO): "sem_prev"|"vencido"|"hoje"|"d1"|"d2"|"d3_mais" {
  if (prev === null) return "sem_prev";
  if (prev < hoje) return "vencido";
  if (prev === hoje) return "hoje";
  if (prev === somarDiasCorridos(hoje, 1)) return "d1";
  if (prev === somarDiasCorridos(hoje, 2)) return "d2";
  return "d3_mais";
}
// hoje = CURRENT_DATE da sessão (UTC hoje). Paridade: hojeUtc(agora). Recomendado: hojeSp(agora).
```

Exemplos com hoje = 2026-11-10: null → sem_prev; 11-09 → vencido; 11-10 → hoje; 11-11 → d1;
11-12 → d2; 11-13 → d3_mais. Usado no bloco "Previstos" (Performance) e no recorte da Listagem.

### 5.5 Status do previsto — origem `_bucket_status_previsto(int, tipo_ssw)`

```ts
function statusPrevisto(codigo: number | null, tipoSsw: TipoSsw | null): "agendamento"|"rota"|"pendencia"|"programacao"|"outros" {
  if (codigo === 35) return "agendamento";
  if (codigo === 85 || codigo === 7) return "rota";
  if (tipoSsw === "PENDENCIA_CLIENTE" || tipoSsw === "PENDENCIA_TRANSPORTADORA") return "pendencia";
  if (codigo === null || [80, 82, 83, 84].includes(codigo)) return "programacao";
  return "outros";
}
```

`codigo` = efetiva como inteiro; `tipoSsw` = do cadastro do código efetivo. A ordem importa: 35
com tipo pendência é "agendamento". Exemplos: (35, PENDENCIA_CLIENTE) → agendamento; (7, null) →
rota; (9, PENDENCIA_CLIENTE) → pendencia; (null, null) → programacao; (84, INFORMATIVA) →
programacao; (88, INFORMATIVA) → outros.

### 5.6 Saiu para entrega — origem `_saiu_entrega_status(ctrcs)`

```ts
const CODIGOS_SAIU_ENTREGA = [85,7,9,10,13,14,17,30,31,32,33,34,38,48,63,67,70,87,88,96] as const;
function saiuParaEntrega(c: CtrcLeitura, ocorrencias: Ocorrencia[]): "sim" | "quarentena" | "nao_rastreado" {
  if (estaEntregue(c.data_entrega_realizada, c.ocorr_efetiva_codigo)) return "sim";
  for (const col of [c.ocorr_efetiva_codigo, c.ultima_ocorr_codigo_0013, c.ult_ocorr_codigo_0174]) {
    const n = normalizaCodigoOcorr(col);
    if (n !== null && CODIGOS_SAIU_ENTREGA.includes(n)) return "sim";
  }
  const sas = ocorrencias.filter((o) => CODIGOS_SAIU_ENTREGA.includes(o.codigo));
  if (sas.length === 0) return "nao_rastreado";
  return sas.some((o) => o.quarentena !== true) ? "sim" : "quarentena";
}
```

Usado em `romaneio_base` (filtro `p_saiu_entrega`) e `_romaneio_saida_ctrc_sync` (spec do
Romaneio). Exemplos: efetiva 1 → sim; 0174 `"085"` → sim; só ocorrência 9 em quarentena →
quarentena; só ocorrências 80/82 → nao_rastreado.

### 5.7 Em rota e travado em ocorrência — origem `_romaneio_em_rota(ctrcs)` e `_ctrc_travado(ctrcs)`

```ts
function emRota(c: CtrcLeitura, ocorrencias: Ocorrencia[]): boolean {
  if (normCodigoOcorr(c.ocorr_efetiva_codigo) !== 85) return false;
  const de85 = ocorrencias.filter((o) => o.codigo === 85);
  if (de85.length === 0) return true;                        // 85 veio só de foto (0174/0013/036)
  const corte = inicioDoDiaUtc(c.data_emissao);              // ⚠ D1: data_emissao::timestamptz
  return de85.some((o) => o.quarentena !== true && o.data_hora >= corte && o.created_at >= c.created_at);
}

/** Pendência só deixa de travar com uma NOVA saída para entrega (85). Decisão 26/10/2026. */
function travadoEmOcorrencia(c: CtrcLeitura, ocorrencias: Ocorrencia[], cad: Cadastro): boolean {
  if (emRota(c, ocorrencias)) return false;
  const pend = ocorrencias.filter((o) => o.codigo !== 85 &&
    ["PENDENCIA_CLIENTE", "PENDENCIA_TRANSPORTADORA"].includes(cad(o.codigo)?.tipo_ssw ?? ""));
  if (pend.length === 0) return false;
  const ultPend = max(pend.map((o) => o.data_hora));
  const ult85 = max(ocorrencias.filter((o) => o.codigo === 85).map((o) => o.data_hora)) ?? -Infinity;
  return ultPend >= ult85;                                   // empate de horário = travado
}
```

- Ocorrências **incluem quarentena** no travado (o SQL não filtra).
- ⚠ O cadastro do travado é o da **empresa da sessão** (`empresa_atual()`); no novo, a do CT-e.
- Exemplos: efetiva 85 e nenhuma 85 na tabela → em rota; pendência 9 em 11-05 e 85 em 11-04 →
  travado; 9 em 11-05, 85 em 11-06 → não travado; 9 e 85 no mesmo instante → travado; 9 em 11-05
  e efetiva 85 com 85 válida na tabela → não travado (está em rota).

---

## 6. Prazo

### 6.1 Dias úteis entre datas — origem `_dias_uteis_sla(prev, ent)`

Conta dias úteis no intervalo **(menor, maior]** (exclui o início, inclui o fim), com sinal.
Útil = segunda a sexta e não feriado **nacional**.

```ts
function diasUteisEntre(prev: DataISO | null, ent: DataISO | null, feriadosNacionais: ReadonlySet<DataISO>): number | null {
  if (prev === null || ent === null) return null;
  if (prev === ent) return 0;
  const [lo, hi] = prev < ent ? [prev, ent] : [ent, prev];
  let n = 0;
  for (let d = somarDiasCorridos(lo, 1); d <= hi; d = somarDiasCorridos(d, 1))
    if (diaDaSemanaIso(d) < 6 && !feriadosNacionais.has(d)) n++;
  return (ent > prev ? 1 : -1) * n;
}
```

- `feriadosNacionais` = `feriados` com `tipo = 'nacional'`. ⚠ Hoje **sem filtro de empresa** e
  sem municipal/estadual (§14 D5).
- Exemplos (feriados 2026 da §6.2): `(11-06 sex, 11-09 seg)` → 1; `(11-09, 11-06)` → −1;
  `(11-19 qui, 11-23 seg)` → 1 (20/11 feriado); `(10-30 sex, 11-03 ter)` → 1 (02/11 feriado);
  `(11-07 sáb, 11-08 dom)` → 0; `(11-10, 11-10)` → 0; `(null, x)` → null.
- Usado por `calcular_sla_arquivos` (cron do SLA — spec de Performance/SLA).

### 6.2 Feriados nacionais — origem `gerar_feriados_nacionais(ano)`

Permissão: papel `admin` ou `super_admin` (senão erro `forbidden`). Páscoa pelo algoritmo
anônimo gregoriano (Meeus/Jones/Butcher), com divisão inteira:

```ts
function pascoa(y: number): DataISO {
  const a = y % 19, b = div(y, 100), c = y % 100, d = div(b, 4), e = b % 4, f = div(b + 8, 25),
        g = div(b - f + 1, 3), h = (19 * a + b - d - g + 15) % 30, i = div(c, 4), k = c % 4,
        l = (32 + 2 * e + 2 * i - h - k) % 7, m = div(a + 11 * h + 22 * l, 451);
  const mes = div(h + l - 7 * m + 114, 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, mes, dia);
}
```

Lista inserida (`tipo 'nacional'`, `cidade/uf/empresa_id` nulos, `gerado_automaticamente true`),
`ON CONFLICT (data, tipo, cidade, uf, empresa_id) DO NOTHING`:

| data | descrição |
| --- | --- |
| 01/01 | Confraternização Universal |
| 21/04 | Tiradentes |
| 01/05 | Dia do Trabalho |
| 07/09 | Independência do Brasil |
| 12/10 | Nossa Senhora Aparecida |
| 02/11 | Finados |
| 15/11 | Proclamação da República |
| 20/11 | Consciência Negra |
| 25/12 | Natal |
| Páscoa − 48 | Carnaval (segunda) — ponto facultativo |
| Páscoa − 47 | Carnaval (terça) — ponto facultativo |
| Páscoa − 2 | Sexta-feira Santa |
| Páscoa + 60 | Corpus Christi (ponto facultativo) |

Retorno: `{ ano, inseridos, existiam }` (contagem por linha da lista). Testes: Páscoa 2025 =
04-20 (carnaval 03-03/03-04, sexta 04-18, Corpus 06-19); 2026 = 04-05 (02-16/02-17, 04-03,
06-04); 2027 = 03-28 (02-08/02-09, 03-26, 05-27). Rodar duas vezes o mesmo ano → 2ª vez
`{inseridos: 0, existiam: 13}`.

### 6.3 Prazo padrão (mínimo 48 h) e nascido em atraso — origens `prazo_padrao_do_ctrc`, `prazo_padrao_data_do_ctrc`, `_trg_ctrcs_prazo_padrao`

Decisão vigente: *nascido-em-atraso-48h-corridas-2026-10-13*.

```ts
const RAIZ_CNPJ_TROCA = "00193687";  // por empresa (§12)
const PRAZO_PADRAO_DIAS = 2;         // 48 h corridas; por empresa (§12)

function prazoPadraoDias(pagadorCnpj: string | null, parceiroCnpj: string | null): number | null {
  const raiz = (s: string | null) => (s ?? "").replace(/\D/g, "").slice(0, 8);
  return raiz(pagadorCnpj) === RAIZ_CNPJ_TROCA || raiz(parceiroCnpj) === RAIZ_CNPJ_TROCA ? null : PRAZO_PADRAO_DIAS;
}
function prazoPadraoData(emissao: DataISO | null, previsao: DataISO | null, dias: number | null): DataISO | null {
  if (emissao !== null && previsao !== null && previsao < emissao) return null; // não avaliado
  if (emissao === null || dias === null) return null;
  return somarDiasCorridos(emissao, dias);          // previsão NULL ainda gera data!
}
const nascidoEmAtraso = (previsao: DataISO | null, padraoData: DataISO | null) =>
  previsao !== null && padraoData !== null && previsao < padraoData;
```

Gravados em `prazo_padrao_dias` e `prazo_padrao_data` quando muda emissão, previsão, pagador ou
parceiro. Avaliados = `prazo_padrao_data` e `data_prevista_entrega` não nulos; % = nascidos ÷
avaliados (spec de Performance/Prazo parceiro).

| emissão | previsão | pagador | dias | data padrão | nascido |
| --- | --- | --- | --- | --- | --- |
| 2026-11-06 | 2026-11-07 | 11.222.333/0001-81 | 2 | 2026-11-08 | sim |
| 2026-11-06 | 2026-11-08 | idem | 2 | 2026-11-08 | não |
| 2026-11-06 (sex) | 2026-11-09 (seg) | idem | 2 | 2026-11-08 | não (72 h) |
| 2026-11-06 | 2026-11-06 | idem | 2 | 2026-11-08 | sim |
| 2026-11-06 | 2026-11-05 | idem | 2 | null | não avaliado |
| 2026-11-06 | null | idem | 2 | 2026-11-08 | não avaliado (sem previsão) |
| 2026-11-06 | 2026-11-07 | 00.193.687/0001-xx | null | null | TROCA, não avaliado |

### 6.4 Prazos configurados — origens `aplicar_prazo_configurado`, `limpar_prazos_regras_orfas`, `recalcular_todos_prazos_configurados`

Tela Admin › Prazos configurados (`prazos.functions.ts`). Gatilhos de execução hoje:

- salvar regra (nova ou editada) → `aplicar(regra)`;
- ativar → `aplicar(regra)`; desativar → `recalcularTodos(empresa)`;
- excluir → `recalcularTodos(empresa)`.

⚠ CT-e novo, ou 84 nova, **não** recebe regra até alguém mexer numa regra (§14 D7). O caso de
uso é admin (papel admin), escreve com permissão de sistema na empresa ativa.

```ts
function aplicar(regraId): { atualizados: number; aplicada: boolean } {
  const r = buscarRegra(regraId); if (!r) throw erro("regra não encontrada");
  if (!r.ativo) return { atualizados: 0, aplicada: false };
  const ehParceiroAtivo = (cnpj) => existeRegra({ tipo: "parceiro", ativo: true, parceiro_cnpj: cnpj, empresa: r.empresa_id });

  if (r.tipo === "parceiro") {
    // todos os CT-e da empresa com parceiro_cnpj = r.parceiro_cnpj (igualdade de TEXTO, com máscara)
    // e data_emissao não nula — inclusive entregues e com previsão do SSW
    set data_prevista_entrega = emissao + r.prazo_dias (corridos),
        prazo_fonte = "regra_parceiro",
        data_base_prazo = meia-noite de SP da emissão (timestamptz)
  }
  if (r.tipo === "transbordo") {
    // chegada = MIN(data_hora) das ocorrências 84 da empresa com filial = r.unidade_destino_codigo, por CT-e (inclui quarentena)
    // alvo: CT-e da empresa com filial = r.unidade_codigo, com chegada, e sem regra de parceiro ativa para o parceiro_cnpj dele
    set data_prevista_entrega = diaSp(chegada) + r.prazo_dias, prazo_fonte = "regra_transbordo", data_base_prazo = chegada
  }
  if (r.tipo === "unidade") {
    // chegada = MIN(data_hora) das 84 com filial = r.unidade_codigo
    // alvo: filial = r.unidade_codigo, com chegada, sem regra de parceiro ativa e SEM regra de transbordo ativa
    //       (unidade_codigo = filial do CT-e) cuja unidade_destino tenha uma 84 neste CT-e
    set data_prevista_entrega = dataDe(horaLocalSp(chegada) + r.prazo_horas h), prazo_fonte = "regra_unidade", data_base_prazo = chegada
  }
  return { atualizados: linhasAtualizadas, aplicada: true };  // conta linhas tocadas, mesmo sem mudança de valor
}

function limparOrfas(empresa): { limpos } {          // empresa obrigatória: "Informe a empresa."
  // para CT-e com prazo_fonte regra_parceiro sem regra parceiro ativa p/ o parceiro_cnpj;
  //                regra_unidade sem regra unidade ativa p/ a filial;
  //                regra_transbordo sem regra transbordo ativa p/ a filial cujo destino tenha 84 no CT-e:
  set prazo_fonte = null, prazo_contratado_dias = null, data_prevista_entrega = null,
      data_base_prazo = null, prazo_ssw_indisponivel = false   // ⚠ apaga a previsão
}

function recalcularTodos(empresa): { atualizados, limpos } {  // empresa obrigatória
  const { limpos } = limparOrfas(empresa);
  let total = 0;
  for (const r of regrasAtivas(empresa).ordenadasPor({ unidade: 1, transbordo: 2, parceiro: 3 })) total += aplicar(r.id).atualizados;
  return { atualizados: total, limpos };
}
```

Ordem unidade → transbordo → parceiro: a de parceiro roda por último e vence. Dentro do mesmo
tipo a ordem não é definida (proposta: `created_at`, `id`). Cada atualização dispara as regras
de gravação do CT-e (§11): prazo padrão e histórico de previsão (fonte = `regra_*`).

Exemplo unidade: regra `{unidade, CAP, 48 h}`; 84 em CAP às `2026-11-05T22:30-03:00` → hora
local 22:30 + 48 h = 07/11 22:30 → previsão **2026-11-07**. Transbordo `{CAP→RIO, 1 dia}` com 84
em RIO em `2026-11-06T01:00Z` (05/11 22:00 SP) → previsão **2026-11-06**.

### 6.5 Histórico de previsão — origem `_trg_ctrcs_log_prazo`

Depois de gravar o CT-e: se `data_prevista_entrega` mudou **e** o valor anterior não era nulo,
inserir `ctrc_prazo_historico { empresa_id, ctrc_id, data_anterior, data_nova, fonte: prazo_fonte novo }`.
Primeira previsão (anterior nula) não gera linha. Gravação idêntica não gera linha (§11.3).

---

## 7. Universo do CT-e

### 7.1 Data mínima de emissão — origem `_trg_ctrcs_data_minima_emissao`

Na **criação** do CT-e: se `configuracoes['ctrc_data_minima_emissao']` da empresa existe, não é
vazia e `data_emissao < data mínima` → **não cria** (sem erro; em upsert a linha inteira é
ignorada, nem o UPDATE acontece). Não vale para update. Hoje: produção `2026-09-01`, develop
`2026-01-01` (memória *base-comeca-em-setembro*). Valor inválido → erro de cast (validar na
gravação da configuração).

### 7.2 Cancelado no mesmo dia — origens `_is_cancelado_mesmo_dia`, `_trg_ctrcs_calc_cancelado_mesmo_dia`, `_trg_ocorrencias_recompute_cancelado`

```ts
const canceladoMesmoDia = (emissao: DataISO, ocorrencias: Ocorrencia[]) =>
  ocorrencias.some((o) => o.codigo === 99 && diaSp(o.data_hora) === emissao); // inclui quarentena
```

- Na criação do CT-e: mantém o valor recebido (`?? false`) — o CT-e novo ainda não tem
  ocorrência.
- Recalcula quando muda `data_emissao` e quando uma ocorrência 99 do CT-e é criada, alterada
  (código antigo ou novo = 99, CT-e antigo e novo) ou apagada.
- Exemplos: emissão 11-05, 99 em `2026-11-06T02:30Z` (05/11 23:30 SP) → true; 99 em
  `2026-11-06T13:00Z` → false; 99 em quarentena no dia → true.

### 7.3 Fora do universo — origem `_trg_ctrcs_fora_universo`

`fora_universo = (cancelado_mesmo_dia ?? false) || duplicado_de !== null`, recalculado em **toda**
gravação do CT-e, por último. Para tirar um CT-e das telas: preencher `duplicado_de` com o id do
CT-e certo; para voltar: limpar. Nunca gravar `fora_universo` direto. Toda consulta de tela filtra
`NOT fora_universo` (sem `COALESCE`, para usar o índice parcial).

---

## 8. Ocorrência na gravação

Ordem fixa na **criação** de uma ocorrência (antes de gravar): 8.1 → 8.2 → 8.3. Depois de gravar:
§11.2.

### 8.1 Quarentena — origem `guard_data_ocorrencia` (só INSERT)

```ts
if (o.ctrc_id && o.data_hora) {
  const ct = buscarCtrc(o.ctrc_id); // data_emissao, created_at
  if (diaSp(o.data_hora) < ct.data_emissao) {
    o.quarentena = true;
    o.quarentena_motivo = `data_hora (${diaSp(o.data_hora)}) anterior a data_emissao do CTRC (${ct.data_emissao})`;
  } else if (o.origem === "trackingdanfe" && ct.created_at && o.data_hora < menosDias(ct.created_at, 400)) {
    o.quarentena = true;
    o.quarentena_motivo = "evento muito anterior a criacao da linha do CTRC (trackingdanfe)";
  }
}
// nunca põe quarentena = false: mantém o valor recebido (padrão false)
```

Texto do motivo é literal (sem acento). Exemplo: emissão 2026-11-05, `data_hora`
`2026-11-05T02:00Z` (04/11 23:00 SP) → quarentena, motivo
`data_hora (2026-11-04) anterior a data_emissao do CTRC (2026-11-05)`.

### 8.2 Responsável e penaliza — origem `fill_ocorrencia_penaliza` (só INSERT)

Se o código existe no cadastro da empresa: `responsavel = o.responsavel ?? cad.responsavel`;
`penaliza = cad.penaliza` (**sempre** sobrescreve o recebido). Se não existe: mantém o recebido
(e `responsavel` nulo faz a gravação falhar — NOT NULL; por isso a ingestão chama 8.4 antes).

### 8.3 Domínio do trackingdanfe — origem `validar_ocorrencia_dominio` (só INSERT)

Só para `origem = 'trackingdanfe'` (webhook do SSW é confiável):

```ts
const dom = o.payload_bruto?.dominio ?? null, fil = o.payload_bruto?.filial ?? null;
if (dom !== null && dom === empresa.dominio_ssw) gravar();
else if (dom === null && filiaisProprias(empresa).has(fil)) gravar();   // igualdade exata da sigla
else descartarSemErro(); // log 'ocorrencia_dominio_invalido: dominio=% filial=% ctrc_id=%'
```

Domínio presente e diferente → descarta, mesmo com filial própria.

### 8.4 Garantir código — origem `garantir_codigo_ocorrencia(empresa, codigo, descricao)`

Chamado pela ingestão antes de gravar ocorrência (930, webhook, enriquecimento, import CSV):

```ts
if (!empresa) throw erro("Empresa obrigatória");
if (codigo === null || codigo < 0 || codigo > 99) return;
inserirSeNaoExiste(codigos_ocorrencia, { empresa, codigo,
  descricao: vazioAposTrim(descricao) ?? "Recebido via SSW",
  responsavel: "outro", penaliza: false, letra_responsavel: "O", pendente_classificacao: true, ativo: true });
// tipo_ssw fica NULL → 8.5 não altera nada
```

### 8.5 Derivar responsável do tipo SSW — origem `codigos_derivar_responsavel` (só INSERT em `codigos_ocorrencia`)

| `tipo_ssw` | `responsavel` | `letra_responsavel` | `penaliza` |
| --- | --- | --- | --- |
| NULL | (mantém o recebido) | (mantém) | (mantém) |
| PENDENCIA_TRANSPORTADORA | `FR` | `F` | true |
| PENDENCIA_CLIENTE com `processo_ssw` ENTREGA/REENTREGA | `destinatario` | `D` | false |
| PENDENCIA_CLIENTE (outro processo) | `cliente` | `C` | false |
| qualquer outro | `sistema` | `S` | false |

Em UPDATE do código não roda (o admin pode ajustar à mão).

### 8.6 Propagar alteração do código — origem `propagate_codigo_changes`

Ao alterar um código: se `responsavel` ou `penaliza` mudou, gravar os novos valores em **todas**
as ocorrências da empresa com esse código. Efeito colateral hoje: essa gravação dispara o recálculo
da efetiva de todos esses CT-e (§11.2), que pega também `tipo_ssw`/descrição novos (§14 D3).

### 8.7 Data de embarque — origem `sync_data_embarque_from_ocorrencia`

Depois de criar/alterar ocorrência com código 82 ou 85 (e `ctrc_id`, `data_hora`):
`ctrcs.data_embarque = MIN(diaSp(data_hora))` das ocorrências 82/85 do CT-e (**inclui
quarentena**). Não roda em DELETE nem quando a alteração tira o código de 82/85.

### 8.8 Emissão ancorada no 80 — origem `sync_data_emissao_from_ocorrencia_80`

Depois de criar/alterar ocorrência 80 **fora de quarentena**:

```ts
const validas = ocorrencias.filter((o) => o.codigo === 80 && o.quarentena !== true &&
  (o.origem !== "trackingdanfe" || ct.created_at === null || o.data_hora >= menosDias(ct.created_at, 400)));
const min = minimo(validas.map((o) => diaSp(o.data_hora)));
if (min !== null && (ct.data_emissao === null || ct.data_emissao > min)) ct.data_emissao = min; // só antecipa
```

A emissão nunca é adiada por aqui. Mudar a emissão recalcula cancelado no mesmo dia, prazo
padrão e fora do universo (§11).

### 8.9 Filial do complemento — origem `filial_do_complemento(empresa, complemento)`

Webhook SSW: tira a cidade de textos como `"Chegada na unidade SAO JOAO DE MERITI em 02/07/26, 01:14h."`
e busca a filial em `filial_alias` (`cidade_normalizada` exata, empresa).

```ts
// O regex do PG é GULOSO no todo (o 1º quantificador, \s+, é guloso): captura até o ÚLTIMO " em <dígito>".
const m = /unidade\s+(.+)\s+em\s+\d/.exec(complemento ?? "");   // sensível a maiúsculas
if (!m) return null;
const nome = m[1].trim().toUpperCase();                          // TRIM do PG: só espaço
return filialAlias.get(empresa, nome) ?? null;
```

Casos: o exemplo acima → `"SAO JOAO DE MERITI"`; `"Unidade X em 1"` → null (U maiúsculo);
`"unidade A em 1 e unidade B em 2"` → `"A EM 1 E UNIDADE B"` (pela regra de gulosidade do
regex do PG, que trata o RE inteiro como guloso; confirmar este caso num teste contra o Postgres
antes de fechar a paridade; não casa alias de qualquer forma); `null` → null.

---

## 9. Escrita do BI2 no CT-e

Regra do usuário (09/11/2026): **o BI2 nunca altera CT-e em andamento e nunca cria CT-e**; e não
sobrescreve coluna que veio dos arquivos do SSW (`campos_ssw`). Hoje é imposta por gatilho a
partir de `app.escrita_fonte` / header `x-escrita-fonte`. No novo, o caso de uso da ingestão BI2
passa a **fonte da escrita** explícita para a função de domínio.

### 9.1 Não cria — origem `_trg_ctrcs_bi2_nao_cria`

Fonte `bi2` ou `bi2_0017_prazo_entregue` em criação → descarta a linha sem erro. Em upsert, a
linha inteira é descartada (o ramo UPDATE também não roda): hoje o upsert do 0174 é inerte.

### 9.2 Preserva o SSW — origem `_trg_ctrcs_bi2_preserva_ssw`

Só roda quando o CT-e já tem `campos_ssw` não vazio (condição `WHEN cardinality(old.campos_ssw) > 0`):

```ts
function mesclarEscritaBi2(antigo: Ctrc, novo: Ctrc, fonte: string | null, codigosBaixa): Ctrc | "descartar" {
  if (antigo.campos_ssw.length === 0) return novo;                 // ⚠ sem marca, nada é protegido (D10)
  if ((fonte === "bi2" || fonte === "bi2_0017_prazo_entregue")
      && antigo.cancelado_em === null
      && !estaEntregue(antigo.data_entrega_realizada, antigo.ocorr_efetiva_codigo)
      && !estaFinalizadoSemEntrega(antigo.data_entrega_realizada, antigo.ocorr_efetiva_codigo, codigosBaixa))
    return "descartar";                                            // CT-e em andamento: só os arquivos mudam
  if (fonte !== "bi2") return novo;                                // inclui bi2_0017_prazo_entregue: passa tudo
  const manter = new Set(antigo.campos_ssw);
  if (manter.has("data_prevista_entrega")) { manter.add("prazo_fonte"); manter.add("data_base_prazo"); }
  manter.add("campos_ssw");                                        // o BI2 não mexe na própria marca
  return { ...novo, ...pick(antigo, [...manter].filter((c) => c in antigo)) };
}
```

`bi2_0017_prazo_entregue` existe para aplicar a previsão ajustada pós-entrega em CT-e encerrado
mesmo com `data_prevista_entrega` em `campos_ssw` (decisão *prazo-ajustado-depois-da-entrega-2026-11-06*).

---

## 10. Cadastros, escopo e utilidades

### 10.1 Cidade da unidade — origem `_trg_ctrcs_unidade_cidade_por_filial`

Ao criar o CT-e ou gravar `filial`, `unidade_cidade` ou `unidade_uf`: se `trim(filial)` não vazio
e existe `filiais_ssw` da empresa com `upper(trim(sigla)) = upper(trim(filial))` **e cidade não
nula** → `unidade_cidade = f.cidade`, `unidade_uf = f.uf` (uf pode ser nula e sobrescreve). Senão
mantém o que veio.

### 10.2 Filiais próprias — origem `filiais_proprias()` (+ `filiais_proprias_sql()`)

`filiais_ssw.sigla` com `propria = true` da empresa ativa, ordenadas; vazio = `[]`. Em consulta
montada no backend: parâmetro `$filiaisProprias::text[]` e `= ANY(...)` (a versão `_sql`, que
monta literais para SQL dinâmico, não é portada). Front: `criarFiliaisProprias`
(`src/config/filiais.ts`) — enquanto a lista não carregou, não filtra.

### 10.3 CNPJs próprios da empresa — origem `empresa_cnpjs_proprios(empresa)`

Distintos e não vazios, só dígitos: `empresas.cnpj` + cada item de
`empresa_integracoes(tipo 'xml_cte').parametros.cnpjs_emitentes`. Usado pela ingestão do 455
(`aplicar_partes_455`) para deixar o parceiro vazio quando o expedidor é a própria empresa.

### 10.4 Escopo de visibilidade — origens `pode_ver_tudo(uid)`, `pode_ver_ctrc(ctrc_id)` (RLS de `ctrcs`/`ocorrencias` e filtro de ~20 RPCs)

```ts
function podeVerTudo(u, empresaAtiva): boolean {
  if (!u) return false;
  if (temPapel(u, empresaAtiva, "admin") || temPapel(u, empresaAtiva, "super_admin") || temPapel(u, empresaAtiva, "gestor")) return true;
  const temUnidade = empresaUsuarios.some((eu) => eu.user_id === u && eu.empresa_id === empresaAtiva && eu.unidade_id !== null); // não olha eu.ativo
  const temEquipe = membrosEquipe.some((m) => m.usuario_id === u && m.data_saida === null && m.empresa_id === empresaAtiva);
  return !(temUnidade || temEquipe);           // sem escopo definido = vê tudo
}
function podeVerCtrc(u, c, empresaAtiva): boolean {
  if (c.empresa_id !== empresaAtiva) return false;
  if (podeVerTudo(u, empresaAtiva)) return true;
  const unidade = empresaUsuarios.find((eu) => eu.user_id === u && eu.empresa_id === c.empresa_id)?.unidade_id ?? null;
  return (unidade !== null && unidade === c.unidade_id)
      || membrosEquipe.some((m) => m.usuario_id === u && m.data_saida === null && m.equipe_id === c.equipe_id);
}
// temPapel(u, e, p) = empresa_usuarios(u, e, role_key = p, ativo) OU (p === "admin" && adminPlataforma(u) && e !== null)
```

No novo, a RLS fica só por empresa; este escopo é aplicado pelo **repositório** em toda consulta
de CT-e/ocorrência (fragmento: `($podeVerTudo OR c.unidade_id = $unidadeDoUsuario OR c.equipe_id = ANY($equipesAtivas))`).

### 10.5 `updated_at` — origem `update_updated_at_column`

`updated_at = now()` em todo UPDATE de: `departamentos`, `roles`, `ssw_config`, `equipes_entrega`,
`prazo_padrao_cidade`, `prazos_configurados`, `regras_bonificacao`, `ssw_ciclo_importacao`,
`ssw_relatorio_arquivos`, `ssw_relatorio_tipos`, `sync_state`, `bi2_viagens`, `configuracoes`,
`ftp_sync_progresso`. No novo: `$onUpdate` do Drizzle (ou o repositório). ⚠ `ctrcs.updated_at`
**não** tem gatilho: fica com o valor da criação (D11).

### 10.6 Status de meta (front) — `src/features/dashboard/utils/status.ts`

`statusOf(perf, meta)`: `perf ≥ meta` → good; `perf ≥ meta − 0,03` → warn; senão bad (frações,
não pontos percentuais inteiros).

---

## 11. Gatilhos → onde a regra roda no sistema novo

Sem gatilho no banco: as regras abaixo viram **funções puras** em `packages/dominio` chamadas
pelos casos de uso que gravam CT-e ou ocorrência (API e worker), na mesma transação.

### 11.1 Gravação de CT-e (`ctrcs`) — ordem de hoje

O Postgres dispara gatilhos do mesmo momento em **ordem alfabética do nome**. `UPDATE OF col`
dispara só se a coluna está na lista do `SET` do comando — mudança feita por outro gatilho
**não conta** (origem de duas defasagens, §14 D2).

| # | Gatilho (momento) | Quando dispara | Regra | Caso de uso no novo |
| --- | --- | --- | --- | --- |
| 1 | `trg_aaa_ctrcs_data_minima_emissao` (BEFORE INSERT) | criação | §7.1 descarta | `criarCtrc` (ingestão SSW/XML/webhook/import) |
| 2 | `trg_ctrcs_a_bi2_nao_cria` (BEFORE INSERT) | criação | §9.1 descarta | ingestão BI2 nunca chama `criarCtrc` |
| 3 | `trg_ctrcs_a_bi2_preserva_ssw` (BEFORE UPDATE, se `campos_ssw` não vazio) | update | §9.2 | `gravarCtrc` com `fonte` (ingestão BI2 0017) |
| 4 | `trg_ctrcs_calc_cancelado_mesmo_dia` (BEFORE INSERT / UPDATE OF data_emissao) | criação; emissão no SET | §7.2 | `derivarCtrc` |
| 5 | `trg_ctrcs_calc_ocorr_efetiva` (BEFORE INSERT / UPDATE OF 10 colunas 0174/0013/036) | criação; fonte-foto no SET | §4.1 | `derivarCtrc` |
| 6 | `trg_ctrcs_data_conclusao_efetiva` (BEFORE INSERT / UPDATE OF data_entrega_realizada, ocorr_efetiva_data, ocorr_efetiva_codigo) | criação; essas colunas no SET | §3.4 | `derivarCtrc` |
| 7 | `trg_ctrcs_prazo_padrao` (BEFORE INSERT / UPDATE OF data_emissao, data_prevista_entrega, pagador_cnpj, parceiro_cnpj) | idem | §6.3 | `derivarCtrc` |
| 8 | `trg_ctrcs_unidade_cidade_por_filial` (BEFORE INSERT / UPDATE OF filial, unidade_cidade, unidade_uf) | idem | §10.1 | `derivarCtrc` |
| 9 | `trg_ctrcs_zz_fora_universo` (BEFORE INSERT/UPDATE) | sempre | §7.3 | `derivarCtrc` (último) |
| 10 | `trg_ctrcs_zzz_ignora_update_identico` (BEFORE UPDATE, `suppress_redundant_updates_trigger`) | sempre | linha igual à antiga → não grava (nem histórico) | repositório compara antes de gravar |
| 11 | `trg_ctrcs_log_prazo` (AFTER UPDATE OF data_prevista_entrega) | previsão no SET e linha gravada | §6.5 | `gravarCtrc`, mesma transação |

### 11.2 Gravação de ocorrência (`ocorrencias`) — ordem de hoje

| # | Gatilho | Quando | Regra | Efeito em `ctrcs` (dispara 11.1) |
| --- | --- | --- | --- | --- |
| 1 | `trg_aaa_guard_data_ocorrencia` (BEFORE INSERT) | criação | §8.1 quarentena | — |
| 2 | `trg_fill_ocorrencia_penaliza` (BEFORE INSERT) | criação | §8.2 | — |
| 3 | `trg_validar_ocorrencia_dominio` (BEFORE INSERT) | criação trackingdanfe | §8.3 descarta | — |
| 4 | `trg_ocorrencias_recompute_cancelado` (AFTER I/U/D) | código antigo ou novo = 99 | §7.2 | `cancelado_mesmo_dia` → fora_universo |
| 5 | `trg_ocorrencias_recompute_efetiva` (AFTER I/U/D) | sempre; CT-e novo e, se mudou `ctrc_id`, o antigo | §4.1 (`recompute_ocorr_efetiva`: grava só se algum dos 5 campos mudou) | `ocorr_efetiva_*` no SET → dispara #6 conclusão e #9 |
| 6 | `trg_sync_data_embarque` (AFTER INSERT / UPDATE OF codigo, data_hora, ctrc_id) | código 82/85 | §8.7 | `data_embarque` |
| 7 | `trg_sync_data_emissao_80` (AFTER INSERT / UPDATE OF codigo, data_hora, ctrc_id) | código 80, fora de quarentena | §8.8 | `data_emissao` no SET → #4 cancelado, #7 prazo padrão, #9 (**não** a efetiva) |
| 8 | `trg_sync_status_atual` (AFTER INSERT / UPDATE OF codigo, descricao, data_hora, ctrc_id) | sempre | §4.3 | `status_atual` |

Antes de gravar ocorrência, a ingestão chama §8.4 (garantir código). Cadastro de códigos:
`trg_codigos_derivar` (BEFORE INSERT, §8.5) e `trg_propagate_codigo_changes` (AFTER UPDATE, §8.6).

### 11.3 Proposta de ordem no novo (uma função, sempre na mesma sequência)

```ts
// packages/dominio — puro; o caso de uso carrega antes: CT-e antigo, ocorrências do CT-e, cadastro de códigos,
// filiais_ssw, configurações da empresa; e grava depois numa transação.
function derivarCtrc(antigo: Ctrc | null, novo: Ctrc, ctx: ContextoDerivacao): Ctrc | "descartar" {
  if (!antigo) { if (abaixoDaDataMinima(novo, ctx)) return "descartar"; if (ehFonteBi2(ctx.fonte)) return "descartar"; }
  else { const m = mesclarEscritaBi2(antigo, novo, ctx.fonte, ctx.codigosBaixa); if (m === "descartar") return m; novo = m; }
  novo.data_emissao     = emissaoAncoradaNo80(novo, ctx.ocorrencias);        // §8.8 (só antecipa)
  novo.unidade_cidade/uf = cidadeDaFilial(novo, ctx.filiais);                // §10.1
  novo.cancelado_mesmo_dia = antigo ? canceladoMesmoDia(novo.data_emissao, ctx.ocorrencias) : (novo.cancelado_mesmo_dia ?? false);
  novo.ocorr_efetiva_*  = calcularOcorrenciaEfetiva(novo, ctx.ocorrencias, ctx.cadastro); // §4.1
  novo.data_conclusao_efetiva = dataConclusaoEfetiva(novo, ctx.codigosBaixa); // §3.4 (depende da efetiva)
  novo.prazo_padrao_dias/data = ...;                                          // §6.3 (depende da emissão)
  novo.data_embarque    = embarque(ctx.ocorrencias) ?? novo.data_embarque;    // §8.7
  novo.status_atual     = statusAtual(ctx.ocorrencias) ?? novo.status_atual;  // §4.3
  novo.fora_universo    = (novo.cancelado_mesmo_dia ?? false) || novo.duplicado_de !== null; // §7.3, último
  return novo;
}
// depois: se antigo e igual campo a campo → não grava; se previsão mudou e antiga ≠ null → histórico (§6.5).
```

Casos de uso que chamam `derivarCtrc`:

- **Ingestão SSW** (038/455/930/036/306, `aplicar_staging_ssw`, `aplicar_partes_455`,
  `aplicar_036_romaneio`, `ssw_aplicar_estornos`): por CT-e afetado, depois de gravar as
  ocorrências do lote.
- **Ingestão BI2 0017** (`fonte = bi2` / `bi2_0017_prazo_entregue`).
- **Webhook SSW, trackingdanfe/enriquecimento, XML CT-e, import CSV**: criação de CT-e e de
  ocorrência.
- **Admin**: prazos configurados (§6.4), marcar/desmarcar `duplicado_de`, alteração de código
  (§8.6 — recalcula os CT-e com ocorrência daquele código).
- **SLA pelos arquivos** (`calcular_sla_arquivos`, cron :08/:38) grava `no_prazo`/`performance_dias`:
  não muda nenhum campo derivado acima, mas passa pela comparação "igual → não grava".

Diferença consciente frente a hoje: o novo **sempre** recalcula todos os derivados (não depende
de qual coluna veio no `SET`) e calcula a efetiva **depois** de ancorar a emissão. Só muda número
em CT-e hoje defasado (§14 D2). O migrador `public → erp` copia os valores gravados; uma
conferência única deve recalcular todos e listar as diferenças antes da virada.

---

## 12. Constantes de negócio

| Constante | Valor | Origem | Por empresa? |
| --- | --- | --- | --- |
| `CODIGOS_ENTREGA` | 1, 18, 67 | `_is_entregue`, `atraso_lista_dias`, `src/lib/ctrc.ts`; decisão 08/10 | Não (padrão SSW; fixo) |
| Códigos de baixa | `tipo_ssw = 'BAIXA'` do cadastro; FR: 12, 36, 61, 77, 92, 93, 94, 99 | `_is_finalizado_sem_entrega` (cadastro), `atraso_lista_dias` e front (lista fixa) | **Sim** (cadastro `codigos_ocorrencia`) |
| Finalizadores do alerta "Saíram para entrega com prazo vencido" | 1, 12, 36, 59, 61, 77, 92, 93, 94, 99 | decisão 09/10 (spec de Performance) | a decidir |
| `CODIGOS_SAIU_ENTREGA` | 85, 7, 9, 10, 13, 14, 17, 30, 31, 32, 33, 34, 38, 48, 63, 67, 70, 87, 88, 96 | `_saiu_entrega_status` | Não |
| Status previsto | 35 agendamento; 85, 7 rota; 80, 82, 83, 84 ou nulo programação | `_bucket_status_previsto` | Não |
| Saída para entrega | 85 (em rota; único que destrava pendência) | `_romaneio_em_rota`, `_ctrc_travado` | Não |
| Embarque | 82, 85 | `sync_data_embarque_from_ocorrencia` | Não |
| Âncora de emissão | 80 | `sync_data_emissao_from_ocorrencia_80` | Não |
| Cancelamento | 99 | `_is_cancelado_mesmo_dia` | Não |
| Chegada na unidade (prazos configurados) | 84 | `aplicar_prazo_configurado` | Não |
| Tipos de pendência | PENDENCIA_CLIENTE, PENDENCIA_TRANSPORTADORA | `_ctrc_travado`, `_bucket_status_previsto` | Não |
| Faixas de previsão | sem_prev, vencido, hoje, d1, d2, d3_mais | `_bucket_faixa_prev` | Não |
| Raiz CNPJ TROCA | `00193687` | `prazo_padrao_do_ctrc` | **Sim** (hoje fixo: é cliente da FR) |
| Prazo mínimo (nascido em atraso) | 2 dias corridos | `prazo_padrao_do_ctrc`; decisão 13/10 | **Sim** (hoje fixo) |
| Limite "sem movimento" | config `alerta_dias_sem_movimento`, padrão 3 | `_alerta_dias_sem_movimento` | **Sim** (já é config) |
| Data mínima de emissão | config `ctrc_data_minima_emissao` (FR prod 2026-09-01) | `_trg_ctrcs_data_minima_emissao` | **Sim** (já é config) |
| Quarentena trackingdanfe | 400 dias antes da criação do CT-e | `guard_data_ocorrencia`, `sync_data_emissao_from_ocorrencia_80` | Não |
| Código de ocorrência válido | 0–99 | `garantir_codigo_ocorrencia`, CHECK da tabela | Não |
| Código novo sem cadastro | descrição "Recebido via SSW", responsável `outro`, letra `O`, `pendente_classificacao` | `garantir_codigo_ocorrencia` | Não |
| Feriados nacionais | 9 fixos + 4 móveis da Páscoa | `gerar_feriados_nacionais` | Não (globais, `empresa_id` nulo) |
| Domínio SSW | `empresas.dominio_ssw` (FR = FRT) | `validar_ocorrencia_dominio` | **Sim** (cadastro) |
| Tolerância de meta (front) | 0,03 | `statusOf` | Não |
| Fuso | America/Sao_Paulo | todas | Não |

---

## 13. Não portar (código morto) — com prova

Prova = busca por nome (palavra inteira) em `fr-transportes` (`src/`, `apps/`, `packages/`,
`supabase/functions/`; o `types.ts` gerado não conta), nas 217 funções de
`erp-ssw-referencia/banco/funcoes` e na tabela de crons de `docs/vps/paridade.md` §7.

| Função | Prova | O que fazer |
| --- | --- | --- |
| `somar_dias_uteis` | Nenhuma função, rota ou cron a chama; só a migration que a criou (20261008150000) e o REVOKE de segurança. | Não portar. |
| `prazo_padrao_cidade_painel` | Sem chamador. Decisão *nascido-em-atraso-padrao-por-transferencia-2026-10-09*: "O cadastro 'Prazo padrão por cidade' saiu do Admin. A tabela `prazo_padrao_cidade` fica no banco só como registro: nada mais lê dela." | Não portar (nem a tela). |
| `prazo_padrao_da_cidade` | Sem chamador (só migration 20261008150000 e carga `docs/migracao/16`). Mesma decisão. | Não portar. |
| `recalcular_prazo_padrao_ctrcs` | Só usada como carga única dentro das migrations 20261008150000/20261009170000/20261013150000; sem rota/cron. | Não portar como rotina; o migrador já grava `prazo_padrao_*` por `derivarCtrc`. |
| `ultima_ocorrencia_efetiva` (singular) | Nenhum `.rpc("ultima_ocorrencia_efetiva")`; a página do CT-e lê `ocorr_efetiva_*` direto (`ctrc.functions.ts:180`). As ocorrências em `src` são o campo `ultima_ocorrencia_efetiva` do objeto de resposta. | Não portar. (A `_batch` está viva, §4.2.) |
| `_ctrc_ocorrencia_status`, `_ctrc_teve_ocorrencia` | Única chamadora é `listar_enriq_alvos_85`, que não é chamada por nada (só aparece em `types.ts` e migrations). | Não portar (confirmar com a spec de ingestão/enriquecimento que `listar_enriq_alvos_85` sai). |
| `_is_ctrc_sem_movimento` | A função não é chamada: `_lista_ctrcs_detalhado_filtro` e `performance_alertas` só a citam em comentário e escrevem a regra inline. | Não portar a função; portar a **regra** como §5.2. |
| `filiais_proprias_sql` | Só monta literais para SQL dinâmico dentro de RPCs. | Não portar; usar parâmetro array (§10.2). |
| `update_updated_at_column` | Viva, mas é mecanismo de banco. | Vira `$onUpdate` do ORM (§10.5). |
| `_normaliza_codigo_ocorr` × `norm_codigo_ocorr` | As duas vivas; diferem só em texto com letra. | Portar uma (`normCodigoOcorr`), §2.2. |

Vivas (para conferência): `_calc_data_conclusao_efetiva`, `_calc_ocorr_efetiva`, `recompute_ocorr_efetiva`
(também por `ssw_aplicar_estornos`), `_ctrc_travado` (`get_romaneio_v3`, `_lista_ctrcs_detalhado_filtro`),
`_dias_uteis_sla` (`calcular_sla_arquivos`, cron `sla-pelos-arquivos`), `_is_cancelado_mesmo_dia`,
`_is_entregue`, `_is_finalizado_sem_entrega`, `_saiu_entrega_status` (`romaneio_base` →
`romaneio-fase2.functions.ts`; `_romaneio_saida_ctrc_sync`), `_alerta_dias_sem_movimento`,
`_bucket_faixa_prev`, `_bucket_status_previsto` (`performance_previstos_breakdown`),
`codigo_situacao_ctrc`, `codigos_derivar_responsavel`, `gerar_feriados_nacionais`
(`calendario.functions.ts:187`), `prazo_padrao_data_do_ctrc`, `prazo_padrao_do_ctrc`,
`aplicar_prazo_configurado`, `recalcular_todos_prazos_configurados`, `limpar_prazos_regras_orfas`
(`prazos.functions.ts`), `ultima_ocorrencia_efetiva_batch` (`ultima-ocorrencia.server.ts`,
`performance.functions.ts`), `tipo_documento_efetivo`, `texto_casa_filtro`, `normalizar_nome`,
`formatar_cnpj_cpf` (`aplicar_partes_455`), `fill_ocorrencia_penaliza`, `guard_data_ocorrencia`,
`validar_ocorrencia_dominio` (trackingdanfe vivo em `ssw-enriquecimento.server.ts`),
`garantir_codigo_ocorrencia`, `propagate_codigo_changes`, `atraso_lista_dias`, `filiais_proprias`,
`empresa_cnpjs_proprios`, `filial_do_complemento` (`webhook-process.server.ts:91`), `pode_ver_ctrc`
e `pode_ver_tudo` (RLS), os três `sync_*` e todos os `_trg_ctrcs_*`/`_trg_ocorrencias_*`.

---

## 14. Dúvidas que só o dono responde

Cada uma tem a recomendação; enquanto não houver resposta, a onda 1 implementa **o comportamento
de hoje** (paridade) atrás de uma função única, para a troca ser de uma linha.

- **D1 — Fuso da sessão.** `_bucket_faixa_prev` usa `CURRENT_DATE` e `_romaneio_em_rota` usa
  `data_emissao::timestamptz`, ambos no fuso da sessão do banco (UTC no Supabase, a confirmar com
  `SHOW timezone`). Entre 21:00 e 23:59 de SP o "hoje" dos Previstos já é amanhã, e uma 85 das
  21:00–23:59 da véspera da emissão conta como válida. Recomendação: SP.
- **D2 — Derivados defasados por `UPDATE OF`.** Hoje (a) `data_conclusao_efetiva` não é
  recalculada quando a efetiva muda por uma gravação das colunas 0174/0013/036 (só quando muda por
  ocorrência); (b) a efetiva não é recalculada quando a emissão é antecipada pelo 80 (o filtro "antes
  da emissão" fica com a data velha). O novo recalcula sempre (§11.3). Aceita a mudança nesses
  CT-e? Quer a conferência de diferenças antes da virada?
- **D3 — Alterar `tipo_ssw` ou descrição de um código** não recalcula as efetivas (só recalcula,
  por tabela, quando muda `responsavel`/`penaliza`). Recomendação: recalcular os CT-e com
  ocorrência do código em qualquer dessas mudanças.
- **D4 — Lista de baixa.** `_is_finalizado_sem_entrega` usa o cadastro (hoje de **qualquer**
  empresa); `atraso_lista_dias` e o front usam a lista fixa. No novo: cadastro **da empresa** em
  todos. Confirmar que o cadastro BAIXA da FR é exatamente {12, 36, 61, 77, 92, 93, 94, 99}.
- **D5 — Feriados nos dias úteis.** Só `tipo = 'nacional'` conta, de qualquer empresa (um feriado
  "nacional" criado por uma empresa vale para todas); municipal/estadual e os da empresa não
  contam. Manter? Recomendação: nacional com `empresa_id` nulo ou da própria empresa.
- **D6 — TROCA e 48 h** estão fixos no código. Viram configuração da empresa (FR = `00193687`, 2)?
- **D7 — Prazos configurados** só são aplicados quando se salva/ativa/exclui uma regra: CT-e
  emitido depois, ou 84 que chega depois, fica sem a regra. A regra de parceiro sobrescreve até
  CT-e entregue e previsão do SSW; "limpar órfãs" apaga a previsão. Replicar como está?
- **D8 — Empates sem ordem definida** (duas ocorrências com mesma data na efetiva e no
  `status_atual`; regras do mesmo tipo). Proposta: `created_at` desc, depois `id` desc.
- **D9 — Pendência que trava** usa as ocorrências **com quarentena** e a 85 sem filtro de
  quarentena; `status_atual` e `data_embarque` também incluem quarentena. Intencional?
- **D10 — BI2 em CT-e sem `campos_ssw`.** A proteção "BI2 nunca altera CT-e em andamento" só
  roda se o CT-e já tem alguma coluna marcada pelo SSW; sem marca, o BI2 grava. A regra do
  usuário (09/11) diz "nunca". No novo: aplicar sempre?
- **D11 — `ctrcs.updated_at`** nunca é atualizado (não há gatilho). Replicar ou passar a atualizar?
