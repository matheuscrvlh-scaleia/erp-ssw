# 02 — Performance, Listagem detalhada, Dashboard e CT-e

Especificação extraída do sistema atual (branch `feat/multiempresa`, banco DEVELOP) para a onda 1
(domínio performance/ctrc). Fonte da verdade: definição real das funções em
`erp-ssw-referencia/banco/funcoes/*.sql` e o TypeScript das telas. Onde o sistema atual tem um
comportamento estranho, ele está descrito **como é** (marcado **[peculiaridade]**) — o objetivo é
dar os mesmos números; correção é decisão do dono (ver §12).

Origem de cada regra: `origem: <função SQL ou arquivo TS>`. Toda regra portada cita a origem no
código (`// origem: calcular_performance (sistema atual)`).

---

## 0. Convenções e regras compartilhadas

### 0.1 Regras do núcleo (não reescritas aqui)

Definidas em `docs/regras/01-nucleo-ctrc.md`; aqui só são usadas pelo nome:

| Nome usado aqui | Origem no sistema atual | Resumo (só para leitura) |
| --- | --- | --- |
| `codigoEfetivo(c)` | `norm_codigo_ocorr(ocorr_efetiva_codigo)` | dígitos do código da ocorrência efetiva → int; sem dígitos → `null` |
| `entregue(c)` | `_is_entregue` | `data_entrega_realizada != null` ou `codigoEfetivo ∈ {1,18,67}` |
| `finalizadoSemEntrega(c, baixas)` | `_is_finalizado_sem_entrega` | sem data de entrega, código ≠ null, ≠ 1 e ∈ códigos `tipo_ssw='BAIXA'` do catálogo da empresa |
| `emAberto(c)` | `NOT entregue AND NOT finalizadoSemEntrega` | — |
| `atrasoListaDias(c, hojeSp)` | `atraso_lista_dias` | previsão nula → null; entregue com data → dia SP da entrega − previsão; código 1/18/67 → `performance_dias`; código 12/36/61/77/92/93/94/99 → null; senão hoje − previsão |
| `codigoSituacao(c, tipoSswDoCodigo)` | `codigo_situacao_ctrc` | data de entrega preenchida e tipo do código efetivo ∉ {ENTREGA, BAIXA} (inclusive sem código) → 1; senão `codigoEfetivo` |
| `tipoDocumentoEfetivo(c)` | `tipo_documento_efetivo` | `upper(trim(tipo_documento_455) \|\| trim(tipo_documento))`, vazio → null |
| ocorrência efetiva | gatilho `_calc_ocorr_efetiva` | colunas `ocorr_efetiva_*` do CT-e |
| finalizadores | `docs/decisoes/codigos-finalizadores-2026-10-08.md` | entrega 1/18/67; baixa 12/36/61/77/92/93/94/99 |
| dias úteis SLA | `_dias_uteis_sla` | usado só pelo job da §9 |
| `fora_universo` | gatilho `trg_ctrcs_zz_fora_universo` | CT-e fora de todas as telas |

> **Variante do "finalizado sem entrega"**: algumas funções desta parte escrevem
> `nc NOT IN (1,18,67) AND nc ∈ BAIXA` (calcular_performance, performance_alertas,
> performance_alerta_ocorrencia_13_multipla, performance_previstos_breakdown) e outras
> `nc <> 1 AND nc ∈ BAIXA` (relatorio_bloco_agregados, lista). Só diferem se o catálogo marcar 18
> ou 67 como `BAIXA` (hoje não marca). Portar com a função do núcleo e registrar o teste do §11
> que fixa o comportamento.

### 0.2 Termos próprios desta parte

- **`siglaResp(c)`** = `c.unidade_destino ?? c.unidade_atual ?? c.filial` (SQL:
  `COALESCE(unidade_destino, unidade_atual, filial)`; string vazia **não** cai para o próximo).
  É a "unidade destino" das telas, o agrupamento "por unidade" e o filtro "Unidade responsável".
- **`filiaisProprias(empresa)`** = siglas de `filiais_ssw` com `propria = true` da empresa.
- **Universo de tela (U)** = `c.empresa_id = empresaAtiva AND siglaResp(c) ∈ filiaisProprias AND NOT c.fora_universo`.
  Se `filiaisProprias` está vazio, o universo é vazio (`IN (NULL)`).
- **`digitos(s)`** = `(s ?? "").replace(/\D/g, "")` (SQL `regexp_replace(COALESCE(s,''),'\D','','g')`).
- **`hojeSp`** = data corrente em `America/Sao_Paulo` (`(now() AT TIME ZONE 'America/Sao_Paulo')::date`).
- **`hojeUtc`** = `CURRENT_DATE` no fuso da sessão do banco, que é **UTC** (evidência: comentário da
  migration `20261005201000_romaneio_usa_indice.sql`). Só três lugares usam: faixa de vencimento
  dos Previstos (§1.8, §3.3), "em rota" do TDE (§1.6) e as datas `::date` de `timestamptz` listadas
  em cada seção. **[peculiaridade]** — ver §12.
- **`diaSp(ts)`** = `(ts AT TIME ZONE 'America/Sao_Paulo')::date`.
- **Códigos do catálogo** (por empresa, tabela `codigos_ocorrencia`): `BAIXAS` = `tipo_ssw='BAIXA'`;
  `PENAL` = `pendencia_acompanhada = true`; `CLASSIFICADOS` = `pendente_classificacao IS NOT TRUE`;
  `PENDENCIA` = `tipo_ssw ∈ {PENDENCIA_CLIENTE, PENDENCIA_TRANSPORTADORA}`.

### 0.3 Texto com vários valores (remetente, destino, cidade)

origem: `texto_casa_filtro`, `src/lib/filtro-texto.ts`.

```ts
// Postgres ILIKE: sem escapar % e _ digitados pelo usuário; caixa ignorada (inclusive acentuadas),
// acento NÃO ignorado ("sao" não casa "SÃO"). Campo nulo → não casa.
function textoCasaFiltro(valor: string | null, filtro: string): boolean {
  if (!filtro.includes("|")) return ilike(valor, `%${btrim(filtro)}%`);
  const padroes = ("%" + btrim(filtro).replace(/\s*\|\s*/g, "%|%") + "%").split("|");
  return padroes.some((p) => ilike(valor, p));
}
// btrim = só espaço (não tab/quebra). "a||b" gera "%%" e casa com tudo (atalho conhecido).
```

Na consulta SQL do backend use `col ILIKE ANY($n::text[])` com os padrões montados em TS (mesma
semântica; deixa de existir função no banco).

Exemplos: `"são paulo|campinas"` casa `"SÃO PAULO"` e `"CAMPINAS"`; `" ara "` vira `%ara%`.

### 0.4 Escopo do usuário (visibilidade de CT-e)

Há **três** modos no sistema atual, e cada chamada usa um. Isso só muda número para usuário com
escopo restrito (não admin/super_admin/gestor e com unidade no vínculo ou equipe ativa).

- `podeVerTudo(u)` (origem `pode_ver_tudo`): papel `admin`, `super_admin` ou `gestor` na empresa
  ativa, **ou** usuário sem escopo (sem `empresa_usuarios.unidade_id` na empresa ativa **e** sem
  `membros_equipe` ativo — `data_saida IS NULL` — na empresa ativa).
- **E0 — nenhum**: a função é SECURITY DEFINER e não filtra; vê todos os CT-e da empresa.
- **E1 — escopo de perfil** (origem `_perf_filtro_ctrcs` p_escopo, `_lista_ctrcs_detalhado_filtro`,
  `performance_alertas`): se `!podeVerTudo(u)`:
  `c.unidade_id = usuarios_perfil.unidade_id(u)` **ou** `c.equipe_id ∈ equipes ativas de u na empresa`.
  **[peculiaridade]** usa `usuarios_perfil.unidade_id`, não `empresa_usuarios.unidade_id`.
- **E2 — RLS** (funções SECURITY INVOKER e leituras PostgREST): `podeVerTudo(u)` **ou**
  `empresa_usuarios.unidade_id(u, empresa) = c.unidade_id` **ou** u é membro ativo de `c.equipe_id`.

No sistema novo o RLS é só por empresa; E1/E2 viram filtro explícito no repositório, por chamada,
conforme a tabela de cada seção.

### 0.5 Filtro de performance (FP)

origem: `_perf_filtro_ctrcs`, `_perf_coluna_data`, `_perf_codigos_norm`, `_perf_tipos_norm`,
`normalizarFiltroUnidades`, `saneTipos`, `getFiliaisProprias().filtrar`.

Entrada HTTP comum das chamadas da Performance (zod):

```ts
type FiltroPerformanceEntrada = {
  inicio: string;            // AAAA-MM-DD
  fim: string;               // AAAA-MM-DD
  unidades?: string[] | null;   // uuid de `unidades` OU sigla (links de outras telas)
  parceiros?: string[] | null;  // CNPJ do pagador, só dígitos (id do seletor)
  remetente?: string | null;    // "a|b"
  destino?: string | null;      // "a|b" (cidade_destino)
  filiais?: string[] | null;    // siglas
  tipos?: string[] | null;      // tipo de documento; "__SEM_TIPO__" = sem tipo
  codigos?: string[] | null;    // códigos da ocorrência efetiva
  base_data?: "emissao" | "prevista" | "concluido"; // padrão "emissao"
};
```

Normalização no servidor (ordem importa):

1. `normalizarFiltroUnidades`: de `unidades`, os que **não** casam
   `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` saem de `unidades`, viram
   `trim().toUpperCase()` e entram em `filiais` (sem duplicar). `unidades` fica só com uuids.
2. `filiais` → só as que são filiais próprias (comparação `trim().toUpperCase()`), em maiúsculas.
   Vazio → sem filtro.
3. `tipos` → `trim().toUpperCase()`, sem vazios, sem duplicados; vazio → sem filtro.
4. `codigos` → cada item vira `parseInt(digitos(x))` (sem dígitos → `null`, que não casa nada);
   vazio → sem filtro.
5. `remetente`/`destino` → `trim()`; vazio → sem filtro.
6. `unidades`/`parceiros` vazios → sem filtro (o front nunca manda vazio; a função SQL trataria
   `[]` como "nenhum").

Predicado (aplicado sobre o universo U):

```ts
colunaData(base) = { emissao: "data_emissao", prevista: "data_prevista_entrega",
                     concluido: "data_conclusao_efetiva" }[base ?? "emissao"]; // todas `date`
FP(c) = U(c)
  && (semPeriodo || (c[colunaData] != null && inicio <= c[colunaData] && c[colunaData] <= fim))
  && (!unidades || unidades.includes(c.unidade_id))          // unidade_id nulo não casa
  && (!parceiros || parceiros.includes(digitos(c.pagador_cnpj)))
  && (!filiais || filiais.includes(siglaResp(c)))
  && (!remetente || textoCasaFiltro(c.remetente, remetente))
  && (!destino || textoCasaFiltro(c.cidade_destino, destino))
  && (!codigos || codigos.includes(codigoEfetivo(c)))         // efetivo nulo não casa
  && (!tipos || tipos.includes(tipoDocumentoEfetivo(c) ?? "__SEM_TIPO__"))
  && escopo(modo, u, c);
```

Cada chamada abaixo diz quais partes do FP usa (algumas ignoram códigos, tipos ou base).

### 0.6 Números, arredondamento e formatação

- Contagens são inteiras. Somas de dinheiro/peso vêm de `numeric`: somar em decimal exato
  (centavos/gramas como inteiros ou biblioteca decimal), nunca acumular float.
- `ROUND(x, 4)` do Postgres arredonda meio para longe de zero. Portar com aritmética inteira:
  `arredondarRazao(num, den, casas) = Math.floor((2 * num * 10**casas + den) / (2 * den)) / 10**casas`
  (para `num, den ≥ 0`). Ex.: `arredondarRazao(2, 3, 4) = 0.6667`; `arredondarRazao(1, 160, 4) = 0.0063`.
- Razões sem `ROUND` (ex.: `performance` de `calcular_performance`) saem do banco com ~20 dígitos;
  em TS `float64` basta — toda exibição arredonda a 1 casa.
- Formatação na tela (manter exatamente; as funções existem em várias versões):
  - `fmtPct(n) = (n*100).toFixed(1) + "%"` — **ponto** decimal (cards do topo da Performance,
    tabela por unidade, dashboard). Ex.: `0.95733 → "95.7%"`.
  - `fmtPctBloco(v) = v.toFixed(1).replace(".", ",") + "%"` — vírgula; recebe 0–100 (linha de
    Produção, relatório). Ex.: `95.733 → "95,7%"`; `null → "—"`.
  - `toLocaleString("pt-BR")` para inteiros; BRL com `maximumFractionDigits: 0` nos cards de
    Produção/Previstos, com centavos no relatório.

### 0.7 Período das telas (cliente)

origem: `resolvePeriodo` em `performance.index.tsx` e `performance.lista.tsx`.

Datas no fuso **do navegador**: `fim = hoje local`; `hoje` → `[fim, fim]`; `7d` → `[fim−6, fim]`;
`30d` → `[fim−29, fim]`; `mes` (padrão) → `[1º dia do mês local, fim]`; `custom` com `de` e `ate`
→ `[de, ate]` (sem validar `de ≤ ate`). Rótulos: "Hoje", "Últimos 7 dias", "Últimos 30 dias",
"Este mês", `"${de} → ${ate}"`.

