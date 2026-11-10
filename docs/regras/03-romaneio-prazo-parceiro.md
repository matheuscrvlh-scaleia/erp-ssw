# R3 — Romaneio e Prazo do parceiro

Especificação das regras das telas `/romaneio` (todas as abas) e `/prazo-parceiro` (visão geral e
`/prazo-parceiro/$id`), extraída do sistema atual para reimplementação em TypeScript. O objetivo é
dar **os mesmos números**. Onde o sistema atual tem comportamento estranho, a regra é descrita como
está e o ponto vai para a seção 9 (dúvidas para o dono). Nada aqui foi conferido no banco: tudo
vem da definição real das funções (`erp-ssw-referencia/banco`), do código do app e das decisões.

Fontes:

- Funções: `erp-ssw-referencia/banco/funcoes/<nome>.sql`; matviews/views/gatilhos em
  `schema-public.sql` (linhas 12659–12730, 13116–13432, 13645–13670, 16436–16562, 16779–16800).
- App: `fr-transportes` — a versão multiempresa (`.claude/worktrees/agent-ae0264d9f8203d8fa`) para
  módulo, filiais por empresa e configuração por empresa; o checkout principal (`main` + alterações
  locais de 09/11) para o filtro "Em rota agora" (Sim/Não), que o banco já aceita.
- Decisões: `docs/decisoes/romaneio-historico-de-viagens-2026-10-28.md`,
  `performance-motorista-ajudante-codigo-13-2026-10-26.md`,
  `romaneio-contar-pela-data-de-saída-como-a-joana-faz-2026-09-04.md`,
  `divergência-10-vs-165-no-romaneio-definição-confirmada-2026-09-05.md`,
  `tde-aguardando-na-performance-e-romaneado-no-romaneio-2026-10-28.md`,
  `nascido-em-atraso-48h-corridas-2026-10-13.md`; migrations `20261109160000_romaneio_em_rota_igual_aba_hoje`
  e `20261109180000_romaneio_filtro_em_rota_agora`.

O núcleo do CT-e (entregue, finalizado sem entrega, ocorrência efetiva, códigos finalizadores,
universo `fora_universo`, unidade responsável, escopo do usuário, filtros de texto/pagador/tipo de
documento, prazo padrão) está em **`docs/regras/01-nucleo-ctrc.md`**. Aqui só aparece o resumo de
cada regra do núcleo para a leitura fechar; a definição que vale é a de lá.

---

## 0. Convenções desta spec

- Pseudocódigo em TS. `null` = `NULL` do SQL. Comparações com `null` seguem o SQL: `null = x` é
  "desconhecido" e não passa no filtro (anotado onde importa).
- **Dia em São Paulo**: `diaSP(ts) = data local de ts em America/Sao_Paulo`.
- **Hoje**: `hojeSP() = diaSP(agora)`.
- **Data → instante**: o SQL faz `data::timestamptz`, que usa o fuso da sessão do banco. No
  Supabase a sessão é **UTC** (a confirmar, ver §9.1), então `inicioDoDia(d) = d 00:00 UTC`
  (= 21:00 do dia anterior em SP). Isso entra na regra "ocorrência 85/13 válida" (≥ emissão).
- Texto ordenado (`ORDER BY texto`, `max(texto)`, `string_agg ... ORDER BY`) usa a collation do
  banco; ver §9.1.
- `empresa`: toda leitura é da empresa da sessão (`empresa_id`). No sistema novo isso é RLS +
  `app.empresa_id`; a spec omite o filtro, mas ele vale em **toda** tabela e projeção citada.
- Empates não especificados no SQL ficam marcados como **"empate sem ordem"**. O TS deve fixar um
  desempate determinístico (sugerido em cada caso); isso não muda nenhum número, só a ordem.

### 0.1 Resumo das regras do núcleo usadas (definição em `01-nucleo-ctrc.md`)

```ts
// Código só com dígitos (norm_codigo_ocorr): "085"→85, "12-A"→12, ""/null→null.
normCodigo(t: string | null): number | null
// Código sem zeros à esquerda (_normaliza_codigo_ocorr): "085"→85; texto não numérico faz a
// consulta atual FALHAR (cast). No TS: null para não numérico (ver §9.2).
codigoSemZeros(t: string | null): number | null

entregue(c)  = c.data_entrega_realizada != null || [1, 18, 67].includes(normCodigo(c.ocorr_efetiva_codigo))
finalizadoSemEntrega(c) = c.data_entrega_realizada == null && n != null && n !== 1 && BAIXA.has(n)
  // n = normCodigo(c.ocorr_efetiva_codigo); BAIXA = codigos_ocorrencia.tipo_ssw = 'BAIXA'
  // (hoje 12, 36, 61, 77, 92, 93, 94, 99). As RPCs do romaneio usam a variante
  // "n ∉ {1,18,67} && BAIXA.has(n)" — mesma coisa enquanto 18/67 não forem BAIXA.

FP = filiais próprias da empresa (filiais_ssw.propria) — vazio ⇒ nenhuma linha em nenhuma tela.
unidadeResponsavel(c) = FP.has(c.unidade_destino) ? c.unidade_destino
                      : FP.has(c.unidade_atual)   ? c.unidade_atual
                      : c.filial
universoRomaneio(c) = FP.has(unidadeResponsavel(c)) && !c.fora_universo
universoPrazoParceiro(c) = FP.has(c.unidade_destino ?? c.unidade_atual ?? c.filial) && !c.fora_universo
  // ATENÇÃO: regra diferente da do romaneio (COALESCE simples). Ver §9.4 item 8.

escopoUsuario(c) = verTudo || (unidadePerfil != null && c.unidade_id === unidadePerfil)
                 || (equipesAtivas.length > 0 && equipesAtivas.includes(c.equipe_id))
  // verTudo = pode_ver_tudo(usuario); unidadePerfil = usuarios_perfil.unidade_id;
  // equipesAtivas = membros_equipe (usuario, data_saida null).

casaTexto(valor, filtro)   // texto_casa_filtro: contém (ILIKE) algum dos valores "a|b"
tipoEfetivo(c) = upper(trim(c.tipo_documento_455) || trim(c.tipo_documento)) || null
casaTipos(c, tipos) = !tipos?.length || tipos.map(upper).includes(tipoEfetivo(c) ?? "__SEM_TIPO__")
casaPagador(c, cnpjs) = digitos(c.pagador_cnpj ?? "") ∈ cnpjs   // cnpjs = variantes do pagador
```

### 0.2 Constantes e normalizações próprias do romaneio

```ts
/** "Saiu para entrega": 85 + eventos de rua (tentativa, recusa, ausente, retorno, 17...). */
const ROTA = [85, 7, 9, 10, 13, 14, 17, 30, 31, 32, 33, 34, 38, 48, 63, 67, 70, 87, 88, 96];

/** romaneio_norm_placa: maiúsculas, só A–Z e 0–9; vazio → null. */
function normPlaca(p: string | null): string | null {
  const s = (p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s === "" ? null : s;
}
// "kqk-6i98 " → "KQK6I98"; "  " → null.

/** romaneio_norm_nome: maiúsculas, espaços em sequência viram um, sem espaço nas pontas. */
function normNome(n: string | null): string | null {
  const s = (n ?? "").toUpperCase().replace(/[ \t\n\r\f\v]+/g, " ").replace(/^ +| +$/g, "");
  return s === "" ? null : s;
}
// "  joão  da silva " → "JOÃO DA SILVA". Use a classe [ \t\n\r\f\v] e não \s do JS: \s do JS
// também casa NBSP e espaços Unicode, que o \s do Postgres (classe [[:space:]]) pode não casar.

/** normalizar_nome (só para casar motorista com equipe): maiúsculas e sem acento. Não apara. */
function normalizarNome(t: string | null): string  // upper(translate(áàãâä…→aaaaa…))

/** Número/sigla do CT-e no texto do SSW ("CAP038984-6"). */
sswNum(t)   = parte antes do "-", só dígitos, sem zeros à esquerda ("38984"); sem dígitos → null
sswSigla(t) = letras iniciais em maiúsculas ("CAP"); sem letras → null
sswNorm(t)  = igual a sswNum, mas texto vazio/só espaços → null  (ssw_norm_ctrc)
```

### 0.3 Ocorrência "penalizante da FR" e ocorrência "na viagem"

```ts
codigosPrejuizo(codigos?: number[]) = codigos?.length ? codigos : [13];

/** Penalizante da FR: usa o CADASTRO do código (codigos_ocorrencia), não a coluna da ocorrência. */
penalizanteFR(o, cods) = o.codigo !== 85 && cad(o.codigo)?.penaliza === true
                      && cad(o.codigo)?.responsavel === "FR" && cods.includes(o.codigo)
// Quarentena NÃO é olhada na regra de prejuízo.

/** _romaneio_ocorrencia_na_viagem: a ocorrência cai na viagem cujo intervalo contém o dia dela. */
function ocorrenciaNaViagem(ctrcId, v: Viagem, codigos: number[],
                            inicio: Date | null, fim: Date | null, regra: "prejuizo" | "retorno") {
  return ocorrencias(ctrcId).some((o) => {
    const d = diaSP(o.data_hora);
    return codigos.includes(o.codigo)
      && (inicio == null || (d >= inicio && d <= fim))
      && (v.primeira || d >= v.data_saida)          // a 1ª viagem vale desde sempre
      && (v.proxima_saida == null || d < v.proxima_saida)
      && (regra === "prejuizo"
            ? o.codigo !== 85 && cad(o.codigo)?.penaliza === true && cad(o.codigo)?.responsavel === "FR"
            : o.quarentena !== true);
  });
}
```

Exemplo: CT-e saiu no romaneio A em 27/10 e no B em 28/10. Um 13 lançado em 27/10 cai em A
(intervalo [−∞, 28/10)); um 13 em 28/10 ou depois cai em B ([28/10, +∞)). Caso-limite: duas
viagens **no mesmo dia** — a primeira tem intervalo [D, D) vazio e nunca recebe ocorrência; tudo vai
para a última do dia.

---

## 1. Conceitos

| Termo | Definição |
| --- | --- |
| Romaneio de entrega | Linha do relatório SSW 036 (`staging_036_romaneios`): romaneio × CT-e, com placa, motorista, até 3 ajudantes, data/hora de emissão do romaneio (= **saída**), situação, cidade/bairro de entrega e ocorrência do CT-e no romaneio. |
| Viagem | Par (CT-e, romaneio). Um CT-e que voltou e saiu de novo tem várias viagens (14% em out/2026). Projeção `romaneio_viagem_ctrc` (§5.1). |
| "Por viagem" | Telas de pessoa/carro/viagem: o CT-e conta em **cada** viagem; entregue só na última; prejuízo/retorno na viagem do dia da ocorrência. |
| "Último romaneio" | Telas por CT-e (lista, KPIs): o CT-e conta uma vez. A placa/motorista da lista vem do último romaneio importado (§5.2/§5.3). |
| Saída | `data_emissao` do romaneio no 036. Base de data "saída para entrega" = CT-e com alguma linha de 036 não cancelada naquele dia (§5.4). |
| Saiu para entrega (`saiu_rota`) | `entregue(c)` ou algum dos códigos (efetiva, 0013, 0174) ∈ ROTA, ou alguma ocorrência ∈ ROTA fora de quarentena. É o "romaneado"/"levado" das abas de Performance. |
| Em rota agora (`romaneado_status = 'sim'`) | Última ocorrência é a 85 (saída). Usado no filtro da lista e no Status "Em rota". |

---

## 2. Filtros comuns

A barra de filtros do topo vale em todas as abas menos **Hoje**. Ela gera dois conjuntos de
argumentos: `queryArgs` (cards do topo + lista da aba Total) e `fase2Filtros` (demais abas).

### 2.1 Parâmetros da URL `/romaneio` (validateSearch)

