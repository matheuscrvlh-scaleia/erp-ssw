# R4 — Ocorrências, Comprovantes, Coletas, Histórico, Calendário e Códigos de ocorrência

Especificação extraída do sistema atual para reimplementar no backend TypeScript **com os mesmos
números**. Fonte da verdade: as funções reais em
`erp-ssw-referencia/banco/funcoes/*.sql`, a estrutura em `schema-public.sql` e o código da branch
`feat/multiempresa` (`fr-transportes/.claude/worktrees/agent-ae0264d9f8203d8fa`). Onde o código
atual tem um comportamento estranho, ele está descrito como é (paridade) e marcado com
**[paridade]**; o que precisa de decisão está em [§11](#11-dúvidas-para-o-dono).

Núcleo do CT-e (ocorrência efetiva, `fora_universo`, `no_prazo`, `data_prevista_entrega`, escopo
de visibilidade, tipo de documento): ver `docs/regras/01-nucleo-ctrc.md`. Aqui só se repete o
necessário para as fórmulas ficarem fechadas.

Sumário

1. [Convenções e regras comuns](#1-convenções-e-regras-comuns)
2. [Tela Ocorrências](#2-tela-ocorrências-ocorrencias)
3. [Tela Comprovantes](#3-tela-comprovantes-comprovantes)
4. [Tela Coletas e importação do 050](#4-tela-coletas-coletas-e-importação-do-050)
5. [Histórico (anotações) e Histórico › Feriados](#5-histórico-historico-e-histórico--feriados-historicoferiados)
6. [Calendário](#6-calendário-calendario)
7. [Admin › Códigos de ocorrência](#7-admin--códigos-de-ocorrência-admincodigos)
8. [Escritas: validações, efeitos colaterais e auditoria](#8-escritas-validações-efeitos-colaterais-e-auditoria)
9. [Exportações](#9-exportações)
10. [Código morto — não portar](#10-código-morto--não-portar)
11. [Dúvidas para o dono](#11-dúvidas-para-o-dono)

---

## 1. Convenções e regras comuns

### 1.1 Fuso, datas e ordenação de texto

- **Hoje** nas regras de atraso/vencimento = data civil em `America/Sao_Paulo`
  (`(now() AT TIME ZONE 'America/Sao_Paulo')::date`). Chamado aqui de `hojeSP()`.
- **Sessão do banco em UTC.** Toda conversão `timestamptz::date` sem `AT TIME ZONE` dá a data
  **em UTC**. Isso afeta Comprovantes (dia da entrega) — ver [§3.2](#32-universo-e-campos). Onde
  houver isso, a spec diz "data UTC" explicitamente. **[paridade]**
- Datas (`date`) chegam e saem como `'YYYY-MM-DD'`.
- Ordenações de texto no SQL usam a collation do banco. **Não foi possível conferir qual é**
  (ver [§11](#11-dúvidas-para-o-dono), D1). A spec assume `C` (ordem de bytes) e diz onde isso
  muda o resultado.
- `ORDER BY x DESC` no Postgres põe `NULL` **primeiro** quando não há `NULLS LAST`; `ASC` põe por
  último. Onde importa, está dito.

### 1.2 Normalizações de busca (CTRC e NF)

```ts
// origem: ocorrencias_painel_v5 / ocorrencias_lista_v5 / ocorrencias_codigos_bucket_v3 / comprovantes_*_v2
/** "CAS 150354-5" → "150354"; "ABC0001234" → "1234"; "000" → null. */
function termoCtrc(entrada: string | null): string | null {
  const s = (entrada ?? "")
    .replace(/^ +| +$/g, "")       // trim só de espaços (btrim)
    .toUpperCase()
    .replace(/^[A-Z]+/, "")        // tira a sigla colada no começo
    .split("-")[0]!                // split_part(..., '-', 1)
    .replace(/[^0-9]/g, "")
    .replace(/^0+/, "");
  return s === "" ? null : s;
}
/** Lado do CT-e: dígitos de ctrcs.numero_ctrc sem zeros à esquerda ('' se nulo). */
const numeroCtrcNorm = (n: string | null) => (n ?? "").replace(/[^0-9]/g, "").replace(/^0+/, "");

function termoNf(entrada: string | null): string | null {
  const s = (entrada ?? "").replace(/[^0-9]/g, "").replace(/^0+/, "");
  return s === "" ? null : s;
}
/** Lado do CT-e: NF nula vira '0' e depois '' (ltrim de zeros). */
const nfNorm = (nf: number | null) => String(nf ?? 0).replace(/^0+/, "");
```

- Ocorrências (painel, lista, bucket): filtro aplicado só se `termo != null`; casa quando
  `numeroCtrcNorm(c.numero_ctrc) === termo` / `nfNorm(c.numero_nf) === termoNf`.
- Comprovantes usa a **mesma** normalização, mas o "filtro ligado" é `trim(entrada) !== ''` e
  compara o termo **sem** o `NULLIF`: `ctrc="000"` vira termo `''` e casa só CT-e cujo número sem
  zeros é vazio (na prática nenhum); `nf="0"` vira `''` e casa **todo CT-e sem NF**
  (`nfNorm(null) === ''`). **[paridade]**

### 1.3 Filtro de texto com vários valores (remetente, destino)

```ts
// origem: texto_casa_filtro
function textoCasaFiltro(valor: string | null, filtro: string): boolean {
  if (valor == null) return false;                          // NULL ILIKE ... → não casa
  if (!filtro.includes("|")) return ilike(valor, `%${btrim(filtro)}%`);
  const padroes = `%${btrim(filtro).replace(/\s*\|\s*/g, "%|%")}%`.split("|");
  return padroes.some((p) => ilike(valor, p));             // "a||b" gera '%%' → casa tudo
}
```

`ilike` = semântica do `ILIKE` do Postgres: sem distinção de maiúsculas (não remove acento),
`%` = qualquer sequência, `_` = um caractere, `\` = escape. Os curingas digitados pelo usuário
valem como curinga. **[paridade]** No banco novo, montar o `ILIKE` parametrizado igual.

### 1.4 Tipo de documento

```ts
// origem: tipo_documento_efetivo
const tipoDocEfetivo = (t455: string | null, tBi2: string | null) =>
  (btrim(t455) || btrim(tBi2) || null)?.toUpperCase() ?? null;   // btrim só espaços; '' conta como vazio
const SEM_TIPO = "__SEM_TIPO__";
/** Filtro do seletor: lista vazia/nula = sem filtro. A UI já manda em maiúsculas (saneTipos). */
const casaTipos = (c, tipos: string[] | null) =>
  !tipos?.length || tipos.map((t) => t.toUpperCase()).includes(tipoDocEfetivo(c.tipo_documento_455, c.tipo_documento) ?? SEM_TIPO);
```

`saneTipos` (front→servidor): `trim().toUpperCase()`, remove vazios e duplicados; lista vazia vira
"sem filtro".

### 1.5 Unidade responsável, filiais próprias, pagador

```ts
// COALESCE do SQL: '' NÃO é pulado. Usar ??, nunca ||.
const unidadeResp = (c) => c.unidade_destino ?? c.unidade_atual ?? c.filial;
/** filiais_proprias(): siglas de filiais_ssw com propria = true da empresa ativa. */
const pagadorRotulo = (c) => nz(c.pagador_nome) ?? nz(c.pagador_cnpj) ?? "—";  // nz: '' → null
const pagadorCnpjDigitos = (c) => (c.pagador_cnpj ?? "").replace(/\D/g, "");
```

Universo base de **Ocorrências** e **Comprovantes**: `!c.fora_universo &&
filiaisProprias.includes(unidadeResp(c))`.

### 1.6 Escopo de visibilidade (só Ocorrências)

As três funções da tela Ocorrências aplicam, além do RLS, o escopo do usuário:

```ts
// origem: CTE actor de ocorrencias_*_v5 / bucket_v3; pode_ver_tudo
const veTudo = podeVerTudo(uid);   // papel admin/super_admin/gestor, OU usuário sem unidade no vínculo
                                   // da empresa (empresa_usuarios.unidade_id) e sem equipe ativa
const unidadeDoPerfil = usuarios_perfil.unidade_id;                 // atenção: outra fonte que o pode_ver_tudo
const equipes = membros_equipe(usuario = uid, data_saida = null, empresa ativa).equipe_id;
const visivel = (c) => veTudo
  || (unidadeDoPerfil != null && unidadeDoPerfil === c.unidade_id)
  || (c.equipe_id != null && equipes.includes(c.equipe_id));
```

Detalhe completo em `01-nucleo-ctrc.md`. **Comprovantes não aplica escopo** (todas as unidades da
empresa); Coletas não tem escopo por unidade (decisão de 05/11, ver [§4](#4-tela-coletas-coletas-e-importação-do-050)).

### 1.7 Situação do CT-e (entregue, baixado, em aberto, atraso)

```ts
// origem: _is_entregue / _is_finalizado_sem_entrega / CTE univ do painel_v5
const normCodigo = (txt: string | null) => { const d = (txt ?? "").replace(/\D/g, ""); return d === "" ? null : Number(d); };
const ENTREGA = [1, 18, 67];                    // fixos no SQL (função IMMUTABLE)
// BAIXA = códigos do catálogo da empresa com tipo_ssw = 'BAIXA' (hoje 12,36,61,77,92,93,94,99)
function situacao(c, baixas: number[], hoje: string) {
  const nc = normCodigo(c.ocorr_efetiva_codigo);
  const entregue = c.data_entrega_realizada != null || (nc != null && ENTREGA.includes(nc));
  const baixado = !entregue && c.data_entrega_realizada == null && nc != null && nc !== 1 && baixas.includes(nc);
  const emAberto = !entregue && !baixado;
  const vencido = emAberto && c.data_prevista_entrega != null && c.data_prevista_entrega < hoje;
  return { entregue, baixado, emAberto, emAtraso: vencido,
           atrasoDias: vencido ? diasEntre(c.data_prevista_entrega, hoje) : null };   // hoje − previsão, ≥ 1
}
```

`_is_finalizado_sem_entrega` (usada na lista) lê `codigos_ocorrencia` **sem filtro de empresa**
(BAIXA de qualquer empresa). Hoje só a FR tem catálogo, então dá o mesmo. No sistema novo usar
sempre o catálogo da empresa.

### 1.8 Códigos da tela Ocorrências

```ts
// origem: _ocorrencias_codigos_tela
const foraDaTela = parseListaInteiros(config(empresa, "ocorrencias_codigos_fora_da_tela"));  // FR: "3,40,55,96,98"
const codigosTela = catalogo
  .filter((co) => co.pendencia_acompanhada && !foraDaTela.includes(co.codigo))
  .map((co) => co.codigo).sort((a, b) => a - b);
// parseListaInteiros: split(','), trim, só /^\d+$/, Number. Config ausente = lista vazia.
```

- Não olha `ativo`: código inativo com `pendencia_acompanhada` continua na tela.
- Na FR hoje: 8, 13, 15, 20, 24, 25, 27, 30, 34, 35, 42, 44, 47, 49, 50, 51, 52, 64, 69, 71, 87,
  92 (22 códigos). O texto "recorte: 22 códigos de pendência" da tela é fixo no front
  (ver D7).
- Como todo código da tela está no catálogo, a classificação do evento sempre acha o código
  (o ramo "código sem cadastro → pendente" do SQL nunca dispara na tela; manter por segurança).

### 1.9 Classificação de cada evento (ocorrência)

```ts
// origem: CTE ev/oc_all/base dos três SQL da tela
function classificar(o: { codigo: number; descricao: string | null }, co: Codigo | undefined) {
  const pendente = co == null || co.pendente_classificacao;
  return {
    pendente,
    penaliza: pendente ? false : co.penaliza,
    responsavel: pendente ? "pendente" : co.responsavel,    // FR | transportador | destinatario | cliente | sistema | outro
    descricao: co?.descricao ?? o.descricao ?? `Código ${o.codigo}`,
    tipo_ssw: co?.tipo_ssw ?? "SEM_TIPO",
  };
}
```

**A tela lê a classificação do catálogo no momento da consulta**, não as colunas
`ocorrencias.penaliza/responsavel` (essas são cópias para as outras telas; ver [§8.4](#84-catálogo-de-códigos)).
Ocorrências em `quarentena` **não** são excluídas nas três funções da tela. **[paridade]**

### 1.10 Conferente e romaneio do CT-e (relatório 036)

```ts
// origem: _ocorrencias_conferente_romaneio (e a cópia inline da lista_v5)
function conferenteRomaneio(c): { conferente: string | null; romaneio: string | null } | null {
  const linhas = staging_036_romaneios.filter((s) =>
    s.empresa_id === empresa && s.ctrc != null && s.romaneio != null
    && s.situacao !== "CANCELADO"                         // IS DISTINCT FROM: situacao nula passa
    && sswNumCtrc(s.ctrc) === c.numero_ctrc && sswSiglaCtrc(s.ctrc) === c.sigla_ctrc);
  // ORDER BY, nesta ordem:
  //  data_ocorr_ctrc DESC NULLS LAST, hora_ocorr_ctrc (texto) DESC NULLS LAST,
  //  (situacao = 'BAIXADO') DESC  → situacao NULL primeiro, depois 'BAIXADO', depois as demais,
  //  data_emissao DESC NULLS LAST, importado_em DESC, id DESC (uuid)
  const s = ordenar(linhas)[0];
  return s ? { conferente: nz(btrim(s.conferente)), romaneio: s.romaneio } : null;
}
// ssw_num_ctrc: parte antes do '-', só dígitos, sem zeros à esquerda (cast bigint); vazio → null.
// ssw_sigla_ctrc: letras iniciais em maiúsculas; sem letras → null.
```

A comparação com `ctrcs.numero_ctrc` é **igualdade exata** (se `numero_ctrc` tiver zero à
esquerda, não casa).

### 1.11 Período "mês anterior"

```ts
// origem: v_ini_ant/v_fim_ant do painel_v5 — (d - interval '1 month')::date
function mesAnterior(d: string): string {
  const [y, m, dia] = d.split("-").map(Number);
  const [ya, ma] = m === 1 ? [y - 1, 12] : [y, m - 1];
  return iso(ya, ma, Math.min(dia, diasNoMes(ya, ma)));   // dia inexistente → último dia do mês
}
```

Exemplos: 01–05/11/2026 → 01–05/10/2026; 31/03/2026 → 28/02/2026; 29–31/03/2026 → 28/02–28/02;
29/03/2024 → 29/02/2024. Início e fim são deslocados **independentemente**. Os dois períodos podem
se sobrepor (ex.: 15/01–20/03 → 15/12–20/02); um CT-e pode estar nos dois.

### 1.12 Período das telas (front)

Calculado no navegador, com a data **local** do navegador:

| Tela | Botões | Padrão | `custom` sem `de`/`ate` |
| --- | --- | --- | --- |
| Ocorrências | hoje, 7d (hoje−6), 30d (hoje−29), mes (dia 1 até hoje), custom | `mes` | cai em `mes` |
| Comprovantes | idem | `mes` | cai em **30d** **[paridade]** |
| Coletas | 7d, 30d, mes, mes_anterior (1º ao último dia do mês passado), custom | `30d` | cai em 30d |
| Histórico | 7d, 30d, mes, 90d (hoje−89) | `30d` | — (usa `toISOString()`: data **UTC** do navegador) **[paridade]** |

---

## 2. Tela Ocorrências (`/ocorrencias`)

Módulo `ocorrencias`. Três chamadas de dados + duas de opções. Todas exigem usuário autenticado.

### 2.1 Parâmetros de URL (search) — manter os nomes

`conferentes[]` (cada um cortado em 120 chars), `campoData` (`emissao`|`prevista`, padrão
`emissao`), `periodo`, `unidades[]` (uuid, só por URL — não há seletor), `parceiros[]` (CNPJ só
dígitos), `remetente`, `destino`, `ctrc`, `nf`, `tipos[]`, `filiais[]` (siglas), `de`, `ate`
(`YYYY-MM-DD`), `resp` (`todas`|`penalizantes`|`externas`|`pendentes`), `codigos[]` (aceita também
o legado `codigo`), `responsaveis[]` (`FR`,`transportador`,`destinatario`,`cliente`,`sistema`,
`pendente`), `prazo` (`no_prazo`|`fora_prazo`|`sem_prazo`), `faixa`
(`ate_3`|`de_4_8`|`de_9_15`|`de_16_30`|`acima_30`), `pagador` (rótulo do pagador), `unidadeResp`
(sigla), `ordem` (`data_hora`|`codigo`|`responsavel`|`numero_ctrc`|`parceiro_nome`|`atraso_dias`),
`dir` (`asc`|`desc`, padrão `desc`), `page` (≥1), `size` (50|100|200, padrão 50). Qualquer mudança
de filtro volta `page` para 1.

### 2.2 Filtros: semântica exata

Filtros "de CT-e" (valem para o painel, a lista e o bucket):

| Filtro | Regra |
| --- | --- |
| Período + `campoData` | `emissao`: `c.data_emissao ∈ [inicio, fim]`; `prevista`: `c.data_prevista_entrega ∈ [inicio, fim]` (CT-e sem previsão fica fora). Seleciona o **CT-e**; todas as ocorrências dos códigos da tela desse CT-e entram, qualquer que seja a data da ocorrência. |
| `unidades` (uuid) | `c.unidade_id ∈ unidades` |
| `conferentes` | `conferenteRomaneio(c)?.conferente ∈ conferentes` (só o romaneio mais recente do 036 conta) |
| `parceiros` | `pagadorCnpjDigitos(c) ∈ parceiros` |
| `filiais` | `unidadeResp(c) ∈ filiais` |
| `remetente` | `textoCasaFiltro(c.remetente, remetente)` |
| `destino` | `textoCasaFiltro(c.cidade_destino, destino)` |
| `tipos` | `casaTipos(c, tipos)` |
| `ctrc` / `nf` | [§1.2](#12-normalizações-de-busca-ctrc-e-nf) |

Recortes (cards e blocos; valem para painel e lista, **não** para o bucket):

| Recorte | Regra |
| --- | --- |
| `pagador` | `pagadorRotulo(c) === pagador` |
| `unidadeResp` | `(unidadeResp(c) ?? '—') === unidadeResp` |
| `prazo` | `no_prazo`: `c.no_prazo === true`; `fora_prazo`: `=== false`; `sem_prazo`: `== null` |
| `faixa` | `emAberto && prev != null && prev < hoje` e `atrasoDias` em: ate_3 1–3, de_4_8 4–8, de_9_15 9–15, de_16_30 16–30, acima_30 > 30 |
| `codigos` | evento com `codigo ∈ codigos` (lista vazia = sem filtro) |
| `responsaveis` | evento com `responsavel ∈ responsaveis` (inclui `'pendente'`) |
| `resp` (aba/card) | ver abaixo |

Regra de **CT-e penalizante** (card "Penalizantes"; decisão de 21/08/2026):

```ts
// frRuim olha TODOS os eventos dos códigos da tela do CT-e, sem os filtros de código/responsável.
const frRuim = (eventosDoCtrc) => eventosDoCtrc.some((e) => e.penaliza && e.responsavel !== "cliente");
const penalizante = (c) => frRuim(eventosDoCtrc(c)) && situacao(c).emAtraso;
// resp: todas → tudo; pendentes → evento.pendente; penalizantes → penalizante(c); externas → !penalizante(c)
```

Consequência: com filtro de código `[15]` (não penaliza), um CT-e que tem 15 e também 13 (FR) e
está em atraso é **penalizante**. "Pendentes" é por **evento**; "penalizantes"/"externas" é por
**CT-e**.

### 2.3 Painel — `GET/POST painel` (origem `ocorrencias_painel_v5`)

Entrada: filtros de CT-e + `codigos`, `responsabilidade` (padrão `todas`; `''`/nulo = `todas`),
`responsaveis`, `prazo`, `faixaAtraso`, `pagadorNome`, `unidadeResp`. Timeout atual 45 s.

```ts
const hoje = hojeSP();
const ant = { inicio: mesAnterior(inicio), fim: mesAnterior(fim) };
const baixas = catalogo.filter((c) => c.tipo_ssw === "BAIXA").map((c) => c.codigo);

// 1) univ: CT-e dos DOIS períodos com todos os filtros de CT-e e os recortes de CT-e
//    (pagador, unidadeResp, prazo, faixa). É também o denominador do Impacto.
const univ = ctrcs.filter((c) => {
  const dt = campoData === "prevista" ? c.data_prevista_entrega : c.data_emissao;
  return dt != null && (entre(dt, inicio, fim) || entre(dt, ant.inicio, ant.fim))
    && universoBase(c) && visivel(c) && filtrosDeCtrc(c) && recortesDeCtrc(c);
}).map((c) => {
  const dt = campoData === "prevista" ? c.data_prevista_entrega : c.data_emissao;
  const s = situacao(c, baixas, hoje);
  return { id: c.id, atual: entre(dt, inicio, fim), anterior: entre(dt, ant.inicio, ant.fim),
           pagador: pagadorRotulo(c), unidade_resp: unidadeResp(c), no_prazo: c.no_prazo, ...s };
});

// 2) ev: cada ocorrência (evento) dos códigos da tela desses CT-e
const ev = univ.flatMap((u) => ocorrencias(u.id).filter((o) => codigosTela.includes(o.codigo))
  .map((o) => ({ ...u, codigo: o.codigo, ...classificar(o, catalogo[o.codigo]) })));

// 3) flags por evento
const frPorCtrc = agrupar(ev, "id", (es) => frRuim(es));
const g = ev.map((e) => {
  const penalizante = frPorCtrc[e.id] && e.emAtraso;
  const okCod = !codigos?.length || codigos.includes(e.codigo);
  const okRv = !responsaveis?.length || responsaveis.includes(e.responsavel);
  const okResp = resp === "todas" || (resp === "pendentes" && e.pendente)
    || (resp === "penalizantes" && penalizante) || (resp === "externas" && !penalizante);
  return { ...e, penalizante,
    k: e.atual && okCod && okRv,                  // cards: tudo menos a aba de responsabilidade
    m: e.atual && okCod && okRv && okResp,        // demais blocos
    m_ant: e.anterior && okCod && okRv && okResp,
    imp: e.atual && okRv && okResp,               // Impacto: sem o filtro de código
    imp_ant: e.anterior && okRv && okResp };
});
```

Saída (JSON):

| Campo | Fórmula |
| --- | --- |
| `periodo_anterior` | `{ inicio: ant.inicio, fim: ant.fim }` |
| `metricas.total` | `count(g where k)` (eventos) |
| `metricas.pendentes` | `count(g where k && pendente)` (eventos) |
| `metricas.ctrcs` | `distinct(id) where k` |
| `metricas.penalizantes` | `distinct(id) where k && penalizante` |
| `metricas.nao_penalizantes` | `distinct(id) where k && !penalizante` (penalizantes + não = ctrcs) |
| `prazo.no_prazo / fora_prazo / sem_prazo` | `distinct(id) where m` e `no_prazo` `true` / `false` / `null` |
| `faixas_atraso.<faixa>` | `distinct(id) where m && atrasoDias` na faixa (1–3, 4–8, 9–15, 16–30, >30) |
| `finalizacao.ctrcs` | `distinct(id) where m` |
| `finalizacao.entregues / baixados / em_aberto / em_atraso` | `distinct(id) where m` e `entregue` / `baixado` / `emAberto` / `emAtraso` |
| `por_pagador[]` | `where m`, agrupa por `pagador`, `{pagador, ctrcs: distinct(id)}`; ordem `ctrcs DESC, pagador ASC`; **top 15** |
| `top_codigos[]` | agrupa **todo o g** por `codigo`, `HAVING count(m) > 0`; `{codigo, descricao: min, responsavel: min, penaliza: bool_or, pendente: bool_or, tipo_ssw: min, count: count(m), count_prev: count(m_ant), delta: count − count_prev}`; ordem `count DESC, codigo ASC`; **top 10** |
| `onde_atuar[]` | `where m`, agrupa por `unidade_resp ?? '—'`: `{unidade, ocorrencias: count, penalizantes: count(e.penaliza && e.responsavel !== 'cliente' && e.emAtraso) [por EVENTO], pendentes: count(pendente), ctrcs: distinct(id)}`; ordem `penalizantes DESC, ocorrencias DESC, unidade ASC`; sem limite |
| `impacto.ctrcs` | `count(univ where atual)` — todos os CT-e, com ou sem ocorrência |
| `impacto.ctrcs_ant` | `count(univ where anterior)` |
| `impacto.rows[]` | agrupa todo o g por `codigo`, `HAVING count(imp || imp_ant) > 0`: `{codigo, descricao, penaliza, responsavel, ocorrencias: count(imp), ocorrencias_ant: count(imp_ant)}`; ordem `ocorrencias DESC, ocorrencias_ant DESC, codigo ASC` |

`min(descricao)`/`min(responsavel)` são iguais para todos os eventos do código (vêm do catálogo);
em `min(responsavel)` o enum ordena pela ordem de declaração (`FR < transportador < destinatario
< cliente < sistema < outro`), irrelevante porque o valor é único. Listas vazias saem `[]`.

**Front (o que cada número mostra)**

- Card "Total de ocorrências" = `metricas.total`, sub "`ctrcs` CT-e distintos".
- Card "Penalizantes" = `penalizantes`, sub `penalizantes/ctrcs` em % sem casas (Intl pt-BR,
  `maximumFractionDigits: 0`; `ctrcs = 0` → 0%).
- Card "Não penalizantes" = `nao_penalizantes`, sub `nao_penalizantes/ctrcs` (idem).
- Card "Pendentes de classificação" = `pendentes`, sub `pendentes/total` "das ocorrências". Se
  `pendentes > 0`, faixa âmbar "**N** ocorrência(s) precisam ser classificadas…" com botão para
  `/admin/codigos`.
- Clicar num card troca `resp` (clicar no ativo volta para `todas`; "Total" sempre `todas`).
- Gráfico do topo = `top_codigos` (barras `count` e `count_prev`), legenda "Atual (dd/mm–dd/mm)" e
  "Mês anterior (dd/mm–dd/mm)" com `periodo_anterior`. Clique filtra por um código (`codigos=[c]`;
  clicar no mesmo limpa).
- "Ocorrências mais frequentes" = `top_codigos`; % = `count / metricas.total` (**base `k`, sem a
  aba**; com 1 casa, `percentualOcorrencias`, total 0 → 0,0%); selo `delta` ("+N vs anterior").
- "CT-e finalizados e em aberto" = `finalizacao`; % sobre `finalizacao.ctrcs`. Cliques abrem
  `/performance/lista` ([§2.7](#27-drill-down-para-a-listagem-detalhada)).
- "Onde atuar" = `onde_atuar`; % = `ocorrencias / metricas.total`; "N penal. · M CT-e".
- "Impacto por código": `% = 100 × ocorrencias / impacto.ctrcs` (null se `ctrcs = 0`, mostra "—"),
  idem mês anterior com `ctrcs_ant`; variação = diferença em p.p. com 1 casa; cor neutra se
  `|Δ| < 0,05`. Cabeçalho: "`ctrcs` CT-e emitidos|com previsão no período · `ctrcs_ant` no mês
  anterior".
- "Prazo": % sobre `no_prazo + fora_prazo + sem_prazo`. "Faixas de atraso": só faixas > 0; % sobre
  a soma das faixas. "CT-e por pagador": % sobre `metricas.ctrcs`.

### 2.4 Lista detalhada (origem `ocorrencias_lista_v5`)

Entrada: filtros de CT-e, recortes, `orderBy`, `orderDir`, `page` (≥1), `pageSize` (1–500).
Timeout atual 55 s.

```ts
// Só o período ATUAL (sem mês anterior).
const ocAll = ctrcs.filter((c) => dtCampo(c) ∈ [inicio, fim])
  .flatMap((c) => ocorrencias(c.id).filter((o) => codigosTela.includes(o.codigo))
    .map((o) => ({ id: o.id, data_hora: o.data_hora, codigo: o.codigo, ctrc_id: c.id, ...classificar(o, catalogo[o.codigo]) })));
const frCtrc = new Set(ocAll.filter((e) => e.penaliza && e.responsavel !== "cliente").map((e) => e.ctrc_id));
const linhas = ocAll
  .filter((e) => okCod(e))                                          // codigos
  .map((e) => ({ e, c: ctrc(e.ctrc_id) }))
  .filter(({ e, c }) => universoBase(c) && visivel(c) && filtrosDeCtrc(c) && recortesDeCtrc(c)
    && okRv(e) && okRespLista(e, c, frCtrc));
// okRespLista: pendentes → e.pendente; penalizantes/externas → (frCtrc.has(c.id) && situacao(c).emAtraso) === (resp === "penalizantes")
const total_count = linhas.length;
```

Colunas por linha:

| Coluna | Valor |
| --- | --- |
| `id`, `data_hora`, `codigo`, `descricao`, `responsavel`, `penaliza`, `pendente` | evento + [§1.9](#19-classificação-de-cada-evento-ocorrência) |
| `ctrc_id`, `numero_ctrc`, `numero_nf`, `data_emissao` | CT-e |
| `unidade_resp` | `unidadeResp(c)` |
| `pagador` | `pagadorRotulo(c)` |
| `destinatario`, `cidade_destino`, `uf_destino`, `peso`, `volumes`, `valor_frete`, `data_prevista_entrega`, `setor` | CT-e (`setor` = `ctrcs.setor`, setor de destino 038 + 455) |
| `atraso_dias` | `situacao(c).atrasoDias` (null se entregue, baixado ou não vencido) |
| `conferente`, `romaneio` | `conferenteRomaneio(c)` ([§1.10](#110-conferente-e-romaneio-do-ct-e-relatório-036)), calculado só para as linhas da página |
| `sigla_ctrc` | buscada à parte em `ctrcs` (para o link do SSW na exportação) |

Ordenação e paginação (fiel ao SQL):

```ts
// Chave textual por coluna; dir asc → ASC NULLS LAST; desc → DESC NULLS LAST; desempate por id (uuid).
const chave = {
  codigo: (r) => String(r.codigo).padStart(6, "0"),
  responsavel: (r) => r.responsavel,                 // texto do enum
  numero_ctrc: (r) => r.numero_ctrc,                 // TEXTO: "10" < "9" (collation, D1)
  parceiro_nome: (r) => r.parceiro_nome,             // COALESCE(parceiros.nome, ctrcs.parceiro_nome)
  atraso_dias: (r) => lpadPg(String(r.atraso_dias ?? -999), 6, "0"),   // null → "00-999"
  data_hora: (r) => formatarUTC(r.data_hora, "YYYYMMDDHHmmss"),       // segundos truncados
}[orderBy] ?? chaveDataHora;
// LIMIT pageSize OFFSET (page − 1) × pageSize
```

- `lpad` do Postgres: preenche à esquerda até 6; `"-999"` vira `"00-999"`. Com collation `C`,
  `'-' < '0'`, então "sem atraso" fica **antes** de 1 dia no `asc` e **depois** no `desc`. Com
  collation linguística o hífen pode ser ignorado e "sem atraso" ordenar como 999 (D1).
- `data_hora` ordena por segundo; eventos no mesmo segundo desempatam por `id`.
- `parceiro_nome` vem de `parceiros.nome` (join por `parceiro_id`) ou `ctrcs.parceiro_nome`
  (que é o **expedidor**, ver memória "parceiro_nome é expedidor"). Ordenação disponível na UI com
  rótulo "Parceiro", embora a coluna mostrada seja o pagador. **[paridade]**
- Página além do fim volta `rows = []` e `totalCount = 0` (o total vem da 1ª linha). **[paridade]**

Front: "Data/hora" e datas formatadas no fuso do navegador (`pt-BR`, `short`); "Atraso" mostra
`Nd` em vermelho só se `> 0`, senão "—"; "Penaliza": ícone relógio se `pendente`, alerta se
`penaliza`; Conferente "Não informado" se nulo; clique na linha → `/ctrc/<numero_ctrc>`.
Mensagem de lista vazia: "Nenhuma ocorrência no período filtrado. Tente ampliar o período ou
ajustar os filtros." Atalho Alt+←/→ troca página.

### 2.5 Códigos de um card ("ver códigos") — origem `ocorrencias_codigos_bucket_v3`

Chamado pelo popover de cada card com `bucket ∈ {todas, penalizantes, externas, pendentes}` e
**só os filtros de CT-e** (sem `codigos`, `responsaveis`, `resp` e recortes de bloco). Timeout 55 s.

```ts
const base = /* CT-e do período atual por campoData com filtros de CT-e */ ...
  .flatMap(/* eventos dos codigosTela */).map((e) => ({ ...e, emAtraso: situacao(c).emAtraso }));
const pen = agrupar(base, "ctrc_id", (es) => frRuim(es) && es.some((x) => x.emAtraso));
const filtrados = base.filter((b) =>
  bucket === "penalizantes" ? pen[b.ctrc_id]
  : bucket === "externas" ? !pen[b.ctrc_id]
  : bucket === "pendentes" ? b.pendente : true);
// agrupa por codigo: {codigo, descricao: min, responsavel: min, penaliza: bool_or, pendente: bool_or,
//   tipo_ssw: min, total: count, ctrcs: distinct(ctrc_id)}; ordem total DESC, codigo ASC
```

- `penalizantes` traz **todos os códigos** dos CT-e penalizantes (inclusive os que não penalizam).
- O total do card pode diferir do popover quando há recortes ativos (o popover ignora recortes).
- Front: "% das ocorrências do grupo" = `total / Σ total`; busca local por código/descrição;
  clicar num código aplica `codigos=[c]`. A chave de cache do front não inclui `conferentes`
  (troca de conferente reaproveita o cache por 60 s) **[paridade, bug menor]**.

### 2.6 Opções dos filtros

- **Opções** (`inicio`, `fim`, `unidades`, `filiais`): `unidades` ativas (`id,nome,cidade,uf`,
  ordem `nome`); `parceiros` = `listar_pagadores_ctrcs(inicio, fim, unidades, filiais, limite 500)`
  mapeado para `{id: cnpj, nome: nome ?? cnpj_formatado ?? '—', cnpjFormatado}` (a função usa base
  emissão mesmo com "Por previsão" — **[paridade]**; regra da função no spec de filtros
  compartilhados); `codigos` = catálogo com `pendencia_acompanhada`, ordem `codigo`, menos
  `foraDaTela` → `{codigo, descricao}`.
- **Conferentes** (origem `ocorrencias_conferentes_opcoes`): `distinct btrim(conferente)` não
  vazio de `staging_036_romaneios` da empresa, ordem alfabética, **limite 1000**. Não depende de
  filtro (cache de 1 h no front).
- Seletores Filial, Remetente, Destino, Tipo de documento usam as funções de filtros
  compartilhadas (fora deste documento).

### 2.7 Drill-down para a Listagem detalhada

Os itens do bloco "CT-e finalizados e em aberto" navegam para `/performance/lista` com
`tipo ∈ {ocorr_entregues, ocorr_baixados, ocorr_abertos, ocorr_em_atraso}`, `periodo=custom`,
`de/ate` = período, `base = campoData`, e só `filiais, parceiros, remetente, destino, ctrc, nf,
tipos` (unidade uuid, conferente, códigos, responsáveis, aba e recortes **não** vão). Predicados na
lista (origem `_lista_ctrcs_detalhado_filtro`, spec da Performance):

```ts
const temOcorrTela = (c) => ocorrencias(c.id).some((o) => codigosTela.includes(o.codigo));
ocorr_entregues: temOcorrTela(c) && entregue(c)
ocorr_baixados:  temOcorrTela(c) && !entregue(c) && finalizadoSemEntrega(c)
ocorr_abertos:   temOcorrTela(c) && emAberto(c)
ocorr_em_atraso: temOcorrTela(c) && emAberto(c) && prev != null && prev < hojeSP()
```

Por isso o número da lista pode diferir do bloco quando há filtros que não são repassados.
**[paridade]**

### 2.8 Exemplo numérico

Período 01–05/11/2026, por emissão, hoje = 10/11/2026, sem filtros. Todos os CT-e na unidade RIO.

| CT-e | Emissão | Previsão | Situação | Ocorrências |
| --- | --- | --- | --- | --- |
| A | 02/11 | 06/11 | aberto, `no_prazo` null | 13 (FR, penaliza), 15 (sistema) |
| B | 03/11 | 12/11 | aberto, null | 13, 13 |
| C | 04/11 | 05/11 | entregue 05/11, `no_prazo` true | 30 (destinatário) |
| D | 02/10 | 05/10 | aberto | 13 |
| E | 01/11 | 08/11 | aberto | nenhuma |

- `metricas`: total 5 (A2+B2+C1), ctrcs 3, penalizantes 1 (A: FR e atraso de 4 dias), não
  penalizantes 2, pendentes 0. Card Penalizantes "33% dos CT-e".
- `top_codigos`: 13 → count 3, count_prev 1 (D), delta +2; 15 → 1/0/+1; 30 → 1/0/+1 (empate em 1
  desempata por código).
- `finalizacao`: ctrcs 3, entregues 1, baixados 0, em_aberto 2, em_atraso 1.
- `prazo`: no_prazo 1, fora 0, sem_prazo 2. `faixas_atraso.de_4_8` = 1 (A). E não entra (sem
  ocorrência); D está em atraso mas é do mês anterior.
- `onde_atuar`: RIO — ocorrências 5, penalizantes 1 (só o 13 de A), pendentes 0, CT-e 3.
- `impacto`: ctrcs 4 (A, B, C, E), ctrcs_ant 1 (D); linha 13: 3 e 1 → 75,0% e 100,0%, −25,0 p.p.
- Aba `penalizantes`: cards iguais; `top_codigos` passa a 13:1 e 15:1, mas o % continua sobre 5.
- Filtro `codigos=[15]`: total 1, ctrcs 1, penalizantes 1 (A continua penalizante pelo 13).

### 2.9 Casos-limite

- CT-e sem previsão: nunca em atraso, `atraso_dias` null, nunca penalizante; com
  `campoData=prevista` nem entra.
- `data_entrega_realizada` preenchida vence qualquer código: entregue.
- Código efetivo `"01"`/`"1 "` normaliza para 1 (só dígitos).
- `ctrc` com termo vazio ("ABC", "000") desliga o filtro em Ocorrências.
- Erro de timeout: mensagem "A consulta demorou demais. Reduza o período ou aplique mais filtros
  (unidade, parceiro, filial) e tente novamente."

---

## 3. Tela Comprovantes (`/comprovantes`)

Módulo `comprovantes`. "Digitalizado" = ocorrência 88 **ou** "Compr. de Entrega Escaneado" do 455
(decisões de 27/10 e 05/11/2026). Sem escopo por unidade do usuário.

### 3.1 Parâmetros de URL

`periodo`, `de`, `ate`, `unidades[]` (siglas, só URL), `filiais[]`, `pagadores[]` (CNPJ dígitos),
`status` (`todos`|`digitalizados`|`pendentes`), `ctrc`, `nf`, `tipos[]`, `remetente`, `destino`
(cortados em 2000 chars), `page`, `size`.

### 3.2 Universo e campos

```ts
// origem: comprovantes_metricas_v2 / comprovantes_lista_v2
const diasCobertos = new Set(ssw_relatorio_arquivos
  .filter((a) => a.empresa === empresa && a.status === "importado" && /^930_ocorrencias_\d{4}-\d{2}-\d{2}_/.test(a.nome_arquivo))
  .map((a) => a.nome_arquivo.substring(16, 26)));           // a data do NOME do arquivo
const base0 = ctrcs.filter((c) =>
  universoBase(c) && !(c.cancelado_mesmo_dia ?? false) && entregue(c)
  && (c.data_entrega_realizada ?? c.ocorr_efetiva_data) != null
  && entre(dataUTC(c.data_entrega_realizada ?? c.ocorr_efetiva_data), inicio, fim)   // ver nota UTC
  && (!unidades?.length || unidades.includes(unidadeResp(c)))
  && (!filiais?.length || filiais.includes(unidadeResp(c)))
  && (!pagadores?.length || pagadores.includes(pagadorCnpjDigitos(c)))
  && (!btrim(remetente) || textoCasaFiltro(c.remetente, remetente))
  && (!btrim(destino) || textoCasaFiltro(c.cidade_destino, destino))
  && filtroCtrcComprovantes(c, ctrc) && filtroNfComprovantes(c, nf))       // §1.2
  .map((c) => ({
    id: c.id,
    unidade: unidadeResp(c),
    dia: dataUTC(c.data_entrega_realizada ?? c.ocorr_efetiva_data),
    tipo_efetivo: tipoDocEfetivo(c.tipo_documento_455, c.tipo_documento),
    digitalizado: (c.comprovante_escaneado ?? false) || ocorrencias(c.id).some((o) => o.codigo === 88),
    coberto: diasCobertos.has(dia) || c.comprovante_escaneado != null,   // 'S' ou 'N' no 455 conta como coberto
  }));
const base = base0.filter((b) => casaTipos(b, tipos)).map((b) => ({ ...b, tipo_documento: b.tipo_efetivo ?? "NAO INFORMADO" }));
```

- **Nota UTC**: o dia da entrega é `timestamptz::date` com sessão em UTC. Entrega às 22:30 de
  05/11 em Brasília (01:30 UTC de 06/11) conta no dia **06/11**, tanto no filtro de período quanto
  no casamento com o dia coberto e no `por_dia`. **[paridade]** — ver D2.
- O 88 vale em qualquer data e mesmo em quarentena.
- `inicio`/`fim` nulos desligam o lado correspondente (a UI sempre manda os dois).

### 3.3 Métricas (origem `comprovantes_metricas_v2`)

| Campo | Fórmula (sobre `base`) |
| --- | --- |
| `totais.entregues` | `count` |
| `totais.digitalizados` | `count(digitalizado)` |
| `totais.pendentes` | `count(coberto && !digitalizado)` |
| `totais.pct` | `count(coberto) > 0 ? round4(count(coberto && digitalizado) / count(coberto)) : null` |
| `por_unidade[]` | por `unidade ?? '—'`: `{unidade, entregues, digitalizados, pendentes, pct}` (mesma fórmula); ordem texto de `unidade` |
| `por_dia[]` | por `dia`: `{dia, entregues, digitalizados, pendentes, coberto: some(coberto), pct}`; ordem `dia` |
| `por_tipo_documento[]` | por `tipo_documento`: idem sem `coberto`; ordem `entregues DESC` **sem desempate** (D3) |
| `tipos_contagem[]` | sobre **`base0`** (todos os filtros menos tipo): `{tipo: tipo_efetivo ?? '__SEM_TIPO__', qtd}`; ordem `qtd DESC, tipo ASC` |
| `cobertura_inicio` | menor dia coberto — não usado pela tela ([§10](#10-código-morto--não-portar)) |

`round4` = `ROUND(numeric, 4)` do Postgres (meio para longe do zero). `pct` sai como número
(ex.: `0.6667`).

Front: cards "CT-e entregue" (`entregues`), "Digitalizados" (`digitalizados`), "% digitalizados"
(`pct × 100` com 1 casa e vírgula; `toFixed(1)` do JS; null → "—"), "Pendentes" (`pendentes`). O
texto do card diz "Digitalizados ÷ entregues", mas a conta é sobre os **cobertos** **[paridade]**.
Clicar num card grava `status` na URL e abre a lista lateral. Gráfico por dia: barras entregues e
digitalizados, linha `pct × 100` (1 casa). Tabelas "Por unidade" e "Por tipo de documento".
`tipos_contagem` alimenta as contagens do seletor de tipo.

### 3.4 Lista (origem `comprovantes_lista_v2`)

```ts
const filtrada = base.filter((b) =>
  status.toLowerCase() === "digitalizados" ? b.digitalizado
  : status.toLowerCase() === "pendentes" ? (!b.digitalizado && b.coberto) : true);
// ordem: data_entrega DESC NULLS LAST (sem desempate — D3)
// LIMIT max(pageSize ?? 50, 1) OFFSET max(offset ?? 0, 0); total_count = filtrada.length
```

Colunas: `id, numero_ctrc, numero_nf, data_entrega (= data_entrega_realizada ?? ocorr_efetiva_data),
unidade, setor, pagador_nome, remetente, destinatario, cidade_destino, tipo_documento,
digitalizado` + `sigla_ctrc` e `data_emissao` buscados em `ctrcs` para o link SSW. Lista lateral
pagina de 50 em 50; clique → `/ctrc/<numero>`. Títulos: "CT-e entregues no período" / "CT-e com
comprovante digitalizado" / "CT-e sem comprovante digitalizado".

### 3.5 Exemplo

930 importado para 04/11. Entregues em 04/11 (UTC): X com 88, Y com escaneado 'S', Z sem nada →
entregues 3, digitalizados 2, pendentes 1, pct 0.6667. W entregue em 03/11 sem 930 do dia e sem
coluna do 455 → entra em `entregues`, não é coberto: não conta em `pendentes` nem no `pct`.

---

## 4. Tela Coletas (`/coletas`) e importação do 050

Módulo `coletas`. Lê a tabela `coletas` (PK `empresa_id, unidade, numero`), alimentada só pelo
importador. Todo usuário com a tela vê todas as unidades (decisão de 05/11).

### 4.1 Campos derivados (origem `vw_coletas`)

```ts
function etapa(situacao: string | null) {        // LIKE com caixa: o importador grava em maiúsculas
  const s = situacao ?? "";
  return s.startsWith("CANCEL") ? "cancelada" : s.startsWith("COLETAD") ? "coletada"
       : s.startsWith("COMAND") ? "comandada" : "cadastrada";
}
function statusPrazo(c, agora: Date) {
  const s = c.situacao ?? "";
  if (s.startsWith("CANCEL")) return "cancelada";
  if (s.startsWith("COLETAD")) {
    if (c.limite_em == null) return "no_prazo";
    const em = c.coletada_em ?? c.situacao_em;
    return em != null && em <= c.limite_em ? "no_prazo" : "atrasada";   // em nulo → 'atrasada' (CASE cai no ELSE)
  }
  if (c.limite_em == null) return "a_vencer";
  if (c.limite_em < agora) return "vencida";
  if (dataSP(c.limite_em) === hojeSP()) return "vence_hoje";
  return "a_vencer";
}
// ctrc_tipo_documento / ctrc_emissao: LEFT JOIN ctrcs ON numero_ctrc = c.ctrc_numero AND sigla_ctrc = c.ctrc_sigla (mesma empresa)
```

- Regra de prazo = a do SSW (bate com o quadro RESUMO): hora em que ficou COLETADA ≤ limite
  **atual**; cancelada não entra na conta mesmo se coletada antes. Não "corrigir" para o limite
  inicial.
- O join com `ctrcs` é feito sob o RLS do usuário (view `security_invoker`): se o RLS esconder o
  CT-e, tipo e emissão saem nulos. Se houver mais de um CT-e com a mesma sigla+número, a coleta
  **duplica** (D4).

### 4.2 Painel (origem `coletas_painel`)

Entrada: `inicio`, `fim`, `unidades[]` (≤50, ≤10 chars), `solicitantes[]` (≤200, ≤100 chars),
`tipo` (`NORMAL`|`REVERSA`|nulo).

```ts
const base = coletas.filter((v) => v.dia_cadastro != null && entre(v.dia_cadastro, inicio, fim)
  && (!unidades || unidades.includes(v.unidade))
  && (!solicitantes || solicitantes.includes(v.solicitante ?? ""))
  && (!tipo || v.tipo === tipo));
```

| Campo | Fórmula |
| --- | --- |
| `totais` | `total`, `coletadas` (etapa coletada), `no_prazo`, `atrasadas` (status_prazo), `canceladas` (etapa), `abertas` (etapa cadastrada ou comandada), `cadastradas`, `comandadas`, `vencidas`, `vence_hoje`, `a_vencer` (status_prazo), `com_ctrc` (`ctrc_numero != null`), `prejudicadas` (`prejudicada_horario`), `reversas` (`tipo === 'REVERSA'`) |
| `por_solicitante[]` | por `solicitante ?? ''`: `{solicitante, total, coletadas, no_prazo, atrasadas, abertas}`; ordem `total DESC, solicitante ASC` |
| `por_unidade[]` | por `unidade`: `{unidade, total, coletadas, no_prazo, atrasadas, abertas, vencidas, canceladas}`; ordem `total DESC, unidade ASC` |
| `por_dia[]` | por `dia_cadastro`: `{dia, total, no_prazo, atrasadas}`; ordem `dia` |
| `por_tipo_ctrc[]` | só `ctrc_numero != null`, por `ctrc_tipo_documento ?? ''`: `{tipo_documento, coletas: count, ctes: distinct(ctrc_sigla + ctrc_numero)}` (sigla nula não conta em `ctes`); ordem `coletas DESC` sem desempate |
| `opcoes.unidades` | `distinct unidade` de **todas** as coletas da empresa, ordenado |
| `opcoes.solicitantes` | `distinct solicitante` não nulo com `dia_cadastro` no período (sem os outros filtros), ordenado |
| `posicao_em` | `max(relatorio_emitido_em)` de todas as coletas da empresa |
| `cobertura` | `{inicio: min(dia_cadastro), fim: max(dia_cadastro)}` de todas as coletas |

Front: cards Coletas (`total`, "N reversa(s)"), Coletadas no prazo (`no_prazo`, `% de coletadas`),
Coletadas atrasadas, Em aberto ("N cadastradas · M comandadas"), Vencidas, Vencem hoje ("N a
vencer depois de hoje"), Com CT-e gerado (`com_ctrc / coletadas`), Canceladas ("N prejudicada(s)
pelo horário"). `pctColeta(parte, total)`: `total = 0` → "—", senão `(parte/total×100).toFixed(1)`
com vírgula. Clicar num card põe `status` na URL (clicar de novo → `todas`). Botões de unidade só
aparecem com mais de uma unidade. Por solicitante: o gráfico mostra os 12 primeiros. Sem
`posicao_em`: aviso "Nenhuma coleta importada ainda. Um administrador importa o relatório 050 em
Admin · Importação SSW." Selo de sincronização usa `posicao_em`; subtítulo "coletas importadas de
dd/mm/aaaa a dd/mm/aaaa" com `cobertura`. Recarrega a cada 5 min.

### 4.3 Lista (origem `coletas_lista`)

Entrada: filtros do painel + `status` (enum abaixo, padrão `todas`), `busca` (≤100), `page`,
`pageSize` (1–1000).

```ts
const casaStatus = {
  todas: () => true, coletadas: (v) => v.etapa === "coletada", no_prazo: (v) => v.status_prazo === "no_prazo",
  atrasadas: (v) => v.status_prazo === "atrasada", abertas: (v) => ["cadastrada", "comandada"].includes(v.etapa),
  cadastradas: (v) => v.etapa === "cadastrada", comandadas: (v) => v.etapa === "comandada",
  vencidas: (v) => v.status_prazo === "vencida", vence_hoje: (v) => v.status_prazo === "vence_hoje",
  a_vencer: (v) => v.status_prazo === "a_vencer", canceladas: (v) => v.etapa === "cancelada",
  com_ctrc: (v) => v.ctrc_numero != null, prejudicadas: (v) => v.prejudicada_horario,
}; // status desconhecido → nenhuma linha
const b = btrim(busca);
const casaBusca = (v) => !b
  || String(v.numero) === b.replace(/^0+/, "")
  || v.ctrc_numero === b.replace(/\D/g, "").replace(/^0+/, "")
  || ilike(v.placa, b)                          // igualdade sem caixa, mas % e _ são curinga
  || [v.remetente_nome, v.destinatario_nome, v.notas_fiscais, v.observacao].some((x) => ilike(x, `%${b}%`));
// ordem: abertas (cadastrada/comandada) primeiro; entre elas limite_em ASC NULLS LAST;
//        depois cadastrada_em DESC NULLS LAST, unidade ASC, numero ASC
// LIMIT clamp(pageSize ?? 50, 1, 1000) OFFSET max(0, offset ?? 0); total_count = count da busca
```

Colunas: `unidade, numero, tipo, etapa, status_prazo, situacao, cadastrada_em, limite_em,
coletada_em, cancelada_em, solicitante, remetente_cnpj, remetente_nome, remetente_cidade,
destinatario_nome, destino_cidade, motorista, placa, volumes, peso_kg, valor_mercadoria,
tipo_frete, notas_fiscais, ctrc_sigla, ctrc_numero, ctrc_tipo_documento, ctrc_emissao,
prejudicada_horario, ultimo_evento (= historico[0].texto, o evento mais recente)`.

Front: lista de 50; datas `dd/mm/aa hh:mm` em São Paulo; número com 6 dígitos (`padStart`); muda
filtro → página 1.

**Detalhe** (clique na linha): lê `observacao, mercadoria, setor, romaneio, cadastrada_por,
comandada_em, limite_inicial, relatorio_emitido_em, historico` por `(unidade, numero)` da empresa;
mostra o histórico na ordem gravada e "Posição do relatório 050 emitido em …". Link do CT-e gerado
→ `/ctrc/<ctrc_numero>`.

### 4.4 Importação do 050 — escrita

Duas entradas, mesma gravação:

- **Manual** (Admin › Importação SSW, item "050 — Relação das Coletas"): só **admin** da empresa
  ativa (`assertAdmin`) e módulo `coletas`. Vários arquivos; o navegador decodifica cada um em
  **ISO-8859-1** e manda `{conteudo (1 a 30.000.000 chars), arquivo_origem (≤300)}`. Arquivo com
  erro vira toast "`<nome>`: `<mensagem>`" e os outros seguem. Ao fim: "N coleta(s) gravada(s) de M
  arquivo(s)" e invalida o cache de Coletas.
- **FTP** (rota pública `ftp-relatorio-import`, onda 2): reconhece o 050 por `pareceRelatorio050` e
  chama a mesma gravação com o nome do arquivo.

```ts
// origem: importar-050.server.ts + importar_coletas_050
async function importarRelatorio050(empresaId, conteudo, arquivo) {
  const a = parse050(conteudo, arquivo);                     // §4.5; lança erro se não for 050
  let lidas = 0, gravadas = 0, ignoradas = 0;
  for (const bloco of fatiar(a.coletas, 500)) {              // um upsert por bloco de 500
    if (!empresaExiste(empresaId)) throw new Error(`Empresa da ingestão inexistente: ${empresaId}`);
    lidas += bloco.length;
    const validas = unicoPor(bloco.filter((x) => x.unidade != null && x.numero != null), (x) => [x.unidade, x.numero]);
    for (const r of validas) {
      const atual = coletas.get(empresaId, r.unidade, r.numero);
      if (atual && atual.relatorio_emitido_em > a.emitido_em) continue;        // mais novo já gravado vence
      gravar({ ...r, empresa_id: empresaId, tipo: r.tipo ?? "NORMAL",
        prejudicada_horario: (r.prejudicada_horario ?? false) || (atual?.prejudicada_horario ?? false),  // gruda em true
        ctrc_sigla: r.ctrc_sigla ?? atual?.ctrc_sigla ?? null,                // CT-e e romaneio não somem
        ctrc_numero: r.ctrc_numero ?? atual?.ctrc_numero ?? null,
        romaneio: r.romaneio ?? atual?.romaneio ?? null,
        historico: r.historico ?? [],                                         // substitui
        relatorio_emitido_em: a.emitido_em, arquivo_origem: arquivo, atualizado_em: agora });
      gravadas++;
    }
  }
  ignoradas = lidas − gravadas;   // inclui sem unidade/número, duplicadas no bloco e as já mais novas
  return { emitido_em, periodo_cadastro, periodo_coleta, unidades: distintas ordenadas,
           lidas, gravadas, ignoradas, resumo_ssw: a.resumo, erros: a.erros.slice(0, 50) };
}
```

- Na inserção nova, `prejudicada_horario` e `historico` usam os do arquivo (`false`/`[]` se faltar).
- Empate de emissão (mesmo `emitido_em`) **regrava**.
- Duplicata `(unidade, numero)` dentro do mesmo bloco: o Postgres fica com uma **arbitrária**
  (`DISTINCT ON` sem desempate); entre blocos, a do bloco posterior vence. No sistema novo: ficar
  com a **última** do arquivo (determinístico; não muda número na prática — D5).
- Nada é apagado: coleta que some do relatório continua com a última posição.
- Sem auditoria e sem registro em `ssw_relatorio_arquivos` na importação manual **[paridade]**.
- Tela de resultado por arquivo: período de cadastro, gravadas ("(+N já atualizadas)" se
  `ignoradas > 0`), conferência "ok — N coletas no resumo" quando `resumo_ssw.quantidade === lidas`,
  senão "resumo do SSW diz N, lidas M" em vermelho; sem resumo: "sem quadro de resumo"; mais " · N
  aviso(s)" se houver erros.

### 4.5 Leitor do 050 (`parse050`) — portar com o mesmo comportamento

Função pura (vai para `packages/dominio`). Portar junto os testes e as fixtures
`__fixtures__/relatorio-050-amostra.{txt,csv}` de `src/features/coletas/` (expectativas abaixo).

**Detecção**: `pareceRelatorio050` olha os primeiros 2000 chars: linha começando com
`ssw0157\s+RELACAO DAS COLETAS` ou cabeçalho `UNIDADE;COLETA;TIPO;` (com BOM opcional). `parse050`
decide CSV se o cabeçalho estiver nos primeiros 200 chars.

**Datas**: tudo vira ISO com `-03:00`. Datas `dd/mm` sem ano usam o **ano UTC** da emissão; se a
data resultante passar de emissão + 60 dias, é do ano anterior (relatório de janeiro com coleta de
dezembro). Hora ausente = `00:00`.

**Impresso (ssw0157)**:

- Remove `\x0c` e `\x0f`; nas 20 primeiras linhas lê a emissão
  `ssw0157 RELACAO DAS COLETAS dd/mm/aa hh:mm` (ano `20aa`, fuso −03:00; sem ela: erro "Este
  arquivo não é o relatório 050 (Relação das Coletas) do SSW: o cabeçalho com a data de emissão não
  foi encontrado.") e os períodos `PERIODO DE (CADASTRAMENTO|COLETA): dd/mm/aa A dd/mm/aa`.
- Início de coleta: `^([A-Z0-9]{3}) (\d{6}) - (\S+)` com `DATA LIMITE INICIAL: dd/mm` opcional; tipo
  começando por `REVERS` → `REVERSA`, senão o texto.
- Linhas da coleta (por prefixo, depois de `trimStart`): `REME:` (CNPJ 11–14 dígitos opcional +
  nome até ` END:`; cidade = trecho após o CEP `\d{7,8} ` nas colunas END+45..+91, senão END+55..+91;
  `SETOR:`), `DEST:`, `DATA/HORA LIMITE:` (limite, `SOLICITANTE:`, `MOTORISTA:`, `SITUACAO ATUAL:` dd/mm
  hh:mm + texto em maiúsculas), `VAL MERC:` (`QTDE VOL:`, `PESO(KG):`, `VEICULO:`, `CADASTRADA:` data
  + usuário; `dia_cadastro` = data local), `MERC:` (`TIPO FRETE:`, `NFISCAIS:`, `COMANDADA:`),
  `OBS1:` (corta em `COLETADA:` → `coletada_em`), `OBS2:` (corta em `CANCELADA:` → `cancelada_em`),
  `OBS3:`; observações concatenadas com espaço.
- Histórico: a partir de `SIT/INSTR:` até a linha de `-----`/`=====`; evento
  `\S+ (UNI) (usuario) dd/mm hh:mm texto`; linha não reconhecida vira aviso "linha de histórico não
  reconhecida: …" (80 chars). Ordem do arquivo = mais recente primeiro.
- Ignora cabeçalhos de página (`PAG: n`, `ssw0157`, `PERIODO DE`). Quadro `R E S U M O`: linha
  `TOTAL` dá `{quantidade, cadastradas, comandadas, coletadas, canceladas, no_prazo, atrasadas}`.
- Nomes: espaços colapsados; sufixo de truncamento `(..)` ou `..` removido. Números BR (`1.234,5`).

**CSV do FTP** (`;`, sem aspas, cabeçalho na 1ª linha): exige as colunas `UNIDADE, COLETA, TIPO,
DATA_LIMITE_INICIAL, REME_CNPJ, REME_NOME, REME_CIDADE, SETOR, DEST_CNPJ, DEST_NOME, DEST_CIDADE,
DATA_HORA_LIMITE, SOLICITANTE, MOTORISTA, SITUACAO_ATUAL, DATA_SITUACAO_ATUAL, VALOR_MERCADORIA,
QTDE_VOLUMES, PESO_KG, VEICULO, MERCADORIA, TIPO_FRETE, NOTAS_FISCAIS, CADASTRADA_EM, CADASTRADA_POR,
COMANDADA_EM, COLETADA_EM, CANCELADA_EM, OBS1, OBS2, OBS3, HISTORICO` (falta → erro "O CSV do 050
veio sem a coluna X."). Emissão = nome do arquivo `AAAA-MM-DD_HHMM` (−03:00); sem nome no padrão, a
maior data entre `DATA_SITUACAO_ATUAL` e `CADASTRADA_EM`; nenhuma → erro "O CSV do 050 não tem
nenhuma coleta com data." Linha com menos colunas que o cabeçalho → aviso e pulada; sem unidade ou
número ≤ 0 → aviso e pulada. Datas `dd/mm/aaaa[ hh:mm]`. Histórico separado por `" | "`. Sem
quadro RESUMO; `periodo_coleta` nulo; `periodo_cadastro` = min/max de `dia_cadastro`.

**Derivados do histórico** (os dois formatos), percorrendo do mais recente ao mais antigo:
primeiro `CTRC GERADO: (SIG) (\d+)-\d` → `ctrc_sigla`, `ctrc_numero` sem zeros à esquerda;
primeiro `ROMANEIO (SIG [\d-]+) gerado` → `romaneio`; qualquer `PREJUDICADA PELO HORARIO` →
`prejudicada_horario = true`. Coleta sem data de cadastro gera aviso "coleta UNI N sem data de
cadastro" (mas é gravada; não aparece na tela porque o filtro é por `dia_cadastro`).

Exemplos dos testes: impresso emitido "03/11/26 12:01" → `emitido_em = 2026-11-03T15:01:00.000Z`;
ARA 56168: limite `2026-10-16T23:59:00-03:00`, coletada `2026-10-16T09:40-03:00` → no prazo;
CSV `050_coletas_2026-11-05_1330.csv` → emissão `2026-11-05T16:30:00.000Z`; ARA 56168 coletada
`2026-10-17T09:40-03:00` → atrasada; dezembro em relatório de 05/01/27 → `2026-12-30`.

---

## 5. Histórico (`/historico`) e Histórico › Feriados (`/historico/feriados`)

Módulo `historico`. Anotações = contexto do dia (clima, operacional, externo, outro), visíveis a
toda a empresa.

### 5.1 Leitura (`getHistorico`)

Entrada: `inicio`, `fim`, `unidades[]` (uuid; só por URL).

```ts
const anotacoes = anotacoesDaEmpresa
  .filter((a) => entre(a.data, inicio, fim) && (!unidades?.length || (a.unidade_id != null && unidades.includes(a.unidade_id))))
  .sort(por("data", "desc"), por("criado_em", "desc")).slice(0, 1000);     // ver nota de limite
const feriados = feriadosVisiveis                                         // empresa + nacionais (empresa nula)
  .filter((f) => entre(f.data, inicio, fim)).sort(por("data", "desc")).slice(0, 1000);
// cada anotação: {id, data, tipo, texto, autor, autor_nome (usuarios_perfil.nome), unidade_id, unidade_nome, criado_em}
// unidades: ativas ordenadas por nome; autores: todos os perfis visíveis {id, nome}
// totais: {anotacoes: anotacoes.length, feriados: feriados.length, diasComContexto: |datas distintas das duas listas|}
```

- **Limite**: o código pede `.limit(2000)`, mas o PostgREST corta em silêncio em 1000
  (`db-max-rows`). Paridade = 1000, ordem acima (D6).
- Feriados **não** são filtrados por unidade.
- Os filtros `tipos`, `autor`, `q` (texto, sem caixa) e `presenca` são aplicados **no navegador**
  e não mudam os `totais`. `presenca`: `anotacao` = dias só com anotação; `feriado` = só com
  feriado; `ambos` = os dois. Dias em ordem decrescente; linha do tempo mostra 30 dias por vez.
- Rótulos: `clima` Clima, `operacional` Operacional, `feriado` **Externo**, `outro` Outro.
- URL: `periodo` (7d|30d|mes|90d, padrão 30d), `unidades[]`, `visao` (timeline|calendario), `tipos[]`,
  `presenca`, `autor`, `q`.
- Calendário do histórico: clicar num dia com anotação edita a primeira; sem anotação, cria com a
  data do dia.

### 5.2 Anotação — criar, editar, excluir

Modal global (atalho **N** fora de campos de texto, sem Ctrl/Alt/Meta).

| Ação | Entrada | Regra |
| --- | --- | --- |
| Criar | `data` (YYYY-MM-DD), `tipo` (clima\|operacional\|feriado\|outro), `texto` (1–2000), `unidade_id` (uuid ou nulo) | `autor = usuário`, `empresa_id = empresa ativa`. Front exige texto não vazio ("Escreva o que aconteceu") e manda `texto.trim()`. |
| Editar | `id` + os mesmos campos | Só o **autor** ou admin/super_admin. Não muda autor. |
| Excluir | `id` | Só o autor ou admin/super_admin; confirmação "Tem certeza? Esta ação não pode ser desfeita." |

Hoje, editar/excluir de quem não pode passa sem erro e não altera nada (RLS filtra a linha) e o
front diz "Anotação atualizada"/"excluída" **[paridade, bug]** — ver D8. Sem auditoria (não há
gatilho em `anotacoes`). Efeito: aparece também na Performance e no Dashboard (leitura direta,
spec dessas telas).

### 5.3 Histórico › Feriados (admin)

Página só para admin/super_admin (não-admin é mandado para `/historico`).

- **Listar** (`listFeriados`): `ano?` (2000–2100 → `data` entre 01/01 e 31/12), `tipo?`
  (`nacional`|`municipal`), `uf?` (2 letras); ordem `data DESC`; limite efetivo 1000. Retorna
  feriados visíveis (da empresa + nacionais globais).
- **Salvar** (`upsertFeriado`): `id?`, `data`, `tipo` (`nacional`|`municipal` — esta tela não
  oferece `estadual`), `cidade?`, `uf?` (2 letras), `descricao` (1–200). Sem validação de
  cidade/UF para municipal. `cidade`/`uf` vazios → nulo. Com `id`: UPDATE; se nenhuma linha mudou →
  erro "Este feriado é nacional e vale para todas as empresas: só a equipe da Plataforma pode
  alterar ou remover." Sem `id`: INSERT com `empresa_id = empresa ativa` (sem checar duplicata:
  violação de `uq_feriados` sobe a mensagem crua do banco — D9).
- **Excluir** (`deleteFeriado`): por `id`; nenhuma linha → mesma mensagem acima.
- **Importar nacionais** (`importarFeriadosNacionais`, botão da página): `ano` (2000–2100). Lista
  fixa (só os 9 fixos, sem móveis): 01/01 Confraternização Universal, 21/04 Tiradentes, 01/05 Dia do
  Trabalho, 07/09 Independência do Brasil, 12/10 Nossa Senhora Aparecida, 02/11 Finados, 15/11
  Proclamação da República, 20/11 Consciência Negra, 25/12 Natal. Pula os que já existem com o mesmo
  `data|descricao` entre os nacionais **visíveis** do ano; insere o resto com `tipo = nacional`,
  `cidade/uf` nulos e **`empresa_id = empresa ativa`** (não global). Retorna `{inseridos}`; toast
  "N feriado(s) nacional(is) inseridos".

Permissão de escrita em feriados: admin de plataforma, ou admin/super_admin **da empresa** e só em
linhas da própria empresa. Feriado com `empresa_id` nulo é global (vale para todas).

---

## 6. Calendário (`/calendario`)

Módulo `historico`. Escrita só para admin/super_admin (botões escondidos para os demais).

### 6.1 Leitura (`getCalendario`)

```ts
const feriados = feriadosVisiveis.filter((f) => f.data >= `${ano}-01-01` && f.data <= `${ano}-12-31`)
  .sort(por("data", "asc")).slice(0, 1000);
const contagens = { nacional: n, estadual: n, municipal: n };          // por tipo, sobre `feriados`
const proximo = feriadosVisiveis.filter((f) => f.data >= hojeUTC()).sort(por("data", "asc"))[0] ?? null;  // data UTC do servidor [paridade]
// unidades: ativas {id, nome, cidade, uf} por nome
```

Front: cards "Feriados nacionais em ANO", "Feriados municipais em ANO" e "Próximo" (`Nd` =
dias do hoje local até a data, arredondado; "dd/mm/aaaa · descrição"). Visões mês a mês, ano
inteiro e lista. **Unidades impactadas**:

```ts
function impactaUnidades(f, unidades) {
  if (f.tipo === "nacional") return unidades;
  if (f.tipo === "estadual") return unidades.filter((u) => u.uf === f.uf);
  return unidades.filter((u) => (u.uf ?? "") === (f.uf ?? "") && (u.cidade ?? "").toLowerCase() === (f.cidade ?? "").toLowerCase());
}
```

### 6.2 Escritas

- **Salvar** (`upsertFeriadoCal`): `id?`, `data`, `tipo` (`nacional`|`municipal`|`estadual`),
  `cidade?`, `uf?` (2), `descricao` (3–200), `recorrente?`, `anos_a_frente?` (0–10).
  - Validação: municipal sem cidade **ou** UF → "Cidade e UF são obrigatórios para feriado
    municipal"; estadual sem UF → "UF é obrigatório para feriado estadual".
  - Normaliza: `cidade = municipal ? cidade.trim() : null`; `uf = nacional ? null : uf ?? null`.
  - Com `id`: UPDATE (`gerado_automaticamente = false`); nenhuma linha → mensagem de feriado
    nacional (§5.3). Retorna `{inseridos: 0, atualizados: 1}`.
  - Sem `id`: gera as datas `data + i anos` para `i = 0..(recorrente ? anos_a_frente ?? 5 : 0)`
    (o front manda `recorrente` só na criação, padrão ligado, e `anos_a_frente = 5` → 6 anos).
    Ano somado como `Date.setFullYear`: **29/02 vira 01/03** em ano não bissexto **[paridade]**.
    Calcular por texto de data no sistema novo (o código atual depende do fuso do servidor). Pula
    as datas que já têm feriado visível com o mesmo `data|tipo|cidade|uf`; insere o resto com
    `empresa_id = empresa ativa`. Retorna `{inseridos, atualizados: 0}`.
- **Excluir** (`deleteFeriadoCal`): igual ao §5.3.
- **Gerar nacionais em lote** (`gerarNacionaisLote`): `ano`, `anos_a_frente` (0–10, front manda 4,
  padrão 4) → para cada ano de `ano` a `ano + anos_a_frente`, a regra de
  `gerar_feriados_nacionais(ano)`:

```ts
// origem: gerar_feriados_nacionais — exige papel admin/super_admin (senão erro 'forbidden')
const p = pascoa(ano);            // algoritmo de Meeus/Butcher (o do SQL, com divisão inteira)
const lista = [ [01-01,"Confraternização Universal"], [04-21,"Tiradentes"], [05-01,"Dia do Trabalho"],
  [09-07,"Independência do Brasil"], [10-12,"Nossa Senhora Aparecida"], [11-02,"Finados"],
  [11-15,"Proclamação da República"], [11-20,"Consciência Negra"], [12-25,"Natal"],
  [p−48,"Carnaval (segunda) — ponto facultativo"], [p−47,"Carnaval (terça) — ponto facultativo"],
  [p−2,"Sexta-feira Santa"], [p+60,"Corpus Christi (ponto facultativo)"] ];
// cada um: INSERT tipo 'nacional', cidade/uf nulos, gerado_automaticamente true, EMPRESA NULA (global)
// ON CONFLICT (data, tipo, cidade, uf, empresa) DO NOTHING → conta inseridos / existiam
```

  Toast "N feriado(s) gerado(s) · M já existiam". Confirmação antes: "Vamos gerar os feriados
  nacionais de ANO e dos próximos 4 anos. Feriados já cadastrados serão mantidos. Continuar?"
  Atenção: grava feriado **global** a partir de um admin de empresa (D10).

---

## 7. Admin › Códigos de ocorrência (`/admin/codigos`)

Catálogo por empresa (PK `empresa_id, codigo`, `codigo` 0–99). Funções exigem módulo
`ocorrencias`; escrita só admin/super_admin (front esconde/desabilita; banco barra pelo RLS).

### 7.1 Leitura

**Lista** (`getCodigosOcorrencia`): todos os códigos da empresa (`codigo, descricao, responsavel,
penaliza, letra_responsavel, ativo, pendente_classificacao, notas, updated_at, atualizado_por,
tipo_ssw, processo_ssw`), ordem `codigo`, mais `atualizado_por_nome` (perfil) e `freq_30d`:

```ts
// origem: codigos.functions.ts — [paridade, bug]: a consulta pede 50.000 linhas mas o PostgREST
// devolve no máximo 1000, sem ordem, sob o RLS do usuário (ocorrências visíveis).
const amostra = ocorrenciasVisiveis.filter((o) => o.data_hora >= agora − 30 dias).slice(0, 1000);
const freq_30d = (codigo) => amostra.filter((o) => o.codigo === codigo).length;
```

Ver D11 (proposta: contar de verdade, como `get_codigos_admin_stats`).

**Estatísticas** (origem `get_codigos_admin_stats`, sem RLS de unidade, só empresa):

| Campo | Fórmula |
| --- | --- |
| `total` | `count(catalogo)` |
| `classificados` | `count(!pendente_classificacao && ativo)` |
| `pendentes` | `total − classificados` (inclui **inativos**) |
| `ocorrencias_30d` | `count(ocorrencias da empresa com data_hora >= now() − 30 dias)` |
| `ocorrencias_em_pendentes` | idem, só códigos do catálogo com `pendente_classificacao` |
| `precisao` | `ocorrencias_30d > 0 ? 1 − ocorrencias_em_pendentes / ocorrencias_30d : 1` |

Front: card "Classificados" = "`classificados` / `total`" (tom ok > 0,8, alerta > 0,5, senão ruim)
com barra; "Pendentes de classificação" = `pendentes` (texto fixo "encontrados nos últimos 30
dias", que não corresponde à conta **[paridade]**); "Ocorrências aguardando" =
`ocorrencias_em_pendentes` (ruim > 100, alerta > 0); "Precisão do cálculo" =
`Math.round(precisao × 100)%` (ok > 0,95 "Números muito precisos", alerta > 0,8 "Boa precisão",
senão "Classifique pendentes para melhorar").

Bloco "pendentes": códigos com `pendente_classificacao`, ordenados por `freq_30d` desc, **15
primeiros**, com classificação rápida (letra padrão F, penaliza ligado). Tabela: filtros no
navegador — busca (código contém / descrição contém, sem caixa), letras (F, C, D, T, S, O),
penaliza (tudo/sim/não), ativo (padrão **ativos**), ordem (código asc / `freq_30d` desc /
`updated_at` desc).

**Histórico do código** (`getCodigoHistory`, aba do modal): `auditoria` com `entidade =
'codigo_ocorrencia'` e `entidade_id = String(codigo)`, ordem `criado_em DESC`, 200 linhas, visível
ao admin da empresa ativa (e ao admin de plataforma — de todas as empresas, D12). Conversão:

```ts
// criar → 1 entrada "criou" (valor_novo = JSON do registro); excluir → "excluiu";
// alterar → 1 entrada por campo de `depois` ∈ {descricao, responsavel, penaliza, letra_responsavel,
//   ativo, pendente_classificacao, notas}: acao = ativo ? (novo ? "reativou" : "desativou")
//   : (campo === "pendente_classificacao" && novo === false ? "classificou" : "editou");
//   valor_antigo/novo = string ou JSON.stringify; autor_nome pelo perfil.
```

### 7.2 Escritas

**Salvar código** (`updateCodigoOcorrencia`, modal e classificação rápida):

```ts
// entrada: codigo 0–99, descricao 3–500, letra F|C|D|T|S|O, penaliza, ativo? (padrão true), notas?
const RESP = { F: "FR", C: "cliente", D: "destinatario", T: "transportador", S: "sistema", O: "outro" };
const afetadas = count(ocorrencias visíveis com codigo)                       // só para a mensagem
upsert(catalogo, { empresa_id, codigo, descricao, responsavel: RESP[letra], penaliza, letra_responsavel: letra,
  ativo: ativo ?? true, pendente_classificacao: false, notas: notas ?? null, updated_at: agora, atualizado_por: uid });
return { ok: true, afetadas };
```

- Sempre limpa `pendente_classificacao`. Não mexe em `tipo_ssw`, `processo_ssw`,
  `pendencia_acompanhada` nem nos campos do SSW.
- "Novo código" com número já existente **sobrescreve** o existente (upsert) **[paridade]**.
- Front: descrição < 3 → "Descrição (mín. 3 caracteres)"; `penaliza` com letra ≠ F pede
  confirmação; classificação rápida usa `descricao || "Código N"`. Toasts: "Salvo · N ocorrência(s)
  atualizadas retroativamente" / "Código N classificado · N ocorrência(s) atualizadas".

**Ação em lote** (`bulkUpdateCodigos`): `codigos[]` (≥1, 0–99), `acao` ∈ `ativar` (ativo=true),
`desativar` (false), `penaliza_true`, `penaliza_false`; grava também `updated_at` e
`atualizado_por`. Só códigos da empresa. Confirmação "Aplicar "acao" em N código(s)?".

**Exportar** (botão da página): JSON (ver [§9](#9-exportações)).

Efeitos colaterais e auditoria: [§8.4](#84-catálogo-de-códigos).

---

## 8. Escritas: validações, efeitos colaterais e auditoria

### 8.1 Anotação

Validação em §5.2. Efeitos: nenhum recálculo. Auditoria: **nenhuma** hoje (D8). Leituras afetadas:
Histórico, Performance (lista de anotações do período), Dashboard (anotações do dia).

### 8.2 Feriado (Histórico › Feriados e Calendário)

- Validações em §5.3 e §6.2. Unicidade: `(data, tipo, cidade, uf, empresa_id)` com nulos iguais.
- **Efeito**: feriados `tipo = 'nacional'` (de **qualquer** empresa, inclusive globais) entram na
  conta de dias úteis (`somar_dias_uteis`, `_dias_uteis_sla` → previsão/SLA; spec de prazo).
  Municipal e estadual não entram. Carnaval e Corpus Christi gerados em lote são "nacional" e
  **contam** como não útil. Nada é recalculado no momento da escrita: vale para os próximos
  cálculos.
- **Auditoria**: toda inclusão/alteração/exclusão gera linha em `auditoria` (`entidade =
  'feriado'`, `entidade_id = id`, `acao` criar/alterar/excluir, `antes`/`depois` só com os campos
  que mudaram, ignorando carimbos; alteração sem mudança real não gera linha). Ator = usuário;
  `ator_tipo` = `plataforma` se admin de plataforma, senão `usuario`; empresa = a da linha (global →
  empresa do contexto).

### 8.3 Importação do 050

§4.4. Sem auditoria. Efeito: só a tabela `coletas`.

### 8.4 Catálogo de códigos

- **Efeito obrigatório**: quando `responsavel` ou `penaliza` mudam (salvar ou lote), copiar os novos
  valores para **todas** as `ocorrencias` daquele código na empresa (origem
  `propagate_codigo_changes`). Performance, ranking e romaneio leem `ocorrencias.penaliza/
  responsavel`; a tela Ocorrências lê o catálogo direto. Mudar só descrição/notas/ativo/letra não
  propaga.
- Nova ocorrência recebe `penaliza` (sempre) e `responsavel` (se vier nulo) do catálogo
  (`fill_ocorrencia_penaliza`, ingestão).
- No banco atual, o UPDATE em massa dispara os gatilhos de ocorrência efetiva e de "cancelado no
  mesmo dia" para cada CT-e afetado. O resultado deles **não depende** de `penaliza/responsavel`
  (efetiva usa `tipo_ssw` e descrição do catálogo; cancelado usa o código 99), então **não portar**
  esse recálculo.
- Mudar `descricao` não recalcula a descrição da ocorrência efetiva já gravada **[paridade]**.
- `codigos_derivar_responsavel` (gatilho de INSERT com `tipo_ssw`) e `garantir_codigo_ocorrencia`
  (cria código desconhecido como pendente, responsável `outro`, letra O) são da **ingestão**, não
  desta tela.
- **Auditoria**: como feriado, `entidade = 'codigo_ocorrencia'`, `entidade_id = String(codigo)`,
  ignorando `updated_at` e `atualizado_por`. O lote gera uma linha por código alterado. É a fonte
  da aba Histórico (§7.1).
- Permissão: admin/super_admin da empresa. Hoje um não-admin que chame o lote recebe "ok" sem nada
  mudar (RLS) — no sistema novo responder 403 (a UI nunca chama).

---

## 9. Exportações

`ExportTabela` = menu CSV / Excel / PDF com a identidade da FR (spec de exportação comum). Nome do
arquivo = `nome-dd-mm-aaaa` (data local) salvo onde indicado. Coluna "Link SSW" =
`https://sistema.ssw.inf.br/bin/ssw0053?act=P1&t_ser_ctrc=<sigla>&t_nro_ctrc=<número 6 dígitos>&t_data_ini=<ddmmaa da emissão>…`
(vazio sem sigla, número ou emissão).

| Tela / local | Nome | Título / subtítulo | Linhas | Colunas |
| --- | --- | --- | --- | --- |
| Ocorrências — lista | `ocorrencias` | "Ocorrências" / rótulo do período | **todas**: páginas de 500 até `totalCount`; se o total mudar no meio ou vier página vazia antes do fim → erro "Os dados mudaram durante a exportação. Atualize e tente novamente." | Data/hora (dd/mm/aa hh:mm local), Emissão, CTRC, NF, Código, Descrição, Responsável (rótulo; FR → nome curto da empresa), Conferente, Romaneio, Destinatário, Cidade entrega, Setor, Unidade resp., Prev. entrega, Atraso, Pagador, Peso (kg), Vol., Frete, Link SSW |
| Ocorrências — painel | `ocorrencias-blocos` | "Painel de ocorrências" | blocos atuais | Bloco, Item, Valor, Participação (%), Detalhe. Linhas: "Ocorrências mais frequentes" (`#cod desc`, count, base total, "mês anterior: N"); "CT-e com ocorrência" (Entregues, Baixados sem entrega, Em aberto com "N em atraso"; base `finalizacao.ctrcs`); "Onde atuar" (base total, "N penal. · M CT-e"); "Prazo" (base `metricas.ctrcs`); "Faixas de atraso" (só > 0; base soma); "CT-e por pagador" (base `metricas.ctrcs`). % = `percentualOcorrencias` (1 casa) |
| Ocorrências — impacto | `ocorrencias-impacto-codigos` | "Impacto por código de ocorrência" | `impacto.rows` | Código, Descrição, Ocorrências, % dos CT-e, Ocorrências mês anterior, % mês anterior, Variação (ocorrências) |
| Ocorrências — "ver códigos" | `ocorrencias-blocos` | título do popover | linhas do bucket | Código, Descrição, Total, % das ocorrências do grupo |
| Comprovantes — cabeçalho | `comprovantes-<status>-<inicio>-a-<fim>` (**sem** sufixo de data) | "Comprovantes" / "dd/mm/aaaa a dd/mm/aaaa" | até 20 páginas de 500 (10.000), status da URL | NF, CTRC, Data de entrega (local), Unidade responsável, Setor, Pagador, Remetente, Destinatário, Cidade, Tipo de documento, Comprovante (Digitalizado/Pendente), Link SSW |
| Comprovantes — lista lateral | `comprovantes-detalhe-<status>-<inicio>-a-<fim>` | título da lista / período | até 10.000 | NF, CTRC, Data de entrega, Unidade, Setor, Pagador, Destinatário, Cidade, Tipo, Comprovante, Link SSW |
| Comprovantes — por unidade | `comprovantes-por-unidade` | "Por unidade" | `por_unidade` | Unidade, Entregues, Digitalizados, Pendentes, % (número com 1 casa ou vazio) |
| Comprovantes — tendência | `comprovantes-tendencia` | "Tendência de comprovantes por dia" | `por_dia` | Dia (dd/mm), Entregues, Digitalizados, Pendentes, % digitalizados |
| Coletas — lista | `coletas-<status>-<inicio>-a-<fim>` | "Coletas — <rótulo do status>" / "Cadastro de dd/mm/aaaa a dd/mm/aaaa" | até 20 páginas de 1000 | Unidade, Coleta, Tipo, Situação (etapa), Prazo, Cadastro, Limite, Coletada em, Cancelada em (dd/mm/aa hh:mm SP), Solicitante, CNPJ remetente, Remetente, Cidade coleta, Destinatário, Destino, Motorista, Placa, Volumes, Peso (kg), Valor mercadoria, Frete, Notas fiscais, CT-e gerado ("SIG N"), Tipo do CT-e, Prejudicada pelo horário ("Sim"/vazio), Último evento, Link SSW |
| Coletas — por dia | `coletas-por-dia` | "Coletas por dia de cadastro" | `por_dia` | Dia, Coletas, Coletadas no prazo, Coletadas atrasadas, Em aberto ou canceladas (`max(0, total − no_prazo − atrasadas)`) |
| Coletas — por solicitante | `coletas-por-solicitante` | "Coletas por solicitante" | todos | Solicitante ("(sem solicitante)" se vazio), Coletas, Coletadas, No prazo, Atrasadas, Em aberto |
| Coletas — por unidade | `coletas-por-unidade` | "Coletas por unidade" | todos | Unidade, Coletas, Coletadas, No prazo, Atrasadas, % no prazo (`pctColeta(no_prazo, coletadas)`), Em aberto, Vencidas, Canceladas |
| Histórico | `historico-<inicio>_a_<fim>` (Excel FR) | "Histórico" / "Período: dd/mm/aaaa a dd/mm/aaaa · N registros" | dias filtrados na tela | Data, Tipo (rótulo; feriado: "Feriado nacional" se nacional, senão **"Feriado municipal"** — estadual também **[paridade]**), Texto, Unidade (anotação: unidade; feriado: "cidade/UF"), Autor, Origem (Anotação/Feriado) |
| Calendário | `feriados-<ano>-<dd-mm-aaaa>` (Excel FR) | "Calendário de feriados ANO" / "N feriados" | feriados do ano | Data, Tipo (valor cru), Cidade, UF, Descrição, Unidades impactadas (nomes com "; ") |
| Admin › Códigos | `codigos-ocorrencia-<AAAA-MM-DD UTC>.json` | — | catálogo inteiro (sem filtros da tela) | JSON indentado 2: `{codigo, letra, responsavel, penaliza, ativo, descricao, notas ('' se nulo)}` |

Coletas por tipo de CT-e e Comprovantes por tipo de documento **não** têm exportação.

---

## 10. Código morto — não portar

| Item | Prova |
| --- | --- |
| `ocorrencias_lista_v5`: parâmetros `p_codigo`, `p_tipo_ssw`, `p_busca` e a ordenação `unidade_nome` | A rota monta `filtrosLista = {...filtrosBase, ...recortes, orderBy, orderDir, page, pageSize}` (`ocorrencias.tsx:356`): não tem `codigo` nem `tipoSsw`; `getOcorrenciasLista` nunca envia `p_busca`; o zod de `orderBy` não aceita `unidade_nome`. Portar só `codigos[]`. |
| Colunas da lista de ocorrências `unidade_id, unidade_nome, filial, data_entrega_realizada, no_prazo, placa_entrega, sigla_cte, numero_cte, tipo_ssw` (e os joins com `unidades`) | `grep "row\.<campo>\|r\.<campo>"` em `ocorrencias.tsx` (tabela e exportação) = 0 para cada uma. `parceiro_nome` só aparece como fallback de `pagador`, que nunca é nulo (`'—'`): manter apenas como **chave de ordenação** (ordem "Parceiro"), não como coluna. |
| `ocorrencias_codigos_bucket_v3`: ramo `bucket LIKE 'tipo:%'` e `p_busca` | O popover só é usado com `todas/penalizantes/externas/pendentes` (`ocorrencias.tsx:800-858`); `commonArgs` não manda `p_busca`. |
| `top_codigos[].tipo_ssw` e `PainelBlocos.TIPO_LABEL` | Bloco "Por tipo (SSW)" removido em 05/11; `grep tipo_ssw` nos componentes de ocorrências = 0; `TIPO_LABEL` de `PainelBlocos` não é importado em lugar nenhum (a Performance tem o seu). |
| `impacto.rows[].responsavel` e `opcoes.codigos[].responsavel/penaliza` | `ImpactoCodigosOcorrencias` só lê `penaliza`; `CodigoPicker` só lê `codigo`/`descricao`. |
| `comprovantes_metricas_v2.cobertura_inicio` | Só tipado/mapeado em `comprovantes.functions.ts:121`; nenhum componente lê. |
| `getComprovantesPagadores` | Nenhum import fora de `features/comprovantes` (`index.ts` reexporta); a tela usa `usePagadoresOpcoes` (filtros compartilhados). |
| `get_codigos_admin_stats.frequencias` e `atualizado_em` (saída) | `grep frequencias admin.codigos.tsx` = 0. `ocorrencias_30d` não é mostrado, mas é necessário para `precisao`: calcular internamente. |
| `prazoDaColeta` (`parse-050.ts`) | Só usada em `parse-050.test.ts`. Diverge da view (coletada sem data → "no_prazo" aqui, "atrasada" na view). Portar só `statusPrazo` (§4.1) e apontar os testes para ela. |
| `coletas_lista.situacao` (coluna de saída) | `grep situacao` em `ColetasLista.tsx` = 0 (a tela usa `etapa`). |
| Recálculo de ocorrência efetiva/cancelado ao propagar `penaliza` | §8.4: resultado independente do valor alterado. |
| Lista de pagadores dentro de `getPerformance` (`parceiros: []`) | Fora deste escopo; citado porque a Performance lê `feriados`/`anotacoes` (consumidores de §5). |

---

## 11. Dúvidas para o dono

- **D1 — Collation do banco.** As ordenações de texto (lista de ocorrências por CTRC/responsável/
  parceiro/atraso, pagadores, unidades, solicitantes) dependem dela. Confirmar com
  `SELECT datcollate FROM pg_database WHERE datname = current_database()` no DEVELOP. Se não for
  `C`, "sem atraso" na ordenação por atraso pode cair como 999 dias. Proposta: ordenar atraso como
  número (nulo = −999) e texto em `C`.
- **D2 — Dia da entrega em UTC nos Comprovantes.** Hoje entrega depois das 21:00 de Brasília cai
  no dia seguinte (filtro, cobertura e gráfico). Manter (paridade) ou passar para o dia de São Paulo
  (como já foi feito no SLA)? Mudar altera números.
- **D3 — Desempates ausentes.** Lista de Comprovantes (`data_entrega DESC` sem desempate: a
  paginação pode repetir/pular CT-e com a mesma hora), `por_tipo_documento` e `por_tipo_ctrc`.
  Proposta: desempatar por `id`/rótulo (não muda contagem).
- **D4 — Coleta × CT-e duplicado.** `vw_coletas` junta por sigla+número; se houver dois CT-e iguais
  a coleta conta duas vezes. Usar só um (qual: o não `fora_universo`?).
- **D5 — Coleta repetida no mesmo arquivo:** hoje fica uma arbitrária; proposta: a última linha.
- **D6 — Limite de 1000 (PostgREST)** em Histórico (anotações e feriados) e listas de feriados:
  manter o corte em 1000 ou trazer tudo?
- **D7 — Texto fixo "22 códigos" na tela Ocorrências** com a lista da FR. Com multiempresa, gerar o
  texto a partir de `codigosTela` da empresa? Para a FR o texto fica igual.
- **D8 — Anotação:** editar/excluir de outro autor hoje diz "sucesso" sem fazer nada; e anotações
  não são auditadas. Proposta: 403 com "Só o autor ou um administrador pode alterar esta anotação."
  e gravar auditoria (aparece em Admin › Logs — muda o que o usuário vê lá).
- **D9 — Feriado duplicado** em Histórico › Feriados sobe o erro cru do Postgres. Proposta:
  "Já existe um feriado igual nesta data."
- **D10 — "Gerar nacionais em lote"** grava feriado **global** (todas as empresas) a partir de
  qualquer admin de empresa. Restringir a admin de plataforma ou gravar na empresa?
- **D11 — `freq_30d` em Admin › Códigos** é contado sobre no máximo 1000 ocorrências arbitrárias
  (ordenação "frequência" e o bloco de pendentes dependem disso). Proposta: contagem real dos
  últimos 30 dias na empresa (mesma base de `get_codigos_admin_stats`).
- **D12 — Histórico do código para admin de plataforma** mistura as auditorias de todas as
  empresas com o mesmo número de código. Filtrar pela empresa ativa?
- **D13 — Escopo nos Comprovantes**: não há filtro por unidade/equipe do usuário (ao contrário de
  Ocorrências). Intencional?
- **D14 — Quarentena**: ocorrências em quarentena contam na tela Ocorrências e no "digitalizado"
  (88), mas não na ocorrência efetiva. Intencional?