### 0.8 Autorização por chamada

Toda rota exige sessão. Rotas da Performance/Lista/Dashboard exigem o módulo `performance`
liberado para a empresa (admin de plataforma passa sempre); a série SLA aceita `performance` **ou**
`ranking`; filtros compartilhados (§4) e o detalhe do CT-e (§5) exigem só sessão.

Erro de tempo esgotado vira a mensagem do operador "reduza o período ou aplique mais filtros"
(origem `friendlyDbError`). Chamadas marcadas "falha → vazio" engolem o erro e devolvem o vazio
indicado (a tela segue aberta).

---

## 1. Tela Performance (`/performance`)

origem: `src/routes/_authenticated/performance.index.tsx`, `src/features/performance/*`.

### 1.1 URL e filtros da tela

Parâmetros de busca (todos opcionais): `periodo ∈ {hoje,7d,30d,mes,custom}` (inválido → `mes`),
`base ∈ {emissao,prevista,concluido}` (→ `emissao`), `unidades[]`, `parceiros[]`,
`ordem ∈ {pior,melhor}` (→ `pior`), `remetente`, `destino`, `filiais[]`, `codigos[]`, `tipos[]`,
`de`, `ate` (só aceitos se `AAAA-MM-DD`). Arrays aceitam string única.

Controles: períodos (Hoje, 7 dias, 30 dias, Mês), base (Emitidos / Data Prevista / Concluídos),
intervalo de datas (`periodo=custom`), busca por CTRC e por NF (abre a lista com
`ignorar_periodo`, §1.13), Parceiros (opções §4.4), Unidade responsável (= `filiais`, opções
§4.2), Remetente/Destino (sugestões §4.3), Ocorrência (opções §1.10), Tipo documento (§1.10).
"Limpar filtros" zera remetente, destino, filiais, códigos, tipos, de, ate (e `custom` → `mes`);
**não** zera unidades nem parceiros.

Faixa "Filtrando por": Unidade (nome da unidade pelo id; uuid sem nome → "unidade selecionada";
sigla mostra a sigla), Parceiros (nome), Unidade responsável, Remetente/Destino (cada valor do
"a|b"), Ocorrência (`"${c} — ${descricao}"` quando a descrição está nas opções carregadas),
Tipo documento (`__SEM_TIPO__` → "sem tipo").

### 1.2 Chamadas e o que alimentam

| Chamada nova (sugestão) | Origem SQL/TS | Alimenta |
| --- | --- | --- |
| `POST /performance/resumo` | `calcular_performance` + leituras de `getPerformance` | cards Taxa de retorno, Em Atraso, tabela por unidade, banner de pendentes, aviso de cobertura |
| `POST /performance/pontualidade` | `calcular_performance_pontualidade` | SLA Operacional, Nascidos em atraso, colunas SLA Op./Nasc. atraso, No/Fora do prazo, alerta "abaixo da meta" (com `base=emissao`) |
| `POST /performance/producao` | `relatorio_bloco_agregados` | linha de Produção |
| `POST /performance/tde-aguardando` | `performance_tde_aguardando` | card TDE |
| `POST /performance/otif` | `performance_otif` | card OTIF (só se `otif_visivel`) |
| `POST /performance/previstos` | `performance_previstos_breakdown` | seção Previstos |
| `POST /performance/alertas` | `performance_alertas` + `performance_alerta_ocorrencia_13` + `..._13_multipla` | banner de alertas |
| `POST /performance/codigos-disponiveis` | `performance_codigos_disponiveis` | seletor Ocorrência |
| `POST /performance/tipos-documento` | `performance_tipos_documento` | contagem do seletor Tipo documento |
| `POST /performance/serie` | `sla_serie` | gráfico Evolução |
| `POST /performance/relatorio` | §2 | painel Relatório de período |

Ordem de carga (só desempenho, não muda número): resumo → pontualidade (após resumo) → otif (se
visível) → produção → TDE / pagadores; alertas, previstos e pontualidade-por-emissão depois da
produção; série só quando o gráfico entra na tela; códigos e tipos só com o seletor aberto.
Cache no cliente: 5 min (padrão), produção/códigos/tipos/previstos 1 min.

### 1.3 Resumo — `calcular_performance`

Entrada: FP completo (base, unidades, parceiros, filiais, remetente, destino, códigos, tipos).
Escopo **E1**. Universo **U**.

Por CT-e da base (`B = {c | FP(c)}`), agregando as ocorrências do CT-e (todas, inclusive em
quarentena):

```ts
const ocs = ocorrencias.filter((o) => o.ctrc_id === c.id);
const ehPenalizante = (o) => o.penaliza === true && o.responsavel !== "cliente" && PENAL.includes(o.codigo);
temPenalizante  = ocs.some(ehPenalizante);
qtdPenalizantes = ocs.filter(ehPenalizante).length;
temRetorno      = ocs.some((o) => o.codigo === 13);
qtdPendentes    = ocs.filter((o) => !CLASSIFICADOS.includes(o.codigo)).length; // código fora do catálogo conta
ent   = c.data_entrega_realizada != null || [1, 18, 67].includes(nc);   // nc = codigoEfetivo(c)
fin   = c.data_entrega_realizada == null && nc != null && ![1, 18, 67].includes(nc) && BAIXAS.includes(nc);
concl = ent || fin;
aberto = !ent && !fin;
vencido = aberto && c.data_prevista_entrega != null && c.data_prevista_entrega < hojeSp;
respCli = c.responsabilidade_cliente ?? false;
```

Totais (`totais` no JSON; ★ = lido pela tela/relatório):

| Campo | Fórmula |
| --- | --- |
| `total_ctrcs` ★ | `|B|` |
| `ctrcs_penalizados` ★ (relatório) | `#temPenalizante` |
| `ctrcs_concluidos` ★ | `#concl` |
| `ctrcs_penalizados_concluidos` | `#(concl && temPenalizante)` |
| `performance` ★ (relatório) | `concl > 0 ? 1 − pen_concl/concl : 1.0` |
| `total_retornos` | `#temRetorno` (**qualquer** CT-e de B, inclusive em aberto) |
| `taxa_retorno` ★ | `concl > 0 ? total_retornos/concl : 0` — **[peculiaridade]** numerador inclui abertos; pode passar de 100% |
| `ocorrencias_penalizantes` ★ (relatório) | `Σ qtdPenalizantes` |
| `ocorrencias_pendentes` ★ | `Σ qtdPendentes` |
| `entregues`, `finalizado_sem_entrega` | `#ent`, `#fin` (sem leitor) |
| `previstos` = `ctrcs_em_aberto` ★ | `#aberto` |
| `ctrcs_em_atraso` ★ | `#vencido` |
| `ctrcs_em_atraso_fr` ★ | `#(vencido && !respCli)` |
| `ctrcs_em_atraso_cliente` ★ | `#(vencido && respCli)` |
| `ctrcs_sem_prazo` ★ | `#(aberto && data_prevista_entrega == null)` |

`meta_taxa_retorno` ★ — média ponderada da meta por `unidade_id`:

```ts
// metas: tipo_meta = 'taxa_retorno', vigencia_inicio <= fim && (vigencia_fim == null || vigencia_fim >= inicio)
// grupos: CT-e de B agrupados por unidade_id (inclusive o grupo unidade_id = null)
// JOIN por unidade_id: meta global (unidade_id nulo) NUNCA casa; unidade com 2 metas vigentes
// duplica o grupo (conta 2x no numerador e no denominador) — [peculiaridade]
meta = Σ grupos (n_grupo × (valor ?? 0)) / Σ grupos n_grupo   // B vazio → null
```

Com CT-e no período e **nenhuma** meta cadastrada, `meta = 0` (não `null`).

`por_unidade` ★ — uma linha por `siglaResp` presente em B:
`{ sigla, total, concluidos = #concl, penalizados = #(concl && temPenalizante),
penalizados_abertos = #(aberto && temPenalizante), performance = concluidos > 0 ? 1 − penalizados/concluidos : 1.0 }`,
ordenada por `performance ASC, sigla ASC`.

`periodo = { inicio, fim, dias = max(1, fim − inicio + 1) }`.