| Parâmetro | Tipo / padrão | Observação |
| --- | --- | --- |
| `periodo` | `hoje\|7d\|30d\|mes\|custom`, padrão `mes` | Resolvido **no navegador, fuso local**: `hoje`=[hoje,hoje]; `7d`=[hoje−6,hoje]; `30d`=[hoje−29,hoje]; `mes`=[dia 1 do mês,hoje]; `custom` usa `de`/`ate` (ambos obrigatórios; senão cai em `mes`). |
| `de`, `ate` | `YYYY-MM-DD` | Só com `custom`. |
| `ver` | base de data, padrão **`saida`** | Aceita `emissao\|embarque\|prevista\|saida\|conclusao`; a tela só oferece **Emissão** e **Saída para entrega**. Sem `ver` na URL, usa o último valor salvo no navegador (`localStorage["romaneio:ver"]`) e regrava a cada troca. |
| `tab` | `hoje\|andamento\|romaneio\|performance\|motoristas\|ajudantes\|prejuizo`, padrão `hoje` | Rótulos: Hoje, Total, Romaneio de entrega, Performance por romaneio, Performance Motorista, Performance Ajudante, Prejuízo. |
| `unidades` | uuid[] | `c.unidade_id ∈`. |
| `parceiros` | CNPJ[] | **Pagador** (`pagador_cnpj`, variantes de máscara — ver 01). Rótulo "Parceiros". |
| `filiais` | siglas | **Unidade responsável** (`unidadeResponsavel(c) ∈`). Antes de ir ao banco é recortado às FP; se o recorte esvazia, o filtro **some** (vira "todas"). |
| `unidadeAtual` | siglas | `c.unidade_atual ∈`; mesmo recorte às FP. Opções: lista fixa `MTZ, CAP, RIO, ARA, SIN, SIA, GDR, VRD, NOF, TRS, RRT, COU` (ver §9.3). |
| `remetente`, `destino` | texto `a\|b` | `casaTexto(c.remetente)`, `casaTexto(c.cidade_destino)`. |
| `codigos` (+ legado `codigo`) | int[] ordenado | `EXISTS ocorrência do CT-e com codigo ∈ codigos` — **qualquer data, inclusive quarentena**. Também troca o código do prejuízo (§0.3). |
| `tipos` | texto[] | `casaTipos`. `__SEM_TIPO__` = sem tipo. |
| `previsao` | data | `c.data_prevista_entrega === previsao`. |
| `placas` (+ legado `placa`) | texto[] | Ver §2.3. |
| `motoristas` (+ legado `motorista`) | texto[] | Ver §2.3. Não vale na aba Ajudante. |
| `ajudantes` (+ legado `ajudante`) | texto[] | Só vale na aba Ajudante (e nos Motivos de não entrega dela). |
| `ctrc`, `nf` | texto | Só cards do topo e lista (§2.4). |
| `busca` | texto ≤ 120 | Só a lista (§3.3.3). |
| `recorte` | ver §3.3.2, padrão `todos` | Card/situação clicada. |
| `romaneado` | `todos\|sim\|nao`, padrão `todos` | Filtro "Em rota agora" da lista. Valor fora da lista ⇒ `todos`. |
| `status` | `todos\|andamento` | "Só em andamento" exclui entregues e baixados. |
| `verTodos` | 0/1 | 1 = universo completo (com "Parado sem saída"). Irrelevante com `ver=saida`. |
| `semMovimento` | 0/1 | Só chega por link; ver §3.2. |
| `agrupar`, `ordem`, `dir`, `page`, `size` | lista | `size ∈ {25,50,100,200}`, padrão 50. |

### 2.2 Período por base de data (`_romaneio_filtro_periodo`)

```ts
function noPeriodo(c, campo, ini, fim): boolean {
  switch (campo) {
    case "emissao":   return c.data_emissao between ini..fim;
    case "embarque":  return c.data_embarque between ini..fim;
    case "prevista":  return c.data_prevista_entrega between ini..fim;
    case "conclusao": return conclusaoDia(c) between ini..fim;
    case "saida":     return romaneioSaida.existe(c.numero_ctrc, c.sigla_ctrc, data_saida between ini..fim);
  }
}
// conclusaoDia: o SQL faz (data_conclusao_efetiva AT TIME ZONE 'America/Sao_Paulo')::date sobre uma
// coluna DATE. Com a sessão em UTC o Postgres converte a data em 00:00 UTC e volta para SP:
// resultado = data_conclusao_efetiva − 1 dia. O comentário da função diz "mantido, é a regra em
// vigor". Portar como `data_conclusao_efetiva − 1 dia` (ver §9.1/§9.4).
// saida: casa por número E sigla (sigla null nunca casa: NULL = NULL é falso).
```

Exemplo (`saida`, dia 03/09): o CT-e CAP012345 tem linha de 036 não cancelada com
`data_emissao = 03/09` ⇒ entra, mesmo emitido em 01/09.

### 2.3 Placa, motorista e ajudante

Valem só se algum dos quatro (placa, placas, motorista, motoristas) vier preenchido:

```ts
casaPlacaMotorista(c) = viagens(c.numero_ctrc, c.sigla_ctrc).some((v) =>
     (campo !== "saida" || v.data_saida between ini..fim)
  && (placa == null      || v.placa === normPlaca(placa))
  && (placas == null     || placas.map(normPlaca).includes(v.placa))
  && (motorista == null  || v.motorista === motorista)            // texto cru, sem normalizar
  && (motoristas == null || motoristas.map(normNome).includes(v.motorista_norm)));
```

- A tela só manda `placas`/`motoristas` (listas). `placa`/`motorista` no singular não são usados
  por nenhuma tela (código morto, §7).
- Nas RPCs **por CT-e** (cards, lista, KPIs, distribuição, notas por carro, prejuízo, por viagem)
  o filtro é "o CT-e saiu em alguma viagem dessa placa/motorista".
- Nas RPCs **por viagem** (Motorista, Ajudante, Carro, Notas por carro, Por viagem, Prejuízo por
  motorista) o filtro também recorta **quais viagens** contam.
- **Ajudantes** (`p_ajudantes`): só na aba Ajudante. Na RPC dela casa por viagem
  (`trim(upper(ajudante_n)) ∈ ajudantes`, valores recebidos sem normalizar); nos Motivos de não
  entrega casa pelo **último romaneio** do CT-e por número (§3.9).

### 2.4 Documento (só cards do topo e lista)

```ts
// ctrc: "CAP038984-6" → tira letras do início (após upper/trim) → "038984-6" → antes do "-" →
// "038984" → só dígitos → sem zeros à esquerda → "38984".
casaCtrc(c, ctrc) = semZerosEsq(digitos(c.numero_ctrc ?? "")) === semZerosEsq(digitos(antesDoHifen(semLetrasIniciais(upper(trim(ctrc))))))
// Caso-limite: entrada só com letras ("CAP") vira "" e casa com CT-e de número vazio/zero.
casaNf(c, nf) = semZerosEsq(String(c.numero_nf ?? 0)) === semZerosEsq(digitos(nf))
```

### 2.5 Universo e escopo por chamada

| Chamada | Universo `universoRomaneio` | Escopo do usuário | Observação |
| --- | --- | --- | --- |
| `get_romaneio_base_totais`, `get_romaneio_v3`, `romaneio_base` (KPIs, distribuição, notas por carro, prejuízo, por viagem), performance motorista/ajudante/carro | sim | **sim** | |
| `romaneio_motivos_nao_entrega` | sim | **não** | Ver §9.4. |
| `romaneio_do_dia`, `romaneio_do_dia_ctrcs` (Hoje) | **não** (só `p_filiais` se vier; nem `fora_universo`) | **não** | Ver §9.4. |
| `romaneio_opcoes_placa_motorista`, `romaneio_timeline_ocorrencias` | não | não | Opções/linha do tempo. |
| Prazo do parceiro (RPCs) | `universoPrazoParceiro` | RLS do usuário (`pode_ver_tudo` ou `pode_ver_ctrc`) | Funções sem SECURITY DEFINER. |
| Prazo do parceiro — lista | `filial ∈ FP` (sem `fora_universo`!) | RLS | Ver §6.3 e §9.4. |

Toda RPC do romaneio exige sessão (`auth.uid()`); sem ela, erro "Unauthorized" ou resultado vazio
(motivos, timeline). Módulo exigido no servidor: `romaneio` e `prazo_parceiro`.

---

## 3. Tela `/romaneio`

### 3.1 Aba **Hoje** (`romaneio_do_dia`, `romaneio_do_dia_ctrcs`)

Romaneios **emitidos hoje** (data do romaneio no 036, não do CT-e). Não usa a barra do topo: tem
só "Unidade responsável" (`filiais`, sem recorte às FP) e "Tipo documento" (opções por
`tipos_documento_no_periodo(hoje, hoje, 'romaneio_dia')`). Código de prejuízo fixo = 13 (a tela não
manda `p_codigos`). Recarrega sozinha a cada 60 s e ao voltar o foco.

#### 3.1.1 Linhas do 036 do dia

```ts
const dia = p_dia ?? hojeSP();   // a tela nunca manda p_dia
const lotesParciais = ssw_relatorio_arquivos.filter(a => a.lote_id != null && a.status !== "importado").map(a => a.lote_id);

const linhas036 = staging036.filter(s =>
  s.data_emissao === dia && s.ctrc != null && s.romaneio != null
  && s.situacao !== "CANCELADO"                 // situacao null passa
  && sswNum(s.ctrc) != null && !lotesParciais.includes(s.lote_id));

// v: 1 linha por (romaneio, número do CT-e). Ordem de escolha (a 1ª vence):
//   data_ocorr_ctrc DESC (null por último), hora_ocorr_ctrc DESC (texto; null por último),
//   (situacao === "BAIXADO") DESC (null PRIMEIRO, depois true, depois false — padrão do DESC),
//   importado_em DESC.
// Colunas: numero=sswNum, sigla=sswSigla, romaneio, situacao, placa=normPlaca, motorista,
//   ajudante, ajudante_2, ajudante_3, data_emissao, cidade_entrega, bairro, k_data, k_hora,
//   k_baixado, importado_em.
```

#### 3.1.2 Junção com o CT-e e flags

```ts
// b: v LEFT JOIN ctrcs ON numero igual E (sigla de algum lado null OU siglas iguais).
// Pode casar MAIS DE UM CT-e (número não é único) — e não filtra fora_universo nem FP.
// Sem CT-e: valor_frete=0, entregue=false, tipo=null, unidade=null.
b.valor_frete = c?.valor_frete ?? 0;
b.entregue    = entregue(c);  b.finalizado = finalizadoSemEntrega(c);
b.ocorr85     = normCodigo(c?.ocorr_efetiva_codigo) === 85;

// o85.ok por CT-e: existe ocorrência 85 com !quarentena && data_hora >= inicioDoDia(c.data_emissao)
//   && created_at >= c.created_at. Sem nenhuma 85 → ok = null.
// prejudicada: existe ocorrência penalizanteFR(o, codigosPrejuizo(p_codigos)) com diaSP(o.data_hora) === dia.
r.em_rota     = b.ocorr85 && (o85.ok ?? true) && !b.entregue && !b.finalizado;
r.prejudicada = ...;
// Filtros: casaTipos (tipo upper/trim, vazio → "__SEM_TIPO__") e, se p_filiais, unidadeResponsavel ∈ p_filiais
//   (com c null: unidadeResponsavel = null ⇒ sai quando há p_filiais).
```

#### 3.1.3 Cada CT-e conta em um romaneio só (u)

```ts
// u = 1 linha por NÚMERO de CT-e entre as linhas r. Ordem: k_data DESC (null por último),
//   k_hora DESC (null por último), k_baixado DESC (null primeiro), importado_em DESC, romaneio DESC.
```

Exemplo: o CT-e 38984 está nos romaneios A (ocorrência 09:10) e B (ocorrência 14:30) do dia: conta
só em B. O romaneio A continua na lista (vem de `roms`, que usa todas as linhas `r`), com `ctrcs`
menor ou 0.

#### 3.1.4 Linha por romaneio

```ts
roms(rom)  = sobre TODAS as linhas r do romaneio: data_romaneio = max(data_emissao),
             situacao/placa/motorista/ajudante/ajudante_2/ajudante_3 = max(texto).
rota(rom)  = cidades de r: cidade = trim(upper(cidade_entrega) sem o sufixo /^\s*\/\s*[A-Z]{2}\s*$/) || null;
             conta linhas por cidade; junta com ", " ordenando por qtd DESC, cidade ASC.
bairros(rom) = bairro = trim(upper(bairro)) || null; conta linhas por bairro; descarta os que não
             têm letra A–Z (/[A-Z]/); junta com ", " por qtd DESC, bairro ASC.
// (as contagens de cidade/bairro usam r, inclusive CT-e que contam em outro romaneio e
//  linhas duplicadas pela junção com ctrcs)
linha = {
  romaneio, data_romaneio, situacao, placa, motorista, ajudante, ajudante_2, ajudante_3, rota, bairros,
  ctrcs:        u.filter(x => x.romaneio === rom).length,
  frete:        soma(u.valor_frete),
  entregues:    conta(u.entregue),
  nao_entregues: conta(!u.entregue),
  performance:  ctrcs > 0 ? round1(100 * entregues / ctrcs) : null,
  frete_perdido: soma(u.valor_frete onde prejudicada),
  prejudicadas: conta(u.prejudicada),
};
// Ordem: ctrcs DESC (empate sem ordem; sugerido romaneio ASC).
```

