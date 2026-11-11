# @erp/dominio

Regras de negócio puras (sem I/O, sem relógio escondido): recebem dados, devolvem decisões. Usadas
pela API e pelo worker. Quem lê e grava no banco são os repositórios/casos de uso.

## Núcleo do CT-e — `@erp/dominio/nucleo`

Especificação: `docs/regras/01-nucleo-ctrc.md`. Decisões do dono aplicadas:
`docs/duvidas-do-dono.md` (Q07, Q11, Q19–Q23, Q25, Q26, Q48, Q54); o que muda para o usuário está
em `docs/mudancas-visiveis.md` ("Núcleo do CT-e").

Convenções: dia de negócio é `DataIso` (`AAAA-MM-DD`, dia de **Brasília** — Q11); instantes são
`Date`; quem precisa de "hoje" recebe `agora: Date` do relógio injetado. Os nomes dos campos são os
do schema Drizzle (`packages/db/src/schema/dominio/ctes.ts`), então a linha do repositório entra
direto.

### 1. Gravar um CT-e — `prepararGravacaoDoCte`

```ts
prepararGravacaoDoCte<T extends CteNucleo>({ antigo, novo, fonte, contexto }): GravacaoDoCte<T>
// contexto: { ocorrencias, catalogo, filiais, regrasDePrazo, config, ocorrenciasMudaram }
// → { tipo: "descartar", motivo } | { tipo: "gravar", cte, mudou, trocaDePrevisao }
```

**Quem chama:** todo caso de uso que cria ou altera CT-e — ingestão SSW (038/455/930/036/306,
estornos), BI2 0017 (`fonte: "bi2"` ou `"bi2_0017_prazo_entregue"`), webhook, trackingdanfe, XML,
import CSV, Admin (prazos configurados, `duplicado_de`, alteração de código). **E** todo caso de uso
que grava/apaga ocorrência, para cada CT-e afetado, depois de gravar a ocorrência.

**Como:** na transação, carregue a linha atual (`antigo`, `null` na criação), aplique o que chegou
por cima (`novo`), carregue as ocorrências do CT-e (todas, já com a nova), o catálogo de códigos
(`montarCatalogo`), as filiais, as regras de `prazos_configurados` e `lerConfiguracaoDoNucleo(...)`
da empresa do CT-e. Depois:

- `descartar` → não grava nada, sem erro (data mínima de emissão, BI2 criando CT-e, BI2 em CT-e
  em andamento). Logue o `motivo` se quiser.
- `gravar` com `mudou: false` → não grave (nem `atualizado_em`, nem histórico).
- `gravar` com `mudou: true` → grave `cte` com `atualizado_em = agora` (Q55) e, se
  `trocaDePrevisao` vier, insira em `cte_prazo_historico`.

Ordem interna (cada passo usa os anteriores): emissão ancorada na 80 → cidade da filial → filial
efetiva e dígitos do pagador → cancelado no mesmo dia → ocorrência efetiva → data de conclusão →
previsão (regra configurada ou SSW) → prazo padrão → embarque → status atual → fora do universo.
Tudo é recalculado em toda gravação (Q20), não só quando "a coluna veio no SET" — menos o status
atual, que só é refeito com `ocorrenciasMudaram: true` (a gravação inseriu, alterou ou apagou
ocorrência do CT-e, ou o catálogo do código mudou), como o gatilho de hoje; fora disso fica o
gravado (ex.: o "CANCELADO" do XML).

`recalcularDerivadosDoCte(cte, contexto)` devolve só os campos derivados (`DerivadosDoCte`), para
conferências e para o migrador (recalcular tudo e listar diferenças antes da virada — Q52).

Quem grava uma previsão vinda do SSW grava também a `prazoFonte` dela (nunca `regra_*`): o núcleo
guarda essa previsão em `previsaoSsw*` e volta a ela quando a regra configurada deixa de valer
(Q19).

Em `campos_ssw` vão os nomes de **coluna** (snake_case) do `ctes`; `campoDaColuna` converte.

### 2. Gravar uma ocorrência — `prepararOcorrencia`

```ts
prepararOcorrencia({ ocorrencia, cte, catalogo, empresa, trackingdanfe }): OcorrenciaPreparada
// → { tipo: "gravar", quarentena, responsavel, penaliza } | { tipo: "descartar", motivo }
```

Antes: se o código não está no catálogo, insira `codigoRecebidoSemCadastro(codigo, descricao)`
(fora de 0–99 devolve `null` = não grava). Depois de gravar: `prepararGravacaoDoCte` do CT-e.

Catálogo: ao **cadastrar** código no Admin aplique `derivarResponsavelPeloTipo`; ao **alterar**,
`efeitoDaAlteracaoDeCodigo(antes, depois)` diz se regrava `responsavel/penaliza` em todas as
ocorrências do código e se recalcula os CT-e que têm o código.

Webhook: `cidadeDoComplemento(complemento)` dá o nome a buscar em `filiais_apelidos`.

### 3. Regras de leitura (telas, consultas, exportação)

| Função                                                                                                   | Para quê                                                                    |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `estaEntregue`, `estaFinalizadoSemEntrega`, `estaEmAberto`                                               | situação pela efetiva gravada                                               |
| `codigoSituacao`                                                                                         | código do seletor/gráfico "Ocorrência" (entrega sem efetiva de entrega = 1) |
| `atrasoDias`                                                                                             | atraso pela previsão atual (aberto = hoje − previsão)                       |
| `estaSemMovimento`                                                                                       | alerta "sem movimento" (`config.limiteSemMovimento` ou o da tela)           |
| `faixaPrevisao`, `statusPrevisto`                                                                        | bloco "Previstos"                                                           |
| `saiuParaEntrega`, `emRota`, `travadoEmOcorrencia`                                                       | Romaneio / Listagem                                                         |
| `efetivaParaLeitura`                                                                                     | efetiva gravada + responsável do cadastro (leitura em lote)                 |
| `diasUteisEntre` + `feriadosQueContamNosDiasUteis`                                                       | SLA em dias úteis (só nacionais — Q23)                                      |
| `nascidoEmAtraso`                                                                                        | indicador de prazo mínimo                                                   |
| `podeVerTudo`, `podeVerCte`                                                                              | escopo por unidade/equipe (Q26; sem escopo, vê tudo)                        |
| `padroesTextoFiltro` / `casaFiltroTexto`                                                                 | filtro "a\|b" (`col ILIKE ANY($padroes)`)                                   |
| `formatarCnpjCpf`, `normalizarNome`, `tipoDocumentoEfetivo`, `filiaisProprias`, `cnpjsPropriosDaEmpresa` | utilidades da ingestão e das telas                                          |

Agregações grandes rodam em SQL montado pelo repositório com a **mesma** regra: os parâmetros saem
daqui (`hojeSp(agora)`, `[...codigosDeBaixa(catalogo)]`, `padroesTextoFiltro(f)`,
`filiaisProprias(...)`). Os fragmentos equivalentes estão na spec (§2–§5); teste as duas formas
com os mesmos casos.

### 4. Configuração — `lerConfiguracaoDoNucleo` / `validarConfiguracaoDoNucleo`

Chaves de `configuracoes`: `alerta_dias_sem_movimento` (3), `ctrc_data_minima_emissao` (sem
trava), `prazo_padrao_dias` (2) e `raiz_cnpj_troca` (`00193687`) — padrões da FR (Q48). O caso de
uso que grava configuração chama `validarConfiguracaoDoNucleo` (valor inválido vira 422 para o
operador).