**Não portar** (saída sem leitor; prova em §10): `periodo_anterior` e `comparacao_anterior` — a
segunda consulta inteira, que repetia o FP no período `[inicio − dias, inicio − 1]` ("mês
anterior" desta função = mesma quantidade de dias imediatamente antes).

Leituras extras da mesma chamada (`getPerformance`):
- `unidades`: `unidades` da empresa com `ativo = true`, ordem `nome` — só para nomes nos filtros.
- `cobertura = { min, max }`: menor e maior `data_emissao` de `ctrcs` visível ao usuário (E2,
  **inclui** `fora_universo` e filiais não próprias). Mostra o aviso "Sem CTRCs no intervalo..."
  quando `total_ctrcs = 0`, ou "Os números podem parecer iguais..." quando `min === max`.
- **Não portar**: `feriados`, `anotacoes` e `parceiros: []` (devolvidos e nunca lidos).

Casos-limite: período sem CT-e → `performance = 1.0`, `taxa_retorno = 0`, `meta = null`,
`por_unidade = []`.

### 1.4 Pontualidade — `calcular_performance_pontualidade`

Entrada: FP completo. Escopo **E2** (função SECURITY INVOKER: só RLS). Universo U.

Por `siglaResp` (todo CT-e de B):

```ts
respCli = c.responsabilidade_cliente ?? false;
total              = #B
no_prazo           = #(!respCli && c.no_prazo === true)
fora_prazo         = #(!respCli && c.no_prazo === false)
sem_info_bi2       = #(!respCli && c.no_prazo == null)
excluido_cliente   = #(respCli)
no_prazo_cliente   = #(respCli && c.no_prazo === true)
fora_prazo_cliente = #(respCli && c.no_prazo === false)
nascidos_avaliados = #(c.prazo_padrao_data != null && c.data_prevista_entrega != null)
nascidos_atraso    = #(c.data_prevista_entrega < c.prazo_padrao_data)  // qualquer nulo → falso
```

Linha por unidade (ordem `total DESC`; empate sem ordem definida — usar `sigla ASC` como
desempate determinístico):
`performance_pct = total > 0 ? ROUND((total − fora_prazo)/total, 4) : null`;
`sla_cliente_pct = (npc+fpc) > 0 ? ROUND(npc/(npc+fpc), 4) : null`;
`nascidos_pct = avaliados > 0 ? ROUND(nascidos_atraso/avaliados, 4) : null`.

`totais`: somas das linhas; `performance_pct` (SLA Operacional,
`docs/decisoes/sla-operacional-sobre-emitidos-2026-10-13.md`) = `ROUND((total − fora_prazo)/total, 4)`
ou null; `total_cliente = npc + fpc`; `sla_cliente_pct = ROUND(npc/total_cliente, 4)` ou null;
`nascidos_pct` idem; `pendente = 0` (constante); `sem_prazo = sem_info_bi2`.

Exemplo (teste): 10 CT-e de ARA — sem resp. cliente: 6 `no_prazo=true`, 2 `false`, 1 `null`;
resp. cliente: 1 `false`. → `total 10, no_prazo 6, fora_prazo 2, sem_info_bi2 1, excluido 1,
performance_pct 0.8, sla_cliente_pct 0.0 (0/1)`. Com 8 avaliados e 1 nascido → `nascidos_pct 0.125`.
Total 3 com 1 fora → `0.6667`.

Falha: RPC inexistente → `null` (tela mostra os textos de fallback); tempo esgotado → erro amigável.

### 1.5 Produção — `relatorio_bloco_agregados` + bloco

Entrada: FP completo. Escopo **E0**. Universo U.

```ts
ent = c.data_entrega_realizada != null || [1,18,67].includes(nc);
fin = c.data_entrega_realizada == null && nc != null && nc !== 1 && BAIXAS.includes(nc);
codigosPerdido = codigos?.length ? codigos /* do filtro, parse dígitos */ : [13];

total_ctrcs            = #B
entregues              = #ent
finalizado_sem_entrega = #fin
previstos              = #(!ent && !fin)
devolvidos             = #(B com alguma ocorrência 13)
valor_frete_total      = Σ_{c ∈ B} Σ_{o ∈ ocs(c), o.codigo = 85} c.valor_frete   // uma parcela POR ocorrência 85
valor_frete_perdido    = Σ c.valor_frete  para c ∈ B com ∃ o: catalogo(o.codigo).codigo <> 85
                         && catalogo.penaliza && catalogo.responsavel = 'FR' && o.codigo ∈ codigosPerdido
// nulos de valor_frete somam 0; sem linhas → 0
```

**[peculiaridade]** `valor_frete_total` conta o frete do CT-e uma vez **por ocorrência 85** (CT-e
de R$ 100 com duas saídas → R$ 200). `valor_frete_perdido` usa `penaliza`/`responsavel` do
**catálogo** (não da ocorrência) e **não** exige que o CT-e tenha 85, embora o rótulo diga "de
romaneados".

Bloco (origem `montarBlocoRelatorio`, usado na tela e no relatório):

```ts
total_ctrcs        = agregados.total_ctrcs || resumo.totais.total_ctrcs   // 0 cai para o resumo
entregues, finalizado_sistema = agregados.finalizado_sem_entrega, previstos, devolvidos
no_prazo  = pont.totais.no_prazo ?? 0;  fora_prazo = pont.totais.fora_prazo ?? 0
pendente_prazo = pont.totais.pendente ?? 0; sem_prazo = pont.totais.sem_prazo ?? 0
valor_frete_total, valor_frete_perdido
pct_frete_perdido   = valor_frete_total > 0 ? perdido/total*100 : null
sla_operacional_pct = resumo.totais.performance != null ? resumo.performance*100 : null  // SLA por ocorrência penalizante
sla_pontualidade_pct = pont.totais.performance_pct ?? null      // ATENÇÃO: fração 0–1 aqui (não ×100)
taxa_retorno_pct    = resumo.taxa_retorno*100
total_cliente, no_prazo_cliente, fora_prazo_cliente, sla_cliente_pct (fração) — de pont
```

**[peculiaridade] nomes trocados**: `sla_operacional_pct` (campo) é o SLA por ocorrência
penalizante e aparece nas telas como "SLA de Pontualidade"/"SLA Pont."; `sla_pontualidade_pct`
(campo) é o `performance_pct` da pontualidade e aparece como "SLA Operacional"/"SLA Op.". Manter
os rótulos das telas exatamente como estão.

### 1.6 TDE aguardando programação — `performance_tde_aguardando`

Usa o **filtro da Listagem** (§3.2), não o FP: recorte `tde_aguardando` para o card e `emitidos`
para o total. Entrada: `inicio, fim, base_data`, `unidades = filiaisProprias.filtrar(unidades)`
(uuids caem fora — **[peculiaridade]**), `filiais` (filtradas), `parceiros`, `remetente`,
`destino`, `codigos` (`Number(x)` inteiros; comparados com `codigoSituacao`, §3.2), `tipos`.
Escopo **E1**.

```ts
aguardando = #{c ∈ L("tde_aguardando")};  valor = Σ (c.tde ?? 0) desses
total      = #{c ∈ L("emitidos") | (c.tde ?? 0) > 0}
```

Card: valor `aguardando` (ou "…"), legenda "Com TDE e ainda sem saída para entrega", sub
`"${fmtBRL0(valor)} de TDE · ${total} CT-e com TDE no período"`, tom vermelho se `aguardando > 0`.

### 1.7 OTIF — `performance_otif`

Só roda e aparece se a configuração da empresa `otif_visivel = "true"` (FR: desligado,
`docs/decisoes/otif-fora-das-telas-2026-10-20.md`). Entrada: FP completo. Escopo **E0**.

```ts
codigosProblema = catálogo.filter(k => PENDENCIA.includes(k.tipo_ssw) && k.codigo !== 85).map(k => k.codigo).sort()
problemas = #{c ∈ B | ∃ o ∈ ocs(c): catálogo tem o.codigo && o.codigo ∈ codigosProblema}  // histórico inteiro
total = #B;  pct = total > 0 ? ROUND(problemas/total, 4) : null
```

Card "OTIF" (badge "menor é melhor"): `≤ 0.05` bom, `≤ 0.10` alerta, senão ruim. Falha não-timeout
→ `null` ("Sem CTRCs no período").

### 1.8 Previstos — `performance_previstos_breakdown`

Entrada: FP **sem base** (período sempre por **emissão**) + `ignorar_periodo` (tela: padrão
`false` = "Emitidos no período"; relatório: os dois modos). `ignorar_periodo = true` → sem período;
`false` → `data_emissao >= inicio` (se informado) e `<= fim` (se informado). Escopo **E0**.

```ts
previsto(c) = c.data_entrega_realizada == null && (nc == null || ![1,18,67].includes(nc)) && !BAIXAS.includes(nc)
cod   = parseInt(c.ocorr_efetiva_codigo)       // texto cru → int; vazio → null
tipo  = catálogo(cod)?.tipo_ssw ?? null
status(cod, tipo) = cod === 35 ? "agendamento"
                  : cod === 85 || cod === 7 ? "rota"
                  : PENDENCIA.includes(tipo) ? "pendencia"
                  : cod == null || [80,82,83,84].includes(cod) ? "programacao" : "outros";
faixa(prev) = prev == null ? "sem_prev" : prev < hojeUtc ? "vencido" : prev == hojeUtc ? "hoje"
            : prev == hojeUtc+1 ? "d1" : prev == hojeUtc+2 ? "d2" : "d3_mais";   // hojeUtc! (§0.2)
```

Saída: `status[]` e `faixa[]` com `{ key, qtd, peso = Σpeso, volumes = Σvolumes, frete = Σvalor_frete }`
(nulos somam 0; sem ordem — a tela ordena), `total` idem sobre todos.

Tela: rótulos status (ordem fixa) Agendamento, Programação, Em rota de entrega, Pendência,
Outros (some se 0); faixa Vencido, Vence hoje, D+1, D+2, D+3+, Sem previsão (some se 0).
Peso `0 → "0 kg"`, `≥ 1000 → (v/1000) com até 1 casa + " t"`, senão inteiro `+ " kg"`.

### 1.9 Alertas

#### 1.9.1 `performance_alertas` (só as partes com leitor)

Entrada: filtros do FP **sem base** (sempre emissão), com `codigos` aplicados como `match` (abaixo)
e `tipos`; parâmetros vindos de `configuracoes` da empresa (padrão entre parênteses):
`sla_alerta_vermelho_pct (95)`, `alerta_dias_sem_movimento (3)`,
`atrasos_excluir_responsabilidades ("cliente")` (sem leitor após cortar `vermelhas`),
`alerta_queda_sla_pp (5)`, `alerta_janela_tendencia_dias (7)`, `alerta_janela_vencimento_h (48)`,
`alerta_min_vencimento (20)`, `alerta_nascido_atrasado (1)`, `alerta_desvio_finsistema_pp (5)`,
`alerta_dias_sem_atualizacao (5)`. Escopo **E1** (com `unidade_id` do perfil e equipes ativas).

```ts
F(c) = U(c) && unidades/parceiros/filiais/remetente/destino/tipos do FP && E1   // SEM período
match(c) = !codigos || codigos.includes(nc)
J = max(janela_tendencia ?? 7, 1)
per  = {c | F(c) && inicio <= c.data_emissao <= fim}
base = {c ∈ per | match(c)}
ent/fin como em §1.3; respCli = c.responsabilidade_cliente ?? false
```

| Bloco | Regra |
| --- | --- |
| `semMovimento.count` | `#{c ∈ base | !ent && !fin && !respCli && atraso != null && atraso > N && (hojeSp − (diaSp(ocorr_efetiva_data) ?? data_emissao)) > N}`; `atraso = atrasoListaDias(c)`, `N = alerta_dias_sem_movimento` |
| `quedaSla` | `atu`: emissão em `[fim−J+1, fim]`; `ant`: `[fim−2J+1, fim−J]`; ambos `F && match && !respCli`; por `siglaResp`: `base_n = #(no_prazo != null)`, `ok = #(no_prazo === true)`, `sla = base_n >= 10 ? 100*ok/base_n : null`. Só siglas presentes nas duas janelas. Item se os dois `sla` não nulos e `ant − atu >= queda_pp ?? 5`: `{unidade, sla_atual: round1, sla_anterior: round1, queda_pp: round1(ant−atu), total_atual: base_n atu}` ordenado por queda DESC; `count` = nº de itens |
| `vencendo` | `{c | F(c) && match(c) && data_entrega == null && !ent && !fin && !respCli && prev != null && hojeSp <= prev <= limVenc}` com `limVenc = diaSp(agora + H horas)`, `H = janela_vencimento_h ?? 48` (sem período de emissão). `count`; `top_parceiros`: agrupa por `(digitos(pagador_cnpj), pagador_nome ?? parceiro_nome)` → `{parceiro_id, parceiro_nome, qtd}` top 5 por `qtd DESC` |
| `nascidoAtrasado` | `{c ∈ base | prev != null && !(nc' ∈ {1,12,36,59,61,77,92,93,94,99} || (data_entrega != null && nc' ∉ {18,67})) && min(diaSp(o.data_hora) | o ∈ ocs(c), o.codigo = 85) > prev}` com `nc' = nc ?? −1`; sem 85 → não entra. `count`, `top_unidades` (`{unidade, qtd}` top 5) |
| `finSistemaAnomalo` | atual = `per` (**sem** `match`); baseline = `F` com emissão em `[inicio−28, inicio−1]` (sem `match`); por sigla `pct_atual = total >= 10 ? 100*fin/total : null`, `pct_baseline = total >= 40 ? ... : null` (sigla sem baseline → null); item se ambos não nulos e `atual − baseline >= desvio_pp ?? 5`: `{unidade, pct_atual, pct_baseline, desvio_pp, qtd_atual = fin atual}` (round 1) por desvio DESC |
| `semAtualizacao` | `{c | F(c) && match(c) && data_entrega == null && !ent && !fin && !respCli && hojeSp − (diaSp(ocorr_efetiva_data) ?? data_emissao) >= max(dias_sem_atualizacao ?? 5, 1)}` (sem período). `count`, `top_unidades` top 5, `unidades: []` |
| `thresholds` | `{vermelhoPct, diasSemMovimento, quedaSlaPp, janelaTendenciaDias, janelaVencimentoH, minVencimento, nascidoAtrasadoMin, desvioFinsistemaPp, diasSemAtualizacao}` = valores recebidos |

`round1` = `ROUND(x, 1)` meio para longe de zero. Top N: o SQL não define desempate; usar
`qtd DESC, chave ASC`.

**Não portar** `vermelhas` (ids, count, unidades, items com LIMIT 50 e a CTE `pen`): o card
"unidades abaixo da meta" é calculado da pontualidade (abaixo); prova em §10.

#### 1.9.2 `performance_alerta_ocorrencia_13`

FP **sem base/códigos** (emissão no período; unidades, parceiros, filiais, remetente, destino,
tipos). Escopo **E1**. `hits = {c ∈ B | ∃ ocorrência 13}`; `count = |hits|`;
`top_unidades = top 3 por siglaResp → {unidade, count}`. Falha → `{count: 0, top_unidades: []}`.

#### 1.9.3 `performance_alerta_ocorrencia_13_multipla`

Igual ao anterior, mas `hits = {c ∈ B | c.data_entrega == null && (nc == null || (nc ∉ {1,18,67} && nc ∉ BAIXAS)) && #ocorrências 13 >= 2}`.

#### 1.9.4 Cartões do banner (cliente)

origem: `AlertsBanner.tsx`. Ordem e regra de exibição:

| Card | Mostra se | Título | Clique (§1.13) |
| --- | --- | --- | --- |
| vermelhas | `abaixo.length > 0`, `abaixo = pontEmissao.por_unidade.filter(u => u.performance_pct != null && u.performance_pct*100 < vermelhoPct)` ordenado por pct ASC, sigla | `"${n} unidade(s) abaixo da meta"`; sub `"Piores: SIG (95,1%) · ..."` (4 piores, pct com vírgula) | `penalizados_abertos`, `unidades = siglas abaixo` |
| semMovimento | `count > 0` | `"${n} CTRC(s) atrasado(s) e parado(s) há mais de ${N} dias"` | `sem_movimento` |
| quedaSla | `count > 0` | `"${n} unidade(s) com queda de SLA"`; sub top 2 `"SIG (-5pp)"` | `penalizados` (+ unidade se só 1 item no top 2) |
| vencendo | `count >= minVencimento` | `"${n} CTRCs vencendo em ${H}h"`; sub top 2 parceiros | `vencimento_proximo`, `ignorar_periodo` |
| nascidoAtrasado | `count >= nascidoAtrasadoMin` | `"${n} CTRCs saíram para entrega com prazo vencido"` | `nascido_atrasado`, `abertos` |
| finSistemaAnomalo | `count > 0` | `"${n} unidade(s) com anomalia de finalizados"`; sub `"SIG (+10pp)"` | `finalizado_sistema` (+ unidade se 1) |
| semAtualizacao | `count > 0` | `"${n} CTRCs sem atualização há ${D}+ dias"` | `sem_atualizacao`, `ignorar_periodo` |
| ocorrencia13 | `count > 0` | `"${n} CT-e com entrega prejudicada (13)"`; top 2 | `ocorrencia_13` |
| ocorrencia13Multipla | `count > 0` | `"${n} CT-e com múltiplas entregas prejudicadas (13)"` | `ocorrencia_13_multipla` |

`pontEmissao` = §1.4 com os filtros da tela e `base=emissao` (mesma consulta da tela quando a base
já é emissão). Textos de ajuda (`info`) estão em `AlertsBanner.tsx` linhas 151–276 — copiar.

### 1.10 Opções dos seletores Ocorrência e Tipo documento

`performance_codigos_disponiveis` — FP **sem códigos**; usa unidades, parceiros,
remetente, destino, filiais, **tipos**; período **sempre por emissão** (a tela não envia a base —
**[peculiaridade]**). Escopo **E0**. Agrupa B por `nc` (não nulo) → `{codigo: String(nc),
descricao: catálogo(nc)?.descricao ?? null, qtd}` ordenado por `qtd DESC, codigo ASC` **como texto**
(`"10" < "9"`). Falha → `[]`. Opção: `"${codigo} — ${descricao ?? "sem descrição"}"`, sub `qtd`.

`performance_tipos_documento` — unidades, parceiros, filiais, remetente, destino e **base** (sem
códigos, sem tipos). Escopo E0. `{tipo: tipoDocumentoEfetivo ?? "__SEM_TIPO__", qtd}` por
`qtd DESC`. Falha → `[]`. O seletor junta essas contagens com `tipos_documento_opcoes` (§4.5):
tipos com `qtd > 0` primeiro (por qtd DESC), os sem CT-e no período depois, apagados.

### 1.11 Série — `sla_serie` e gráfico Evolução

Janela (cliente): `dias = fim − inicio + 1`; `dias < 7` → `[fim−6, fim]`, granularidade `dia`,
subtítulo "Últimos 7 dias (o período selecionado é curto demais para um gráfico)"; senão
`[inicio, fim]` com `mes` se `dias > 92`, senão `dia`.

Entrada: FP completo + granularidade. Escopo **E1**. Por CT-e de B:
`periodo = trunc(c[colunaData], dia|mês)`; `entregue = data_entrega != null || nc ∈ {1,18,67}`;
`respCli`.

```ts
total_ctrcs, entregue
fora_transp    = #(entregue && no_prazo === false && !respCli)
no_prazo_op    = #(!respCli && no_prazo === true);   fora_prazo_op  = #(!respCli && no_prazo === false)
no_prazo_cli   = #(respCli && no_prazo === true);    fora_prazo_cli = #(respCli && no_prazo === false)
```

Eixo completo de `trunc(inicio)` a `trunc(fim)` (dia a dia ou mês a mês), zeros onde não há CT-e;
`periodo` em `AAAA-MM-DD`.

Métricas da tela (`metricas = ["sla_op","sla_cli","volume"]`; `razao(n,d) = d > 0 ? n/d : null`):
SLA Operacional `= razao(total − fora_prazo_op, total)`; SLA Cliente
`= razao(no_prazo_cli, no_prazo_cli + fora_prazo_cli)`; CT-e emitidos `= total`. Rótulo do eixo:
dia `dd/mm`, mês `jan..dez`. Meta = `sla_meta_pct/100`. Exportação (`ExportTabela`,
nome `performance-evolucao`): coluna "Dia"/"Mês" (`dd/mm/aaaa` / `jan/2026`) + uma por métrica:
`"SLA Operacional (%)"`, `"SLA Cliente (%)"` com `+(v*100).toFixed(1)` ou vazio; `"CT-e emitidos"`.

### 1.12 Cards e tabela (cliente)

Limiares: `meta = sla_meta_pct/100` (95 → 0.95), `warn = sla_alerta_amarelo_pct/100` (0.90).
`statusFor(p) = p >= meta ? bom : p >= warn ? alerta : ruim`.

| Card | Valor | Detalhe |
| --- | --- | --- |
| SLA Operacional | `fmtPct(pont.totais.performance_pct)` ou "—" | barra de 4 segmentos No prazo / Fora do prazo / Excluído (resp. cliente/parceiro) / Ainda sem confirmação do SSW, % de cada sobre a soma dos 4 (vírgula, 1 casa); sem pct: "Todos os CTRCs no período são responsabilidade do cliente" (excluido = total > 0), "Aguardando dados de pontualidade do BI2" (sem_info > 0), "Sem CTRCs no período" (total 0), "Aguardando dados do BI2" |
| Nascidos em atraso | `fmtPct(nascidos_pct)`; neutro | `"${atraso} de ${avaliados} CTRCs chegaram com prazo menor que o padrão"` + `" · ${total − avaliados} fora da conta (TROCA ou sem previsão)"` se > 0; clique só se pct != null e atraso > 0 → `nascido_em_atraso` |
| OTIF | §1.7 | `"${problemas} de ${total} CTRCs tiveram algum problema no percurso — quanto menor, melhor"`; clique se problemas > 0 → `otif` |
| Taxa de retorno | `fmtPct(taxa_retorno)` | status: meta nula → bom; `taxa <= meta` bom; `<= meta+0.01` alerta; senão ruim. Badge "acima" se `meta != null && taxa > meta`, "ok" se meta != null. Sub `"meta ≤ ${fmtPct(meta)}"` ou "sem meta definida" + `" · base: ${concluidos} CT-e concluídos"` |
| Em Atraso | `ctrcs_em_atraso` | sub-blocos `nomeCurto` = `em_atraso_fr`, "Aguardando cliente/parceiro" = `em_atraso_cliente` (só se em_atraso > 0); rodapé `"CT-e em aberto com prazo vencido · de ${ctrcs_em_aberto} em aberto"` + `" · ${sem_prazo} sem prazo definido"`; badge `"+${ocorrencias_pendentes} pendentes"` → /admin/codigos |

Linha de Produção (bloco §1.5; `pctProd = total > 0 ? entregues/total*100 : null`):
CT-e Emitidos (`total_ctrcs`, "total no período"); Entregues (`"${fmtPctBloco(pctProd)} dos emitidos"`
ou "sem emissões"); No Prazo (`no_prazo`, sub `no_prazo/entregues*100` "dos entregues" ou
"aguardando entregas"; bom se ≥ meta×100 — **[peculiaridade]** numerador da pontualidade e
denominador da produção, pode passar de 100%); Fora do Prazo ("exclui resp. cliente", vermelho se
> 0); Finalizado em Sistema (`fin/total*100` "dos emitidos"); % Produção (`"entregues / emitidos ·
meta ${meta×100}%"`); TDE (§1.6). Clique → recortes `emitidos, entregues, no_prazo, fora_prazo,
finalizado_sistema, entregues (% Produção), tde_aguardando`.

Verificação da partição: `soma = entregues + finalizado_sistema + previstos`; texto "partição fecha
100%" se `soma === total_ctrcs`, senão `"diferença de ${|soma − total|} CTRC."`.

Tabela "Performance por unidade" (linhas = `resumo.por_unidade`): ordena pelo `performance_pct`
da pontualidade da sigla — `ordem=pior` ASC, `melhor` DESC; siglas sem pontualidade no fim, por
sigla; empates mantêm a ordem do resumo (sort estável). Colunas: sigla, `"${total} CTRCs · ${n}
penalizado(s) em aberto"` (clicável se n > 0 → `penalizados_abertos` da sigla; "· agir agora" se
status ruim), barra, SLA Op. `fmtPct(pct)`, Nasc. atraso `fmtPct(nascidos_pct)`; linha inteira →
`emitidos` da sigla. Exportação `performance-por-unidade` (`ExportTabela`): Unidade destino, Total
CTRCs, Concluídos, Penalizados em aberto, Penalizados concluídos, `"SLA Op. (%)"`,
`"Nascidos em atraso (%)"` — **[peculiaridade]** as duas últimas saem como **fração** (0.9573),
não %.

Banner "N ocorrências precisam de classificação" quando `ocorrencias_pendentes > 0` → /admin/codigos.

### 1.13 Navegação para a Listagem (consistência card ↔ lista)

origem: `goToLista`. Leva para `/performance/lista` com: `tipo`, `codigo`, `status_previsto`,
`faixa_prev`, `ignorar_periodo ("1")`, `busca`, `ctrc`, `nf`, `periodo`, `base` (alertas e
Previstos forçam `emissao`), `de`, `ate`, `unidades` (substituível), `filiais`, `parceiros`,
`remetente`, `destino`, `codigos` (inteiros do filtro; substituível), `tipos`, `abertos ("1")`.
Previstos: status → `previstos_por_status` + `status_previsto`; faixa → `previstos_por_faixa` +
`faixa_prev`; total → `previstos_por_status` sem status.

**[peculiaridade]** a lista descarta `unidades` que não sejam sigla própria (uuid some) e compara
códigos pela **situação** (§3.2), enquanto os cards comparam pelo código efetivo: os totais podem
divergir com esses filtros.

---

## 2. Relatório de período (painel dentro da Performance)

origem: `RelatorioPeriodoPanel.tsx`, `performance-relatorio.functions.ts` (`getRelatorioSemanal`),
`performance-relatorio.server.ts` (`computeSnapshot`), `relatorio-semanal-export.ts`.

### 2.1 Entrada

Período **próprio** do painel (padrão "Hoje"; mesmos atalhos da §0.7), comparativo opcional
(`compare_inicio`, `compare_fim`) e os filtros herdados da tela (FP completo, com a base da tela).
Configuração: `sla_meta_pct` (95) e `taxa_retorno_meta_pct` (3) → `thresholds`. Nomes dos
pagadores (para os rótulos de filtro) só são buscados se há filtro de parceiros (§4.4).

### 2.2 Snapshot (período principal e, se houver, o comparativo)

```ts
bloco = montarBloco(relatorio_bloco_agregados(FP), calcular_performance(FP), pontualidade(FP))  // §1.5
penalizantes = { ocorrencias: resumo.totais.ocorrencias_penalizantes,
                 ctrcs_afetados: resumo.totais.ctrcs_penalizados }

// Impacto por código (performance_impacto_codigos): FP sem códigos, com base e tipos; escopo E0.
//   base_imp = {c ∈ B | !(c.responsabilidade_cliente ?? false)}
//   codigo = c.ultima_ocorr_codigo_0013 (texto do BI2 0013 — NÃO é a ocorrência efetiva), '' → null
//   penalizante(c) = (c.no_prazo ?? false) === false && (c.no_prazo === false || (atrasoListaDias(c) ?? 0) > 0)
//   total_periodo = |base_imp|
//   rows: só códigos só-dígitos (/^\d+$/): {codigo (texto), descricao: catálogo(int)?.descricao,
//          penaliza: catálogo?.penaliza ?? false, total_ctrcs, total_penalizantes}
//          ordem: penaliza DESC, total_penalizantes DESC, total_ctrcs DESC (desempate: codigo ASC)
impacto = rows.filter(r => !codigosFiltro || codigosFiltro.includes(r.codigo))   // comparação de TEXTO
impacto_base_com_ocorrencia = Σ impacto.total_ctrcs
r.pct_do_total = base > 0 ? r.total_ctrcs / base * 100 : 0
// falha da chamada → impacto = [], total 0 (só log)

// Produção por unidade (relatorio_producao_por_unidade): FP SEM tipos ([peculiaridade]), escopo E0,
//   por siglaResp: { sigla, emitidos: #B, entregues: #entregue(c) } ordem sigla. Falha → mapa vazio.

por_unidade = (siglas de resumo.por_unidade ∪ siglas de pont.por_unidade).map(sig => ({
  sigla: sig, cidade: null, uf: null,
  total: resumo.por_unidade[sig]?.total ?? 0,
  entregues: producao[sig]?.entregues ?? 0,
  producao_pct: emitidos > 0 ? entregues / emitidos * 100 : null,  // emitidos = producao[sig]?.emitidos ?? total
  sla_operacional_pct: resumo.por_unidade[sig] ? performance * 100 : null,
  sla_pontualidade_pct: pont.por_unidade[sig]?.performance_pct != null ? pct * 100 : null,
})).filter(r => r.total > 0)
   .sort((a, b) => (a.sla_operacional_pct ?? Infinity) - (b.sla_operacional_pct ?? Infinity)
                   || a.sigla.localeCompare(b.sigla));

finalizado_por_codigo = performance_finalizado_sistema_breakdown(FP).rows   // abaixo
previstos_todos   = previstos(FP, ignorar_periodo = true,  inicio = fim = null)   // §1.8
previstos_periodo = previstos(FP, ignorar_periodo = false)
```

`performance_finalizado_sistema_breakdown`: FP completo, escopo E0; `{c ∈ B | finalizadoSemEntrega(c)}`
agrupado por `parseInt(ocorr_efetiva_codigo)` → `{codigo, descricao: catálogo?.descricao, qtd}`
por `qtd DESC` (desempate codigo ASC); `total = Σ qtd`.

Saída: `{ periodo, atual: bloco, por_unidade, impacto_codigos, impacto_total_periodo,
impacto_base_com_ocorrencia, penalizantes, finalizado_por_codigo, previstos_todos,
previstos_periodo, comparativo?: {mesma forma + periodo}, filtros_aplicados (com rótulos),
thresholds: {sla_meta_pct, taxa_retorno_meta_pct} }`.

### 2.3 Derivados e comparativo (cliente)

```ts
totalPrazo = no_prazo + fora_prazo
pctNoPrazo        = totalPrazo > 0 ? no_prazo / totalPrazo * 100 : null
pctPenalizadoPont = total_ctrcs > 0 ? fora_prazo / total_ctrcs * 100 : null    // exibido como "% Penalizado Op."
pctPenalizadoOp   = sla_operacional_pct != null ? 100 − sla_operacional_pct : null // exibido como "% Penalizado Pont."
pctProducao       = total_ctrcs > 0 ? entregues / total_ctrcs * 100 : null
deltaPP(a, c, maiorMelhor)    : nulo se algum nulo; |a−c| < 0.05 → "0,0 pp" neutro; senão "▲|▼ x,x pp"
deltaPctAbs(a, c, maiorMelhor): c = 0 → a = 0 ? "0,0%" : (a > 0 ? "▲ n/a" : "▼ n/a"), neutros;
                                senão d = (a−c)/|c|*100; |d| < 0.05 → "0,0%"; senão "▲|▼ x,x%"
tom: bom se (subiu e maiorMelhor) ou (desceu e !maiorMelhor)
```

**[peculiaridade] escala errada**: `bloco.sla_pontualidade_pct` e `bloco.sla_cliente_pct` são
**frações** (0,9573), mas o painel, o CSV, o Excel e a impressão os tratam como % — o card "SLA
Operacional" do relatório mostra `"1,0%"` em vez de `"95,7%"`, e o tom "bom" (`>= 95`) nunca
acende. As linhas **por unidade** estão certas (×100). Ver §12, dúvida 1.

Cards do painel e da impressão (`fmtPct(v) = v.toFixed(1)` com vírgula + "%"; `fmtBRL` com
centavos). Produção: "CT-e emitidos" ("Total no período", delta abs), "Entregues" (`"de N
emitidos"`), "% Produção" (`"e / t"`, delta pp). Qualidade: "% No prazo" (`"n de totalPrazo"`,
bom se `>= meta`), "% Penalizado Pont." (= `pctPenalizadoOp`, "ocorrências penalizantes", ruim se
`> 100 − meta`), "% Penalizado Op." (= `pctPenalizadoPont`, `"N fora do prazo"`, ruim se
`> 100 − meta`), "SLA de Pontualidade" (= `sla_operacional_pct`, `"meta 95,0%"`, bom `>= meta`,
ruim `< meta − 5`), "SLA Cliente" ("Universo separado (responsabilidade do cliente)"), "SLA
Operacional" (= `sla_pontualidade_pct`, bom `>= meta`), "Prejuízo" (`fmtBRL(perdido)`, sub
`"${prejuizoSubtitulo} · ${pct} de ${fmtBRL(total)} (romaneados)"`, delta abs, menor é melhor).
`prejuizoSubtitulo(codigos)` = sem códigos → `"código 13"`; senão `"códigos a, b"`.
Previstos: "Total previstos" ("CTRCs ainda não entregues"), "Peso total (kg)" (0 casas), "Frete
total"; tabelas por status e por faixa com a chave crua (`agendamento`, `d1`...), Qtd e Frete.
Impacto: top 30 na impressão, top 20 na tela; descrição em vermelho se `penaliza`.