#### 3.1.5 Resumo (cards e faixas)

```ts
resumo = {
  romaneios: linhas.length,                 // inclui romaneio com 0 CT-e
  ctrcs: u.length, entregues: conta(u.entregue), frete: soma(u.valor_frete),
  prejuizo_frete: soma(u.valor_frete onde prejudicada), prejuizo_ctrcs: conta(u.prejudicada),
  // "Fotografia" (todos os CT-e do dia):
  prazo_vencida: conta(prev != null && prev < dia), prazo_hoje: conta(prev === dia),
  prazo_futuro: conta(prev != null && prev > dia), prazo_sem_prev: conta(prev == null),
  // Mesmas faixas só dos não entregues (somam o card "Em rota de entrega"):
  prazo_<faixa>_nao_entregue: mesmas condições && !entregue,
};
```

| Card / chip | Valor | Tela |
| --- | --- | --- |
| Romaneios de hoje | `romaneios` | |
| CT-e nos romaneios | `ctrcs`; dica `frete` em R$ sem centavos | |
| Já entregues | `entregues`; dica `entregues/ctrcs×100` com 1 casa; verde se ≥ 90 | |
| Em rota de entrega | `max(0, ctrcs − entregues)` (calculado na tela) | dica "N CT-e − M entregues" |
| Prejuízo | `prejuizo_frete` (R$ sem centavos), dica `prejuizo_ctrcs` | subtítulo "código 13" |
| Total no romaneio: Vencida / Vencendo no dia / Vencimento futuro / sem prazo definido | `prazo_*` | abre gaveta faixa, todos os status |
| Em rota agora: idem | `prazo_*_nao_entregue` | abre gaveta só não entregues |

Tabela: Romaneio, Data, Situação, Placa, Motorista, Ajudante 1..N (N = maior quantidade de
ajudantes entre os romaneios do dia, mínimo 1), Rota, Bairros (até 3 linhas, clique expande),
CT-e, Frete, Entregues, Não entregues, Performance (`x,x%`; "—" se 0 CT-e), Prejuízo ("—" se 0).
Clique na linha com placa abre a aba Total filtrada pela placa.

#### 3.1.6 Gaveta da faixa (`romaneio_do_dia_ctrcs`)

```ts
// v: 1 linha por NÚMERO de CT-e entre as linhas do dia (mesmos filtros de 3.1.1).
//   Ordem: data_ocorr_ctrc DESC (null último), hora DESC (null último), baixado DESC (null 1º),
//   data_emissao DESC, importado_em DESC. (Sem desempate por romaneio: empate sem ordem.)
// j: LEFT JOIN ctrcs (mesma regra de sigla — pode duplicar).
status = entregue ? "Entregue" : finalizado ? "Finalizado sem entrega"
       : emRotaCtrc(c) ? "Em rota" : "Sem conclusão";
// emRotaCtrc (_romaneio_em_rota) = normCodigo(ef) === 85 && (o85.ok ?? true)
faixa: vencida | hoje | futuro | sem_prev (mesmas condições de 3.1.5) | "todas" (sem filtro)
total = quantidade que passa (faixa + tipos + filiais)
linhas = 2000 linhas QUAISQUER do conjunto, depois ordenadas por data_prevista ASC (null último),
         numero_ctrc ASC (texto)   // ver §9.4: o corte é antes da ordenação
```

A tela, quando aberta por "Em rota agora", **filtra no navegador** `status !== "Entregue"` e mostra
a contagem das linhas filtradas (não o `total`). Ordena por placa (vazias por último, estável). O
servidor completa `sigla_ctrc` pelo número (`buscarSiglaPorNumeroCtrcs`) para o link do SSW.
Colunas: NF, CT-e, Romaneio, Destinatário, Pagador, Cidade/UF, Emissão, Prazo, Situação, Placa,
Link SSW (só exportação).

### 3.2 Cards do topo (`get_romaneio_base_totais`)

Aparecem em todas as abas menos Hoje e Performance por romaneio (nesta, os mesmos números vêm
dentro da aba, §3.5). Argumentos: `queryArgs` sem recorte, sem "Em rota agora", sem "só em
andamento", com `universo` e `semMovimento`.

```ts
universo = (verTodos || ver === "saida") ? "todos" : "romaneados";

base = ctrcs.filter(c => noPeriodo(c, campo, ini, fim) && universoRomaneio(c) && escopoUsuario(c)
  && filtros 2.1 (unidades, pagadores, filiais, unidadeAtual, remetente, destino, tipos, previsao)
  && casaCtrc && casaNf && codigos && casaPlacaMotorista
  && (!semMovimento || (!entregue(c) && !finalizadoSemEntrega(c)
        && (max(ocorrencias(c).data_hora) ?? inicioDoDia(c.data_emissao)) < agora − alerta_dias_sem_movimento dias)));
// alerta_dias_sem_movimento = configuração da empresa, padrão 3.

// Por CT-e, sobre as ocorrências (cadastro do código por LEFT JOIN):
tem85   = existe 85
ok85    = existe 85 com !quarentena && data_hora >= inicioDoDia(c.data_emissao) && created_at >= c.created_at  (null se não há 85)
teveProblema = existe código com tipo_ssw ∈ {PENDENCIA_CLIENTE, PENDENCIA_TRANSPORTADORA} e ≠ 85
temPrejuizo  = existe penalizanteFR(o, codigosPrejuizo(codigos)) com diaSP(o.data_hora) ∈ [ini, fim]
               // a janela é o período da tela, qualquer que seja a base de data
ultPendencia = max(data_hora) das pendências (≠85);  ultLiberacao = max(data_hora) das 85

nEf = normCodigo(c.ocorr_efetiva_codigo);
zEf = codigoSemZeros(c.ocorr_efetiva_codigo); z13 = codigoSemZeros(c.ultima_ocorr_codigo_0013);
z74 = codigoSemZeros(c.ult_ocorr_codigo_0174); n036 = normCodigo(c.ocorr_036_codigo);

ehEntregue   = entregue(c)
ehFinalizado = c.data_entrega_realizada == null && nEf != null && ![1,18,67].includes(nEf) && BAIXA.has(nEf)
emRotaFlag   = zEf != null ? (zEf === 85 && (ok85 ?? true))
             : (z13 != null || z74 != null) ? (z13 === 85 || z74 === 85)
             : (tem85 && ok85 === true)
travadoFlag  = !emRotaFlag && ultPendencia != null && ultPendencia >= (ultLiberacao ?? −∞)
saiu         = campo === "saida" || emRotaFlag || travadoFlag || ehFinalizado
```

`universo === "romaneados"` aplica `ehEntregue || ehFinalizado || emRotaFlag || travadoFlag` **só**
aos números de `agg` abaixo; **Prejuízo e TDE ignoram o universo** (contam o período inteiro).

| Card | Fórmula (sobre `base`, com universo salvo indicação) | Clique (recorte) |
| --- | --- | --- |
| CTRC | `count` | `todos` |
| Peso total | `Σ peso` (≥ 1000 kg → "x,x t") | — |
| Volumes | `Σ volumes` | — |
| Frete total | `Σ valor_frete` | — |
| Em rota de entrega | `count(!ehEntregue && saiu)` | `em_rota` |
| Entregues | `count(ehEntregue)` | `entregues` |
| Baixado sem entrega | `count(!ehEntregue && ehFinalizado)` (card ocultável) | `devolvido` |
| Travado em ocorrência | `count(!ehEntregue && !ehFinalizado && !emRotaFlag && travadoFlag)`; subtítulo "Principal: <motivo>" | `travado` |
| Parado sem saída | `count(!ehEntregue && !ehFinalizado && !emRotaFlag && !travadoFlag)`; só com `verTodos` (e ocultável) | `parado` |
| TDE romaneado | `tdeEmRota + tdeEntregue`; subtítulo com `tdeEmRota`, `tdeEntregue`, `Σ tde` desses, `count(tde>0)` | `tde_romaneado` |
| CTRC com problema (OTIF) | `count(teveProblema) / count × 100` (1 casa) + quantidade; só se a configuração da empresa liga o OTIF | `otif` |
| Prejuízo | `Σ valor_frete(temPrejuizo)`, `count(temPrejuizo)` — sem universo | `prejuizo` |
| Em rota, por prazo: Vencida / Vencendo no dia / Vencimento futuro / sem prazo | `count(!ehEntregue && saiu && prev < hojeSP())` etc. (relativo a **hoje**, não ao período) | `em_rota_vencida`… |

```ts
tdeEmRota   = count(tde > 0 && emRotaFlag && !ehEntregue && !ehFinalizado)   // sem universo
tdeEntregue = count(tde > 0 && ehEntregue)
tdeValor    = Σ tde onde tde > 0 && (ehEntregue || (emRotaFlag && !ehFinalizado))
travadoMotivo = entre os CT-e travados, conta OCORRÊNCIAS (não CT-e) de pendência (≠85) com
  data_hora >= (ultLiberacao ?? −∞), agrupa por descrição do código, pega a maior (empate sem ordem).
```

- Percentual de cada card: `n / count × 100`, 1 casa, "x,x% do total do período".
- "Em rota de entrega" não é mais partição (09/11): inclui travados depois da saída e baixados. Com
  `ver=saida`, `saiu` é sempre verdadeiro ⇒ Em rota = CTRC − Entregues.
- Timeout: o servidor tenta 2 vezes; no 2º timeout devolve `null` e a tela usa os totais da lista
  (§3.3) quando não há recorte ativo; com recorte ativo, mostra 0/"—".

Exemplo (`ver=saida`, 1.203 CT-e, 1.041 entregues): Em rota = 162; 13,5% do total.

### 3.3 Aba **Total** (`andamento`)

Topo da aba: gráfico de distribuição (§3.3.5). Depois a lista.

#### 3.3.1 Lista (`get_romaneio_v3`)

```ts
janela = ctrcs.filter(c => noPeriodo(c, campo, ini, fim) && universoRomaneio(c));
r85(c)  = existe 85 ? (existe 85 ok, como ok85 em 3.2 ? "sim" : "quarentena") : null;
romaneadoStatus(c) =
    (codigoSemZeros(ef) === 85 || codigoSemZeros(c0013) === 85 || codigoSemZeros(c0174) === 85) ? "sim"
  : (ef != null || c0013 != null || c0174 != null) ? "nao_rastreado"   // texto cru não nulo, mesmo ""
  : (r85(c) ?? "nao_rastreado");
emRota85(c) = romaneadoStatus(c) === "sim";

filtrada = janela.filter(c => escopoUsuario(c) && filtros 2.1 && casaCtrc && casaNf && casaBusca
  && casaTipos && (ids == null || ids.includes(c.id)) && codigos
  && (romaneado === "todos" || (romaneado === "sim") === emRota85(c))   // "nao" = tudo menos "sim"
  && casaPlacaMotorista
  && (status !== "andamento" || (c.data_entrega_realizada == null && !entregue(c) && !finalizadoSemEntrega(c)))
  && (!semMovimento || <mesma regra de 3.2>)
  && casaRecorte(c, recorteEfetivo));
recorteEfetivo = recorte !== "todos" ? recorte : (universo === "todos" ? "todos" : "romaneados");
```

#### 3.3.2 Recortes (`casaRecorte`)

```ts
E = entregue(c); F = finalizadoSemEntrega(c); R = emRota85(c); T = travadoCtrc(c);
travadoCtrc(c) = !emRotaCtrc(c) && ultPendencia(c) != null && ultPendencia(c) >= (ultLiberacao(c) ?? −∞)
  // emRotaCtrc de 3.1.6 (só a efetiva). Diferente de travadoFlag de 3.2 — ver §9.4.
saiuLista = campo === "saida" || F || R || T;
switch (recorte) {
  todos:            true
  entregues:        E
  em_rota:          !E && saiuLista
  em_rota_vencida:  !E && saiuLista && prev != null && prev < hojeSP()
  em_rota_hoje:     !E && saiuLista && prev === hojeSP()
  em_rota_futuro:   !E && saiuLista && prev > hojeSP()
  em_rota_sem_prev: !E && saiuLista && prev == null
  devolvido:        !E && F
  travado:          !E && !F && T
  parado:           !E && !F && !R && !T
  romaneados:       E || F || R || T
  tde_romaneado:    (c.tde ?? 0) > 0 && (E || (R && !F))
  otif:             existe ocorrência de pendência (tipo PENDENCIA_*, ≠ 85)
  prejuizo:         existe penalizanteFR(o, codigosPrejuizo(codigos)) com diaSP ∈ [ini, fim]
}
```

Rótulos (select "Situação" e faixa "Filtrando por"): Todos/Todas, Em rota de entrega, Entregues,
Baixado sem entrega, Travado em ocorrência, "Parado, sem saída para entrega" (só com `verTodos`),
CTRC com problema no percurso (só com OTIF ligado), CTRC com prejuízo, Em rota · prazo vencido,
Em rota · vence hoje, Em rota · vencimento futuro, Em rota · sem prazo definido, TDE romaneado (em
rota ou entregue); `romaneados` = "Somente romaneados (saíram para entrega)".
Select "Em rota agora": Todos / Sim / Não ("só em rota agora" / "só fora de rota agora").
Select "Status": Todos / Só em andamento ("excluindo entregues e baixados").

#### 3.3.3 Busca livre

`busca` (aparado): contém (ILIKE, sem escapar `%`/`_` digitados) em `numero_ctrc`, `numero_nf`
(texto), `remetente`, `destinatario`, `cidade_destino`, `parceiro_nome`, placa ou motorista do
último romaneio (§5.3).

#### 3.3.4 Totais, grupos, ordem, página e linhas

```ts
totais = { count, peso: Σ, volumes: Σ, frete: Σ, entregues: count(entregue) }   // sobre filtrada
// Grupos (agrupar ≠ none), ordem cnt DESC (empate sem ordem):
//   parceiro: key = parceiro_id ?? "__null__"; label = parceiros.nome ?? c.parceiro_nome ?? "— sem parceiro —"
//   unidade:  key = unidade_id ?? "__null__";  label = unidades.nome ?? c.filial ?? "—"
//   setor:    key = label = trim(enr.setor) || "—"
//   cidade:   key = label = trim((cidade ?? "") + "/" + (uf ?? "")) não "/" ou "—"
//   cada um com count, Σ peso, Σ volumes, Σ frete.
// Ordem: a tela manda sempre modo "em_andamento", e o servidor então IGNORA a coluna clicada:
//   ORDER BY data_prevista_entrega ASC NULLS LAST, id ASC   (ver §9.4)
// Página: LIMIT size OFFSET (page−1)·size. Com agrupamento a tela pede 2000, mas o servidor limita
//   a 500 (ver §9.4).
```

A tela agrupa as linhas da página no navegador com chaves próprias (parceiro: `parceiro_id ??
"__null__"`/rótulo `parceiro_nome ?? "—"`; unidade: `unidade_id`/rótulo `filial ?? "—"`; setor:
`setor_entrega ?? "__null__"`; cidade: `` `${cidade ?? ""}/${uf ?? ""}` `` ou "—") e procura o
subtotal do servidor pela mesma chave (`grupos.find(g => g.key === key)`; se não acha, sem
subtotal — acontece com setor vazio, por exemplo).

Linha (colunas da tela, nesta ordem): NF (com caixa de seleção), CTRC, Status, Emissão, Embarque,
Prazo, Parceiro (`parceiros.nome ?? c.parceiro_nome`, que é o **expedidor**), Unidade (`filial`),
Cidade Unid. (`unidade_cidade/unidade_uf`), Local. atual, Placa, Motorista (do último romaneio,
§5.3), Remetente, Cliente destino, Destino (`cidade/uf`), Setor, Bairro (título = endereço),
Vlr. mercadoria, Peso, Vol., Frete, Última ocorrência (descrição, ou `status_atual`; dica com código,
data/hora e fonte; ícone abre a linha do tempo), Atraso, Alertas. Clique na linha abre `/ctrc/$numero`.

Enriquecimento depois da consulta (por blocos de 2000 ids):

```ts
ultimaOcorrencia(c) = normCodigo(c.ocorr_efetiva_codigo) == null ? null : {
  codigo: normCodigo(c.ocorr_efetiva_codigo),
  descricao: c.ocorr_efetiva_descricao || cad(codigo)?.descricao,
  data_hora: c.ocorr_efetiva_data,
  fonte: ["bi2_0174","bi2_0013","webhook"].includes(c.ocorr_efetiva_fonte) ? c.ocorr_efetiva_fonte : null };
baixadoSemEntrega = c.data_entrega_realizada == null && u?.codigo != null && u.codigo !== 1
                    && BAIXA.has(u.codigo);
// Fonte na dica: bi2_0174 → "BI2 0174 (movimentação)", bi2_0013 → "BI2 0013 (posição)", senão "Webhook SSW".
```

Status, Atraso e Alertas (`romaneio-linha.ts` — já TS puro, portar igual; mesma função na tela e
na exportação):

```ts
entregueLinha = data_entrega_realizada != null || [1,18,67].includes(ultima?.codigo)
status = entregueLinha ? "Entregue" : baixadoSemEntrega ? "Baixado"
       : romaneado_status === "sim" ? "Em rota" : "Pendente";
atraso (hoje = data local do NAVEGADOR):
  baixado → 0 ("baixa formal"); responsabilidade_cliente → 0 ("resp. cliente");
  entregue → max(performance_dias, 0) ("performance");
  com previsão → prev < hoje ? floor(hoje − prev em dias) : 0 ("prazo");
  sem previsão → atraso_dias > 0 ? atraso_dias ("BI2") : 0.
Coluna Atraso: baixado "—"; resp. cliente selo "Resp. cliente"; atraso > 0 "N dia(s)";
  entregue: performance_dias null "—" senão "No prazo"; demais "—".
Alertas: "ATRASADO N dia(s)" se atraso > 0; "RESP. CLIENTE"; "CARGA PESADA" se peso > limite;
  "ALTO VOLUME" se volumes > limite; "TDE" se tde > 0.
  Limites: configuração da empresa romaneio_peso_critico_kg (100) e romaneio_volume_critico (10).
Linha em vermelho quando atraso > 0.
```

Seleção para exportar: começa "todas marcadas"; desmarcar guarda ids excluídos; a caixa do
cabeçalho alterna para "somente as marcadas". Qualquer mudança de filtro volta para "todas".

#### 3.3.5 Distribuição dos não finalizados (`romaneio_distribuicao_codigos`) e Performance por carro

Usa `fase2Filtros` (sem documento, busca, recorte, "Em rota agora", status).

```ts
base = romaneioBase(fase2Filtros, romaneado = "todos");     // §3.4.1
rstatus(c) = entregue(c) ? "sim"
           : [zEf, z13, z74].some(z => ROTA.includes(z)) ? "sim"
           : existeOcorrencia(c, ROTA) ? (existeOcorrencia(c, ROTA, !quarentena) ? "sim" : "quarentena")
           : "nao_rastreado";
naoFinalizado(c) = rstatus(c) === "sim" && !entregue(c) && !finSistema(c);   // finSistema = ehFinalizado de 3.2
cod(c) = zEf ?? z74 ?? z13;                                          // ordem: efetiva, 0174, 0013
linhas = agrupa naoFinalizado por cod: { codigo: cod, descricao: cad(cod)?.descricao,
  pendencia: cad(cod)?.tipo_ssw ∈ {PENDENCIA_CLIENTE, PENDENCIA_TRANSPORTADORA}, qtd }
ordem: qtd DESC, codigo ASC (null por último)
```

Σ qtd = card "Não entregues" das KPIs com os mesmos filtros. Barra: "#cód + 28 primeiros
caracteres da descrição" ou "s/ cód"; vermelha se pendência. Clique: aba Total com
`codigos=[cód]`, `recorte=em_rota`, `status=andamento` (código nulo ⇒ sem filtro de código).

Seletor "Por carro" mostra a tabela de §3.6.3.

### 3.4 Aba **Romaneio de entrega**

#### 3.4.1 Base por CT-e (`romaneio_base`)

```ts
romaneioBase(f, romaneado) = ctrcs.filter(c => noPeriodo(c, f.campo, f.ini, f.fim)
  && universoRomaneio(c) && escopoUsuario(c) && filtros 2.1 de f && codigos && casaPlacaMotorista
  && (romaneado === "todos" || saiuEntregaStatus(c) === romaneado));
saiuEntregaStatus(c) = rstatus(c)  // mesma regra de 3.3.5 (_saiu_entrega_status)
```

#### 3.4.2 KPIs (`romaneio_kpis`)

```ts
base = romaneioBase(f, "todos");
total        = base.length
romaneado    = count(rstatus === "sim")
entregue     = count(rstatus === "sim" && entregue)            // = count(entregue)
nao_entregue = count(rstatus === "sim" && !entregue && !finSistema)
prejudicada  = count(existe penalizanteFR(o, codigosPrejuizo(f.codigos)) com diaSP ∈ [ini, fim])
               // NÃO exige rstatus "sim"
frete_romaneado = Σ frete(rstatus === "sim");  frete_perdido = Σ frete(prejudicada)
```

Nesta aba só aparece o card **CTRC no período** = `total` (clique: lista `todos`) e o gráfico.

#### 3.4.3 CTRC por carro (`romaneio_notas_por_carro`)

```ts
b = romaneioBase(f, "sim");
// Uma linha por viagem do CT-e (LEFT JOIN): viagens do CT-e (número+sigla) que passam em
// (campo !== "saida" || data_saida no período) e nos filtros de placa/motorista; sem viagem → 1 linha com placa null.
porPlaca = agrupa por v.placa: { placa, motorista_nome: max(v.motorista), ctrcs: count,
  peso: Σ b.peso ?? 0, volumes: Σ b.volumes ?? 0, frete: Σ b.valor_frete ?? 0 }
ordem: placa null por último, ctrcs DESC, placa ASC. Sem limite (a tela manda p_limit null).
```

Linha "Sem placa identificada" = placa null (não clicável). Clique na placa: lista com essa placa.
Barra proporcional ao maior `ctrcs`. Cabeçalho "N placas" conta as não nulas.

### 3.5 Aba **Performance por romaneio**

Usa KPIs (§3.4.2), Prejuízo (§3.8, só `por_hora`/`por_dia`), os totais do topo (§3.2, repetidos
aqui), a distribuição (§3.3.5) e Por viagem (§3.5.1).

| Card | Fórmula | Formato |
| --- | --- | --- |
| CTRC romaneados | `romaneado` | |
| Entregues | `entregue`, "de N romaneados" | clique `entregues` |
| Entregas prejudicadas | `prejudicada`, "x,x% da base desta aba" (÷ romaneado) | clique `prejuizo` |
| Frete perdido | `frete_perdido` (R$ sem centavos), "x,x% do frete da base" = `frete_perdido / frete_romaneado` | |
| Prejuízo (%) | `prejudicada / romaneado × 100` | 1 casa |
| Entregas no horário (%) | `100 − Prejuízo (%)`; dica `romaneado − prejudicada` de `romaneado` | verde ≥ 95 |
| Não entregues | `nao_entregue`, % da base | clique `em_rota` + `status=andamento` |
| Performance positiva | `entregue / romaneado × 100` | |
| Performance negativa | `100 − positiva`; dica `romaneado − entregue` | |
| Frete perdido por horário/dia | período de 1 dia: `por_hora` (24 barras); senão `por_dia` | |

Base 0 ⇒ "—". Como `prejudicada` não exige "saiu", o Prejuízo (%) pode passar de 100% em teoria.

#### 3.5.1 Por romaneio (viagem real) (`romaneio_por_viagem`)

```ts
b0 = romaneioBase(f, "todos");
temPenal(c) = existe penalizanteFR(o, codigosPrejuizo(f.codigos)) com diaSP ∈ [ini, fim];
j = para cada c ∈ b0, para cada viagem v do CT-e (número+sigla; INNER — CT-e sem viagem não entra)
    com (campo !== "saida" || v.data_saida no período), filtros de placa/motorista por viagem e
    busca de romaneio:
  { romaneio: v.romaneio, ..., entregue: entregue(c) && v.ultima, transferida: !v.ultima,
    prejudicada: !temPenal(c) ? false : (v.primeira && v.ultima) ? true
               : ocorrenciaNaViagem(c.id, v, codigosPrejuizo(f.codigos), ini, fim, "prejuizo") }
buscaRomaneio(q) = !q?.trim() || v.romaneio contém (ILIKE) trim(q)
                 || (digitos(trim(q)) !== "" && digitos(v.romaneio) contém digitos(trim(q)))
linha por romaneio (texto do romaneio, sem sigla nem empresa): data_romaneio = max(data_saida),
  situacao/placa/motorista/ajudante* = max(texto), ctrcs = count, frete = Σ, entregues,
  nao_entregues = count(!entregue), performance = round1(100·entregues/ctrcs),
  frete_perdido = Σ frete(prejudicada), transferidas = count(transferida)
ordem: ctrcs DESC (empate sem ordem). Limite: 300; com busca, 1000.
```