### 2.4 Exportações do relatório

**CSV** (`relatorio-periodo-${inicio}_${fim}.csv`; `;`; BOM; `\n`; célula entre aspas se contém
`"`, `;`, `,` ou quebra; porcentagem `toFixed(2)` com vírgula, nulo → vazio):

```
# Relatório de período · ${inicio} → ${fim}
# Comparativo · ${ci} → ${cf}                 (se houver)
# Filtros herdados: Rótulo=valor | ...         (se houver)

# Indicadores globais
Indicador;Valor
  CT-e emitidos; Entregues; Finalizado em Sistema; % Produção; No prazo; Fora do prazo;
  SLA de Pontualidade (=sla_operacional_pct); SLA Operacional (=sla_pontualidade_pct, fração);
  SLA Cliente (fração); Taxa de retorno; Penalizantes (ocorrências); Penalizantes (CTRCs afetados);
  Prejuízo (R$) — ${prejuizoSubtitulo} (toFixed(2) vírgula); Prejuízo (%)

# Previstos (Todos em aberto | Emitidos no período)   (modo do painel, padrão "todos")
Eixo;Chave;Qtd;Peso (kg);Volumes;Frete (R$)       linhas "Status;<key>..." e depois "Vencimento;<key>..."

# Finalizado em Sistema por código                 (só se houver linhas)
Código;Descrição;Qtd                               descrição nula → "—"

# SLA por unidade
Unidade;Cidade;UF;Emitidos;Entregues;% Produção;SLA Pont. (%);SLA Op. (%)
  com comparativo: Emitidos (P);Emitidos (C);Entregues (P);Entregues (C);% Produção (P);% Produção (C);
                   SLA Pont. (P);SLA Pont. (C);SLA Op. (P);SLA Op. (C)
  Emitidos = total do resumo; SLA Pont. = sla_operacional_pct; SLA Op. = sla_pontualidade_pct
```