Colunas: Romaneio, Data, Situação, Placa, Motorista, Ajudantes (juntos por ", "), CTRC,
Remanejadas ("—" se 0), Frete que saiu, Entregues, Não entregues, Performance, Frete perdido ("—"
se 0). Busca com espera de 400 ms. Clique na linha com placa: lista filtrada pela placa.

Exemplo (decisão 28/10, KQK6I98 em 27/10): antes 21 CTRC / 1 prejudicada; por viagem 28 / 9.

### 3.6 Performance por pessoa e por carro

Base comum (`base_all`) das três RPCs — CT-e do período com universo, escopo e filtros 2.1 (sem
placa/motorista, que entram por viagem):

```ts
saiuRota(c) = entregue(c) || [zEf, z13, z74].some(z => ROTA.includes(z))
           || ocorrencias(c).some(o => ROTA.includes(o.codigo) && !o.quarentena);
retorno(c)  = zEf === 13 || z13 === 13 || z74 === 13 || ocorrencias(c).some(o => o.codigo === 13 && !o.quarentena);
prej(c)     = existe penalizanteFR(o, codigosPrejuizo(f.codigos)) com diaSP ∈ [ini, fim];
prej13(c)   = existe o.codigo === 13 && cad(13).penaliza && cad(13).responsavel === "FR" && diaSP ∈ [ini, fim];
```

#### 3.6.1 Performance Motorista (`romaneio_performance_motorista`)

```ts
comb = para cada c ∈ base_all, LEFT JOIN viagens do CT-e (número+sigla; saida ⇒ só do período)
       — uma linha por viagem, ou uma linha com m = null se não há viagem — filtradas por
       placa/placas/motorista/motoristas sobre m (com filtro e m null ⇒ a linha sai):
  retornoV = !retorno(c) || m == null || (m.primeira && m.ultima) ? retorno(c)
           : ocorrenciaNaViagem(c.id, m, [13], null, null, "retorno")
  prejV    = idem com prej(c), codigosPrejuizo, ini, fim, "prejuizo"
  prej13V  = idem com prej13(c), [13], ini, fim, "prejuizo"
  entregueV = entregue(c) && (m?.ultima ?? true)
  motorista = m?.motorista ?? "—"     // texto cru do 036
agrupa por motorista:
  placas       = string_agg(DISTINCT m.placa, ", ") onde saiuRota  (ordem alfabética, sem nulos)
  romaneados   = count(saiuRota)
  entregues    = count(saiuRota && entregueV)
  retornos     = count(saiuRota && retornoV && !entregue(c) && !finalizadoSemEntrega(c))
  prejudicadas = count(prejV)                      // NÃO exige saiuRota
  prejudicadas_13 = count(saiuRota && prej13V)
  mantém só romaneados > 0 || prejudicadas > 0
viagens  = count(DISTINCT m.romaneio) onde saiuRota && m.romaneio != null, agrupado por normNome(motorista)
           e ligado por normNome(motorista)   // duas grafias que normalizam igual somam as viagens das duas
equipe   = membros_equipe (papel 'motorista', data_saida null) + equipes_entrega, agrupado por
           normalizarNome(membro.nome): equipe_nome = max(nome da equipe); ligado por normalizarNome(motorista)
performance = romaneados > 0 ? round2(100 · max(romaneados − prejudicadas_13, 0) / romaneados) : 0
ordem: romaneados DESC (empate sem ordem)
```

Exemplo (decisão 26/10): 709 levados, 2 prejudicadas (13) ⇒ 99,72%.

Tela: "Produtividade" = Σ entregues ÷ Σ romaneados (1 casa; verde ≥ 95); "Taxa de retorno" =
Σ retornos ÷ Σ romaneados (vermelho se > 0). Colunas: Motorista, Placas (§3.10), Equipe, Qtd.
viagens, CTRC — levados, CTRC — entregues, CTRC — prejudicadas, % Performance (2 casas; "—" se 0
levados; dica "levados − prejudicadas13"). Clique: lista filtrada pelo motorista (texto cru, que o
filtro normaliza). Abaixo, Motivos de não entrega (§3.9).

#### 3.6.2 Performance Ajudante (`romaneio_performance_ajudante`)

Igual ao motorista, com estas diferenças:

- Junção com viagens **INNER** (CT-e sem viagem não entra) e uma linha por ajudante não vazio da
  viagem (`ajudante`, `ajudante_2`, `ajudante_3`); chave `ajudante = trim(upper(nome))` (sem juntar
  espaços internos). O mesmo nome repetido em duas posições conta duas vezes.
- Filtro `ajudantes`: `trim(upper(nome)) ∈ ajudantes`.
- Os CASE de retorno/prejuízo não têm o teste `m == null`; `entregueV = entregue(c) && m.ultima`.
- `viagens` = `count(DISTINCT romaneio)` onde `saiuRota`, pela mesma chave do ajudante.
- Sem equipe. Saída: ajudante, placas, romaneados, entregues, retornos, prejudicadas,
  prejudicadas_13, viagens, performance; ordem romaneados DESC.
- A base de data `conclusao` é escrita sem a faixa ±1 dia, mesmo resultado.

Opções do filtro Ajudante: os nomes desta mesma RPC rodada **sem** o filtro de ajudante, distintos,
ordenados (pt-BR). O CT-e conta inteiro para cada ajudante.

#### 3.6.3 Performance por carro (`romaneio_performance_carro`)

```ts
comb = como 3.6.1 (LEFT JOIN, m null → motorista "—", placa null), com prejV e entregueV.
agrupa por (motorista, m.placa):
  romaneados = count(saiuRota); entregues = count(saiuRota && entregueV);
  prejudicadas = count(saiuRota && prejV)          // aqui EXIGE saiuRota
  mantém romaneados > 0; ordem servidor: prejudicadas DESC, romaneados DESC
```

Tela (aba Total e Performance por romaneio, seletor "Por carro"): reordena no navegador — placa
null por último; depois `pct = 100·prejudicadas/romaneados` DESC; depois romaneados DESC. Colunas:
Motorista ("Sem romaneio de entrega" se placa null), Placa, Entregas (= romaneados), Entrega
prejudicada, Performance (`100 − pct`, 2 casas), % Prejudicada (2 casas). Linha Total com as
somas e os percentuais sobre as somas. Clique (com placa): lista com placa e motorista.

### 3.7 Opções de placa e motorista (`romaneio_opcoes_placa_motorista`)

```ts
base = DISTINCT (v.placa, v.motorista_norm) das viagens com data_saida ∈ [ini, fim]
       // sempre pela data de saída, qualquer que seja a base da tela; sem escopo e sem outros filtros
placas     = DISTINCT placa não nula      onde (motoristas == null || motoristas.map(normNome).includes(motorista_norm)), ordenadas
motoristas = DISTINCT motorista_norm não nulo onde (placas == null || placas.map(normPlaca).includes(placa)), ordenados
```

Encadeado: a lista de placas considera os motoristas escolhidos e vice-versa. Na aba Ajudante o
seletor de Motorista some.

### 3.8 Aba **Prejuízo** (`get_romaneio_prejuizo`)

```ts
base = romaneioBase(f, "todos");
prej = base.filter(c => existe penalizanteFR(o, codigosPrejuizo(f.codigos)))   // SEM janela de data (ver §9.4)
por_dia    = agrupa prej por c.data_emissao (dia de EMISSÃO do CT-e; ignora nulos): {dia, ctrcs, frete}; ordem dia
por_hora   = para cada c ∈ prej, a ocorrência penalizante MAIS ANTIGA (data_hora ASC); hora = hora SP;
             agrupa: {hora, ctrcs, frete}
cidades    = agrupa por trim(cidade_destino) || "—": top 10 por ctrcs DESC (empate sem ordem)
pagadores  = agrupa por trim(pagador_nome) || "—": top 10
motoristas = para cada c ∈ prej, a 1ª viagem (data_saida ASC, romaneio ASC) em que
             ocorrenciaNaViagem(c.id, v, codigosPrejuizo, null, null, "prejuizo"); sem viagem ⇒ "—"/"—";
             agrupa por (motorista ?? "—", placa ?? "—"): top 15 por ctrcs DESC
```

Tela: texto explicativo; gráfico "Prejuízo por dia" (frete por dia, `dd/mm`); três rankings
(Cidades, Pagadores, Motoristas com a placa ao lado), barra proporcional ao maior frete, frete em
vermelho (R$ sem centavos). Clique em cidade/pagador: lista `prejuizo`; em motorista: lista
`prejuizo` + motorista.

### 3.9 Motivos de não entrega (`romaneio_motivos_nao_entrega`)

Abaixo das abas Motorista e Ajudante.

```ts
base = ctrcs.filter(c => noPeriodo && universoRomaneio(c) && filtros 2.1 && codigos && casaPlacaMotorista
  && (ajudantes == null || ultimoRomaneio036(c.numero_ctrc)  // §5.2, por NÚMERO, sem sigla
        tem ajudante/2/3 com trim(upper(nome)) ∈ ajudantes));   // SEM escopo do usuário
codigosPend = cadastro com tipo_ssw ∈ PENDENCIA_* e codigo ≠ 85
linhas = por código pendente: qtd = CT-e distintos de base com ALGUMA ocorrência desse código
         (qualquer data, inclusive quarentena); descricao = cadastro
ordem: qtd DESC (empate sem ordem); limite clamp(p_limit ?? 12, 1, 100) — a tela pede 12
saída: { placa: null, motorista: null, codigo: texto, descricao, qtd }
```

Tela: código 13 em destaque vermelho; clique: lista com `codigos=[código]`. Timeout: 2 tentativas
com 1,2 s de espera; no 2º timeout mostra o erro (não lista vazia).

### 3.10 Permissão `romaneio_placa`

- Chave de recurso "Romaneio · Ver placa (Performance Motorista/Ajudante)", concedida por cargo,
  departamento ou usuário (seção "Recursos dentro das telas"); fora do menu, nunca página inicial.
- **Servidor**: em Performance Motorista e Ajudante, quem não tem a chave recebe `placas = null`.
- **Tela**: sem a chave, coluna com cadeado e exportação sem a coluna "Placas"; com a chave, a placa
  começa oculta (`•••••••`) e o ícone de olho mostra/oculta.
- A chave não protege placa em nenhuma outra parte (lista, Hoje, Por viagem, CTRC por carro, Por
  carro, Prejuízo). Ver §9.3.

### 3.11 Linha do tempo de ocorrências (`romaneio_timeline_ocorrencias`)

Ícone na coluna "Última ocorrência" da lista.

```ts
num = sswNorm(numeroCtrc);
ssw = staging930.filter(s => sswNorm(s.ctrc) === num && s.ocorrencia_em != null).map(s => ({
  data_hora: s.ocorrencia_em interpretado como horário de SP (coluna sem fuso),
  codigo: trim(s.cod_ocor) || null, codNorm: normCodigo(s.cod_ocor),
  descricao/complemento/usuario: trim(...) || null,
  unidade: trim(s.unid_ocor ?? s.empr_ocor) || null }));   // unid_ocor "" não cai para empr_ocor
sswDedup = 1 por (codNorm, data_hora): complemento ASC (null por último), usuario ASC (null por último)
sis = ocorrencias de TODOS os CT-e da empresa com numero_ctrc === num (qualquer sigla):
  { data_hora, codigo: String(o.codigo), codNorm, descricao: o.descricao, complemento: trim || null }
sisDedup = 1 por (codNorm, data_hora): complemento ASC (null por último)
unificado = sisDedup.map(p => { const x = sswDedup(p.codNorm, p.data_hora);
              return { ...p, descricao: p.descricao ?? x?.descricao, complemento: p.complemento ?? x?.complemento,
                       usuario: x?.usuario, unidade: x?.unidade, fonte: "sistema" } })
          ++ sswDedup sem par no sistema (fonte "ssw")
ordem data_hora DESC; limite 200
```

---

## 4. Resumo das chamadas da tela Romaneio

| Aba / bloco | Chamada atual | Filtros |
| --- | --- | --- |
| Hoje | `romaneio_do_dia`, `romaneio_do_dia_ctrcs` | filiais, tipos |
| Cards do topo (menos Hoje e Perf. por romaneio) | `get_romaneio_base_totais` | queryArgs + universo |
| Total — lista | `get_romaneio_v3` + `ultima_ocorrencia_efetiva_batch` + cadastro BAIXA + configuração de limites | queryArgs |
| Total / Perf. romaneio — distribuição | `romaneio_distribuicao_codigos` / `romaneio_performance_carro` | fase2Filtros |
| Romaneio de entrega | `romaneio_kpis` (só `total`), `romaneio_notas_por_carro` | fase2Filtros |
| Performance por romaneio | `romaneio_kpis`, `get_romaneio_prejuizo` (horas/dias), base_totais (contexto), distribuição, `romaneio_por_viagem` | fase2Filtros |
| Performance Motorista | `romaneio_performance_motorista`, motivos | fase2Filtros |
| Performance Ajudante | `romaneio_performance_ajudante`, motivos | fase2Filtros + ajudantes |
| Prejuízo | `get_romaneio_prejuizo` | fase2Filtros |
| Filtros | `romaneio_opcoes_placa_motorista`, `listar_pagadores_ctrcs` (mesma base de data), `tipos_documento_no_periodo` | |
| Linha do tempo | `romaneio_timeline_ocorrencias` | número |

Mensagens de timeout seguem o padrão do sistema ("reduza o período ou aplique mais filtros").

---

## 5. Matviews → projeções

Hoje há 4 matviews no ciclo + 1 tabela mantida por gatilho. No sistema novo cada uma vira uma
tabela de leitura no schema `erp`, com `empresa_id` e RLS, mantida pelo worker. Nenhuma tem função,
gatilho ou matview no banco.

**Como é hoje.** `refresh_romaneio_matviews()` roda pelo pg_cron `refresh-romaneio-matviews` nos
minutos **:15 e :45** de cada hora (`SET statement_timeout = '300s'`) e também ao fim de cada
importação **manual** de 036/038/306/455 pela tela de administração. O ciclo do FTP **não** dispara
o refresh (levava ~85 s e estourava o timeout da API). Trava por `pg_try_advisory_xact_lock`: se já
há um refresh rodando, sai sem fazer nada. Ordem: `mv_romaneio_036_ctrc` → `mv_romaneio_viagem_ctrc`
(leitura sequencial) → `mv_romaneio_ctrc_motorista` → `mv_ctrc_staging_enriquecido` (bloco próprio:
se estourar o tempo, as anteriores ficam). Atraso típico: até ~30 min + duração. Histórico: de
09/09 a 01/10/2026 as matviews ficaram paradas e as telas mostraram "muito CT-e sem placa".

**Como fica.** Recomendação: (a) **incremental** no mesmo job que grava a staging (mesma
transação), recalculando só as chaves tocadas pelo lote; (b) **reconstrução completa** diária
(madrugada) como conciliação, comparando contagens e registrando divergência em log. Isso deixa as
telas sem o atraso de até 30 min de hoje (os números convergem para os mesmos; só deixam de ficar
velhos). Se o dono quiser o comportamento idêntico, agendar a projeção nos minutos 15/45 (§9.5).

### 5.1 `romaneio_viagem_ctrc` (de `mv_romaneio_viagem_ctrc`) — CT-e × romaneio

| Coluna | Origem |
| --- | --- |
| `empresa_id` | staging |
| `numero_ctrc`, `sigla_ctrc` | `sswNum(ctrc)`, `sswSigla(ctrc)` (ambos não nulos) |
| `romaneio` | texto do 036 (não nulo) |
| `situacao` | da linha escolhida |
| `data_saida` | `data_emissao` do 036 (não nula) |
| `hora_emissao` | texto (só para a ordem; não exposta) |
| `placa` | `normPlaca(placa)` |
| `motorista`, `motorista_norm` | texto cru; `normNome(motorista)` |
| `ajudante`, `ajudante_2`, `ajudante_3` | texto cru |
| `primeira`, `ultima` | sem viagem anterior / posterior |
| `proxima_saida` | `data_saida` da viagem seguinte |

Chave: (`empresa_id`, `numero_ctrc`, `sigla_ctrc`, `romaneio`). Índices: (`empresa_id`,
`data_saida`); (`empresa_id`, `placa`, `data_saida`); (`empresa_id`, `motorista_norm`,
`data_saida`).

```ts
// 1) Para cada (empresa, numero, sigla, romaneio) entre as linhas do 036 com ctrc, número, sigla,
//    romaneio e data_emissao não nulos: a linha de importado_em mais recente (empate sem ordem).
// 2) Descarta se essa linha está CANCELADO (o cancelamento da última importação apaga a viagem,
//    mesmo que importações antigas não estivessem canceladas).
// 3) Por CT-e (empresa, numero, sigla), ordena as viagens restantes por
//    data_saida ASC, hora_emissao ASC (texto; null PRIMEIRO), romaneio ASC, e calcula
//    primeira = é a 1ª; ultima = é a última; proxima_saida = data_saida da seguinte (null na última).
```

Recalcular: o **CT-e inteiro** (todas as viagens dele) sempre que entra/muda/sai linha do 036 com
esse número+sigla (a janela depende de todas). Atrasada: filtro de placa/motorista, Performance
Motorista/Ajudante/Carro, CTRC por carro, Por viagem, Prejuízo por motorista e opções de placa ficam
sem as viagens novas (CT-e "sem placa"). Hora: o SSW manda `HH:MM` com zero à esquerda; comparar
como texto dá a ordem cronológica (§9.1).

### 5.2 `romaneio_ultimo_036` (de `mv_romaneio_036_ctrc` / view `romaneio_036_ctrc`) — último romaneio por número

Chave (`empresa_id`, `numero_ctrc`) — **só o número** (CT-e de siglas diferentes com o mesmo número
viram uma linha). Índice (`empresa_id`, `romaneio`).

```ts
// Todas as linhas do 036 com ctrc e sswNum não nulos — INCLUI canceladas e romaneio null.
// 1 por (empresa, numero). Ordem (a 1ª vence): importado_em DESC, romaneio DESC (null PRIMEIRO),
//   (situacao === "BAIXADO") DESC (null primeiro), data_ocorr_ctrc DESC (null último),
//   hora_ocorr_ctrc DESC (null último), data_emissao DESC (null último).
// Colunas usadas: numero_ctrc, sigla_ctrc, romaneio, situacao, placa (normPlaca), motorista,
//   ajudante, ajudante_2, ajudante_3, cod_ocorr_ctrc, desc_ocorr_ctrc, data_emissao,
//   data_ocorr = data_ocorr_ctrc + (hora_ocorr_ctrc || "12:00") como horário de SP (null se sem data).
//   (frete_ctrc existe na matview mas ninguém lê: não portar.)
```

Consumidores: projeção 5.3; filtro de ajudante dos Motivos (§3.9); `aplicar_036_romaneio` (grava
em `ctrcs` romaneio_numero/situação, ajudantes, `ocorr_036_codigo/descricao/data` — ingestão, outra
spec) e a bonificação (que lê a staging direto). Recalcular: o número inteiro quando muda qualquer
linha do 036 com esse número. **Atenção**: hoje `aplicar_036_romaneio` lê a matview possivelmente
velha (refresh só às :15/:45), então os campos do 036 em `ctrcs` (e a "pendência documental", que
usa `ocorr_036_codigo = 44`) chegam com até ~30 min de atraso. No novo, atualizar esta projeção
**antes** de aplicar o 036 em `ctrcs`.

### 5.3 `romaneio_placa_atual` (de `mv_romaneio_ctrc_motorista` / views `romaneio_ctrc_motorista[_v2|_306]`)

Chave (`empresa_id`, `numero_ctrc`) — só o número.

```ts
// a = romaneio_ultimo_036 (5.2); b = último 306 por número:
//   staging_306 com numero_ctrc_norm não nulo (ctrc_coleta começa com 2–4 letras + dígito;
//   número = dígitos antes do "-", sem zeros); 1 por (empresa, numero): data DESC (null último),
//   importado_em DESC; placa = normPlaca, motorista.
// FULL JOIN por (empresa, numero):
placa     = a?.placa ?? b?.placa          // 036 sem placa cai no 306
motorista = a?.motorista ?? b?.motorista
// (unidade_destino, setor_destino, ocorrencia_mobile, ocorrencia_atual, data: ninguém lê; não portar)
```

Consumidores: colunas Placa/Motorista e busca da lista (§3.3); Listagem detalhada (`listar_ctrcs_detalhado`,
outra spec). Recalcular: o número quando muda 036 ou 306 dele. Atrasada: CT-e aparece "sem placa"
na lista/listagem.

### 5.4 `romaneio_saida_ctrc` (tabela + gatilho `_romaneio_saida_ctrc_sync`; view `mv_ctrc_saida_romaneio`)

Já é tabela; hoje é mantida **na hora** por gatilhos de comando em `staging_036_romaneios`
(INSERT/UPDATE/DELETE/TRUNCATE). Definição declarativa equivalente:

```ts
romaneioSaida = DISTINCT (empresa_id, sswNum(ctrc), sswSigla(ctrc), data_emissao) das linhas do 036
  com ctrc, data_emissao e sswNum não nulos e situacao !== "CANCELADO" (cada linha conta sozinha;
  sigla pode ser null; romaneio pode ser null)
```

Chave única (`empresa_id`, `data_saida`, `numero_ctrc`, `sigla_ctrc`) com nulos iguais; índice
(`empresa_id`, `numero_ctrc`, `sigla_ctrc`, `data_saida`). Novo: o worker mantém na mesma transação
da escrita da staging 036 (insere as chaves novas; ao alterar/apagar, remove a chave que ficou sem
nenhuma linha válida). Consumidores: base de data `saida` (§2.2) em todas as telas, inclusive
`listar_pagadores_ctrcs` e `tipos_documento_no_periodo` (outras specs). Diferença sutil para 5.1:
aqui basta **uma** linha não cancelada no dia; em 5.1 vale só a última importação de cada romaneio.

### 5.5 `ctrc_enriquecido_038_455` (de `mv_ctrc_staging_enriquecido` / view `ctrc_staging_enriquecido`)

Chave (`empresa_id`, `numero_ctrc` = `sswNorm(ctrc)`) — só o número.

```ts
// s038 = 1 por (empresa, numero) de staging_038_ctrcs_pendentes, importado_em DESC (empate sem ordem)
// s455 = 1 por (empresa, numero) de staging_455_ctrcs_expedidos, importado_em DESC
// FULL JOIN:
setor = trim(s038.setor) || null; bairro = trim(s038.bairro) || null;
endereco = trim(s038.endereco) || null; cep = trim(s038.cep) || null;
valor_mercadoria = s038?.valor_mercadoria ?? s455?.valor_mercadoria
// (prazo_entrega, atraso, localizacao, frete_455, peso_455, previsao_455, pagador_455: ninguém lê; não portar)
```

Consumidor único: lista do Romaneio (Setor, Bairro, endereço na dica, CEP na exportação, Vlr.
mercadoria, agrupamento por setor). Recalcular: o número quando muda 038 ou 455 dele. Hoje é a mais
lenta e roda em bloco próprio; se estoura, fica para a próxima rodada (setor/bairro velhos).

### 5.6 Não portar

`mv_romaneio_placa_motorista_dia` e a view `romaneio_placa_motorista` (ver §7).

---

## 6. Prazo do parceiro

"Parceiro" aqui é o **expedidor** do CT-e (`ctrcs.parceiro_id`/`parceiro_cnpj`/`parceiro_nome`,
vindo do 455), não o pagador. `prazo_origem` (`proprio|parceiro`) e `prazo_padrao_data` (emissão +
2 dias corridos; null para TROCA ou previsão anterior à emissão) vêm do núcleo (01).

### 6.1 Parâmetros da URL `/prazo-parceiro`

`periodo` ∈ `hoje|7d|30d|mes` (padrão **30d**, resolvido no navegador como no Romaneio, sem
`custom`); `unidades` (uuid[], opções = unidades ativas); `parceiros` (uuid[] de `parceiros`
ativos, por nome); `tipos`; `filtro` ∈ `nascidos|prazo_parceiro|todos` (padrão `nascidos`); `page`;
`size` ∈ {50, 100, 200}.