**Excel** (`baixarExcelFr`; arquivo `relatorio-periodo-${inicio}-${fim}`; título "Relatório de
período"; subtítulo `"Período: dd/mm/aaaa a dd/mm/aaaa"` + `" · comparativo: ... a ..."`). Abas:

1. "Resumo" — notas "Filtros aplicados:" + `• Unidades: ...`, `• Parceiros: ...`,
   `• Remetente: ...`, `• Destino: ...`, `• Filiais: ...`, `• Códigos: ...`; tabela
   `Indicador | Valor` (comparativo: `Indicador | Período principal | Período comparativo`) com,
   nesta ordem: CT-e emitidos, Entregues, Finalizado em Sistema, % Produção (entregues/emitidos),
   No prazo, Fora do prazo, % No prazo, % Penalizado Pontualidade (= pctPenalizadoOp), %
   Penalizado Operacional (= pctPenalizadoPont), Pendentes de prazo, Sem prazo definido, SLA de
   Pontualidade, SLA Operacional, SLA Cliente, SLA Cliente — no prazo, SLA Cliente — fora do
   prazo, SLA Cliente — total (universo), Taxa de retorno (código 13), Valor de frete romaneado
   (BRL), Prejuízo (R$) — ${subtítulo}, Prejuízo (% dos romaneados), Penalizantes — ocorrências,
   Penalizantes — CTRCs afetados. Porcentagens como texto `"x,x%"` / `"—"`.
2. "SLA por unidade" — `Unidade | Cidade/UF | Emitidos | Entregues | % Produção | SLA de
   Pontualidade | SLA Operacional | Status` (comparativo: pares P/C e `Status (P)`); `Status` pelo
   `sla_operacional_pct`: `>= meta` "Verde", `>= meta − 5` "Amarelo", senão "Vermelho", nulo "—".
3. "Previstos (todos)" — título "Previstos — Todos em aberto"; `Eixo | Chave | Qtd | Peso (kg) |
   Volumes | Frete (R$)` com números crus.
4. "Previstos (período)" — "Previstos — Emitidos no período".
5. "Finalizado em Sistema" — `Código | Descrição | Qtd` (só se houver linhas).
6. "Impacto por código" — `Código | Descrição | CTRCs | % total` (comparativo P/C) (só se houver).

**Imprimir**: HTML A4 retrato, margem 15 mm, cabeçalho FR (`cabecalhoHtmlFr`), título
`"Relatório de período — ${periodoLabel}"`; seções Produção, Qualidade, Previstos, SLA por unidade
("Sem unidades com movimento no período." quando vazio), Finalizado em Sistema por código, Impacto
por código de última ocorrência (`"base: N CTRCs"`, top 30).

---

## 3. Listagem detalhada (`/performance/lista`)

origem: `_lista_ctrcs_detalhado_filtro`, `listar_ctrcs_detalhado`,
`listar_ctrcs_detalhado_agregado_por_*`, `lista.functions.ts`, `performance.lista.tsx`, `lista/*`.
Memória "Filtro único da Listagem detalhada": todo recorte entra só no filtro único; as 5
consultas (lista + 4 agregados) usam **o mesmo** predicado — no novo, uma função TS que monta o
`WHERE`, chamada pelas 5 consultas.

### 3.1 URL e entrada

Busca: `tipo` (recorte principal, padrão `emitidos`), `recortes[]` (extras), `codigo` (para
`por_codigo`), `faixa_min`, `faixa_max`, `status_previsto`, `faixa_prev`, `ignorar_periodo
("1")`, `periodo`, `de`, `ate`, `unidades[]`, `filiais[]`, `parceiros[]`, `remetente`, `destino`,
`busca`, `ctrc`, `nf`, `codigos[]` (inteiros), `tipos[]`, `cidade`, `peso_min`, `peso_max`,
`atraso_min`, `atraso_max`, `sort ∈ {atraso, emissao, prev, entrega}` (padrão `emissao`),
`dir ∈ {asc, desc}` (padrão `desc`), `page` (1…), `base`, `abertos ("1")`.

Servidor (zod): `page_size` ≤ 20000, padrão 100; `unidades` e `filiais` passam por
`filiaisProprias.filtrar` (só siglas próprias; **uuid é descartado**); recortes =
`recortesSelecionados(tipo, recortes)` = os válidos de `TIPOS_RECORTE`, sem duplicar, **na ordem
de `TIPOS_RECORTE`**, unidos por `","`.

`TIPOS_RECORTE` (30): `emitidos, em_atraso, em_atraso_fr, em_atraso_cliente, ocorr_entregues,
ocorr_baixados, ocorr_abertos, ocorr_em_atraso, entregues, no_prazo, fora_prazo, atrasados,
sem_movimento, penalizados_abertos, penalizados, por_codigo, por_faixa_atraso, sla_fr,
sla_cliente, finalizado_sistema, previstos_por_status, previstos_por_faixa, vencimento_proximo,
ocorrencia_13_multipla, otif, tde_aguardando, ocorrencia_13, nascido_atrasado,
nascido_em_atraso, sem_atualizacao`.

### 3.2 Filtro único `L(recortes)`

Escopo **E1**; exige sessão. Base: `ctrcs c` com `co = catálogo(parseInt(c.ocorr_efetiva_codigo))`.

```ts
semPeriodo = ignorar_periodo || busca?.trim() || ctrc?.trim() || nf?.trim()
L(c) = U(c) && E1(u, c)
  && (semPeriodo || ((inicio == null || c[colunaData] >= inicio) && (fim == null || c[colunaData] <= fim)))
  && (!unidades?.length  || unidades.includes(siglaResp(c)))     // aqui "unidades" são SIGLAS
  && (!filiais?.length   || filiais.includes(siglaResp(c)))
  && (!parceiros?.length || parceiros.includes(digitos(c.pagador_cnpj)))
  && (!remetente?.trim() || textoCasaFiltro(c.remetente, remetente))
  && (!destino?.trim()   || textoCasaFiltro(c.cidade_destino, destino))
  && (!cidade?.trim()    || textoCasaFiltro(c.cidade_destino, cidade))
  && (!codigos?.length   || codigos.includes(codigoSituacao(c, co?.tipo_ssw)))  // SITUAÇÃO, não efetivo
  && (peso_min == null || c.peso >= peso_min) && (peso_max == null || c.peso <= peso_max)
  && (atraso_min == null || atrasoListaDias(c) >= atraso_min)
  && (atraso_max == null || atrasoListaDias(c) <= atraso_max)     // atraso nulo nunca casa
  && (!ctrc?.trim()  || normCtrc(c.numero_ctrc) === normBusca(ctrc))
  && (!nf?.trim()    || ltrim0(String(c.numero_nf ?? 0)) === ltrim0(digitos(nf)))
  && (!busca?.trim() || normCtrc(c.numero_ctrc) === normBusca(busca)
                     || ltrim0(String(c.numero_nf ?? 0)) === normBusca(busca))
  && (!tipos?.length || tipos.map(upper).includes(tipoDocumentoEfetivo(c) ?? "__SEM_TIPO__"))
  && combinaRecortes(c, recortes);

ltrim0(s)    = s.replace(/^0+/, "")
normCtrc(n)  = ltrim0(digitos(n))
normBusca(x) = ltrim0(digitos(upper(trim(x)).replace(/^[A-Z]+/, "").split("-")[0]))
// "ARA000123-4" → "123"; "000123" → "123"; "ARA-123" → "" ([peculiaridade]: casa só número vazio)
// nf "0" → "" e casa CT-e com numero_nf NULO ([peculiaridade])
combinaRecortes: ps = recortes.split(",").map(trim), distintos, sem "", sem "emitidos" e sem desconhecidos;
                 ps.length === 0 → true; senão ps.some(p => predicado[p](c))   // OU entre recortes
```

### 3.3 Predicados dos recortes

Abreviações: `ent`, `fin` como §1.5 (fin com `nc <> 1`); `aberto = !ent && !fin`;
`prev = data_prevista_entrega`; `atraso = atrasoListaDias(c)`;
`diaRef = diaSp(c.ocorr_efetiva_data) ?? c.data_emissao`;
`TELA = PENAL − csv(config 'ocorrencias_codigos_fora_da_tela')`;
`respF = !(c.responsabilidade_cliente ?? false)` (nulo conta como "não é do cliente"; SQL
`COALESCE(responsabilidade_cliente, false) = false`); `respC = c.responsabilidade_cliente ?? false`.

| Recorte | Predicado |
| --- | --- |
| `emitidos` | sem restrição |
| `em_atraso` | `aberto && prev != null && prev < hojeSp` |
| `em_atraso_fr` | `em_atraso && respF` |
| `em_atraso_cliente` | `em_atraso && respC` |
| `ocorr_entregues` | `∃o ∈ ocs: o.codigo ∈ TELA` `&& ent` |
| `ocorr_baixados` | idem `&& !ent && fin` |
| `ocorr_abertos` | idem `&& aberto` |
| `ocorr_em_atraso` | idem `&& aberto && prev < hojeSp` |
| `entregues` | `ent` |
| `no_prazo` | `no_prazo === true` |
| `fora_prazo` | `no_prazo === false && respF` |
| `atrasados` | `aberto && atraso > 0 && respF` |
| `sem_movimento` | `aberto && respF && atraso > N && hojeSp − diaRef > N`, `N = config alerta_dias_sem_movimento ?? 3` |
| `penalizados_abertos` | `aberto && ∃o: o.penaliza && o.responsavel <> 'cliente' && o.codigo ∈ PENAL` |
| `penalizados` | `∃o: o.penaliza && o.responsavel <> 'cliente' && o.codigo ∈ PENAL` |
| `por_codigo` | `parseInt(c.ocorr_efetiva_codigo) === codigo` |
| `por_faixa_atraso` | `atraso != null && (faixa_min ?? 0) <= atraso <= (faixa_max ?? 2147483647)` |
| `sla_fr` | `respF && no_prazo != null` |
| `sla_cliente` | `respC && no_prazo != null` |
| `finalizado_sistema` | `fin` |
| `previstos_por_status` | `aberto && (status_previsto == null \|\| status(cod, co.tipo_ssw) === status_previsto)` (§1.8) |
| `previstos_por_faixa` | `aberto && (faixa_prev == null \|\| faixa(prev) === faixa_prev)` (§1.8, `hojeUtc`) |
| `vencimento_proximo` | `aberto && respF && prev != null && hojeSp <= prev <= diaSp(agora + max(vencendo_horas ?? 48, 1) h)` |
| `ocorrencia_13_multipla` | `aberto && #ocorrências 13 >= 2` |
| `otif` | `∃o: catálogo(o.codigo).tipo_ssw ∈ PENDENCIA && o.codigo <> 85` |
| `tde_aguardando` | `(tde ?? 0) > 0 && aberto && (travado(c) \|\| !(n(ocorr_efetiva_codigo) = 85 \|\| n(ultima_ocorr_codigo_0013) = 85 \|\| n(ult_ocorr_codigo_0174) = 85))`; `n` tira zeros à esquerda |
| `ocorrencia_13` | `∃o: o.codigo = 13` |
| `nascido_atrasado` | `prev != null && min(diaSp(o.data_hora) \| o.codigo = 85) > prev` (inclui encerrados; a tela filtra abertos com `abertos=1`) |
| `nascido_em_atraso` | `prev < prazo_padrao_data` (nulo não casa) |
| `sem_atualizacao` | `aberto && respF && hojeSp − diaRef >= max(dias_sem_atualizacao ?? 5, 1)` |

> Todos os recortes tratam `responsabilidade_cliente` nulo como FR (conferido no SQL).

`travado(c)` (origem `_ctrc_travado`) = `!emRota(c) && max(o.data_hora | catálogo PENDENCIA, o.codigo ≠ 85) >= (max(o.data_hora | o.codigo = 85) ?? −∞)`; sem pendência → falso.
`emRota(c)` (origem `_romaneio_em_rota`) = `n(efetivo) = 85 && (existe 85 com !quarentena && o.data_hora >= 00:00 UTC do dia de emissão && o.created_at >= c.created_at)`; sem nenhuma ocorrência 85 → `true` (o `COALESCE(bool_or, true)`).

### 3.4 Lista (`listar_ctrcs_detalhado`)

| Campo | Origem |
| --- | --- |
| `id`, `sigla_ctrc`, `numero_ctrc`, `destinatario`, `cidade_destino`, `bairro_destino`, `setor`, `setor_destino`, `data_emissao`, `data_prevista_entrega`, `data_embarque`, `parceiro_nome`, `pagador_nome`, `remetente`, `peso`, `valor_frete`, `volumes`, `numero_nf` (bigint), `primeiro_manifesto`, `ultimo_manifesto`, `valor_mercadoria`, `performance_dias`, `no_prazo`, `responsabilidade_cliente`, `tde` | coluna do CT-e |
| `unidade_destino_resolvida` | `siglaResp(c)` |
| `ultima_ocorr_codigo` | `parseInt(ocorr_efetiva_codigo)` |
| `ultima_ocorr_descricao` | `ocorr_efetiva_descricao` não vazia `?? co.descricao` |
| `ultima_ocorr_data` | `ocorr_efetiva_data` |
| `placa` | se `ocorr_efetiva_codigo === "85"` (texto exato) → placa da projeção romaneio×CT-e por `(numero_ctrc, empresa)` (hoje `mv_romaneio_ctrc_motorista`: placa do 036, senão do 306 — domínio romaneio); senão `null` |
| `data_entrega_realizada` | **data UTC** de `data_entrega_realizada` — **[peculiaridade]** entrega 22:00 SP aparece no dia seguinte |
| `tipo_documento` | `tipoDocumentoEfetivo(c)` (pode ser null) |
| `localizacao_atual` | `localizacao_atual` não vazia `?? ocorr_efetiva_local` não vazia `?? null` |
| `atraso_dias` | `atrasoListaDias(c)` inteiro |
| `total_count` | total de `L` (janela) |

Ordem: `chave = {atraso: atraso, prev: data_prevista_entrega, entrega: data_entrega_realizada,
emissao: data_emissao}[sort]`; `ORDER BY chave ASC|DESC NULLS LAST, data_emissao DESC,
numero_ctrc ASC`; caso `emissao`+`desc`: `data_emissao DESC, numero_ctrc ASC`.
`LIMIT max(limit, 1) OFFSET max(offset, 0)`, `offset = (page − 1) × page_size`.

`total = linhas[0]?.total_count ?? 0` — **[peculiaridade]** página além do fim mostra total 0
(§12, dúvida 12).

### 3.5 Agregados (mesmo `L`)

- **por código** (`top` padrão 10): agrupa por `cod = codigoSituacao(c)` não nulo →
  `{codigo, descricao, qtd}`; `descricao = max(ocorr_efetiva_descricao das linhas cujo
  parseInt(efetivo) = cod) ?? catálogo(cod).descricao`; `ORDER qtd DESC LIMIT max(top, 1)`
  (desempate determinístico: codigo ASC).
- **por unidade**: `siglaResp` → `{unidade, qtd}` por `qtd DESC`; o TS descarta sigla nula.
- **por cidade destino** (top 10): `trim(cidade_destino)` não vazio → `{cidade, qtd}` qtd DESC.
- **por faixa de atraso** (só `atraso > 0`), ordem fixa: `≤3 "Até 3 dias" [1,3]`,
  `≤5 "4–5 dias" [4,5]`, `≤8 "6–8 dias" [6,8]`, `≤15 "9–15 dias" [9,15]`, `≤30 "16–30 dias"
  [16,30]`, senão `"+30 dias" [31, null]` → `{faixa, ordem, min, max, qtd}`. Só é pedido se os
  recortes incluem `atrasados`, `fora_prazo`, `por_faixa_atraso`, `previstos_por_faixa`,
  `sem_movimento` ou `ocorr_em_atraso` (senão `[]`).

`listarCtrcsDetalhado` devolve `{rows, total, porCodigo, porUnidade, porFaixa, porCidade}`.

### 3.6 Códigos do recorte e "abertos"

`listarCodigosDoRecorte`: agregado por código do mesmo filtro **sem** `codigos`, top 500, com
`tipo_ssw` e `penaliza` do catálogo. O seletor da lista (`OcorrenciaRecortePicker`) agrupa em "Em
aberto" (nem entrega nem baixa), "Pendência do cliente", "Pendência da FR", "Penalizam".

Fluxo `abertos=1` (vindo dos alertas): a tela pede os códigos do recorte e usa como `codigos` só os
**em aberto**: `codigoEmAbertoNoRecorte(tipo, c)` = para `nascido_atrasado`, `c ∉ {1,12,36,59,61,
77,92,93,94,99}`; para os demais, `c ∉ CODIGOS_ENTREGA ∪ CODIGOS_BAIXA`. Sem código em aberto →
lista vazia.

### 3.7 Tela

Título: rótulos dos recortes (`TIPO_LABEL` em `performance.lista.tsx`, copiar) unidos por
`" + "`, mais `" · Todos em aberto"` quando `ignorar_periodo` com `previstos_*`,
`vencimento_proximo` ou `sem_atualizacao`. Gráficos: Ocorrências, Distribuição por Unidade,
Cidades Destino, Dias de Atraso (**[peculiaridade]** aparece também para `nascido_atrasado`, mas o
servidor não pede a faixa → vazio). Clicar numa barra aplica o filtro (`codigos`, `unidades`,
`cidade`, ou `faixa_min/max` + recorte `por_faixa_atraso`). Paginação `"Página X de Y · N CTRCs"`,
100 por página.

Coluna Atraso (`CtrcsTable`): `null` → "—"; `> 0` → `"Atrasado N dia(s)"`; entregue → "No
prazo"; `0` → "Vence hoje"; negativo → "No prazo". NF é link para `/ctrc/$numero`; etiqueta TDE
no destinatário quando `tde > 0`.

### 3.8 Exportação da lista

`exportarListaCtrcsDetalhado`: mesmas entradas, páginas de 1000 até **20000 linhas** (corte
silencioso). Arquivo `listagem-ctrcs-${recortes.join("+")}-${inicio}-a-${fim}`. Colunas (28,
nesta ordem; origem `lista/lista-export.ts`):

`NF`, `CT-e` (numero_ctrc), `Cliente Destino`, `Origem` (sigla_ctrc), `Destino`
(unidade_destino_resolvida), `Cidade Destino`, `Setor` (`setor ?? setor_destino`), `Cód
Ocorrência`, `Tipo Ocorrência` (descrição), `Última Ocorrência` (data-hora curta pt-BR), `Placa`,
`Emissão`, `Prev. Entrega`, `Entrega Realizada` (dd/mm/aaaa), `Atraso (dias)`, `Pagador`,
`Expedidor` (parceiro_nome), `Remetente`, `Documento`, `Peso Real (kg)`, `Valor Frete (R$)`,
`Qtd Volume`, `Localização`, `1º Manifesto`, `Último Manifesto`, `Valor Mercadoria (R$)`,
`TDE (R$)` (só se `> 0`, senão vazio), `Link SSW` (§5.4; CSV leva a URL, Excel o texto "Abrir no
SSW", impressão "SSW").

CSV via `baixarCsv` (`;`, BOM, aspas se `"`/`;`/`,`/quebra); Excel via `baixarExcelFr` (aba
"CTRCs", subtítulo do período + `" · N registros"`); Imprimir A4 retrato escondendo as colunas de
índice 4, 16, 18, 22, 23, 24 (Destino, Expedidor, Documento, Localização, 1º e Último Manifesto).

---

## 4. Filtros compartilhados

Só sessão; escopo **E0** (exceto onde dito). Usados pela Performance, Lista e outras telas.

### 4.1 `listar_filiais_ctrcs`

Filiais distintas não vazias de **todos** os CT-e da empresa (sem universo, sem período), ordem
alfabética. Só é usado como **fallback** de 4.2 quando ele falha.

### 4.2 Opções de "Unidade responsável" — `unidades_disponiveis_ctrcs`

`DISTINCT siglaResp(c)` não nula/vazia dos CT-e da empresa com `inicio <= data_emissao <= fim`,
parceiros, remetente, destino ("a|b") e `codigos` (comparados como `String(codigoEfetivo)`);
**sem** universo nem `fora_universo`. Ordem sigla. O TS guarda só as siglas próprias, acrescenta
as já selecionadas e ordena por `localeCompare`. Junto vêm as opções do catálogo de códigos da
empresa.

### 4.3 Sugestões de texto — `sugestoes_texto_ctrcs`

`campo ∈ {remetente, cidade_destino}` (senão erro). `DISTINCT campo` não nulo/vazio, emissão no
período, `q.trim()` (vazio = sem filtro) com `ILIKE '%q%'`, demais filtros (o filtro de texto do
próprio campo é ignorado), filiais por `siglaResp`, códigos por texto; ordem alfabética; `limit` 20.
Sem universo. Sem período informado, o TS consulta direto `ctrcs` (`campo ILIKE %q%`, ordem asc,
200 linhas, sem duplicados, 20 primeiras; escopo E2).

### 4.4 Pagadores — `listar_pagadores_ctrcs`

Entrada `inicio, fim, unidades (texto), filiais, limite = 500, campo_data ∈ {emissao, embarque,
prevista, saida, conclusao}` (outro → erro). Período: `emissao` ou alguma data nula →
`data_emissao >= inicio` / `<= fim` (cada um só se informado); senão a regra de período do
romaneio (`_romaneio_filtro_periodo` — domínio romaneio). `unidades`: item não-uuid é sigla; uuid
→ `unidades.cidade` → `filial_alias` pela cidade normalizada (maiúsculas, sem acento) → sigla;
filtro `siglaResp ∈ siglas`. Universo U e `pagador_cnpj` não vazio. Agrupa por
`digitos(pagador_cnpj)` (≠ ''): `cnpj`, `cnpj_formatado = max(pagador_cnpj)`, `nome = moda(pagador_nome
não vazio ?? parceiro_nome ?? remetente)` (empate da moda → menor valor), `qtd`; ordem
`lower(nome) ASC, cnpj ASC`; `LIMIT limite`.

### 4.5 `tipos_documento_opcoes`

Exige sessão. CT-e da empresa com `NOT fora_universo` (sem filtro de filial), agrupados por
`tipoDocumentoEfetivo ?? "__SEM_TIPO__"` → `{tipo, qtd}` por `qtd DESC`. Falha → `[]`.

### 4.6 `tipos_documento_no_periodo` (Romaneio/Ocorrências)

Sem sessão → vazio. Por `campo`:

- `romaneio_dia`: pares distintos `(numCtrc, siglaCtrc)` das linhas do 036 com `data_emissao`
  no período, `ctrc` e `romaneio` não nulos, situação ≠ `CANCELADO` (nulo passa), número não
  nulo; LEFT JOIN CT-e por número e (sigla nula de um lado **ou** igual) — sem `fora_universo`.
- `saida`: CT-e distintos (texto) do 036 no período, não cancelados → pares com número → JOIN CT-e
  por número **e** `sigla_ctrc = sigla`, `NOT fora_universo`.
- demais: `NOT fora_universo` e coluna no intervalo: `emissao`, `embarque`, `prevista`;
  `conclusao` = `data_conclusao_efetiva`; `entrega` = **data UTC** de
  `data_entrega_realizada ?? ocorr_efetiva_data`.

`numCtrc(t) = String(BigInt(digitos(t.trim().split("-")[0])))`; `siglaCtrc(t)` = letras iniciais
em maiúsculas. Agrupa `tipoDocumentoEfetivo ?? "__SEM_TIPO__"` por qtd DESC. Falha → `null`.

### 4.7 Ordem no seletor de tipo

`ordenarTiposDocumento`: tipos com contagem > 0 por contagem DESC, depois os sem contagem (rótulo
de `__SEM_TIPO__` = "sem tipo").

---

## 5. Detalhe do CT-e (`/ctrc/$numero`)

origem: `ctrc.functions.ts` (`getCtrcByNumero`), `ctrc.$numero.tsx`, `ctrc_placa_atual`,
`CtrcPdfButton.tsx`, `src/lib/atraso.ts`, `src/lib/ssw.ts`. Só sessão; leitura com escopo **E2**.

### 5.1 Busca

`ctrcs` com `numero_ctrc = $numero` e `fora_universo = false` (sem filtro de filial), uma linha.
**[peculiaridade]** com 2 CT-e do mesmo número (siglas diferentes) a busca de uma linha falha →
"Falha ao carregar CTRC." (memória "Número de CTRC não é único"; §12, dúvida 8). Não achou → "não
encontrado". Junto: parceiro, unidade (cidade/UF), ocorrências, último `bi2_raw`.

### 5.2 Campos derivados

- **Ocorrências exibidas**: sem `quarentena`, sem as de dia SP anterior à emissão, ordem
  `data_hora DESC`.
- **Ocorrência efetiva**: `{codigo: codigoEfetivo, descricao: ocorr_efetiva_descricao ?? catálogo,
  data_hora: ocorr_efetiva_data}`.
- **Placa** (`ctrc_placa_atual(numero, sigla)`): linhas do 036 com `numCtrc(ctrc) = numero`,
  `romaneio` não nulo, situação ≠ CANCELADO (nulo passa), sigla igual se informada; a primeira por
  `data_ocorr_ctrc DESC NULLS LAST, hora_ocorr_ctrc DESC NULLS LAST, (situacao = 'BAIXADO') DESC,
  data_emissao DESC NULLS LAST, importado_em DESC` → `{placa: maiúsculas só [A-Z0-9], vazio →
  null; motorista; romaneio}`.
- **Localização**: `localizacao_atual` descartada se começa com `ROMANE`, `MANIFE` ou `SEGREG`;
  aí vale `ult_ocorr_instrucao_0174`.
- **Atraso** (`atrasoCtrcDias`): previsão nula → null; com entrega → `diaSp(entrega) − prev`;
  efetivo de entrega → `performance_dias`; efetivo de baixa → null; senão `hojeSp − prev`.
- **Finalização**: `entregue = data_entrega != null || efetivo ∈ ENTREGA`; `baixa = !entregue &&
  efetivo ∈ BAIXA ? {codigo, descricao} : null`.

### 5.3 Selos e textos

- Status: entregue → "Entregue"; baixa → `"Baixado sem entrega · ${pad2(codigo)} ${descricao}"`;
  sem status → "Sem status"; senão `status_atual`.
- Pontualidade: resp. cliente → "Responsabilidade cliente"; baixa com `no_prazo` nulo → "Baixado
  sem entrega — fora da pontualidade"; `true` → "No prazo"; `false` → "Fora do prazo"; senão sem
  entrega "Em trânsito — pontualidade não apurada", com entrega "Pontualidade em apuração"
  (tooltips em `PontualidadeBadge`, copiar).
- Status do prazo (`PrazoStatusBadge`, relógio e fuso do **navegador**): sem previsão → "Sem
  previsão"; sem ocorrência de entrega, sem data de entrega e (efetivo ou alguma ocorrência é
  baixa) → "Baixado sem entrega"; `entregaTs = 1ª ocorrência de entrega da lista (a mais recente)
  ?? data_entrega ?? (efetivo de entrega ? data efetiva : null)`; com entrega: `≤ prev 23:59:59
  local` → "Entregue no prazo", senão `"Entregue com ${max(1, ceil(Δ/1 dia))} dia(s) de atraso"`;
  sem entrega: `prev >= hoje local` → "No prazo", senão `"Atrasado ${dias} dia(s)"`.
- "Prazo mínimo (48h)": `prazo_padrao_data` → `"dd/mm/aaaa (emissão + 48 horas corridas)"`;
  `prazo_padrao_dias != null` → "não avaliado (previsão anterior à emissão)"; senão "não avaliado
  (TROCA)". Aviso "Nascido em atraso — emitido a menos de 48 horas da previsão de entrega (...); o
  mínimo seria .... O atraso é do parceiro, não da {nomeCurto}." quando `prev < prazo_padrao_data`.
- Performance: `performance_dias` → `"+N dias"` / `"N dia"` (singular se |N| = 1), nulo "—";
  Atraso: nulo ou 0 → "—", senão `"N dia(s)"`.
- Tooltip da previsão por `prazo_fonte` (`prazoFonteInfo`, copiar os textos).

### 5.4 Link SSW e PDF

`sswCtrcUrl(sigla, numero, emissao)` =
`https://sistema.ssw.inf.br/bin/ssw0053?act=P1&t_ser_ctrc=${encodeURIComponent(sigla)}&t_nro_ctrc=${digitos(numero).padStart(6,"0")}&t_data_ini=${ddmmaa}&t_data_fin=${ddmmaa}`
(sigla, número ou emissão faltando → sem link). PDF do CT-e (`criarPdfFr`): blocos do detalhe +
tabela de ocorrências; arquivo `ctrc-${nf ?? numero}-${dd-mm-aaaa}`.

---

## 6. Dashboard (`/dashboard`)

origem: `dashboard.functions.ts`, `routes/_authenticated/dashboard.tsx`, `vw_performance_dia`.
Módulo `performance`. **Fora do menu e das permissões**; o único link é "Voltar ao dashboard" da
página 404. Provável herança do Lovable — §12, dúvida 4: portar só se o dono confirmar.

Como é hoje (para paridade, se mantido):

- `dia` = data **UTC** do navegador (`toISOString().slice(0,10)`).
- `vw_performance_dia`: por `(data_emissao, unidade_id)`, `ctrcs LEFT JOIN ocorrencias` com
  `penaliza = true`: `total_ctrcs = count(*)` das linhas do join (**inflado** por CT-e com várias
  penalizantes), `ctrcs_com_penalizacao = count(distinct)`, `performance = 1 − distinct/count`.
  Sem universo (E2).
- Contagem de CT-e do dia via PostgREST (teto 1000); `retornos` = ocorrências código **90** (teto
  1000) — não é a regra do 13.
- Metas buscadas com `tipo_meta` `'performance'`/`'retorno'` (valores que **não existem** no enum)
  → sempre caem no padrão (meta SLA da configuração e 0,03).
- `statusOf(p, meta)`: `>= meta` bom, `>= meta − 0.03` alerta, senão ruim.
- Botões "Gerar dados demo" (admin; POST `/api/public/ssw-ingest` modo demo) e "Testar conexão
  SSW" (super admin). **Não portar** (escrevem dado falso / testam SSW pela tela).

---

## 7. Exportação da tela Performance (`ExportMenu`)

origem: `components/common/ExportMenu.tsx`, `features/shared/exportacao.functions.ts` (caminho da
tela Performance, não o de "em andamento"). Escopo **E2**; **sem universo** — **[peculiaridade]**.

Consulta: período por `data_emissao`; `unidade_id ∈ unidades` (uuids); `pagador_cnpj` casando as
variantes (dígitos ou formatado); `filial ∈ filiais` (coluna **crua** `filial`, não `siglaResp`);
tipos (`tipoDocumentoEfetivo`, `__SEM_TIPO__` = nulos); remetente/destino "a|b". Filtro de códigos
= CT-e com **qualquer** ocorrência desses códigos (até 20000 ocorrências). Ordem
`data_emissao DESC`, teto 10000 CT-e. Uma linha **por ocorrência** (CT-e sem ocorrência → uma
linha com as colunas de ocorrência vazias).

Colunas: `NF`, `CTRC`, `Data emissão`, `Unidade` (filial), `Remetente`, `Destinatário`, `Cidade
destino` (`cidade/UF`), `Peso (kg)`, `Volumes`, `Frete (R$)`, `Placa (romaneio)`, `Motorista`,
`Placa coleta`, `Placa entrega`, `CT-e vínculo`, `Romaneio`, `Código`, `Descrição`, `Data/hora
ocorrência`, `Status`, `Link SSW`. Linhas ordenadas por placa (`localeCompare` pt-BR, vazias no
fim, ordenação estável). Arquivo `performance-${periodoSlug}-${dd-mm-aaaa}`; título "Performance";
subtítulo `"Período: dd/mm/aaaa a dd/mm/aaaa · N registros"`. PDF: colunas 4 e 5 com largura 90,
coluna 14 com 110, fonte 7. CSV / Excel / PDF pelo `src/lib/exportacao` (identidade FR).

---

## 8. Consultas set-based e índices (sem função no banco)

Volume de referência: `ctrcs` ~252 mil linhas (1,6 GB), `ocorrencias` ~1,5 milhão (1,2 GB),
`staging_036` ~366 mil, catálogo 200 códigos.

### 8.1 Colunas derivadas gravadas na escrita

Calculadas pelo domínio ao gravar o CT-e (mesma transação), para indexar e não recalcular por
linha: `sigla_responsavel` (`siglaResp`), `codigo_efetivo int`, `pagador_cnpj_digitos`,
`tipo_documento_efetivo`, `numero_ctrc_norm` (`normCtrc`), `numero_nf_norm`
(`ltrim0(String(numero_nf ?? 0))`), `em_aberto bool` (depende do catálogo de baixas: um job
recalcula os CT-e afetados quando o catálogo muda), e por CT-e os agregados de ocorrência usados
em toda tela: `qtd_ocorr_13`, `tem_penalizante`, `qtd_penalizantes`, `qtd_ocorr_pendentes`,
`primeiro_dia_85_sp` — mantidos pelo caso de uso que grava ocorrência (e por job quando o catálogo
muda). Sem eles, cada tela agrega 1,5 milhão de ocorrências.

### 8.2 Forma da consulta

Uma CTE `base` só com os filtros preenchidos (SQL montado no backend com Drizzle `sql`, parâmetros
sempre ligados), depois `count(*) FILTER (WHERE ...)` e `GROUP BY` numa única passada:

```sql
WITH base AS (
  SELECT c.id, c.sigla_responsavel, c.em_aberto, c.no_prazo, c.responsabilidade_cliente, ...
  FROM erp.ctrcs c
  WHERE c.empresa_id = $1 AND NOT c.fora_universo
    AND c.sigla_responsavel = ANY($2)          -- filiais próprias ∩ filtro
    AND c.data_emissao BETWEEN $3 AND $4       -- só se houver período
    /* + só os filtros informados */
)
SELECT sigla_responsavel,
       count(*) AS total,
       count(*) FILTER (WHERE NOT coalesce(responsabilidade_cliente, false) AND no_prazo = false) AS fora_prazo
FROM base
GROUP BY ROLLUP (sigla_responsavel);          -- totais e por unidade na mesma passada
```

- Consulta **não preparada** (statement sem nome) para o planejador ver os valores reais
  (memória "RPC lia a ctrcs inteira": o plano genérico do PG17 ignorava o índice).
- Escrever `NOT fora_universo` sem `COALESCE`, para casar com o índice parcial.
- Resumo + por unidade juntos; pontualidade idem; os três (resumo, pontualidade, produção) podem
  sair da mesma `base`.
- Existência em ocorrências: `EXISTS (... WHERE o.ctrc_id = c.id AND o.codigo = 13)` só onde não
  houver coluna derivada.
- Texto "a|b": `ILIKE ANY($n)` — sem trigram (extensão proibida); barato depois do recorte por
  empresa + período.
- Lista: `ORDER BY ... LIMIT/OFFSET` com `count(*) OVER ()`; `sort=emissao desc` usa o índice
  `(empresa_id, data_emissao DESC, numero_ctrc)` sem ordenar.
- Alertas: uma passada sem período para os blocos de abertos (vencendo, sem atualização) pelo
  índice parcial de abertos; uma passada por emissão para os demais.

### 8.3 Índices recomendados (para o agente de schema)

| Tabela | Índice | Atende |
| --- | --- | --- |
| ctrcs | `(empresa_id, data_emissao) INCLUDE (sigla_responsavel, codigo_efetivo, no_prazo, responsabilidade_cliente, data_prevista_entrega, data_entrega_realizada) WHERE NOT fora_universo` | resumo, pontualidade, produção, série, alertas |
| ctrcs | `(empresa_id, data_prevista_entrega) WHERE NOT fora_universo` | base "prevista" |
| ctrcs | `(empresa_id, data_conclusao_efetiva) WHERE NOT fora_universo` | base "concluido" |
| ctrcs | `(empresa_id, data_prevista_entrega) WHERE em_aberto AND NOT fora_universo` | em atraso, vencendo, previstos |
| ctrcs | `(empresa_id, data_emissao) WHERE em_aberto AND NOT fora_universo` | sem atualização, previstos "todos" |
| ctrcs | `(empresa_id, data_emissao DESC, numero_ctrc) WHERE NOT fora_universo` | lista padrão |
| ctrcs | `(empresa_id, numero_ctrc_norm)`, `(empresa_id, numero_nf_norm)` | busca CTRC/NF |
| ctrcs | `(empresa_id, pagador_cnpj_digitos)` | filtro parceiro, pagadores |
| ctrcs | `(empresa_id, sigla_responsavel)` | opções de unidade |
| ctrcs | `(empresa_id, numero_ctrc)` | detalhe |
| ocorrencias | `(ctrc_id) INCLUDE (codigo, penaliza, responsavel, data_hora)` | agregados por CT-e |
| ocorrencias | `(ctrc_id, data_hora) WHERE codigo = 85` | nascido atrasado, travado |
| ocorrencias | `(ctrc_id) WHERE codigo = 13` | retorno, 13 múltipla |
| metas | `(empresa_id, tipo_meta, unidade_id)` | meta da taxa de retorno |
| romaneio 036 | `(empresa_id, numero_ctrc_num, sigla_ctrc)` | placa atual, tipos por romaneio |

---

## 9. Job — `calcular_sla_arquivos` (pontualidade pelos arquivos)

origem: `calcular_sla_arquivos(p_desde)`, cron `sla-pelos-arquivos` em `8,38 * * * *` (logo após
`ctrcs_unidade_pelo_455`). No novo: job BullMQ no mesmo horário, **por empresa** (hoje roda sem
filtro de empresa).

```ts
desde = max(date("2025-12-01"), p_desde ?? hojeSp − 60)
candidatos = ctrcs.filter(c => c.data_emissao >= desde && c.data_prevista_entrega != null
  && c.data_prevista_entrega >= c.data_emissao && c.data_entrega_realizada != null
  && c.campos_ssw.includes("data_entrega_realizada"))
para cada c:
  ent  = diaSp(c.data_entrega_realizada)
  perf = diasUteisSla(c.data_prevista_entrega, ent)          // núcleo
  pend = perf > 0 && ∃ ocorrência do CT-e (mesma empresa) com catálogo.tipo_ssw = 'PENDENCIA_CLIENTE'
  novo = { performance_dias: perf, no_prazo: perf <= 0, responsabilidade_cliente: perf > 0 && pend,
           fonte_performance: "ssw_arquivos" }
  se algum campo difere (IS DISTINCT FROM) ou falta alguma marca em campos_ssw:
    grava novo + campos_ssw = ordenado(distinct(campos_ssw ∪ {no_prazo, responsabilidade_cliente,
    performance_dias, fonte_performance})) + updated_at = agora, com fonte de escrita 'ssw'
retorno { desde, candidatos, alterados }
```

---

## 10. Código morto — "não portar"

Prova = busca em `src/` (branch `feat/multiempresa`), nas funções SQL (`banco/funcoes/*.sql`) e
nos crons.

| Item | Prova |
| --- | --- |
| `calcular_performance_unidade` | único chamador `getPerformanceUnidade` (`performance.functions.ts:240`), só reexportado em `features/performance/index.ts:3`; nenhum componente, função SQL ou cron chama |
| `performance_ocorrencias_penalizantes` | chamada só por `getPerformanceOcorrenciasPenalizantes`, usada só em `AlertaDetalheDrawer.tsx:105`; o drawer só é reexportado (`index.ts:45`) e nunca renderizado (o banner navega para a lista) |
| `_perf_codigos_norm`, `_perf_tipos_norm`, `_perf_coluna_data`, `_perf_filtro_ctrcs` | auxiliares SQL; viram o construtor de filtro FP em TS (§0.5), não funções |
| `calcular_performance` → `periodo_anterior`, `comparacao_anterior` (2ª consulta inteira) | nenhum leitor em `src/` |
| `performance_alertas` → `vermelhas` (CTE `pen`, `items` LIMIT 50) e `semAtualizacao.unidades` | o card "abaixo da meta" usa a pontualidade (`AlertsBanner.tsx`); `unidades` é sempre `[]`; `p_pagadores_estrategicos` só é ecoado |
| `getPerformance` → `feriados`, `anotacoes`, `parceiros: []` | devolvidos e nunca lidos |
| TS: `getPerformanceAlertaDetalhe`, `AlertaDetalheDrawer`, `RelatorioSemanalModal` + `exportRelatorioPdf`, `ImpactoCodigosPanel` + `getPerformanceImpactoCodigos`, `getPerformanceFinalizadoSistemaBreakdown` (o wrapper; a função SQL segue viva pelo relatório), `computeBloco` de `performance.functions.ts`, `listarPagadoresLista` | sem consumidor fora do próprio arquivo/barrel |
| Dashboard: botões "Gerar dados demo" e "Testar conexão SSW" | §6 |

Vivos (portar): `calcular_sla_arquivos` (cron), `performance_otif` (atrás da configuração),
`listar_filiais_ctrcs` (fallback), `tipos_documento_no_periodo` (Romaneio/Ocorrências),
`performance_impacto_codigos` e `relatorio_producao_por_unidade` (relatório), `ctrc_placa_atual`
(detalhe) e todas as da lista e dos filtros.

---

## 11. Casos de teste (exemplos numéricos)

`hojeSp = 2026-11-10` salvo indicação. Catálogo: BAIXA = {12,36,61,77,92,93,94,99}; PENAL ∋ {13, 20}.

**T1 — resumo (§1.3)**, 6 CT-e emitidos no período, todos `resp = false` exceto E:

| CT-e | efetivo | entrega | prev | ocorrências |
| --- | --- | --- | --- | --- |
| A | 1 | 2026-11-05 | 11-06 | — |
| B | 1 | 2026-11-06 | 11-04 | 20 (penaliza, resp FR) |
| C | 12 | — | 11-04 | 13 |
| D | 80 | — | 11-08 | 20 (penaliza, FR) |
| E (resp cliente) | 80 | — | 11-09 | — |
| F | null | — | null | — |

→ `total 6`, `concluidos 3 (A,B,C)`, `pen_concl 1 (B) → performance 0.6667 (2/3)`, `penalizados 2
(B,D)`, `total_retornos 1 → taxa_retorno 1/3`, `previstos 3 (D,E,F)`, `em_atraso 2 (D,E)`,
`em_atraso_fr 1`, `em_atraso_cliente 1`, `sem_prazo 1 (F)`; numa sigla só: `penalizados 1`,
`penalizados_abertos 1`.

**T2 — retorno acima de 100%**: 2 CT-e, 1 concluído, os 2 com ocorrência 13 → `taxa 2.0`.

**T3 — meta ponderada**: 100 CT-e na unidade X (meta 0,03) + 50 na Y (sem meta) → `0.02`; sem
nenhuma meta → `0`; sem CT-e → `null`; X com duas metas vigentes 0,03 e 0,05 →
`(100×0,03 + 100×0,05 + 50×0)/250 = 0.032`.

**T4 — pontualidade (§1.4)**: exemplo da seção (`0.8`, `0.0`, `0.125`); 2/3 → `0.6667`; 1/160 →
`0.0063`; total 0 → `null`. Decisão do SLA Op.: 24 350 emitidos, 1 040 fora → `0.9573`.

**T5 — frete romaneado**: CT-e de R$ 100 com duas 85 → `valor_frete_total = 200`; CT-e sem 85 com
13 (catálogo: FR, penaliza) → `perdido 100`, `pct_frete_perdido = null` (total 0).

**T6 — queda de SLA**: J = 7, fim 11-10: atual [11-04, 11-10] 20 com prazo, 18 ok → 90.0;
anterior [10-28, 11-03] 20, 19 ok → 95.0 → item `{queda_pp: 5.0}`. Anterior com 9 avaliados →
sem item.

**T7 — anomalia de finalizados**: atual 50 CT-e, 10 fin → 20.0; baseline 100 CT-e, 10 fin → 10.0
→ desvio 10.0; baseline com 39 CT-e → sem item.

**T8 — sem atualização e fuso**: `ocorr_efetiva_data = 2026-11-06T02:30Z` → dia SP 11-05 →
`hojeSp − 11-05 = 5` → entra com limite 5 (pelo dia UTC seriam 4 e não entraria).

**T9 — vencendo**: agora 2026-11-10 22:00 SP, H = 48 → `limVenc = 11-12`; prev 11-10 e 11-12
entram; 11-13 e 11-09 não.

**T10 — faixa de vencimento em UTC**: agora 2026-11-10 22:30 SP (= 11-11 01:30Z), prev 11-11 →
`hojeUtc = 11-11` → "hoje" (por SP seria "D+1").

**T11 — faixas de atraso**: 1 e 3 → "Até 3 dias"; 4 → "4–5 dias"; 30 → "16–30 dias"; 31 → "+30
dias"; 0 e null fora.

**T12 — busca CTRC/NF**: `"ARA000123-4"` casa `numero_ctrc "000123"`; `"123"` casa `"0123"`;
`"ARA-123"` não casa nada; nf `"00456"` casa `numero_nf 456`; nf `"0"` casa NF nula.

**T13 — texto "a|b"**: `"são paulo | campinas"` casa "SÃO PAULO - SP" e "Campinas"; `"sao"` não
casa "SÃO"; `"a||b"` casa tudo.

**T14 — código na lista × card**: CT-e com `data_entrega` preenchida e efetivo 80 (tipo
PRE_ENTREGA) → situação 1: entra na lista com `codigos=[1]`; não entra no card com `codigos=["1"]`.

**T15 — responsabilidade nula**: CT-e aberto, prev vencida, `atraso 3`, `resp = null` → entra em
`em_atraso_fr` e `atrasados`, não em `em_atraso_cliente`; no resumo conta em `em_atraso_fr`.

**T16 — combinação de recortes**: `tipo=entregues, recortes=[finalizado_sistema]` → `ent || fin`;
`tipo=emitidos, recortes=[entregues]` → só `ent` (emitidos é neutro).

**T17 — relatório por unidade**: resumo X (total 10, performance 0.9), pontualidade X 0.8, produção
X (emitidos 10, entregues 7) → `{total 10, entregues 7, producao_pct 70, sla_operacional_pct 90,
sla_pontualidade_pct 80}`; sigla só na pontualidade → removida (`total 0`).

**T18 — deltas**: `deltaPP(95.0, 95.04)` → "0,0 pp"; `deltaPP(90, 95, true)` → "▼ 5,0 pp" ruim;
`deltaPctAbs(5, 0)` → "▲ n/a"; `deltaPctAbs(110, 100)` → "▲ 10,0%".

**T19 — série**: período de 3 dias (11-08..11-10) → janela 11-04..11-10 por dia, 7 pontos com
zeros; período de 100 dias → por mês. Dia com 10 CT-e e 1 fora (resp false) → SLA Op. 0.9; cliente
0 + 0 → null.

**T20 — detalhe do CT-e** (navegador em SP): prev 11-08, entrega 2026-11-09T01:00Z (08/11 22:00
local) → "Entregue no prazo"; entrega 2026-11-10T15:00Z → "Entregue com 2 dias de atraso"
(`ceil((10/11 12:00 − 08/11 23:59:59)/1 dia) = 2`).

---

## 12. Dúvidas para o dono

1. **Relatório mostra SLA Operacional e SLA Cliente do total como fração** ("1,0%" em vez de
   "95,7%"; o tom "bom" nunca acende). Corrigir (×100) ou manter? Recomendo corrigir.
2. **Nomes trocados** no relatório ("SLA de Pontualidade" = SLA por ocorrência penalizante; "SLA
   Operacional" = pontualidade; "% Penalizado Op./Pont." invertidos). Manter os rótulos?
3. **Escopo inconsistente** (§0.4): umas chamadas usam `usuarios_perfil.unidade_id`, outras
   `empresa_usuarios.unidade_id`, outras nenhum escopo (OTIF, produção, previstos, impacto,
   pagadores...). Para usuário restrito, cards da mesma tela somam bases diferentes. Unificar?
4. **Dashboard**: fora do menu, números inflados (join), código 90 como retorno, meta que nunca
   casa, dia em UTC. Portar, corrigir ou remover?
5. **Fuso UTC** em: faixa de vencimento dos Previstos, coluna "Entrega Realizada" da lista,
   `tipos_documento_no_periodo('entrega')`, "em rota" do TDE. Passar tudo para America/Sao_Paulo?
6. **`valor_frete_total` duplicado** quando há várias saídas (85) e **prejuízo não restrito a
   romaneados**: manter?
7. **Taxa de retorno** conta CT-e em aberto no numerador e só concluídos no denominador (pode
   passar de 100%). Manter?
8. **Detalhe do CT-e** quebra com número repetido entre siglas. Desambiguar por sigla na URL?
9. **Exportação da tela Performance** (§7) não respeita o universo, filtra filial pela coluna crua
   e códigos por "qualquer ocorrência" — números diferentes dos cards. Alinhar ao FP?
10. **Unidade por uuid** some na lista e no card TDE (só siglas passam). Alinhar?
11. **Fonte desta spec** é o banco DEVELOP (multiempresa); produção pode ter versões mais novas de
    algumas funções (memória "Desempenho 03/11 só em produção"). Confirmar paridade antes de
    implementar.
12. "Total" da lista vira 0 em página além do fim — aceitar a correção?