### 6.2 Visão geral (`calcular_prazo_parceiro`)

```ts
dias = max(1, fim − ini + 1); iniAnt = ini − dias; fimAnt = ini − 1;
base = ctrcs (sob RLS do usuário) .filter(c => c.data_emissao ∈ [ini, fim] && universoPrazoParceiro(c)
  && casaTipos(c) && (unidades == null || unidades.includes(c.unidade_id))
  && (parceiros == null || parceiros.includes(c.parceiro_id)));
penalizado(c) = existe ocorrência (sob RLS) do CT-e com o.penaliza === true
  // coluna DA OCORRÊNCIA (não o cadastro), qualquer código, data, responsável ou quarentena
nascido(c)  = c.data_prevista_entrega != null && c.prazo_padrao_data != null
              && c.data_prevista_entrega < c.prazo_padrao_data
avaliado(c) = c.prazo_padrao_data != null && c.data_prevista_entrega != null

totais = {
  total_ctrcs: base.length, total_proprio: count(origem "proprio"), total_parceiro: count(origem "parceiro"),
  penalizados_total: count(penalizado), penalizados_proprios: count(penalizado && proprio),
  nascidos_atrasados: count(nascido), nascidos_avaliados: count(avaliado),
  pct_nascidos: avaliados > 0 ? nascidos / avaliados : null,
  performance_total:   total > 0 ? 1 − pen / total : 1,
  performance_propria: proprio > 0 ? 1 − penProprio / proprio : 1,
  diferenca_pp: performance_propria − performance_total,
  pct_prazo_proprio:  total > 0 ? proprio / total : 0,
  pct_prazo_parceiro: total > 0 ? parceiro / total : 0,
}
// Período anterior: mesmos filtros em [iniAnt, fimAnt].
ant = { performance_total: totalAnt > 0 ? 1 − penAnt/totalAnt : null,
        performance_propria: proprioAnt > 0 ? 1 − penPropAnt/proprioAnt : null,   // null (não 1) sem base
        diferenca_pp: (ambos != null) ? propria − total : null,
        nascidos_atrasados: nascidosAnt,
        delta_nascidos: nascidos − nascidosAnt,
        delta_gap_pp: ant.diferenca_pp == null ? null : diferenca_pp − ant.diferenca_pp }
```

Ranking por parceiro (só CT-e com `parceiro_id` ou `parceiro_cnpj`):

```ts
grp = c.parceiro_id ?? ("cnpj:" + c.parceiro_cnpj)
por grupo: total, qtd_parceiro = count(origem "parceiro"), nascidos = count(nascido),
  nascidos_avaliados = count(avaliado), pen = count(penalizado),
  idAny/cnpjAny/nomeAny = 1º valor não nulo na ordem de leitura (nome pode variar — ver §9.4)
cadastro = parceiros por id (se idAny) senão por cnpj = cnpjAny (se mais de um parceiro tiver o
           mesmo CNPJ, a linha DUPLICA — ver §9.4)
linha = { parceiro_id: idAny ?? grp, nome: cadastro?.nome ?? nomeAny ?? cnpjAny ?? "— sem nome —",
  usa_ssw: cadastro?.usa_ssw ?? null, total, qtd_parceiro, pct_parceiro: qtd_parceiro/total,
  nascidos_atrasados: nascidos, nascidos_avaliados,
  pct_nascidos: avaliados > 0 ? nascidos/avaliados : 0,
  performance_com_parceiro: total > 0 ? 1 − pen/total : 1 }
ordem: nascidos DESC, performance_com_parceiro ASC, total DESC (empate sem ordem; sugerido nome)
```

Tela:

| Elemento | Regra |
| --- | --- |
| Faixa verde | `diferenca_pp > 0,03`: "Sua performance real é **+x,x pp** melhor… N CTRC(s) foram emitidos a menos de 48 horas" |
| Faixa amarela | 1º parceiro do ranking com `pct_nascidos > 0,3` e `nascidos ≥ 3` |
| Faixa neutra | `|delta_gap_pp| > 0,05`: "O impacto de prazos herdados aumentou/diminuiu x,x pp" |
| Performance total / própria | `x,x%`; cor: ≥ meta verde, ≥ alerta amarelo, senão vermelho (meta/alerta da configuração SLA da empresa; padrão 0,95/0,90) |
| Diferença | `±x,x pp` (`diferenca_pp × 100`, 1 casa, "+" se > 0); verde se > 0 |
| Origem do prazo | barra proprio/parceiro com quantidades e `%` sem casas |
| Nascidos em atraso | `nascidos_atrasados`, "· x% dos CTRCs avaliados", "+N/−N vs período anterior" (`delta_nascidos`, vermelho se > 0) |
| Ranking | top 10 (`slice(0,10)`); colunas Parceiro (+ "usa SSW"), CTRCs, Prazo do parceiro (qtd e %), Nascidos em atraso (qtd e %; vermelho se `pct > 0,1`), Performance (`performance_com_parceiro`, cor SLA). Clique abre `/prazo-parceiro/$id` com período, unidades e tipos |

Exemplo: total 100, penalizados 10, próprios 80 com 4 penalizados ⇒ performance total 90,0%,
própria 95,0%, diferença +5,0 pp (faixa verde aparece: 0,05 > 0,03).

### 6.3 Lista do rodapé (hoje só TS + PostgREST, `getPrazoParceiroLista`)

```ts
linhas = ctrcs (RLS) .filter(c => FP.has(c.filial)                  // filial, não unidadeResponsavel; sem fora_universo
  && c.data_emissao ∈ [ini, fim] && unidades/parceiros (parceiro_id)/tipos
  && (filtro !== "prazo_parceiro" || c.prazo_origem === "parceiro")
  && (filtro !== "nascidos" || c.prazo_padrao_data != null))
  // lido em blocos de 1000, no máximo 8000 linhas (ordem de leitura sem ORDER BY)
diasEstouro = prev && padrao ? round((padrao − prev) em dias) : null   // positivo = nasceu atrasado
nasceu = diasEstouro != null && diasEstouro > 0
filtro "nascidos" ⇒ só nasceu
unidade_nome = c.filial ?? unidades.nome ?? (cidade/uf da unidade) ?? null
parceiro_nome = parceiros.nome ?? c.parceiro_nome
ordem: data_embarque DESC (nulos por último; estável); paginação no servidor depois de tudo carregado
```

Colunas: CTRC, Parceiro, Embarque, Prazo entrega (`data_prevista_entrega`), Mínimo 48h
(`prazo_padrao_data`), Abaixo do padrão (dias) (vermelho se nasceu), Origem (Parceiro/Próprio),
Status, Setor, Unidade. Rodapé "N CTRC(s)" e selo "amostra truncada em 20k" quando bateu o teto (o
teto real é 8.000 — ver §9.4). Clique abre `/ctrc/$numero`.

### 6.4 Detalhe do parceiro (`calcular_prazo_parceiro_detalhe`)

```ts
base = ctrcs (RLS) com parceiro_id === id (só por id), emissão no período, universoPrazoParceiro, tipos, unidades
resumo = { total, total_proprio, performance_total, performance_propria, nascidos_atrasados, ... }  // mesmas fórmulas de 6.2
histograma = para c com prev < padrao: d = padrao − prev (dias);
  faixa = d ≤ 1 "1 dia" | ≤ 2 "2 dias" | ≤ 3 "3 dias" | ≤ 5 "4-5 dias" | ≤ 10 "6-10 dias" | "11+ dias";
  só faixas com qtd > 0, na ordem acima
nascidos = mesmos CT-e, data_emissao DESC (null último), até 500 (empate sem ordem):
  { id, numero_ctrc, data_embarque, data_emissao, prazo_entrega: data_prevista_entrega,
    dias_estouro: padrao − prev, prazo_padrao_data, prazo_padrao_dias, status_atual, setor,
    unidade_nome: c.filial ?? unidades.nome, cidade_destino, uf_destino } + sigla (consulta por id)
```

Tela: cabeçalho com nome e "· acordo: Nh" (`prazo_acordo_horas`); cards Performance total
(dica "N CTRC(s)"), Performance própria ("apenas N com prazo próprio"), Diferença =
`propria − total` em pp (dica nascidos); histograma "Atraso na origem" (barra ∝ maior qtd; vazio:
"Nenhum CTRC nasceu atrasado neste período. 🎉"); tabela CTRC, Embarque, Prazo entrega, Mínimo 48h,
Abaixo das 48h (dias), Status, Setor, Destino, Unidade.

Exemplo: emissão 10/11, previsão 11/11 ⇒ padrão 12/11, d = 1 ⇒ "1 dia".

---

## 7. Exportações

Todas saem com a identidade visual da empresa (biblioteca de exportação — outra spec). Nome do
arquivo: `<base>-<sufixoHoje>`; Excel com título e subtítulo; PDF com título/subtítulo e tabela.
Coluna "Link SSW" em toda exportação que lista CT-e um a um (CSV: URL; Excel/PDF: link "Abrir no
SSW").

### 7.1 Lista do Romaneio (aba Total) — botão Exportar (CSV, Excel, PDF)

Servidor refaz a consulta da lista (`get_romaneio_v3`) com **os mesmos filtros e recorte da tela**,
mas: ordem `data_emissao DESC, id ASC`; até **10.000** linhas; "só as marcadas" vai por `ids` (lista
vazia ⇒ nada); "todas menos as desmarcadas" tira os ids depois. Enriquece com sigla, placa de
coleta/entrega, CT-e vínculo, pagador (consulta a `ctrcs` em blocos de 400) e a última ocorrência
efetiva (como a tela). Sem linhas: aviso "Nenhum registro no filtro atual — o arquivo não foi
gerado." No navegador, ordena por placa (romaneio, senão coleta, senão entrega; sem placa por
último; estável).

Colunas (34): NF, CTRC, Status, Emissão, Embarque, Prazo, Parceiro, Unidade, Cidade Unid., Local.
atual, Placa, Motorista, Remetente, Cliente destino, Destino, Setor, Bairro, Vlr. mercadoria (R$),
Peso (kg), Volumes, Frete (R$), Última ocorrência, Atraso ("" / "Resp. cliente" / "N dia(s)" /
"No prazo" se entregue com performance_dias), Alertas (separados por ", "), Pagador, Endereço, CEP,
Código última ocorrência, Data/hora última ocorrência, Em rota agora ("Sim" se `romaneado_status =
sim`; "Não" para quarentena/não rastreado), Placa coleta, Placa entrega, CT-e vínculo, Link SSW.
Datas `dd/mm/aaaa` (data/hora curta pt-BR). PDF: só as 24 primeiras + Link SSW, fonte 5,5.
Arquivo `romaneio-<periodo>-<sufixo>`, título "Romaneio", subtítulo "Período: dd/mm/aaaa a
dd/mm/aaaa · N registros".

### 7.2 Exportações de tabela (exportam as linhas já na tela; CSV/Excel/PDF; ordenam por placa quando há coluna "Placa"/"Placas")

| Onde | Arquivo | Título | Colunas |
| --- | --- | --- | --- |
| Hoje — tabela | `romaneio-hoje` | Romaneios de hoje (subtítulo = dia) | Romaneio, Data, Situação, Placa, Motorista, Ajudante 1..N, Rota, Bairros, CT-e, Frete, Entregues, Não entregues, Performance (1 casa; vazio se 0 CT-e), Prejuízo |
| Hoje — gaveta | `romaneio-hoje-faixa` | Romaneio · <faixa> | NF, CT-e, Romaneio, Destinatário, Pagador, Cidade/UF, Emissão, Prazo, Situação, Placa, Link SSW |
| CTRC por carro | `romaneio-ctrc-por-carro` | CTRC por carro | Placa ("Sem placa identificada"), Motorista, CTRC, Peso (kg), Volumes, Frete |
| Por viagem | `romaneio-por-viagem` | Por romaneio (viagem real) | Romaneio, Data, Situação, Placa, Motorista, Ajudantes, CTRC, Remanejadas, Frete, Entregues, Não entregues, Performance (1 casa), Frete perdido |
| Motorista | `romaneio-motorista` | Performance por motorista | Motorista, [Placas só com `romaneio_placa`], Equipe, Qtd. viagens, CTRC — levados, CTRC — entregues, CTRC — prejudicadas, Prejudicadas (cód. 13), % Performance (2 casas) |
| Ajudante | `romaneio-ajudante` | Performance por ajudante | Ajudante, [Placas], Qtd. viagens, levados, entregues, prejudicadas, Prejudicadas (cód. 13), % Performance |
| Por carro | `romaneio-performance-carro` | Performance por carro | Motorista ("Sem romaneio de entrega"), Placa, Entregas, Entrega prejudicada, Performance (%), % Prejudicada (2 casas) |
| Prejuízo por dia | `romaneio-prejuizo-tendencia` | Prejuízo por dia | Dia (dd/mm/aaaa), CTRC, Frete |
| Rankings do prejuízo | `romaneio-prejuizo-cidade` / `-pagador` / `-motorista` | Prejuízo — Cidades/Pagadores/Motoristas | Nome, Placa, CTRC, Frete |

### 7.3 Prazo do parceiro (CSV e Excel; sem PDF)

- Lista: busca de novo com `exportAll` (até 20.000 pedidos, mas o teto de leitura é 8.000).
  Colunas: CTRC, Parceiro, Embarque, Prazo entrega, Mínimo 48h, Abaixo do padrão (dias), Origem do
  prazo (Parceiro/Próprio), Status, Setor, Unidade, Nascido em atraso (Sim/Não), Link SSW. Datas em
  ISO cru (`AAAA-MM-DD`). Arquivo `prazo-parceiro-<periodo>-<sufixo>`, título "Prazo do parceiro".
- Detalhe: as até 500 linhas. Colunas: CTRC, Embarque, Prazo entrega, Mínimo 48h, Abaixo das 48h
  (dias), Status, Setor, Destino (`cidade/uf`), Unidade, Link SSW. Arquivo
  `prazo-parceiro-<nome-em-slug>-<sufixo>`, título "Nascidos em atraso — <parceiro>", aba "Nascidos
  em atraso".

---

## 8. Código morto (não portar)

Prova por busca no app (`src/`, multiempresa e `main`) e nas 217 funções.

| Item | Prova |
| --- | --- |
| `romaneio_placas_motoristas_periodo` + `getRomaneioPlacas` | Só exportado em `features/romaneio/index.ts`; nenhum componente chama `getRomaneioPlacas`; nenhuma função SQL chama a RPC. |
| `mv_romaneio_placa_motorista_dia` | Fora do refresh desde 26/10 (comentário em `refresh_romaneio_matviews`: "nenhuma função nem tela lê"); nenhuma função nem arquivo de `src` a lê. |
| View `romaneio_placa_motorista` (sobre `bi2_viagens`) | Nenhuma função nem arquivo de `src` a lê. |
| Views `romaneio_ctrc_motorista_v2`/`_306`, `romaneio_036_ctrc`, `ctrc_staging_enriquecido`, `romaneio_ctrc_motorista`, `mv_ctrc_saida_romaneio` | Camadas sobre as matviews/tabela; viram as projeções da §5. |
| `refresh_romaneio_matviews`, `_romaneio_saida_ctrc_sync`, `_romaneio_filtro_periodo` | Viram job do worker / manutenção na ingestão / montagem da consulta no backend. |
| Parâmetros `p_placa`/`p_motorista` (singular) de todas as RPCs; `placa`/`motorista` no `ExportFilters` e no input | A URL converte `placa=`/`motorista=` legados em `placas`/`motoristas`; nenhuma tela preenche o singular; Motivos recebe `null`. |
| `p_romaneado` valores `quarentena`/`nao_rastreado` em `get_romaneio_v3` e `romaneio_base` (`quarentena`, `nao_rastreado`) | URL aceita só `todos\|sim\|nao`; `romaneio_base` só é chamada com `todos` ou `sim`. |
| Recortes `pendencia_documental`, `tde_aguardando`, `nunca_movimentou` de `get_romaneio_v3` | O servidor só aceita `ROMANEIO_RECORTES` (não os inclui) e a lista do Romaneio é o único chamador. |
| `RomaneioInput.modo` (sempre `em_andamento`), `orderBy` (ignorado — ver §9.4), `exportAll`/`exportLimit`, `codigo` (legado — a URL já converte), `groupBy` no base_totais | Sempre o mesmo valor ou nunca enviados. |
| Saída `equipe` (subtotal por filial) do `get_romaneio_v3` + as N consultas de `unidade_cidade` por filial em `getRomaneio`; `unidades`; `parceiros: []`; `pendencia_documental`/`_data` das linhas; `totais.romaneado/quarentena/nao_rastreado` | Nenhum componente lê (`data?.equipe`, `.unidades`, `pendencia_documental` só aparecem no `.functions.ts`). |
| Saídas de `get_romaneio_base_totais`: `romaneado`, `quarentena`, `nao_rastreado`, `sem_conclusao*`, `nunca_movimentou`, `travado_frete`, `pendencia_documental`, `tde_aguardando*` | Mapeados no servidor, nunca lidos pela tela (o TDE aguardando foi para a Performance em 28/10). |
| Saídas de `romaneio_kpis`: `quarentena`, `nao_rastreado`, `finalizado_sistema`, `retorno_13`, `retorno_13_aberto` | A tela lê só `total, romaneado, entregue, nao_entregue, prejudicada, frete_romaneado, frete_perdido`. |
| Saídas de `romaneio_do_dia`: `resumo.em_rota`, `nao_entregues`, `prazo_*_aberta`, `prazo_*_em_rota` | Hoje usa `ctrcs − entregues` e as faixas `_nao_entregue`; o resto só é mapeado. |
| Saídas de `get_romaneio_prejuizo`: `ctrcs`, `frete`, `frete_periodo` | Cards removidos ("repetiam os cards do topo"). |
| `ajudante1..3` de `romaneio_performance_motorista` (e a subconsulta de membros) | A tabela não tem a coluna; a exportação também não. |
| `retorno` em `romaneio_performance_carro` | Calculado e não usado na saída. |
| Saída `placa`/`motorista` (sempre null) de `romaneio_motivos_nao_entrega` | Constante nula. |
| Prazo parceiro: `prazo_medio_horas`, `prazo_acordo_horas`, `nascidos_avaliados` por parceiro; `totais.penalizados_*`; `comparacao_anterior.performance_*`/`diferenca_pp`/`nascidos_atrasados` (só os deltas são lidos); `atualizado_em`; `periodo*`; detalhe `resumo.total_parceiro/penalizados_*/nascidos_avaliados`, `parceiro.usa_ssw` | Não lidos pela tela (campos usados listados por busca em `prazo-parceiro*.tsx`). Os valores intermediários continuam calculados para os deltas. |
| Colunas de matview sem leitor | `frete_ctrc` (5.2); `unidade_destino/setor_destino/ocorrencia_*/data` (5.3); `prazo_entrega/atraso/localizacao/frete_455/peso_455/previsao_455/pagador_455` (5.5). |

---

## 9. Dúvidas para o dono e pontos de fidelidade

### 9.1 Técnicas (conferir no banco antes de portar, sem decisão de negócio)

1. `SHOW timezone` da sessão das RPCs: a spec assume **UTC**. Disso dependem a base "conclusão"
   (−1 dia) e o "≥ emissão" das ocorrências 85/13.
2. Collation do banco (ordem de `max(texto)`, `string_agg ... ORDER BY`, opções ordenadas,
   `ORDER BY numero_ctrc`). Se for `C`/`C.UTF-8`, comparar por código; se `en_US`, usar collation
   equivalente.
3. Formato de `hora_emissao`/`hora_ocorr_ctrc` no 036: a ordem por texto só é cronológica com
   `HH:MM` com zero à esquerda.

### 9.2 Dados

1. Código de ocorrência não numérico em `ocorr_efetiva_codigo`/`ultima_ocorr_codigo_0013`/
   `ult_ocorr_codigo_0174` faz a RPC atual **falhar** (cast). No TS a spec trata como `null`.
   Confirmar que nunca acontece.
2. Número de CT-e não é único: 5.2, 5.3 e 5.5 são por número (placa/setor de um CT-e pode vir do
   "gêmeo" de outra sigla); a aba Hoje junta CT-e com sigla nula do lado do CT-e e pode contar
   duplicado.

### 9.3 Negócio — decidir antes de portar

1. **Hoje sem escopo e sem universo**: usuário restrito a uma unidade vê todos os romaneios do dia,
   inclusive CT-e fora do universo (`fora_universo`). Manter?
2. **Motivos de não entrega sem escopo do usuário** (as outras abas aplicam). Manter?
3. **Placa protegida só nas abas Motorista/Ajudante**: a mesma placa aparece na lista, Hoje, Por
   viagem, CTRC por carro, Por carro e Prejuízo. A permissão deveria valer em todas?
4. Opções de "Local. atual" são uma lista fixa de siglas da FR (inclusive no multiempresa).
   Trocar pelas filiais próprias da empresa?
5. Detalhe de parceiro **identificado só por CNPJ** (sem cadastro): o ranking manda `cnpj:...` como
   id, a rota espera uuid e o detalhe dá erro.

### 9.4 Comportamentos estranhos de hoje (replicar ou corrigir?)

Pela regra "o usuário não percebe diferença", a spec descreve todos como estão. Sugestão de
decisão em cada um:

1. **Ordenação da lista ignorada**: o servidor força `data_prevista_entrega ASC` (a tela sempre
   manda `modo=em_andamento`); clicar no cabeçalho só muda a seta. Sugestão: corrigir (respeitar a
   coluna) — é perceptível, mas é o que o botão promete.
2. **Agrupamento limitado a 500 linhas**, com selo "paginação desativada (até 2000)". Sugestão:
   corrigir para 2000 ou trocar o texto.
3. **Card × lista do "Em rota"/"Travado"/"Somente romaneados"**: os cards usam `emRotaFlag`/
   `travadoFlag` (3.2) e a lista aberta pelo card usa `emRota85`/`travadoCtrc` (3.3.2). Divergem
   quando a efetiva é 85 com a saída em quarentena/anterior à emissão, ou quando a efetiva não é 85
   mas o 0013/0174 é. Sugestão: unificar numa regra só (decidir qual).
4. **Prejuízo com janelas diferentes**: cards, KPIs, Hoje, Por viagem e Performance contam a
   ocorrência penalizante **dentro do período**; a aba Prejuízo (dia/hora/rankings) conta **em
   qualquer data**. Sugestão: unificar pela janela do período.
5. **Prejuízo (%) e Entregas prejudicadas** contam CT-e que não saíram para entrega; Performance
   por carro exige "saiu". Manter?
6. Base **"conclusão"** desloca 1 dia (§2.2). A tela só oferece Emissão/Saída, mas a URL e o
   navegador ainda aceitam `conclusao`/`embarque`/`prevista`. Sugestão: manter as 5 por
   compatibilidade de link e corrigir o −1 dia, ou retirar as 3 bases não oferecidas.
7. **Gaveta da aba Hoje**: com mais de 2000 CT-e na faixa, o corte é feito antes da ordenação
   (amostra arbitrária). Sugestão: ordenar antes de cortar.
8. **Prazo do parceiro — universo da lista ≠ dos cards**: a lista usa `filial ∈ FP` e não tira
   `fora_universo`; os cards usam `unidade_destino ?? unidade_atual ?? filial` e tiram. E o
   Romaneio usa uma terceira regra (unidade responsável). Sugestão: lista igual aos cards.
9. **Prazo do parceiro — teto da lista**: lê no máximo 8.000 CT-e em ordem indefinida (antes de
   filtrar os nascidos), e o selo diz "truncada em 20k". Sugestão: filtrar e ordenar no banco.
10. **Prazo do parceiro — datas um dia antes na tela**: `new Date("AAAA-MM-DD")` lido em UTC e
    mostrado no fuso do navegador (Embarque, Prazo entrega, Mínimo 48h aparecem com −1 dia no
    Brasil; a exportação sai certa). Sugestão: corrigir.
11. **Prazo do parceiro — penalizado** usa a coluna `ocorrencias.penaliza` (qualquer código, data
    ou responsável), enquanto o Romaneio usa o cadastro do código + responsável FR + código 13.
    Confirmar que é intencional.
12. Prazo do parceiro: nome do grupo pode variar entre execuções (1º nome não nulo na ordem de
    leitura) e um CNPJ com dois cadastros duplica a linha do ranking.
13. `filiais`/`unidadeAtual` com siglas que não são próprias: o recorte esvazia e o filtro some
    (mostra todas). Sugestão: devolver vazio.
14. Busca livre trata `%` e `_` digitados como curingas.

### 9.5 Projeções

Atualizar as projeções na ingestão (sem o atraso de até 30 min de hoje) muda o "quando", não o
"quanto". Se o dono preferir o comportamento idêntico, agendar nos minutos 15 e 45.
