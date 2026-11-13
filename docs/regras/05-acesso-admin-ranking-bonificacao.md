# R5 — Identidade, acesso, multiempresa, auditoria, admin, ranking, bonificação e Ahgora

Especificação extraída do sistema atual para o porte em TypeScript. Fonte da verdade para os
módulos `auth`, `sessao`, `admin`, `plataforma`, `auditoria`, `ranking`, `bonificacao` e `ahgora`
do `erp-ssw`.

**Fontes lidas** (só leitura):

- Banco: `erp-ssw-referencia/banco/funcoes/*.sql` (definição real) e `schema-public.sql`
  (tabelas, gatilhos e as **161 políticas RLS**).
- Código: `fr-transportes/.claude/worktrees/agent-ae0264d9f8203d8fa` (branch `feat/multiempresa`,
  F0–F6 + correções de segurança de 09/11). Caminhos abaixo são relativos a `src/` desse worktree.
- `docs/multiempresa/README.md` (§2.3, 4, 6–15), `docs/decisoes/*.md`,
  `docs/vps/paridade.md` (branch `feat/vps`).

Convenções deste documento:

- "papel" = `empresa_usuarios.role_key` (no código atual: `role`); "cargo" = linha da tabela
  `roles`. São a mesma coisa vista da tela (o menu diz "Roles").
- "Plataforma" = usuário em `plataforma_admins` (equipe Scale IA).
- "empresa ativa" = resultado de `empresa_atual()` (§1.4).
- "hoje" é sempre o dia em `America/Sao_Paulo`, salvo quando dito o contrário.
- Pseudocódigo em TS é normativo: o porte deve dar o mesmo resultado nos mesmos dados.

---

## 1. Modelo de acesso

### 1.1 Entidades

| Tabela atual | Chave | Campos que importam | Observação para o porte |
| --- | --- | --- | --- |
| `auth.users` (Supabase) | `id uuid` | `email`, `encrypted_password`, `raw_user_meta_data.nome/setor`, `raw_app_meta_data.role_key`, `email_confirmed_at` | Vira a tabela de usuários do backend (§2). **Manter o mesmo `id`**: tudo referencia ele. |
| `usuarios_perfil` | `id` (= `auth.users.id`) | `nome`, `email`, `ativo` (global), `setor` (enum legado), `departamento_key`, `unidade_id`, `empresa_ativa_id` | `ativo` e `setor` ainda são lidos (§1.8). `departamento_key`/`unidade_id` são legado (§8). |
| `empresas` | `id` | `slug` (único, `^[a-z0-9][a-z0-9-]*$`), `nome`, `nome_curto`, `razao_social`, `cnpj`, `dominio_ssw`, `logo_path`, `cor_primaria` (`#212a63`), `cor_destaque` (`#c0392b`), `slogan`, `fuso` (`America/Sao_Paulo`), `status` ∈ `implantacao/ativa/suspensa/encerrada` (padrão `implantacao`), `criado_*`, `atualizado_*` | FR = `f0000000-0000-4000-8000-000000000001`. |
| `empresa_usuarios` (vínculo) | `(empresa_id, user_id)` | `role_key` (FK `roles.key`, pode ser nulo), `departamento_key`, `unidade_id`, `ativo`, `criado_em`, `criado_por` | **Fonte do papel, departamento, unidade e ativo por empresa.** |
| `plataforma_admins` | `user_id` | `criado_em`, `criado_por` | Nunca pode ficar vazia (§3.2). |
| `roles` (cargos) | `key` | `label`, `is_protected` | **Global** (sem `empresa_id`). Seeds: `super_admin` (protegido), `admin`, `gestor`, `operador`, `equipe`. |
| `role_screen_permissions` | `(role_key, screen)` | — | Global. |
| `departamentos` | `key` (**PK global**) | `label`, `descricao`, `ativo`, `is_protected`, `empresa_id` | Por empresa, mas a chave é única entre todas as empresas. |
| `departamento_screen_permissions` | `(departamento_key, screen)` | `empresa_id` | Por empresa. |
| `user_screen_permissions` (exceções) | `id`; único `(user_id, screen, empresa_id)` | `allowed` | Por empresa. |
| `user_roles` | `id`; único `(user_id, role_key)` | — | **Legado**: espelho do papel quando o usuário tem um vínculo só. Não portar (§8). |
| `modulos` (catálogo) | `key` | `nome`, `descricao`, `telas text[]`, `essencial`, `ordem` | Mantido por migration (12 linhas, §1.7). |
| `empresa_modulos` | `(empresa_id, modulo_key)` | `ativo` (padrão true), `inicio`, `fim` (check `inicio <= fim`), `observacao`, `atualizado_*` | |
| `empresa_integracoes` | `id`; único `(empresa_id, tipo)` | `tipo` ∈ `sftp/ssw_api/ssw_bi2/ssw_webhook/ahgora/xml_cte`, `ativo` (padrão **false**), `parametros jsonb`, `segredo_id`, `segredo_definido_em`, `ultimo_teste_*` | Segredo hoje no Vault; no novo, AES-256-GCM no backend. |
| `auditoria` | `id bigint` | `empresa_id` (nulo = Plataforma), `ator_id`, `ator_email`, `ator_tipo` ∈ `usuario/plataforma/sistema/integracao`, `acao`, `entidade`, `entidade_id`, `resumo`, `antes`, `depois`, `ip`, `user_agent`, `criado_em` | Só insert. §4. |
| `configuracoes` | único `(chave, empresa_id)` NULLS NOT DISTINCT | `valor text`, `descricao`, `grupo`, `updated_by` | `empresa_id` nulo = chave da Plataforma. |

### 1.2 Papéis

O papel é texto livre (qualquer `roles.key`), mas o código dá significado fixo a três:

| Papel | Significado codificado |
| --- | --- |
| `super_admin` | Admin da empresa. Único que redefine senha de outro `super_admin` (§3.1). Cargo protegido: telas não editáveis, não pode ser apagado. |
| `admin` | Admin da empresa: telas `admin_*` (via cargo/exceção), Logs da empresa, cadastros. |
| `gestor` | Gestão do ranking/bonificação por regras (equipes, membros, regras, token público) e pode receber por exceção a tela `admin_bonificacao_entrega`. Vê todos os CT-e (`pode_ver_tudo`). |
| demais (`operador`, `equipe`, criados pela Plataforma) | Só o que o cargo/departamento/exceção der. |

### 1.3 Admin da Plataforma

- `ehPlataforma(u) = existe plataforma_admins(user_id = u)`.
- Na empresa ativa, a Plataforma **conta como papel `admin`** (não `super_admin`, não `gestor`),
  mesmo sem vínculo — desde que exista empresa ativa.
- Vê todas as empresas (seletor), todas as telas da Plataforma, passa em qualquer checagem de
  módulo e vê todas as telas mesmo com módulo desligado.
- `eh_admin_plataforma(x)` com argumento de outro usuário só responde para quem é da Plataforma
  (senão `false`). No novo, o backend nunca expõe essa pergunta: só o flag do próprio usuário.

### 1.4 Empresa ativa — `empresa_atual()`

```ts
// origem: empresa_atual (sistema atual)
const STATUS_ACESSO = ["ativa", "implantacao"];

function empresaAtual(u: Usuario | null, appEmpresaId?: string): string | null {
  if (!u) {
    // chamada sem usuário (link público do ranking, jobs): só o contexto explícito, e só se existir
    return appEmpresaId && existeEmpresa(appEmpresaId) ? appEmpresaId : null;
  }
  const preferida = u.empresaAtivaId; // usuarios_perfil.empresa_ativa_id
  if (preferida) {
    if (ehPlataforma(u.id)) return preferida;                      // qualquer status, sem vínculo
    if (vinculoAtivo(u.id, preferida) && STATUS_ACESSO.includes(statusDe(preferida))) return preferida;
  }
  // fallback: vínculo ativo mais antigo em empresa ativa/implantação
  return vinculos(u.id)
    .filter((v) => v.ativo && STATUS_ACESSO.includes(statusDe(v.empresaId)))
    .sort((a, b) => cmp(a.criadoEm, b.criadoEm) || cmp(a.empresaId, b.empresaId))[0]?.empresaId ?? null;
}
```

- A preferência é **persistida** em `usuarios_perfil.empresa_ativa_id` (sobrevive a logout). No
  novo: guardar no usuário e reemitir o token na troca (arquitetura).
- Empresa `suspensa`/`encerrada` ou vínculo inativo ⇒ cai no fallback; sem fallback ⇒ `null` ⇒
  usuário sem empresa ⇒ sem acesso (§1.8), exceto Plataforma.
- Plataforma sem preferência e sem vínculo ⇒ `null` (vê só as telas da Plataforma).

**Troca de empresa** (`trocar_empresa_ativa(p_empresa)`), chamada pelo seletor do topo:

1. Sem usuário ⇒ `Sessão expirada. Entre de novo.`
2. Empresa inexistente ⇒ `Empresa não encontrada.`
3. Não é Plataforma **e** não tem vínculo ativo nessa empresa com status ativa/implantação ⇒
   `Você não tem acesso a esta empresa.`
4. Grava `empresa_ativa_id` e audita `acao=trocar_empresa`, `entidade=empresa`,
   `entidade_id=<nova>`, `antes={empresa_id: <anterior ou null>}`, `depois={empresa_id: <nova>}`,
   `empresa_id` do log = a nova.
5. Front: limpa todo o cache de consultas e recarrega a página.

O seletor só aparece para Plataforma ou para quem tem **mais de uma** empresa na lista (§1.8,
`empresas`). Lista ordenada por `nome`.

### 1.5 Contexto por requisição

Hoje o middleware chama `contexto_sessao()` a cada requisição, em paralelo com a validação do
token. Resultado:

```ts
// origem: contexto_sessao + requireSupabaseAuth (sistema atual)
type ContextoSessao = {
  usuarioId: string;
  empresaId: string | null;        // empresaAtual(u)
  ehPlataforma: boolean;
  modulos: string[];               // chaves com moduloLiberado(empresaId, key), ordenadas por (ordem, key)
};
```

- Se a leitura do contexto falhar: segue com `{ empresaId: null, ehPlataforma: false, modulos: [] }`
  (fecha, não abre). Token inválido ⇒ erro de autenticação.
- `modulos` sem empresa = `["essencial"]` (o essencial vale sempre).

### 1.6 Papéis efetivos — `has_role` / `meus_papeis`

```ts
// origem: has_role, meus_papeis (sistema atual)
function papeisEfetivos(ctx: ContextoSessao): Set<string> {
  const s = new Set<string>();
  if (!ctx.empresaId) return s;                                   // sem empresa: nenhum papel
  const v = vinculo(ctx.usuarioId, ctx.empresaId);
  if (v?.ativo && v.roleKey) s.add(v.roleKey);
  if (ctx.ehPlataforma) s.add("admin");
  return s;
}
const temPapel = (ctx, p: string) => papeisEfetivos(ctx).has(p);
const ehAdminEmpresa = (ctx) => temPapel(ctx, "admin") || temPapel(ctx, "super_admin");
const ehGestao = (ctx) => ehAdminEmpresa(ctx) || temPapel(ctx, "gestor");
const ehSuperAdmin = (ctx) => temPapel(ctx, "super_admin");   // a Plataforma NÃO entra aqui
```

Atenção: o papel **para cálculo de telas** é outro (§1.8: `vinculo.role_key ?? (Plataforma ? "admin")`,
lendo o vínculo mesmo inativo). Um admin da Plataforma com vínculo `operador` tem papéis efetivos
`{operador, admin}` (passa em `assertAdmin`), mas as telas saem do cargo `operador` (+ telas da
Plataforma e Logs). Reproduzir as duas regras como estão.

### 1.7 Módulos

Catálogo (`modulos`, seed da migration F1):

| key | nome | telas | essencial | ordem |
| --- | --- | --- | --- | --- |
| `essencial` | Essencial | admin_usuarios, admin_roles, admin_departamentos, admin_configuracoes, admin_logs | sim | 0 |
| `performance` | Performance | performance | | 10 |
| `romaneio` | Romaneio | romaneio, romaneio_placa | | 20 |
| `ocorrencias` | Ocorrências | ocorrencias, admin_codigos | | 30 |
| `comprovantes` | Comprovantes | comprovantes | | 40 |
| `coletas` | Coletas | coletas | | 50 |
| `prazo_parceiro` | Prazo do parceiro | prazo_parceiro | | 60 |
| `historico` | Histórico e calendário | historico, calendario, admin_historico | | 70 |
| `ranking` | Ranking | ranking, ranking_novo, admin_equipes, admin_bonificacao | | 80 |
| `ponto_bonificacao` | Ponto e bonificação de entrega | admin_ahgora, admin_bonificacao_entrega | | 90 |
| `xml_cte` | XML CT-e | admin_xml_cte | | 100 |
| `integracao_ssw` | Integração SSW | admin_ingestao, admin_importacao_ssw | | 110 |

Telas fora de qualquer módulo: `admin_ssw_diagnostico`, `plataforma_empresas`, `plataforma_logs`,
`plataforma_admins` (e `admin_logs` está no essencial).

```ts
// origem: modulo_liberado (sistema atual). Datas = dia de Brasília (AAAA-MM-DD).
function moduloLiberado(empresaId: string | null, key: string, hoje: string): boolean {
  if (catalogo(key)?.essencial) return true;
  const m = empresaModulo(empresaId, key);             // linha de empresa_modulos
  return !!m && m.ativo && (!m.inicio || m.inicio <= hoje) && (!m.fim || m.fim >= hoje);
}
```

- Sem linha em `empresa_modulos` ⇒ desligado.
- Guard de servidor (`requireModulo(...chaves)`): passa se Plataforma, se alguma chave for
  `essencial`, ou se **alguma** das chaves estiver em `ctx.modulos`. Senão:
  `O módulo ${nomes.join(" / ")} não está liberado para esta empresa. Fale com o suporte para liberar.`
  (nomes = `MODULO_NOME[key] ?? key`; lista vazia ⇒ "desta tela").
- Módulo desligado **não** para a ingestão (pergunta 4 do multiempresa, aberta; comportamento de
  hoje: ingestão continua).
- Rotas do servidor com módulo (as do R5): `ranking` em toda `ranking.functions` e
  `getRankingOperacional`; `ponto_bonificacao` em `bonificacao.functions`; `performance` **ou**
  `ranking` em `getSlaSerie`. Sem módulo (de propósito): usuários, cargos, departamentos,
  configurações, prazos configurados, auditoria, acesso/troca de empresa, Plataforma, Ahgora (só
  Plataforma).

### 1.8 Telas — algoritmo exato (`calcularAcesso`)

Chaves (`Screen`, ordem canônica `ALL_SCREENS`):

```
performance, romaneio, ocorrencias, comprovantes, coletas, prazo_parceiro, historico, calendario,
ranking, ranking_novo, admin_usuarios, admin_codigos, admin_roles, admin_departamentos,
admin_ingestao, admin_importacao_ssw, admin_historico, admin_equipes, admin_bonificacao,
admin_configuracoes, admin_xml_cte, admin_ahgora, admin_bonificacao_entrega, romaneio_placa,
admin_logs, admin_ssw_diagnostico, plataforma_empresas, plataforma_logs, plataforma_admins
```

Conjuntos fixos (`src/lib/permissions.ts`):

- `ADMIN_SCREENS` = todas as `admin_*` + `plataforma_*` (18 chaves; inclui `admin_logs` e
  `admin_ssw_diagnostico`).
- `TELAS_SO_PLATAFORMA` = `plataforma_empresas, plataforma_logs, plataforma_admins, admin_ingestao,
  admin_importacao_ssw, admin_xml_cte, admin_ssw_diagnostico, admin_ahgora` (decisão de 09/11).
- `TELAS_POR_REGRA` = `admin_logs`.
- `PERMISSOES_DE_RECURSO` = `romaneio_placa` (não é página; nunca vira página inicial).
- `ADMIN_SCREENS_PARA_GESTOR` = `admin_bonificacao_entrega`.
- `SETOR_SCREENS` (fallback legado por `usuarios_perfil.setor`):
  `diretoria`, `monitoramento`, `expedicao` = as 10 operacionais (performance … ranking_novo);
  `agendamento` = performance, romaneio, ocorrencias, prazo_parceiro, historico, calendario;
  `rh` = performance, historico, calendario.

```ts
// origem: calcularAcesso + computeScreens + aplicarTelasMultiempresa + aplicarModulos (sistema atual)
function calcularAcesso(ctx: ContextoSessao, hoje: string): AccessInfo {
  const perfil = usuarioPerfil(ctx.usuarioId);                         // global
  const v = ctx.empresaId ? vinculo(ctx.usuarioId, ctx.empresaId) : null; // MESMO se inativo
  const excecoes = ctx.empresaId ? userScreenPermissions(ctx.usuarioId, ctx.empresaId) : [];

  const semEmpresa = !ctx.ehPlataforma && !ctx.empresaId;
  const ativo = (perfil?.ativo ?? true) && v?.ativo !== false && !semEmpresa;
  const papel = v?.roleKey ?? (ctx.ehPlataforma && ctx.empresaId ? "admin" : null);

  const telasCargo = papel ? roleScreenPermissions(papel) : [];       // global
  const telasDepto = v?.departamentoKey
    ? deptScreenPermissions(v.departamentoKey, ctx.empresaId)          // NÃO olha departamentos.ativo
    : [];

  const base = { empresa, empresas, modulos, adminPlataforma: ctx.ehPlataforma, papel, rotuloPapel, setor: perfil?.setor };
  if (!ativo) return { ...base, ativo: false, screens: [], telasBloqueadas: [] };

  // 1) cargo ∪ departamento; vazio ⇒ fallback do setor legado
  const s = new Set<Screen>([...telasCargo, ...telasDepto]);
  if (s.size === 0 && perfil?.setor) SETOR_SCREENS[perfil.setor].forEach((t) => s.add(t));

  // 2) exceções do usuário (na empresa ativa)
  const ehAdminPapel = papel === "admin" || papel === "super_admin";
  for (const o of excecoes) {
    if (!ALL_SCREENS.includes(o.screen)) continue;
    const podeReceberAdmin = ehAdminPapel || (papel === "gestor" && ADMIN_SCREENS_PARA_GESTOR.includes(o.screen));
    if (ADMIN_SCREENS.includes(o.screen) && !podeReceberAdmin) continue;   // ignorada em silêncio
    o.allowed ? s.add(o.screen) : s.delete(o.screen);
  }

  // 3) multiempresa: Plataforma e Logs não vêm de cargo
  for (const t of [...TELAS_SO_PLATAFORMA, ...TELAS_POR_REGRA]) s.delete(t);
  if (ehAdminPapel || ctx.ehPlataforma) s.add("admin_logs");
  if (ctx.ehPlataforma) TELAS_SO_PLATAFORMA.forEach((t) => s.add(t));
  let screens = ALL_SCREENS.filter((t) => s.has(t));

  // 4) módulos (Plataforma não é filtrada)
  const telasBloqueadas: { tela: Screen; modulo: string; moduloNome: string }[] = [];
  if (!ctx.ehPlataforma) {
    const liberados = new Set([...ctx.modulos, ...catalogo().filter((m) => m.essencial).map((m) => m.key)]);
    screens = screens.filter((t) => {
      const mods = catalogo().filter((m) => m.telas.includes(t));         // ordem do catálogo (ordem)
      if (mods.length === 0 || mods.some((m) => liberados.has(m.key))) return true;
      telasBloqueadas.push({ tela: t, modulo: mods[0].key, moduloNome: mods[0].nome });
      return false;
    });
  }
  return { ...base, ativo: true, screens, telasBloqueadas };
}
```

Demais campos de `AccessInfo`:

- `empresas`: Plataforma = todas as empresas; demais = empresas com vínculo **ativo** e status
  ativa/implantação. Ordem `nome`.
- `empresa`: a ativa, com `id, nome, nome_curto, logo_path, logo_url, cor_primaria, cor_destaque,
  slogan`. `logo_url = <storage público>/marcas/<logo_path>` ou `null`.
- `modulos`: `ctx.modulos` ∪ essenciais, ordenado alfabeticamente.
- `roleLabel` = `roles.label` do papel (ou a própria chave).
- Falha ao ler empresas/catálogo **não** derruba o acesso: segue sem esses dados.

Usos fora do menu: `romaneio-fase2.functions.ts` chama `calcularAcesso` **sem** contexto (sem
passo 4) só para saber se `romaneio_placa` está em `screens`.

**Editor de cargo/departamento/exceção** (telas Admin): mostra `EDITABLE_SCREENS` = todas menos
`ranking_novo`, `TELAS_SO_PLATAFORMA` e `TELAS_POR_REGRA`. O item "Ranking" marca/desmarca as duas
chaves `ranking` e `ranking_novo` juntas (`chavesDoItem`). Categorias (`SCREEN_CATEGORIES`):
Operacional, Consulta, Administração · Cadastros ("Só vale se o nível for admin/super admin"),
Administração · Sistema, Recursos dentro das telas. Exceção é tri-estado: vazio (padrão do
cargo/setor), marcado (libera), desmarcado (bloqueia).

### 1.9 Guarda de rota no front

```ts
// origem: use-access-guard.ts, permissions.ts (sistema atual)
const SCREEN_TO_PATH = {
  performance: "/performance", romaneio: "/romaneio", ocorrencias: "/ocorrencias",
  comprovantes: "/comprovantes", coletas: "/coletas", prazo_parceiro: "/prazo-parceiro",
  historico: "/historico", calendario: "/calendario", ranking: "/ranking", ranking_novo: "/ranking",
  admin_usuarios: "/admin/usuarios", admin_codigos: "/admin/codigos", admin_roles: "/admin/roles",
  admin_departamentos: "/admin/departamentos", admin_ingestao: "/admin/ingestao",
  admin_importacao_ssw: "/admin/importacao-ssw", admin_historico: "/historico/feriados",
  admin_equipes: "/admin/equipes", admin_bonificacao: "/ranking/regras",
  admin_configuracoes: "/admin/configuracoes", admin_xml_cte: "/admin/xml-cte",
  admin_ahgora: "/admin/ahgora", admin_bonificacao_entrega: "/admin/bonificacao-entrega",
  romaneio_placa: "/romaneio", admin_logs: "/admin/logs",
  admin_ssw_diagnostico: "/admin/ssw-diagnostico", plataforma_empresas: "/plataforma/empresas",
  plataforma_logs: "/plataforma/logs", plataforma_admins: "/plataforma/administradores",
};
// primeira chave (na ordem acima) cujo caminho é igual ou prefixo + "/"
const telaDoCaminho = (p: string) =>
  Object.keys(SCREEN_TO_PATH).find((s) => SCREEN_TO_PATH[s] === p || p.startsWith(SCREEN_TO_PATH[s] + "/"));

function guarda(access: AccessInfo, pathname: string): Acao {
  if (pathname === "/sem-acesso") return "fica";
  if (!access.ativo) return { ir: "/sem-acesso" };
  const tela = telaDoCaminho(pathname);
  if (!tela || access.screens.includes(tela)) return "fica";
  if (access.telasBloqueadas.some((b) => b.tela === tela)) return "mostra ModuloDesligado";
  return { ir: access.screens[0] ? SCREEN_TO_PATH[access.screens[0]] : "/sem-acesso" };
}
const firstAllowedPath = (a) => {
  const t = a.screens.find((s) => !PERMISSOES_DE_RECURSO.includes(s));
  return t ? SCREEN_TO_PATH[t] : "/sem-acesso";
};
```

Consequências que o porte deve manter (paridade):

- `/historico/feriados` casa com `historico` e `/ranking/regras` e `/ranking/equipe/$id` casam com
  `ranking` (vêm antes no mapa): `admin_historico` e `admin_bonificacao` **não são checados pela
  URL**, só somem do menu.
- `/dashboard`, `/ctrc/$numero`, `/sem-acesso` não têm tela: qualquer usuário ativo entra.
- O redirecionamento da guarda usa `screens[0]` (não `firstAllowedPath`).
- Menu: itens de `screens` deduplicados por caminho (`ranking`/`ranking_novo` viram um item);
  rótulos de Admin/Plataforma sem o prefixo "Admin · "/"Plataforma · ".

### 1.10 Recurso `romaneio_placa`

Chave de tela sem página ("Romaneio · Ver placa (Performance Motorista/Ajudante)"), concedida por
cargo, departamento ou exceção, no módulo `romaneio`. Sem ela, o servidor **não envia** a placa
nas abas de Performance Motorista/Ajudante do Romaneio, a coluna mostra cadeado e a exportação sai
sem a coluna; com ela, a placa começa oculta e o ícone de olho mostra
(`docs/decisoes/performance-motorista-ajudante-codigo-13-2026-10-26.md`). Regra do servidor:
`calcularAcesso(sem passo 4).screens.includes("romaneio_placa")`.

### 1.11 Escopo de dados (`pode_ver_tudo` / `pode_ver_ctrc`)

```ts
// origem: pode_ver_tudo, pode_ver_ctrc, _perf_filtro_ctrcs (sistema atual)
function podeVerTudo(ctx): boolean {
  if (ehGestao(ctx)) return true;                       // admin, super_admin, gestor (Plataforma = admin)
  const temUnidade = !!vinculo(ctx.usuarioId, ctx.empresaId)?.unidadeId;
  const temEquipe = membrosEquipe.some((m) => m.usuarioId === ctx.usuarioId && !m.dataSaida && m.empresaId === ctx.empresaId);
  return !(temUnidade || temEquipe);                    // sem escopo definido = vê tudo
}
function podeVerCtrc(ctx, c: Ctrc): boolean {
  return c.empresaId === ctx.empresaId && (podeVerTudo(ctx)
    || (vinculo(...)?.unidadeId != null && vinculo(...).unidadeId === c.unidadeId)
    || membroAtivoDaEquipe(ctx.usuarioId, c.equipeId));
}
```

- Vale para leitura de `ctrcs` e `ocorrencias` (RLS) e para as RPCs de performance/ranking
  (`_perf_filtro_ctrcs` com `p_escopo = !podeVerTudo`). **Diferença hoje**: o filtro das RPCs usa
  `usuarios_perfil.unidade_id` (global), a RLS usa `empresa_usuarios.unidade_id`.
- **Inerte na prática**: nenhuma tela grava `unidade_id` (README multiempresa, pendências da
  revisão de segurança) e `addMembro` não grava `membros_equipe.usuario_id`. Prova registrada:
  `pode_ver_tudo = true` para os 24 usuários da FR. Ver pergunta P6.

### 1.12 Matriz "pode chamar esta operação" (guards de hoje)

| Guard | Regra | Mensagem |
| --- | --- | --- |
| autenticado | token válido | (401) |
| `exigirEmpresa` | `ctx.empresaId != null` | `Nenhuma empresa ativa para o seu usuário. Fale com o administrador.` |
| `assertAdmin` | `ehAdminEmpresa(ctx)` | `Acesso restrito a administradores` |
| `assertSuperAdmin` | `ehSuperAdmin(ctx)` | `Acesso restrito ao Super Admin` |
| `assertAdminPlataforma` | `ctx.ehPlataforma` | `Acesso restrito à equipe da Plataforma.` |
| `requireModulo(k…)` | §1.7 | §1.7 |
| "só RLS" | ver §1.13 (gestão = admin/super_admin/gestor) | hoje: erro do Postgres no insert, 0 linhas sem erro no update/delete |

Operações do R5 e o guard que cada uma exige (o porte usa o guard **explícito** no caso de uso; a
coluna "hoje" diz de onde vem):

| Operação | Guard | Hoje |
| --- | --- | --- |
| `getMyAccess`, `getAccessHelp`, `trocarEmpresaAtiva` | autenticado | handler |
| `checkIsAdmin` / `checkIsSuperAdmin` | autenticado (devolvem bool) | handler — só `/dashboard` usa (§8) |
| `getConfiguracoesPublicas` | autenticado (sem empresa ⇒ `{}`) | handler |
| Admin → Usuários (listar, convidar, criar com senha, editar, reenviar convite, definir senha) | admin + empresa | handler |
| Admin → Roles: listar | admin + empresa | handler |
| Admin → Roles: criar/alterar/excluir | **Plataforma** (provisório 09/11) | handler + RLS |
| Admin → Departamentos: listar | admin + empresa | handler |
| Admin → Departamentos: criar/alterar/excluir | **Plataforma** + empresa | handler + RLS |
| Admin → Configurações (listar, salvar grupo) | admin + empresa | handler |
| Admin → Prazos configurados (listar, salvar, ligar/desligar, excluir) | admin + empresa | handler |
| Admin → Logs (alterações e integrações da empresa ativa) | (Plataforma ou admin) + empresa | handler + RLS |
| Plataforma → tudo (§3.2) e Logs gerais | Plataforma | handler |
| Ranking operacional (`/ranking`) | módulo `ranking` | handler |
| Regras (listar) | módulo `ranking` (qualquer papel lê) | RLS `true` |
| Regras (salvar, excluir), equipes (salvar), membros (incluir, remover), revogar token | módulo `ranking` + **gestão** | só RLS |
| Gerar token | módulo `ranking` + gestão (`forbidden`) | função SQL |
| Cálculo por equipe / lote (simulador) | módulo `ranking` (sem papel) | — |
| Listar CT-e para atribuir | módulo `ranking` (RLS de `ctrcs`) | RLS |
| Atribuir equipe a CT-e | módulo `ranking` — **hoje não grava nada** (§5.6) | RLS sem policy de UPDATE |
| Link público do ranking | anônimo, por token + módulo `ranking` da empresa da equipe | §5.7 |
| Bonificação de entrega (apurar, unidades, parâmetros) | módulo `ponto_bonificacao` + admin | handler |
| Ahgora (funcionários, departamentos, apuração, batidas) | **Plataforma** + empresa | handler |

### 1.13 Políticas RLS atuais → regra de autorização do backend

No novo, a RLS é só isolamento (`empresa_id = app.empresa_id`, + exceção de Plataforma onde
indicado). **Tudo abaixo vira guard no caso de uso.** `has_role(...)` = papéis efetivos (§1.6).

**A. Isolamento por empresa** — política `empresa_isolamento` (RESTRICTIVE, ALL, `empresa_id =
empresa_atual()`) em: anotacoes, bi2_raw, bi2_sync_log, bi2_viagens, bonificacao_calculo,
bonificacao_codigos, bonificacao_faltas, bonificacao_parametros, codigos_ocorrencia, coletas,
configuracoes, ctrc_prazo_historico, ctrcs, departamento_screen_permissions, departamentos,
equipes_entrega, filiais_ssw, filial_alias, ftp_sync_progresso, ftp_xml_sync_log, membros_equipe,
metas, ocorrencias, parceiros, prazo_padrao_cidade, prazos_configurados, regra_criterios,
regras_bonificacao, romaneio_saida_ctrc, ssw_aplicacao_fila, ssw_aplicacao_log,
ssw_ciclo_importacao, ssw_config, ssw_fila_controle, ssw_relatorio_arquivos, ssw_webhook_eventos,
staging_036_romaneios(+_erros_parsing), staging_038_ctrcs_pendentes, staging_038_erros_parsing,
staging_306_ssw_mobile, staging_306_erros_parsing, staging_455_csv, staging_455_ctrcs_expedidos,
staging_455_erros_parsing, staging_930_ocorrencias, staging_930_erros_parsing, sync_log,
sync_state, unidades, user_screen_permissions, xml_cte_arquivos_processados,
xml_cte_itens_processados, xml_cte_orfaos.
→ Backend: toda leitura/escrita dessas tabelas é da empresa ativa; insert grava `empresa_id` da
empresa ativa. RLS nova idêntica.

- `feriados`: restritiva `empresa_id IS NULL OR empresa_id = empresa_atual()` (nacional visível
  para todos) + escrita permissiva "Plataforma **ou** (admin **e** `empresa_id = empresa ativa`)".
  → feriado nacional (nulo) só a Plataforma cria/altera/apaga; admin da empresa só os da empresa.
  (Regra detalhada no R de histórico/calendário.)

**B. Leitura para qualquer usuário autenticado da empresa** (`USING (true)` + isolamento):
anotacoes, bi2_sync_log, bi2_viagens, bonificacao_codigos, bonificacao_faltas,
bonificacao_parametros, codigos_ocorrencia, coletas, configuracoes, ctrc_prazo_historico,
departamentos, departamento_screen_permissions, feriados, filiais_ssw, filial_alias,
ftp_sync_progresso, metas, parceiros, prazo_padrao_cidade, regra_criterios, regras_bonificacao,
role_screen_permissions, roles, ssw_ciclo_importacao, ssw_relatorio_arquivos, ssw_relatorio_tipos
(sem empresa), unidades, modulos (sem empresa).
→ Backend: leitura sem papel (o que limita é a tela/módulo do endpoint).

**C. Admin da empresa** (`has_role admin OR super_admin`):

| Tabela | Operação |
| --- | --- |
| configuracoes | INSERT, UPDATE, DELETE |
| prazos_configurados | SELECT e ALL |
| codigos_ocorrencia, metas, parceiros, prazo_padrao_cidade, unidades | ALL (escrita) |
| user_screen_permissions | ALL (escrita) |
| usuarios_perfil | INSERT |
| xml_cte_arquivos_processados, xml_cte_itens_processados | SELECT, INSERT |
| xml_cte_orfaos, ssw_webhook_eventos, ftp_xml_sync_log, sync_log, sync_state | SELECT |
| staging_036/038/306/455 (+ erros) | SELECT e ALL |
| staging_455_csv | ALL |
| staging_930_ocorrencias, staging_930_erros_parsing | SELECT, DELETE |
| anotacoes | UPDATE/DELETE de anotação de outro autor |

→ Backend: `ehAdminEmpresa(ctx)`.

**D. Admin pelo papel legado global** (`EXISTS user_roles role_key in (admin, super_admin)`):
ssw_aplicacao_fila (SELECT), ssw_fila_controle (SELECT), ssw_aplicacao_log (SELECT).
→ Backend: `ehAdminEmpresa(ctx)`. **Diferença**: hoje vale o papel global de `user_roles` (o da
empresa única), não o da empresa ativa, e a Plataforma sem linha em `user_roles` não lê. Afeta a
aba Integrações de Admin → Logs (§4.4). Ver P9.

**E. Gestão** (`has_role admin OR super_admin OR gestor`):
bonificacao_calculo (ALL), regra_criterios (escrita), equipes_entrega (escrita), membros_equipe
(escrita), regras_bonificacao (escrita), bonificacao_codigos/faltas/parametros (escrita),
bi2_raw (SELECT).
→ Backend: `ehGestao(ctx)`.

**F. Só Plataforma** (`eh_admin_plataforma()`): empresa_integracoes (SELECT; escrita só service
role), roles / role_screen_permissions / departamentos / departamento_screen_permissions (escrita).
→ Backend: `ctx.ehPlataforma`. RLS nova dessas tabelas: plataforma lê tudo.

**G. Dono da linha / pessoal**:

| Tabela | Regra atual | Backend |
| --- | --- | --- |
| anotacoes | INSERT só com `autor = uid`; UPDATE/DELETE se autor **ou** admin | idem |
| usuarios_perfil | SELECT/UPDATE: própria linha **ou** Plataforma **ou** (admin **e** o usuário lido tem vínculo — qualquer estado — com a empresa ativa) | idem |
| user_roles | SELECT: mesma regra | não portar a tabela |
| user_screen_permissions | SELECT: própria **ou** admin (+ isolamento) | idem |
| plataforma_admins | SELECT: própria linha **ou** Plataforma | idem |

**H. Multiempresa**:

| Tabela | Regra atual (SELECT; escrita só service role) | Backend |
| --- | --- | --- |
| empresas | Plataforma **ou** empresa com vínculo **ativo** do usuário (qualquer status) | idem; RLS nova: `id = app.empresa_id OR app.plataforma` |
| empresa_usuarios | próprio vínculo (todas as empresas) **ou** Plataforma **ou** (empresa ativa **e** admin) | idem |
| empresa_modulos | empresa ativa **ou** Plataforma | idem |
| auditoria | Plataforma **ou** (empresa ativa **e** admin); ninguém altera/apaga | idem; insert só pelo caso de uso |

**I. Escopo de CT-e**: `ctrcs` e `ocorrencias` SELECT = `podeVerTudo` **ou** `podeVerCtrc` (§1.11).
`ctrcs` **não tem policy de UPDATE/INSERT/DELETE** para `authenticated`: só service role grava.
`equipes_entrega` SELECT = gestão **ou** `usuarios_perfil.unidade_id = equipe.unidade_id` **ou**
membro ativo; `membros_equipe` SELECT = gestão **ou** própria linha (`usuario_id`) **ou**
(unidade do perfil = unidade da equipe **ou** membro ativo da equipe). Como unidade e
`usuario_id` nunca são gravados, na prática **só a gestão vê equipes e membros** (os demais
recebem lista vazia).

**J. Infra**: `job_lease` só service role; `foto_referencia` RLS sem policy (ninguém) — tabela de
teste do multiempresa, não portar.

### 1.14 Inconsistências encontradas (paridade primeiro)

1. Plataforma com vínculo **inativo** na empresa ativa: `calcularAcesso` dá `ativo=false` (cai em
   /sem-acesso) embora `has_role` lhe dê `admin`. Reproduzir; registrar.
2. Papel de telas (vínculo mesmo inativo) × papel efetivo (vínculo ativo + Plataforma) — §1.6.
3. `departamentos.ativo = false` não tira as telas do departamento.
4. Escopo por unidade: perfil (RPCs) × vínculo (RLS) — §1.11.
5. Guarda de rota usa `screens[0]`; se o único item for `romaneio_placa` (caminho `/romaneio`, que
   casa com `romaneio`), a guarda redireciona para a mesma URL em laço. Caso teórico.

---

## 2. Autenticação

### 2.1 O que o login faz hoje

Tela `/login` (título da aba "Entrar — Painel BI Logístico"; textos: "Painel BI", "Entre com sua
conta", "Performance logística em tempo real.", "Continuar com Google", "Sem conta? Peça um
convite ao administrador da sua empresa."). Parâmetros de busca: `reason` ∈ `expired|signed_out`,
`redirect` (caminho).

1. **Ao abrir**: se já há sessão, vai para o destino (passo 4).
2. **E-mail + senha**: `signInWithPassword`. Campos `required`, senha `minLength=6` no input. Erro ⇒
   toast com a mensagem crua do Supabase (em inglês: "Invalid login credentials", "Email not
   confirmed"). Ver P2.
3. **Google**: `signInWithOAuth({provider:"google", redirectTo: origin + (redirect ?? "")})`; o
   Supabase devolve `code`, o cliente troca por sessão. Vincula ao usuário existente de mesmo
   e-mail verificado (vínculo automático de identidade do Supabase).
4. **Destino**: `redirect` tem prioridade; senão `firstAllowedPath(getMyAccess())`; erro ao ler o
   acesso ⇒ `/sem-acesso`.
5. **Banner "Sua sessão expirou"** (`reason=expired`): "Podemos tentar restaurar automaticamente
   antes de pedir suas credenciais." Botão "Tentar restaurar sessão" (`refreshSession`): sucesso ⇒
   toast "Sessão restaurada." e destino; falha ⇒ "Não foi possível restaurar a sessão. Entre
   novamente.". Botão "Fechar".
6. **Banner `signed_out`**: "Você saiu da conta. Entre novamente para continuar."
7. **Cadastro fechado**: não há `signUp` na tela (decisão 7 do multiempresa). Usuário só nasce por
   convite (Admin ou Plataforma) ou por criação com senha.

Raiz `/`: sem sessão ⇒ `/login`; com sessão ⇒ `firstAllowedPath`; erro ⇒ `/login`.

Layout autenticado: sem sessão ao carregar ⇒ `/login?reason=expired&redirect=<caminho>`; evento de
logout ⇒ `reason=signed_out`; outro fim de sessão ⇒ `reason=expired`.

**Logout** (menu e /sem-acesso): `supabase.auth.signOut()` (escopo padrão do supabase-js v2:
**global**, revoga todos os refresh tokens do usuário), limpa o cache de consultas e vai para
`/login`.

**Sessão**: JWT de acesso do Supabase + refresh token rotativo, guardados no `localStorage`
(`persistSession`, `autoRefreshToken`). Cada chamada ao servidor leva `Authorization: Bearer`.

**Usuário sem empresa = sem acesso**: login funciona, mas `calcularAcesso` devolve `ativo=false`
(§1.8) e a guarda manda para `/sem-acesso`.

Tela `/sem-acesso` (`getAccessHelp`):

- `ativo` = **só** `usuarios_perfil.ativo` (não o vínculo). Se falso: "Conta desativada" / "Sua
  conta foi desativada por um administrador."; senão "Sem acesso a nenhuma tela" / "Seu nível de
  acesso ainda não libera nenhum módulo.".
- Mostra Usuário (nome ou e-mail), "Nível atual" (`roles.label` do papel no vínculo da empresa
  ativa, ou "Sem role").
- "Quem pode liberar": admins/super_admins com vínculo **ativo** na empresa ativa **e** perfil
  ativo, com e-mail (link `mailto:` assunto "Liberação de acesso"). Sem empresa ⇒ lista vazia.
- Botão sair.

**Convite** (`auth.admin.inviteUserByEmail`): o Supabase envia o e-mail padrão dele com link de
uso único; ao clicar, o usuário entra **logado sem senha** (sessão lida da URL). Não existe tela
de "definir senha" nem "esqueci minha senha". Depois disso o convidado só entra de novo pelo
Google ou se um admin definir a senha (§3.1). Ver P1.

**Recuperação de senha pelo próprio usuário: não existe hoje.** Só admin/Plataforma define senha.

### 2.2 Formato da senha no Supabase

- Coluna `auth.users.encrypted_password`: bcrypt do GoTrue (Go `x/crypto/bcrypt`), formato
  `$2a$10$` + 22 caracteres de sal + 31 de hash (60 no total). Custo vem no próprio hash (10).
- Vazio (`''`) ou nulo para quem nunca teve senha (convite não concluído com senha, só Google).
- bcrypt usa no máximo 72 bytes; as telas limitam senha a 8–72 caracteres (definição por admin) e
  o Supabase recusa acima de 72.
- E-mail é comparado sem diferença de maiúsculas (Supabase guarda em minúsculas).
- Login por senha exige e-mail confirmado (`email_confirmed_at`): criação com senha grava
  `email_confirm: true`; convite confirma ao clicar.
- Identidade Google em `auth.identities` (`provider='google'`, `provider_id` = `sub` do Google,
  `identity_data.email`).

### 2.3 O que o sistema novo precisa replicar

1. Migrar `auth.users` → usuários do backend com o **mesmo id**, e-mail, nome
   (`raw_user_meta_data.nome` ?? e-mail), hash e formato (`bcrypt`), `email_confirmado_em`;
   identidades Google com `sub`.
2. Login por senha: localizar por e-mail (minúsculo); exigir hash não vazio e e-mail confirmado;
   verificar bcrypt (aceitar prefixos `$2a$`/`$2b$`/`$2y$`); **no primeiro acerto, regravar em
   argon2id** na mesma transação e marcar o formato. Mesma mensagem de erro para e-mail
   inexistente e senha errada.
3. Google: **não existe no novo** (decisão do dono, 12/11/2026). Hoje o Supabase entra pelo Google
   e cria usuário novo para e-mail desconhecido; no novo, quem só usava o Google cria a senha por
   "Esqueci a senha".
4. Convite: e-mail com link de uso único que abre sessão (hoje sem definir senha). Ver P1.
5. Sessão: o que a arquitetura define (access 15 min, refresh rotativo em cookie). O
   comportamento visível a manter: expiração ⇒ `/login?reason=expired&redirect=...` com o banner e o
   "Tentar restaurar sessão" (= tentar refresh); logout ⇒ revoga todas as sessões do usuário
   (escopo global) e `reason=signed_out`.
6. Contexto por requisição (§1.5) a partir do token: usuário, empresa ativa, Plataforma, módulos;
   trocar de empresa reemite o token.
7. Cadastro fechado: nenhum endpoint público cria usuário.
8. O que **não** existe hoje e a arquitetura prevê (recuperação de senha por SMTP, rate limit,
   bloqueio progressivo): é mudança visível para o usuário só na recuperação de senha (tela
   nova). Ver P1.

---

## 3. Admin e Plataforma

Escritas administrativas gravam autor no log (§4). "admin" = `assertAdmin` + `exigirEmpresa`.

### 3.1 Admin → Usuários (empresa ativa)

**listUsers** (admin): vínculos da empresa ativa (todos, ativos ou não) + perfis desses usuários +
exceções de tela da empresa. Linha: `{id, nome, email, setor, departamento_key (vínculo), ativo =
perfil.ativo && vínculo.ativo !== false, role (vínculo), overrides[]}`. Ordem `perfil.created_at`
asc.

**inviteUser** (admin) — entrada `{email, nome(1–120), departamento_key?(1–40)|null, role(1–64),
overrides?[{screen ∈ ALL_SCREENS, allowed}]}`;
**createUserWithPassword** — igual + `password` (8–72). Os dois chamam `criarUsuario`:

1. `validarPapelEDepartamento`: papel existe em `roles` senão `Role inexistente`; departamento,
   se informado, existe **na empresa** senão `Departamento inexistente`.
2. `setorLegado = departamento_key` se for um dos valores do enum `setor`
   (`diretoria, monitoramento, expedicao, agendamento, rh`), senão `null`.
3. Convite: `inviteUserByEmail(email, data:{nome, setor})`. Com senha:
   `createUser({email, password, email_confirm:true, user_metadata:{nome, setor},
   app_metadata:{role_key}})`. Erro do Auth (ex.: e-mail já existe) sobe cru.
4. Efeito do gatilho `handle_new_user` (no novo: parte do caso de uso): cria
   `usuarios_perfil(id, nome = metadata.nome ?? email, email)`; grava `setor` se veio; grava
   `user_roles` com `app_metadata.role_key` se o papel existe.
5. `user_roles(user_id, role)` (ignora duplicado) — falha ⇒ `Usuário criado, mas falhou ao gravar
   o papel: …`.
6. Se departamento: `usuarios_perfil.departamento_key` (falha ⇒ aviso).
7. Exceções: insert em `user_screen_permissions` com `empresa_id` (falha ⇒ aviso).
8. Vínculo: `plataforma_vincular_usuario(ator, empresa, user, role, depto, ativo=true,
   definir_ativa=true)` (falha ⇒ aviso). Avisos: `${verbo}, mas falhou ao …: <erro>` com
   `verbo` = "Convite enviado" | "Usuário criado"; só o último aviso volta (`overridesWarning`).
9. Auditoria explícita: `acao=convidar`, `entidade=usuario`, `entidade_id=userId`, `resumo` =
   `Convite para <email>` | `Usuário <email> criado com senha`, `depois={email, papel, modo}`.

No novo: passos 3–8 numa transação (os "avisos" deixam de existir se tudo é atômico — ver P4).

**plataforma_vincular_usuario** (regra do vínculo, usada por Admin e Plataforma):

```ts
// origem: plataforma_vincular_usuario (sistema atual)
function vincular(ator, empresaId, userId, roleKey: string | null, deptoKey: string | null, ativo = true, definirAtiva = false) {
  if (!existeEmpresa(empresaId)) throw "Empresa não encontrada.";
  if (!existePerfil(userId)) throw "Usuário não encontrado.";
  if (roleKey && !existeRole(roleKey)) throw `Papel inexistente: ${roleKey}`;
  upsert empresa_usuarios (empresaId, userId) set role_key, departamento_key, ativo; criado_por = ator (só no insert)
  if (definirAtiva) update usuarios_perfil set empresa_ativa_id = empresaId where id = userId and empresa_ativa_id is null;
  // legado: espelho em user_roles quando há um vínculo só (não portar, §8)
}
```

Não valida que o departamento é da empresa (quem valida é o chamador do Admin).

**updateUser** (admin) — entrada `{userId, nome, email, departamento_key|null, role, ativo,
overrides[]}`:

1. Usuário precisa ter vínculo com a empresa ativa ⇒ senão `Usuário não pertence à empresa ativa.`
2. `validarPapelEDepartamento` (como acima).
3. Nome/e-mail mudaram (e-mail comparado sem maiúsculas; nome exato)? Só se `podeAlterarLogin`:
   Plataforma, **ou** o usuário tem exatamente um vínculo e é com a empresa ativa. Senão: `Este
   usuário também acessa outra empresa: nome e e-mail só podem ser alterados pela equipe da
   Plataforma.` Grava no Auth (`email`, `email_confirm:true`, `user_metadata.nome`) e no perfil.
4. Com um vínculo só: perfil acompanha (`setor = setorLegado`, `departamento_key`, `ativo`).
5. Vínculo da empresa ativa: `vincular(..., ativo, definirAtiva=false)`.
6. Exceções da empresa ativa: apaga todas do usuário e insere as novas.
7. Sem auditoria explícita (as escritas são auditadas por tabela, §4.2).

**resendInvite** (admin) — `{email}`: perfil por e-mail (ILIKE exato, escapando `\ % _`); tem de
ter vínculo com a empresa ativa ⇒ senão `Usuário não pertence à empresa ativa.`; reenvia
`inviteUserByEmail(email)` (para quem já confirmou, o Supabase recusa e o erro sobe). Sem log.

**setUserPassword** (admin) — `{userId, password(8–72)}`:

1. Vínculo com a empresa ativa ⇒ senão `Usuário não pertence à empresa ativa.`
2. `podeAlterarLogin` ⇒ senão `Este usuário também acessa outra empresa: a senha só pode ser
   redefinida pela equipe da Plataforma.`
3. Alvo é `super_admin` em **qualquer** vínculo ⇒ quem chama precisa ter `super_admin` nos papéis
   efetivos (a Plataforma sozinha **não** tem) ⇒ senão `Apenas o Super Admin pode redefinir a
   senha de outro Super Admin`.
4. Troca a senha (no novo: grava argon2id). Sem log explícito. Ver P5.

Telas: diálogo de convite com abas "Convidar por e-mail" / "Criar com senha" (botão desabilitado
com senha < 8), papel padrão `operador`; edição com diff por categoria antes de confirmar.

### 3.2 Plataforma (todas exigem `assertAdminPlataforma`)

| Operação | Entrada / validação | Efeito |
| --- | --- | --- |
| `listarEmpresas` | — | Empresas por `nome` com `usuarios_ativos` (vínculos ativos), `modulos_liberados` (não essenciais com `moduloLiberado` hoje), `integracoes_ativas`. |
| `criarEmpresa` | `nome`(2–120, trim), `nome_curto`(1–30), `slug` (`^[a-z0-9][a-z0-9-]*$`, ≤60), `cnpj` (≤20, vazio ⇒ null) | Insere com `status=implantacao`, `criado_por/atualizado_por`. Slug duplicado ⇒ `Empresa com esse identificador (slug) já existe.` **Efeito colateral**: `empresa_semear` (abaixo). |
| `obterEmpresa` | `id` | Todos os campos; inexistente ⇒ `Empresa não encontrada.` |
| `salvarEmpresa` | `nome`, `nome_curto`, `razao_social`(≤160), `cnpj`(≤20), `dominio_ssw`(≤20), `fuso`(3–60), `status` ∈ 4 valores, `cor_primaria`/`cor_destaque` `^#[0-9a-fA-F]{6}$` ("Cor no formato #RRGGBB"), `slogan`(≤120) | Update + `atualizado_em/por`. Logo não passa aqui. |
| `enviarLogoEmpresa` | base64 ≤ ⌈512 KiB·4/3⌉+8; bytes ≤ 512 KiB ⇒ senão `O logo passa de 512 KB. Reduza a imagem e envie de novo.`; tipo pelos primeiros bytes: PNG `89 50 4E 47`, JPEG `FF D8 FF` ⇒ senão `Envie o logo em PNG ou JPEG.` | Grava em armazenamento público `marcas/<empresa>/logo-<AAAAMMDDhhmmss UTC>.<png|jpg>` (sem sobrescrever), atualiza `logo_path`, apaga o anterior (falha ao apagar só vira aviso no log do servidor). Falha no upload ⇒ `Não foi possível enviar o logo: …`. |
| `removerLogoEmpresa` | `empresaId` | `logo_path = null` e apaga o arquivo. |
| `listarModulosEmpresa` | `empresaId` | Catálogo por `ordem` + estado da empresa (`configurado`, `ativo` (padrão false), `inicio`, `fim`, `observacao`, `atualizado_em`). |
| `salvarModuloEmpresa` | `modulo_key`(1–60), `ativo`, `inicio`/`fim` AAAA-MM-DD ou null, `observacao`(≤300); `inicio <= fim` ⇒ senão `O fim da liberação não pode ser antes do início.` | Upsert `(empresa, modulo)` + autor. A tela avisa "vence em N dias" quando faltam ≤ 15 dias. |
| `listarUsuariosEmpresa` | `empresaId` | Vínculos com nome/e-mail, `total_empresas` do usuário, `admin_plataforma`; ordem nome (pt-BR). |
| `salvarVinculoUsuario` | `userId`, `role_key`(1–64)\|null, `departamento_key`(1–40)\|null, `ativo` | `vincular(..., definirAtiva=false)`. |
| `convidarUsuarioEmpresa` | `modo` convite\|senha, `email` (trim, minúsculo), `nome`, `password?`(8–72), `departamento_key?`, `role`, `overrides?` | Empresa tem de existir. E-mail já tem perfil ⇒ só `vincular(..., ativo=true, definirAtiva=true)` (`jaExistia=true`, sem log explícito). Senão `criarUsuario` na empresa escolhida + log `convidar` com `resumo` `Convite para <email> (<empresa>)` ou `Conta com senha para <email> (<empresa>)`. |
| `listarIntegracoesEmpresa` | `empresaId` | Uma linha por tipo (6), mesmo sem configuração. **Nunca devolve o segredo**, só `segredo_definido_em`. |
| `salvarIntegracao` | `tipo`, `ativo`, `parametros` (chave ≤60; valor texto/número/bool/null/lista de texto). Chave que casa `/(senha\|token\|secret\|segredo\|apikey\|api_key\|password)/i` ⇒ `Senha e token não ficam nos parâmetros (<chaves>). Use o campo de senha/token da integração (cofre).` | Upsert `(empresa, tipo)` + autor. |
| `definirSegredoIntegracao` | `tipo`, `valor` (≤4096, trim) | §3.4. Log `definir_segredo`/`remover_segredo`, `entidade=empresa_integracao`, `entidade_id=tipo`, `resumo` `Senha/token definido (<tipo>)` / `Senha/token removido (<tipo>)` — **sem o valor**. |
| `listarAdminsPlataforma` | — | `user_id, criado_em, nome, email`, ordem e-mail. |
| `adicionarAdminPlataforma` | `email` (trim, minúsculo) | Perfil por e-mail (ILIKE exato) ⇒ senão `Nenhum usuário com esse e-mail. Convide a pessoa antes de torná-la admin.`; `plataforma_admin_definir(true)`. |
| `removerAdminPlataforma` | `userId` | `plataforma_admin_definir(false)`. |

**plataforma_admin_definir** (serializado com trava de tabela):

```ts
// origem: plataforma_admin_definir (sistema atual)
if (admin) { if (!existeUsuario(user)) throw "Usuário não encontrado."; insertIgnore(user, criado_por=ator); return; }
if (!ehPlataforma(user)) return;                        // nada a fazer
if (count(plataforma_admins) <= 1) throw "Não dá para remover o último administrador da Plataforma.";
delete(user);
```

No novo: `SELECT ... FOR UPDATE` / trava equivalente para duas remoções simultâneas não zerarem.

**empresa_semear** (ao criar empresa; no novo: no mesmo caso de uso, mesma transação):

- Modelo = a empresa **mais antiga** diferente da nova (`criado_em` asc, nulos por último, depois
  `id`). Sem modelo ⇒ nada.
- Copia **todos** os `codigos_ocorrencia` do modelo (todas as colunas menos `empresa_id`,
  `updated_at`, `atualizado_por`) sem sobrescrever (`(codigo, empresa_id)`).
- Copia `configuracoes` do modelo dos grupos `performance, operacional, ranking, notificacoes,
  empresa`, exceto as chaves `app_base_url, edge_functions_url, edge_apikey, backfill_cron_token`,
  sem sobrescrever.
- Não copia departamentos, cargos, módulos, integrações nem parâmetros de bonificação.

Telas da Plataforma: `/plataforma/empresas` (lista + "Nova empresa"), `/plataforma/empresas/$id`
com abas Dados, Módulos, Usuários, Integrações, Logs, Implantação; `/plataforma/logs`;
`/plataforma/administradores`. A aba **Implantação** é calculada no front:

| Item | Feito quando |
| --- | --- |
| Dados da empresa | `razao_social`, `cnpj` e `dominio_ssw` preenchidos ("Falta: …") |
| Módulos liberados | ≥1 não essencial liberado hoje |
| Integrações configuradas | ≥1 ativa |
| Integrações testadas | todas as ativas com `ultimo_teste_ok` (senão "depois") |
| Usuários convidados | ≥1 vínculo ativo de quem não é Plataforma |
| Filiais/códigos; primeiro ciclo SFTP | sempre "depois" (texto fixo) |
| Empresa ativa | status |

### 3.3 Cargos e departamentos

**listRoles** (admin + empresa): todos os cargos (ordem `created_at`) com `screens` e `user_count`
= vínculos da **empresa ativa** com aquele papel.

**createRole** (Plataforma): `key` 2–40 `^[a-z0-9_]+$` ("Use apenas minúsculas, números e _"),
`label` 1–60, `screens[]`. Insere `is_protected=false` + permissões.

**updateRole** (Plataforma): inexistente ⇒ `Role não encontrado`; atualiza `label`; **cargo
protegido**: para aí (telas não mudam); senão apaga e regrava as telas.

**deleteRole** (Plataforma): inexistente ⇒ `Role não encontrado`; protegido ⇒ `Este role é
protegido`; em uso em **qualquer** empresa ⇒ `Role em uso por N usuário(s)`; apaga (permissões
em cascata).

**listDepartamentos** (admin + empresa): departamentos da empresa ativa (ordem `created_at`) com
`screens` e `user_count` (vínculos da empresa ativa).

**createDepartamento** (Plataforma + empresa): `key` 2–40 `^[a-z0-9_]+$`, `label` 1–60,
`descricao` ≤300, `screens[]`. Grava na empresa ativa. Chave já usada em **qualquer** empresa ⇒
erro de chave duplicada (PK global).

**updateDepartamento** (Plataforma + empresa): não achado na empresa ⇒ `Departamento não
encontrado`; atualiza `label, descricao, ativo` e regrava telas.

**deleteDepartamento** (Plataforma + empresa): não achado ⇒ `Departamento não encontrado`;
protegido ⇒ `Este departamento é protegido`; em uso na empresa ativa ⇒ `Departamento em uso por N
usuário(s)`.

A regra "só a Plataforma edita cargo/departamento" é **provisória** (pergunta 10 do
multiempresa). Ver P7.

### 3.4 Integrações e segredos

- Tipos: `sftp, ssw_api, ssw_bi2, ssw_webhook, ahgora, xml_cte`. Parâmetros não secretos por tipo
  (`INTEGRACAO_INFO`): sftp `host, porta, usuario, caminho_xml, relatorios_path,
  importados_path`; ssw_api `dominio, usuario, cnpj_edi`; ssw_bi2 `dominio`; ssw_webhook
  `cnpjs_aceitos[]`; ahgora `usuario`; xml_cte `cnpjs_emitentes[]` (sem segredo). `usar_env`
  (bool) = transição: credencial ainda na variável de ambiente.
- **Definir segredo** (`integracao_segredo_definir(empresa, tipo, valor, nome='principal', ator)`):
  tipo inválido ⇒ `Tipo de integração inválido: <tipo>`; `nome` normalizado (vazio ⇒
  `principal`) tem de casar `^[a-z0-9_]{1,40}$` ⇒ senão `Nome de segredo inválido`; empresa
  inexistente ⇒ `Empresa <id> não existe`.
  - Valor vazio ⇒ apaga o segredo; se `principal`, zera `segredo_id`/`segredo_definido_em` na
    integração. Devolve `null`.
  - Valor ⇒ cria/atualiza o segredo de nome `empresa:<id>:<tipo>:<nome>`; se `principal`, upsert
    na integração (`ativo=false` se a linha não existia) com `segredo_definido_em = agora`.
    Devolve o instante.
  - Segredos auxiliares em uso: `ssw_api/token` (token da API SSW, gravado pelo heartbeat).
- **Ler segredo** (`integracao_segredo`): `principal` = o da integração; outro nome = pelo nome.
  Vazio ⇒ `null`. Só servidor; nunca em log nem em resposta.
- **Segredo com fallback** (`segredoDaIntegracao`): do cofre; sem ele, a variável de ambiente só se
  `parametros.usar_env` for `true`/`"true"`.
- **Empresa pelo segredo** (`integracao_empresa_por_segredo(tipo, segredo)`, usado pelo webhook
  SSW quando a chamada não diz a empresa): integrações **ativas** do tipo cujo segredo é
  exatamente igual; mais de uma ⇒ erro `Mais de uma empresa com o mesmo segredo de <tipo>`;
  nenhuma ⇒ `null`. No novo com AES-GCM: não dá para comparar no banco — decifrar os segredos
  ativos do tipo no backend e comparar em tempo constante.
- Mascaramento na auditoria: §4.2.

### 3.5 Configurações

**listarConfiguracoes** (admin + empresa): chaves da empresa ativa dos grupos `performance,
operacional, ranking, notificacoes` (ordem grupo, chave). Chaves da Plataforma (empresa nula),
de job e o grupo `empresa` (ex.: `otif_visivel`) não aparecem.

**salvarConfiguracoesGrupo** (admin + empresa): `{grupo ∈ 4, itens[1..50]{chave(1–80),
valor(≤200)}}`. Toda chave tem de existir na empresa (`Configuração "<k>" não existe`) e ser do
grupo (`Configuração "<k>" não pertence ao grupo <g>`). Valor normalizado:

```ts
// origem: validarValor (configuracoes.functions.ts)
function validarValor(chave: string, valor: string): string {
  const t = valor.trim();
  if (chave === "whatsapp_horario_envio") {             // HH:MM, 00–23 / 00–59
    const m = /^(\d{2}):(\d{2})$/.exec(t);
    if (!m) throw `"${chave}" precisa estar no formato HH:MM`;
    if (+m[1] > 23 || +m[2] > 59) throw `"${chave}" tem hora/minuto inválidos`;
    return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`;
  }
  if (chave === "atrasos_excluir_responsabilidades") {  // CSV de {cliente,destinatario,sistema,FR,transportador,pendente}
    const p = t.split(",").map((s) => s.trim()).filter(Boolean);
    for (const x of p) if (!VALIDOS.has(x)) throw `"${chave}" contém responsabilidade inválida: "${x}". Válidos: cliente, destinatario, sistema, FR, transportador, pendente.`;
    return p.join(",");
  }
  if (chave === "parceiros_estrategicos") {             // CSV de UUIDs
    const p = t.split(",").map((s) => s.trim()).filter(Boolean);
    for (const x of p) if (!UUID_RE.test(x)) throw `"${chave}" contém UUID inválido: "${x}"`;
    return p.join(",");
  }
  const n = Number(t);
  if (!Number.isFinite(n)) throw `"${chave}" precisa ser numérico`;
  if (chave.endsWith("_pct")) { if (n < 0 || n > 100) throw `"${chave}" deve estar entre 0 e 100`; }
  else if (chave.endsWith("_pp")) {
    if (n < 0 || n > 100) throw `"${chave}" deve estar entre 0 e 100`;
    if (!Number.isInteger(n)) throw `"${chave}" precisa ser inteiro`;
  } else {
    if (n < 0) throw `"${chave}" não pode ser negativo`;
    if (!Number.isInteger(n)) throw `"${chave}" precisa ser inteiro`;
  }
  return String(n);                                     // "95.0" vira "95"
}
```

Grava `valor` + `updated_by` e invalida o cache da chave da empresa. `Number("")` é 0: valor
vazio numérico vira `"0"`.

**getConfiguracoesPublicas** (autenticado, sem módulo): valores da empresa ativa das chaves
`sla_meta_pct, sla_alerta_amarelo_pct, sla_alerta_vermelho_pct, taxa_retorno_meta_pct,
romaneio_peso_critico_kg, romaneio_volume_critico, alerta_dias_sem_movimento,
ranking_threshold_positivo_pct, ranking_threshold_atencao_pct, ranking_threshold_critico_pct,
alerta_queda_sla_pp, alerta_janela_tendencia_dias, alerta_janela_vencimento_h,
alerta_min_vencimento, alerta_nascido_atrasado, alerta_desvio_finsistema_pp,
alerta_dias_sem_atualizacao, otif_visivel` (só as que existem). Sem empresa ⇒ `{}`.

Leitura de configuração no servidor (`config.server.ts`): cache por `empresa:chave`, TTL 5 min;
sem empresa ⇒ fallback ou erro `Configuração "<k>": nenhuma empresa ativa`; ausente ⇒ fallback ou
`Configuração "<k>" não encontrada`; `getConfigBool` = `"true"|"1"|"sim"`. `config_empresa(chave)`
(SQL) = valor da chave na empresa ativa.

### 3.6 Prazos configurados (Admin → Configurações)

Guard admin + empresa. Regras de cálculo (`aplicar_prazo_configurado`,
`recalcular_todos_prazos_configurados(p_empresa)`) estão no R de prazo; aqui só a operação:

- **listar**: regras da empresa (ordem `tipo`, `updated_at` desc) + opções de unidade (filial
  distinta de `ctrcs` com a cidade da 1ª linha não vazia) e de parceiro (CNPJ distinto com o
  primeiro nome não vazio, ordem nome). Hoje as opções vêm de `.limit(20000)` que o PostgREST
  corta em **1000 linhas** em silêncio ⇒ a lista sai de só 1000 CT-e. Ver P10.
- **salvar** `{id?, tipo ∈ unidade|parceiro|transbordo, unidade_codigo?(1–10),
  unidade_destino_codigo?(1–10), parceiro_cnpj?(1–20), parceiro_nome?(≤200), prazo_horas?(1–720),
  prazo_dias?(1–90), ativo=true}`; obrigatórios: unidade ⇒ unidade + horas ("Unidade e horas são
  obrigatórias"); parceiro ⇒ CNPJ + dias ("Parceiro e dias são obrigatórios"); transbordo ⇒
  origem + destino + dias ("Origem, destino e dias são obrigatórios"). Grava `created_by = quem
  salvou` (também no update). Update de regra de outra empresa ⇒ `Regra não encontrada nesta
  empresa.` Depois aplica a regra e devolve `{id, atualizados}`.
- **ligar/desligar**: ao ligar aplica a regra; ao desligar recalcula todas as da empresa.
- **excluir**: apaga e recalcula todas as da empresa.

---

## 4. Auditoria

### 4.1 O que é registrado

Duas fontes, mesma tabela:

1. **Por tabela** (gatilho `auditar()` hoje; no novo: o caso de uso grava na mesma transação) —
   tabelas e `entidade`:

| Tabela | entidade | Tabela | entidade |
| --- | --- | --- | --- |
| codigos_ocorrencia | codigo_ocorrencia | metas | meta |
| configuracoes | configuracao | modulos | catalogo_modulo (Plataforma) |
| departamento_screen_permissions | permissao_departamento | parceiros | parceiro |
| departamentos | departamento | plataforma_admins | admin_plataforma (Plataforma) |
| empresa_integracoes | integracao | prazo_padrao_cidade | prazo_padrao_cidade |
| empresa_modulos | modulo | prazos_configurados | prazo_configurado |
| empresa_usuarios | usuario_empresa | regras_bonificacao | regra_bonificacao |
| empresas | empresa | role_screen_permissions | permissao_cargo |
| equipes_entrega | equipe | roles | cargo |
| feriados | feriado | unidades | unidade |
| filiais_ssw | filial | user_roles | papel_usuario (não portar) |
| membros_equipe | membro_equipe | user_screen_permissions | permissao_usuario |
| | | usuarios_perfil | usuario |

   Nunca em `ctrcs`, `ocorrencias`, `staging_*` (volume). Também **não** são auditadas hoje:
   `regra_criterios`, `bonificacao_parametros/codigos/faltas/calculo`, `anotacoes`. Só as 25
   tabelas acima.

2. **Explícito** (`auditoria_registrar`): `convidar` (§3.1, §3.2), `definir_segredo` /
   `remover_segredo` (§3.2), `trocar_empresa` (§1.4). Grava `ip` (`cf-connecting-ip` ou 1º de
   `x-forwarded-for`) e `user_agent`. Falha ao registrar **não** derruba a ação (só log do
   servidor) — no novo, mesma transação (ver P4).

### 4.2 Regras do registro por tabela

```ts
// origem: auditar (sistema atual)
const IGNORAR = ["updated_at","atualizado_em","created_at","criado_em","token_atualizado_em",
  "ultima_verificacao_em","ultima_verificacao_ok","ultima_verificacao_mensagem","ultima_verificacao_origem",
  "ultimo_teste_em","ultimo_teste_ok","ultimo_teste_msg","updated_by","atualizado_por","empresa_ativa_id"];
const SEGREDO = /(senha|token|secret|segredo|apikey|password)/i;

function registroDeTabela(tabela, entidade, op: "criar"|"alterar"|"excluir", antes?, depois?, ctx) {
  const linha = depois ?? antes;
  // configuracoes de estado de job não geram log
  if (tabela === "configuracoes" && (/^(bi2_|enriq_periodo_|backfill_(?!cron_token))/.test(linha.chave)
      || ["ftp_sync_rodando","ssw_relatorios_rodando"].includes(linha.chave))) return;
  let a, d;
  if (op === "alterar") {
    a = {}; d = {};
    for (const k of Object.keys(depois)) if (!IGNORAR.includes(k) && !igualJson(antes[k], depois[k])) { a[k] = antes[k]; d[k] = depois[k]; }
    if (Object.keys(d).length === 0) return;                          // só mudou coluna ignorada
  } else { a = antes && omit(antes, IGNORAR); d = depois && omit(depois, IGNORAR); }
  for (const k of Object.keys(d ?? a)) {
    const mascarar = SEGREDO.test(k) || (tabela === "configuracoes" && k === "valor" && SEGREDO.test(linha.chave));
    if (mascarar) { if (a?.[k] != null) a[k] = "***"; if (d?.[k] != null) d[k] = "***"; }
  }
  const ator = ctx.usuarioId ?? depois?.updated_by ?? depois?.atualizado_por ?? depois?.criado_por ?? depois?.created_by ?? null;
  const empresaId = entidadeDePlataforma(tabela) ? null              // modulos, plataforma_admins
    : tabela === "empresas" ? linha.id
    : linha.empresa_id ?? ctx.empresaId ?? null;
  let entidadeId = linha.id ?? linha.chave ?? linha.key ?? linha.codigo ?? linha.sigla ?? linha.user_id
    ?? linha.role_key ?? linha.departamento_key ?? linha.modulo_key;
  if (["empresa_usuarios","empresa_modulos","empresa_integracoes","user_roles"].includes(tabela))
    entidadeId = linha.user_id ?? linha.modulo_key ?? linha.tipo;
  if (["role_screen_permissions","departamento_screen_permissions","user_screen_permissions"].includes(tabela))
    entidadeId = `${linha.role_key ?? linha.departamento_key ?? linha.user_id}:${linha.screen}`;
  inserir({ empresaId, atorId: ator, atorEmail: emailDe(ator), atorTipo: tipoAtor(ator), acao: op, entidade, entidadeId, antes: a, depois: d });
}
const tipoAtor = (ator) => !ator ? "sistema" : ehPlataforma(ator) ? "plataforma" : "usuario";  // "integracao" nunca é gerado hoje
```

- Autor hoje: `auth.uid()` → `app.ator_id` (funções da Plataforma) → cabeçalho `x-ator-id` (só
  service role) → colunas de autoria. No novo o autor é sempre o usuário do contexto; job/ingestão
  ⇒ `null` ⇒ `sistema`.
- Atenção: o mascaramento usa a regex **sem** `api_key` (a das integrações tem); manter as duas
  como estão.
- `ator_email` = e-mail do usuário na hora do registro.

### 4.3 Leitura (telas Logs)

**Plataforma → Logs** e **Plataforma → Empresa → Logs** (`listarAuditoriaPlataforma`, Plataforma):
filtros `empresaId` (uuid ou `"plataforma"` = `empresa_id IS NULL`), `ator` (trecho do e-mail,
`ILIKE %x%`), `entidade` (igual), `acao` (igual), `de`/`ate` (AAAA-MM-DD, dia de Brasília:
`criado_em >= de 00:00-03:00` e `<= ate 23:59:59.999-03:00`). Ordem `criado_em` desc, **limite
1000** (a tela avisa no limite). Cada linha leva `empresa_nome`.

**Admin → Logs** (`listarAuditoriaEmpresa`): Plataforma ou admin; sempre `empresa_id = empresa
ativa`; mesmos filtros (sem empresa).

Texto de "o que mudou" (`descreverMudanca`): `resumo` se houver; em `alterar`,
`k: <antes> → <depois>` por campo, separados por `; ` (valor > 60 caracteres vira 57 + `…`; nulo =
`vazio`); `criar` ⇒ "Registro criado"; `excluir` ⇒ "Registro excluído". Rótulos de ação: criar
"Criou", alterar "Alterou", excluir "Excluiu", trocar_empresa "Trocou de empresa", convidar
"Convidou". Tipos: Usuário, Plataforma, Sistema, Integração. Rótulos de entidade:
`ENTIDADE_LABEL` em `features/auditoria/types.ts`.

### 4.4 Aba "Integrações" dos Logs

`listarLogsIntegracao({empresaId?, origem?, de?, ate?})`: com `empresaId` ⇒ Plataforma (qualquer
empresa); sem ⇒ (Plataforma ou admin) na empresa ativa, lendo com a RLS do usuário (§1.13 C/D).
Junta até **250 por origem**, período em dia de Brasília, ordena por `quando` desc:

| origem | tabela | quando | resumo |
| --- | --- | --- | --- |
| `sftp_xml` "SFTP · XML de CT-e" | ftp_xml_sync_log | executado_em | `<arquivos_processados> arquivo(s), <ctrcs_processados> CT-e[, <n> com erro][ · <triggered_by>]` |
| `relatorio_ssw` "SFTP · Relatórios SSW" | ssw_relatorio_arquivos (tempo: `visto_em`) | importado_em ?? visto_em | `<tipo_codigo ?? "?"> · <nome_arquivo>[ · <linhas> linha(s)]` |
| `aplicacao_ssw` "Aplicação dos relatórios" | ssw_aplicacao_log (tempo: `aplicado_em`) | iniciado_em ?? aplicado_em | `<ins> inserido(s), <atu> atualizado(s), <oc> ocorrência(s), <ign> ignorado(s)[ · simulação]` |
| `bi2` "BI2 do SSW" | bi2_sync_log | iniciado_em | `Relatório <codigo ?? "—"> de <data_alvo ?? "—">[ (<modo>)]: <n> linha(s), <c> criado(s), <a> atualizado(s)` |

`erro` = `mensagem` / `mensagem` / `erro` / `erro`. Números ausentes contam 0.

---

## 5. Ranking

Dois produtos com o mesmo nome no menu:

- **Ranking operacional** (`/ranking`, telas `ranking`/`ranking_novo`): SLA por parceiro e por
  cidade. É o que tem uso real.
- **Ranking de equipes por regras** (`/admin/equipes`, `/ranking/regras`,
  `/ranking/equipe/$id`, link público `/ranking/publico/$token`): bonificação de equipes por
  critérios configuráveis. No DEVELOP: 1 equipe, 0 membros, 0 regras, 0 cálculos fechados
  (`tabelas-tamanho.txt`). Ver §5.6 e P8.

### 5.1 Ranking operacional — `ranking_operacional`

Entrada: `grupo ∈ pagador|cidade`, `inicio`, `fim` (AAAA-MM-DD), `filiais?`, `baseData ∈
emissao|prevista|concluido` (padrão emissão), `pagadores?` (CNPJs só dígitos), `destino?`,
`remetente?` (texto com `|` = vários valores), `tipos?`. Módulo `ranking`.

```ts
// origem: ranking_operacional (sistema atual). Universo e filtros = _perf_filtro_ctrcs (R de performance):
// filial efetiva própria, NOT fora_universo, data do período pela base, pagador, filial, remetente/destino
// (texto_casa_filtro), tipo de documento efetivo, e escopo de unidade/equipe se !podeVerTudo.
const COL_DATA = { emissao: "data_emissao", prevista: "data_prevista_entrega", concluido: "data_conclusao_efetiva" };
const ENTREGA = [1, 18, 67];

function rankingOperacional(ctrcs: Ctrc[], codigosBaixa: Set<number> /* codigos_ocorrencia da empresa com tipo_ssw = 'BAIXA' */,
                            grupo: "pagador" | "cidade", hoje: string): Linha[] {
  const grupos = new Map<string, Ctrc[]>();
  for (const c of ctrcs) {
    const chave = grupo === "cidade" ? (c.cidadeDestino ?? "").trim().toUpperCase()
                                     : (c.pagadorCnpj ?? "").replace(/\D/g, "");
    if (chave === "") continue;
    push(grupos, chave, c);
  }
  return [...grupos].map(([chave, cs]) => {
    const nc = (c) => { const d = (c.ocorrEfetivaCodigo ?? "").replace(/\D/g, ""); return d ? Number(d) : null; };
    const entregue = (c) => c.dataEntregaRealizada != null || ENTREGA.includes(nc(c));
    const finalizado = (c) => c.dataEntregaRealizada == null && nc(c) != null && !ENTREGA.includes(nc(c)) && codigosBaixa.has(nc(c));
    const E = cs.filter(entregue);
    const aberto = cs.filter((c) => !entregue(c) && !finalizado(c));
    const foraTransp = E.filter((c) => c.noPrazo === false && !(c.responsabilidadeCliente ?? false)).length;
    return {
      chave,
      rotulo: moda(cs.map((c) => grupo === "cidade" ? c.cidadeDestino : c.pagadorNome)), // mais frequente, empate = menor; ignora nulo
      sub: grupo === "cidade" ? max(cs.map((c) => c.ufDestino)) : null,
      total_ctrcs: cs.length,
      entregue: E.length,
      no_prazo: E.filter((c) => c.noPrazo === true).length,
      fora_prazo: E.filter((c) => c.noPrazo === false).length,                 // no_prazo nulo não entra em nenhum
      fora_cliente: E.filter((c) => c.noPrazo === false && (c.responsabilidadeCliente ?? false)).length,
      fora_transp: foraTransp,
      sla_pct: E.length ? (E.length - foraTransp) / E.length : null,          // fração 0–1, numeric sem arredondar
      a_entregar: aberto.length,
      atrasadas: aberto.filter((c) => c.dataPrevistaEntrega != null && c.dataPrevistaEntrega < hoje).length,
      no_prazo_aberto: aberto.filter((c) => c.dataPrevistaEntrega == null || c.dataPrevistaEntrega >= hoje).length,
      peso: soma(cs, "peso"), volumes: soma(cs, "volumes"), frete: soma(cs, "valorFrete"),  // nulo = 0
    };
  }).sort((a, b) => nullsLast(a.sla_pct, b.sla_pct) || b.total_ctrcs - a.total_ctrcs);
}
```

- Timeout da consulta: tenta de novo uma vez após 1,2 s; se a 2ª também estourar, devolve **lista
  vazia** (sem erro). Outro erro ⇒ `friendlyDbError`.
- Filiais pedidas passam pelo filtro de filiais próprias da empresa (R de performance).

**Front** (`RankingTabela`): `meta = sla_meta_pct/100` (padrão 0,95), `warn =
sla_alerta_amarelo_pct/100` (padrão 0,90). Nível: `sla >= meta` bom; `>= warn` atenção; senão
ruim. Cards: grupos = nº de linhas; total de CT-e = Σ`total_ctrcs`; SLA médio = (Σ`entregue` −
Σ`fora_transp`) / Σ`entregue` (ponderado, não média das linhas); abaixo da meta = linhas com
`sla_pct < meta`. Filtro dos cards: na meta = `sla_pct >= meta`, abaixo = `< meta`. Clique na
linha abre `/performance/lista` com os filtros da tela (pagador ⇒ `parceiros=[chave]`; cidade ⇒
`destino=<rótulo>`); clique num número abre o recorte da coluna. Gráfico mês a mês via
`getSlaSerie` (R de performance). Detalhes de tela/PDF:
`docs/decisoes/ranking-visao-filtros-e-pdf-2026-10-20.md`.

Exemplo (aba Parceiro, hoje = 2026-11-10): 5 CT-e do CNPJ 12.345.678/0001-90:

| CT-e | entrega | código efetivo | no_prazo | resp. cliente | prevista |
| --- | --- | --- | --- | --- | --- |
| 1 | 05/11 | 1 | true | — | 04/11 |
| 2 | 06/11 | 1 | false | false | 03/11 |
| 3 | 07/11 | 1 | false | true | 03/11 |
| 4 | — | 85 | — | — | 08/11 |
| 5 | — | 85 | — | — | 12/11 |

entregue 3, no_prazo 1, fora_prazo 2, fora_cliente 1, fora_transp 1, `sla_pct = (3−1)/3 =
0,6667`, a_entregar 2, atrasadas 1 (08/11 < 10/11), no_prazo_aberto 1.

### 5.2 Equipes e membros (`/admin/equipes`, tela `admin_equipes`)

Módulo `ranking`; escrita = gestão (§1.13 E).

- **listEquipes**: equipes (ordem `nome`, com `share_token` e `share_token_revogado`), membros
  ativos (`data_saida` nula) ordenados motorista primeiro, depois `posicao` (nula = 99), depois
  `nome` (`localeCompare`), unidades ativas (ordem nome). Leitura limitada pela RLS (§1.13 I).
- **upsertEquipe** `{id?, nome(≥1), unidade_id?, ativo=true}`: insere (empresa ativa) ou atualiza.
- **addMembro** `{equipe_id, nome, papel ∈ motorista|ajudante, cpf?, posicao?(1–3)}`:

```ts
// origem: addMembro (ranking.functions.ts)
let posicao: number | null = null;
if (papel === "ajudante") {
  const ocupadas = new Set(ajudantesAtivos(equipeId).map((m) => m.posicao).filter((p) => p != null));
  if (pedida != null) { if (ocupadas.has(pedida)) throw `Ajudante ${pedida} já está ocupado nesta equipe.`; posicao = pedida; }
  else { posicao = [1, 2, 3].find((p) => !ocupadas.has(p)) ?? throwErr("Esta equipe já tem 3 ajudantes ativos."); }
}
inserir({ equipeId, nome, papel, cpf: cpf ?? null, posicao });  // usuario_id nunca é gravado
```

  Banco: ajudante exige posição 1–3; motorista posição nula ou 0; posição única entre ativos da
  equipe. Motorista não tem limite.
- **removeMembro** `{id}`: `data_saida = data UTC de agora` (`new Date().toISOString().slice(0,10)`
  — depois das 21h de Brasília grava o dia seguinte). Ver P11.
- **gerarToken** (`gerar_token_equipe`): gestão senão `forbidden`; equipe da empresa ativa senão
  `Equipe não encontrada`; token = 24 bytes aleatórios em hex (48 caracteres); grava
  `share_token`, `share_token_revogado=false`. Front monta `${origin}/ranking/publico/<token>`,
  copia e avisa "Link gerado e copiado".
- **revogarToken**: `share_token_revogado = true` (o token fica gravado; gerar de novo troca).

### 5.3 Regras (`/ranking/regras`, tela `admin_bonificacao`)

- **listRegras**: regras da empresa (ordem `vigencia_inicio` desc) com critérios por `ordem`.
- **upsertRegra** `{id?, nome, descricao?, vigencia_inicio, vigencia_fim?, ativo=true,
  criterios[]{criterio, parametros}}`: grava `criada_por = quem salvou` (também na edição); na
  edição apaga os critérios e regrava com `ordem` = índice. Hoje não é transacional e o erro do
  delete é ignorado — no novo, transação.
- **deleteRegra** `{id}` (critérios em cascata). Front confirma "Remover regra?".
- Critérios válidos e parâmetros padrão do editor: `entregas_prazo {peso: 2}`, `penalizante
  {valor: 15}`, `meta_produtividade {meta_entregas: 200, bonus_se_atingir: 200}`,
  `piso_performance {performance_minima: 85}`, `livre {nome: "Bônus pontual", valor: 50}`. O
  editor converte o texto digitado em número quando é número.
- **Simulador** (botão por regra): mês anterior ao atual (1º ao último dia, datas do navegador)
  via `calcular_bonificacao_lote`; mostra "N equipe(s) · Total estimado: R$ Σvalor_calculado" e as
  **5 primeiras equipes na ordem em que vêm** (sem ordenar).

### 5.4 Bonificação por regra — `calcular_bonificacao`

```ts
// origem: calcular_bonificacao (sistema atual)
function calcularBonificacao(equipeId, regraId, inicio, fim, ctx) {
  if (!equipeDaEmpresa(equipeId, ctx.empresaId)) throw "Equipe não encontrada";
  const cs = ctrcs.filter((c) => c.equipeId === equipeId && c.dataEmissao >= inicio && c.dataEmissao <= fim);
  const totalEntregas = cs.length;                                       // TODOS os CT-e da equipe, entregues ou não
  const noPrazo = cs.filter((c) => c.dataEntregaRealizada && c.prazoEntrega
                                   && diaUTC(c.dataEntregaRealizada) <= c.prazoEntrega).length;   // ::date na sessão UTC
  const penalizantes = ocorrencias.filter((o) => cs.some((c) => c.id === o.ctrcId) && o.penaliza === true).length; // linhas, inclui quarentena
  const performance = totalEntregas > 0 ? 1 - penalizantes / totalEntregas : 1;

  let valor = 0, zerado = false; const breakdown = [];
  for (const k of criterios(regraId).sort(porOrdemDepoisCriadoEm)) {
    const p = k.parametros; let sub = 0, label = k.criterio, det = "";
    switch (k.criterio) {
      case "entregas_prazo": sub = noPrazo * num(p.peso); det = `${noPrazo} × R$${p.peso ?? "0"}`; label = "Entregas no prazo"; break;
      case "penalizante":    sub = -penalizantes * num(p.valor); det = `${penalizantes} × -R$${p.valor ?? "0"}`; label = "Penalidades"; break;
      case "meta_produtividade":
        if (totalEntregas >= int(p.meta_entregas)) { sub = num(p.bonus_se_atingir); det = `Meta atingida (${totalEntregas}/${p.meta_entregas})`; }
        else det = `Meta não atingida (${totalEntregas}/${p.meta_entregas})`;
        label = "Meta de produtividade"; break;
      case "piso_performance":                                            // compara FRAÇÃO com o número digitado (85) — ver P8
        if (performance < num(p.performance_minima)) { zerado = true; det = `Performance ${round1(performance*100)}% < piso ${p.performance_minima}%`; }
        else det = `Performance ${round1(performance*100)}% ≥ piso`;
        label = "Piso de performance"; break;
      case "livre": sub = num(p.valor); det = p.nome ?? "Ajuste livre"; label = "Ajuste livre"; break;
    }
    valor += sub; breakdown.push({ criterio: k.criterio, label, detalhe: det, subtotal: sub });
  }
  if (zerado) valor = 0;
  return { equipe_id, regra_id, periodo_inicio: inicio, periodo_fim: fim, total_entregas: totalEntregas,
           entregas_no_prazo: noPrazo, penalizantes, performance, pontos: noPrazo - penalizantes,
           valor_calculado: Math.max(valor, 0), zerado_por_piso: zerado, breakdown };
}
// num(x) = Number(x ?? 0); int(x) = parseInt(x ?? 0); round1 = arredondamento do Postgres a 1 casa
```

Exemplo: equipe com 120 CT-e no período, 100 entregues no prazo, 6 ocorrências penalizantes ⇒
`performance = 1 − 6/120 = 0,95`. Regra: entregas_prazo peso 2 (+200), penalizante valor 15
(−90), meta 200/200 (não atingida, 0), piso 85.
Como o piso compara 0,95 com 85, `zerado = true` ⇒ `valor_calculado = 0`, detalhe "Performance
95.0% < piso 85%". Com `performance_minima = 0.85`: passa ⇒ `valor = 110`, `pontos = 94`.

**Lote** (`calcular_bonificacao_lote(regra, inicio, fim)`): para cada equipe **ativa** da empresa
(ordem não definida): o cálculo acima + `nome`, `unidade_id`, `unidade_nome`, `membros[{nome,
papel}]` ativos. Devolve `{periodo_inicio, periodo_fim, regra_id, equipes[], gerado_em}`.

**Detalhe da equipe** (`/ranking/equipe/$id?inicio&fim&regra`): cálculo da equipe + tela móvel
(`EquipeMobileView`) com posição nula, total de equipes = nº de equipes da lista, top3 vazio; botão
voltar para `/admin/equipes`.

### 5.5 Fechamento de período

`fechar_periodo_bonificacao` grava `bonificacao_calculo` — **sem tela** (§8).

### 5.6 Atribuição de CT-e a equipe (está quebrada hoje)

- **listCtrcsParaAtribuir** `{inicio, fim, somente_sem_equipe=true, unidade_id?}`: CT-e da empresa
  visíveis ao usuário (§1.11), `fora_universo = false`, emissão no período, sem equipe (se pedido),
  da unidade (se pedida), ordem emissão desc, **limite 500**. Front: mês corrente.
- **atribuirEquipeEmLote** `{ctrc_ids[≥1], equipe_id|null}`: faz `UPDATE ctrcs` com a RLS do
  usuário, mas **não existe policy de UPDATE em `ctrcs`**: grava 0 linhas, sem erro, e devolve
  `count = ctrc_ids.length` (toast "N CTRC(s) atribuído(s)"). Nenhuma função do banco preenche
  `ctrcs.equipe_id`. Logo todo cálculo por regra dá `total_entregas = 0`. Ver P8.

### 5.7 Link público — `/ranking/publico/$token`

Rota sem login (título "Meu ranking"). Período = mês corrente (datas do navegador), rótulo "mês
de ano" em pt-BR.

```ts
// origem: getRankingPublico + get_ranking_publico_por_token (sistema atual)
async function rankingPublico(token: string, inicio: string, fim: string) {
  const e0 = equipePorToken(token);                       // sem olhar revogado/ativo
  if (e0 && !moduloLiberado(e0.empresaId, "ranking", hoje()))
    throw "Este ranking não está disponível no momento. Fale com a sua empresa.";
  const eq = equipes.find((e) => e.shareToken === token && !e.shareTokenRevogado && e.ativo);
  if (!eq) throw "token inválido";
  const ctx = { empresaId: eq.empresaId, usuarioId: null };   // contexto da empresa da equipe
  const regra = regrasBonificacao(eq.empresaId)
    .filter((r) => r.ativo && r.vigenciaInicio <= fim && (r.vigenciaFim == null || r.vigenciaFim >= inicio))
    .sort((a, b) => cmp(b.vigenciaInicio, a.vigenciaInicio))[0];
  if (!regra) return { equipe: { id: eq.id, nome: eq.nome }, erro: "Nenhuma regra vigente" };
  const calculo = calcularBonificacao(eq.id, regra.id, inicio, fim, ctx);
  const lote = calcularBonificacaoLote(regra.id, inicio, fim, ctx);
  const ranqueadas = [...lote.equipes].sort((a, b) => b.valor_calculado - a.valor_calculado); // empate: ordem indefinida
  return {
    equipe: { id: eq.id, nome: eq.nome }, periodo: { inicio, fim }, calculo,
    posicao: ranqueadas.findIndex((x) => x.equipe_id === eq.id) + 1 || null,
    total_equipes: ranqueadas.length,
    top3: ranqueadas.slice(0, 3).map((x, i) => ({ posicao: i + 1, nome: x.nome })),
    regra_id: regra.id,
  };
}
```

- Erro, resposta vazia ou com `erro` ⇒ a tela mostra a mensagem de link inválido com "Solicite um
  novo link ao gestor da sua equipe." (sem tentar de novo).
- No novo: rota `/api/public/...` sem sessão, com rate limit por IP (paridade §2 item 1). A
  consulta roda no contexto da empresa da equipe.

---

## 6. Bonificação de entrega (`/admin/bonificacao-entrega`)

Tela `admin_bonificacao_entrega`, módulo `ponto_bonificacao`, guard **admin** em todas as
operações (gestor só vê a tela se tiver a exceção, mas o servidor nega).

### 6.1 Operações

- **listarUnidadesBonificacao** (`bonificacao_unidades`): `unidade = upper(3 primeiros
  caracteres do romaneio)` do 036 da empresa (romaneio com ≥ 3 caracteres após trim),
  `romaneios = nº distinto`, `ultimo_dia = max(data_emissao)`; ordem `romaneios` desc.
- **listarParametrosBonificacao**: todas as linhas de `bonificacao_parametros` da empresa, ordem
  `vigencia_inicio` desc (painel "Como funciona").
- **apurarBonificacao** `{inicio, fim, unidades?, usarPonto?}` — validações: datas AAAA-MM-DD
  ("Data deve estar no formato YYYY-MM-DD"), `fim >= inicio` ("Data final deve ser maior ou igual
  à data inicial"), `fim − inicio <= 45 dias` ("Apure no máximo 45 dias por vez — períodos maiores
  estouram o tempo da consulta"). Tela: uma unidade ou todas; "usar ponto" ligado por padrão.
  1. Se `usarPonto`: nomes distintos (trim) de motorista/ajudantes do 036 no período/unidades
     (`bonificacao_colaboradores_periodo`) ⇒ `calcularHorasExtras` (§7.3).
  2. `bonificacao_apurar(inicio, fim, horasExtras, unidades)` (§6.2).
  Exige a integração `ahgora` ativa quando `usarPonto` (senão o erro da integração sobe e a
  apuração não sai).

### 6.2 Cálculo — `bonificacao_apurar`

Parâmetros vigentes: linha de `bonificacao_parametros` da empresa com `vigencia_inicio <= fim` e
(`vigencia_fim` nula ou `>= inicio`), a de `vigencia_inicio` mais recente. Nenhuma ⇒ `Não há
parâmetros de bonificação vigentes para o período informado. Cadastre as taxas e metas antes de
apurar.` Valores da FR (seed): turbo 1,00; acelerado 0,80; em rota grande 0,40; em rota pequena
0,60; meta rota pequena 0,90; meta rota grande 0,95; meta em rota 0,80; limite rota pequena 15
NFs.

```ts
// origem: bonificacao_apurar (sistema atual)
function apurar(inicio, fim, horasExtras: {nome, data, hora_extra: boolean | null}[], unidades: string[] | null, p: Parametros) {
  const he = new Map(horasExtras.map((h) => [`${h.nome.trim().toUpperCase()}|${h.data}`, h.hora_extra]));

  // 1) uma linha por (romaneio, nº do CT-e), lida do staging 036 (não da view "último romaneio")
  const linhas036 = staging036(empresa).filter((s) => s.dataEmissao >= inicio && s.dataEmissao <= fim
      && s.romaneio != null && s.ctrc != null && numCtrc(s.ctrc) != null
      && (!unidades || unidades.includes(s.romaneio.slice(0, 3).toUpperCase())));
  const porChave = maisRecentePor(linhas036, (s) => `${s.romaneio}|${numCtrc(s.ctrc)}`, (s) => s.importadoEm);
  const itens = porChave.map((s) => {
    const c = ctrcs.find((c) => c.numeroCtrc === numCtrc(s.ctrc) && (c.siglaCtrc == null || c.siglaCtrc === siglaCtrc(s.ctrc)));
    // ocorrência DO DIA do romaneio (não o desfecho final): última do dia, fora de quarentena
    const od = c && ocorrencias.filter((o) => o.ctrcId === c.id && dia(o.dataHora) === s.dataEmissao && !o.quarentena)
                               .sort(porDataHoraDesc)[0];
    const cod = od?.codigo ?? null;
    return { ...s, placa: normPlaca(s.placa), numero: numCtrc(s.ctrc), cod, entregue: cod === 1 };
  });

  // 2) viagem = (romaneio, placa, data)
  const viagens = agrupar(itens, (t) => `${t.romaneio}|${t.placa}|${t.dataEmissao}`).map((ts) => {
    const efeito = (t) => bonificacaoCodigos(empresa).get(t.cod)?.efeito ?? null;   // penaliza | sac | verificar
    const distintos = (f) => new Set(ts.filter(f).map((t) => t.numero)).size;
    return {
      romaneio, placa, data, motorista: max(ts.map((t) => t.motorista)), ajudante: max(...), ajudante2: max(...), ajudante3: max(...),
      carregadas: distintos(() => true),
      sac: distintos((t) => !t.entregue && efeito(t) === "sac"),
      retorno: distintos((t) => !t.entregue && efeito(t) === "penaliza"),
      pendente: distintos((t) => !t.entregue && efeito(t) === null),   // ex.: 85 "em rota"; conta como entregue
      // efeito "verificar" (código 42) também conta como entregue e não aparece em nenhum contador
    };
  });

  // 3) uma linha por pessoa da viagem
  const calc = viagens.flatMap((v) => [[v.motorista, "Motorista"], [v.ajudante, "Ajudante"], [v.ajudante2, "Ajudante"], [v.ajudante3, "Ajudante"]]
    .filter(([n]) => n != null && n.trim() !== "")
    .map(([n, fn]) => {
      const entregues = v.carregadas - v.sac - v.retorno;
      const base = v.carregadas - v.sac;
      const exito = base === 0 ? 0 : Math.trunc((entregues / base) * 100) / 100;   // TRUNCA em 2 casas (0,949 → 0,94)
      const pequena = v.carregadas <= p.limite_nfs_rota_pequena;
      const horaExtra = he.get(`${n.trim().toUpperCase()}|${v.data}`) ?? null;    // sem registro = null
      const meta = pequena ? p.meta_rota_pequena : p.meta_rota_grande;
      const nivel = exito >= meta ? (horaExtra === false ? "turbo" : "acelerado")    // null ou true ⇒ acelerado
                  : exito >= p.meta_em_rota ? "em_rota" : "sem_bonus";
      return { ...v, colaborador: n.trim(), funcao: fn, entregues, exito, pequena, horaExtra, nivel };
    }));

  // 4) falta zera o último dia BONIFICADO anterior a ela (dentro do período apurado)
  const zerados = new Set<string>();
  for (const f of bonificacaoFaltas(empresa)) {                        // todas as faltas, não só do período
    const alvo = calc.filter((n) => n.colaborador.toUpperCase() === f.colaborador_nome.trim().toUpperCase()
                                  && n.data < f.data_falta && n.nivel !== "sem_bonus")
                     .sort((a, b) => cmp(b.data, a.data))[0];
    if (alvo) zerados.add(`${alvo.colaborador}|${alvo.data}`);           // zera TODAS as linhas dessa pessoa nesse dia
  }

  return calc.map((n) => {
    const z = zerados.has(`${n.colaborador}|${n.data}`);
    const bonus = z ? 0 : n.nivel === "turbo" ? n.entregues * p.taxa_turbo
      : n.nivel === "acelerado" ? n.entregues * p.taxa_acelerado
      : n.nivel === "em_rota" ? n.entregues * (n.pequena ? p.taxa_em_rota_pequena : p.taxa_em_rota_grande) : 0;
    return { data_romaneio: n.data, unidade: n.romaneio.slice(0, 3).toUpperCase(), romaneio: n.romaneio, placa: n.placa,
      colaborador: n.colaborador, funcao: n.funcao, nfs_carregadas: n.carregadas, sac: n.sac, retornos: n.retorno,
      pendentes: n.pendente, nfs_entregues: n.entregues, exito: n.exito, rota_pequena: n.pequena, hora_extra: n.horaExtra,
      sem_registro_ponto: n.horaExtra === null, nivel: n.nivel, bonus, zerado_por_falta: z };
  }).sort((a, b) => cmp(a.data_romaneio, b.data_romaneio) || cmp(a.romaneio, b.romaneio)
                  || Number(a.funcao !== "Motorista") - Number(b.funcao !== "Motorista") || cmp(a.colaborador, b.colaborador));
}
// numCtrc(x): parte antes do 1º "-", só dígitos, sem zeros à esquerda (ssw_num_ctrc); siglaCtrc(x): letras iniciais em maiúsculas
// normPlaca(x): maiúsculas, só [A-Z0-9], vazio ⇒ null (romaneio_norm_placa); dia(o.dataHora) = ::date na sessão (UTC)
```

Observações de paridade:

- O CT-e é casado só pelo número (+ sigla quando o CT-e tem); número repetido entre CT-e casa com
  qualquer um (memória "Número de CTRC não é único").
- `bonificacao_codigos` da FR: `penaliza` 10, 13, 16, 20, 25, 27, 28, 43, 44, 50, 87; `sac` 1, 5,
  9, 11, 14, 29, 30, 34, 38, 48, 67, 90; `verificar` 42. Código 1 é "sac" na tabela mas nunca
  conta como SAC (entregue é excluído).
- O nome que vem do Ahgora é normalizado (sem acento, só A–Z e espaço); o do 036 é só
  `upper(trim)`. Nome com acento no 036 não casa ⇒ `sem_registro_ponto`.
- `bonificacao_faltas` não tem tela de cadastro (§8); a regra do passo 4 só age se houver linhas.

Exemplos (parâmetros da FR):

| Viagem | carregadas | sac | retorno | pendente | entregues | êxito | pequena | hora extra | nível | bônus por pessoa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 20 | 2 | 1 | 1 | 17 | trunc(17/18)=0,94 | não | false | em_rota (0,94 < 0,95; ≥ 0,80) | 17 × 0,40 = 6,80 |
| B | 12 | 0 | 0 | 0 | 12 | 1,00 | sim | false | turbo | 12 × 1,00 = 12,00 |
| B' | 12 | 0 | 0 | 0 | 12 | 1,00 | sim | null (sem ponto) | acelerado | 12 × 0,80 = 9,60 |
| C | 15 | 0 | 4 | 0 | 11 | trunc(11/15)=0,73 | sim | — | sem_bonus | 0 |

**Tela** (agrupamento no front, `agruparPorPessoa`): por colaborador — `funcao` = funções
distintas em ordem decrescente unidas por "/", `dias` = nº de linhas, `entregues` e `retornos`
somados, `exitoMedio` = média simples dos êxitos diários (um dia de 2 NFs pesa igual a um de 40),
`diasTurbo`, `diasSemBonus`, `diasHoraExtra` (`hora_extra === true`), `semPonto`, `zerados`,
`total` = Σbônus; pessoas ordenadas por `total` desc, linhas por data. Visão por dia agrupa por
`data_romaneio`. Rótulos de nível: Turbo, Acelerado, Em rota, Sem bônus.

---

## 7. Ahgora (`/admin/ahgora`, só Plataforma)

Tela com abas "Apuração do período" e "Batidas por colaborador". Todas as operações:
`assertAdminPlataforma` + `exigirEmpresa`; dados da **empresa ativa**.

### 7.1 Cliente HTTP

- Base `https://api.ahgora.com.br`, `Accept: application/json`, `Authorization: Basic
  base64(usuario:senha)`, timeout 30 s.
- Credencial: empresa resolvida para a integração `ahgora` (empresa existe, status
  ativa/implantação, integração **ativa** — senão erros 404/403/409 do resolvedor:
  `Empresa "<x>" não encontrada.`, `Empresa <nome> está <status>: a ingestão não roda.`, `A
  integração ahgora da empresa <nome> está desligada.`); `usuario` = `parametros.usuario` (ou
  `AHGORA_API_USUARIO` com `usar_env`); senha = segredo principal (ou `AHGORA_API_SENHA` com
  `usar_env`). Faltando ⇒ `Credenciais do Ahgora não configuradas para esta empresa. Cadastre
  usuário e senha em Plataforma → Empresa → Integrações.`
- Erros: timeout ⇒ `Tempo limite excedido ao consultar a API do Ahgora.`; rede ⇒ `Falha ao
  consultar a API do Ahgora: <msg>`; 401/403 ⇒ `Acesso negado pela API do Ahgora. Verifique as
  credenciais configuradas.`; outro não-2xx ⇒ `Erro na API do Ahgora (HTTP <status>): <corpo até
  500 caracteres>`.
- Endpoints: `GET /employees` (`register, skip, limit, nextPageId`), `GET /shifts?limit=100`,
  `GET /schedulesAndShifts/between` (`register, start, end`), `GET /punches/between`
  (`employeeId | employeeRegister | employeePis`, `start`, `end`; sem funcionário ⇒ `Informe
  employeeId, employeeRegister ou employeePis para consultar as batidas.`).
- Listagem completa de funcionários: páginas de 100 por `nextPageId` até acabar ou 5000.

### 7.2 Apuração do período

- **listarFuncionariosAhgora** `{register?, skip?, limit?, nextPageId?}`: repassa.
- **listarDepartamentosAhgora**: departamentos distintos não vazios de todos os funcionários,
  ordem pt-BR.
- **listarBatidasAhgora** `{employeeId?|employeeRegister?|employeePis?, start, end}`: algum
  identificador ("Informe o funcionário (employeeId, employeeRegister ou employeePis)"),
  `end >= start`, `end − start <= 30 dias` ("O período máximo por consulta é de 30 dias").
- **apurarPontoPeriodo** `{inicio, fim, departamento?, incluirDemitidos?}`: `fim >= inicio`,
  `fim − inicio <= 30 dias` ("O período máximo por apuração é de um mês").

```ts
// origem: apuracao-ponto.server.ts
function apurarDia(data: string, batidas: Batida[]): DiaApurado {
  const ord = [...batidas].sort((a, b) => a.punchTime.localeCompare(b.punchTime));
  const todas = ord.map((b) => ({ hora: b.punchTime.slice(11, 16), tipo: b.type }));   // hora local da string, sem new Date()
  if (ord.some((b) => b.type === "DELETADA")) return { data, batidas: todas, minutosTrabalhados: null, motivoRevisao: "excluida" };
  const horas = [...new Set(ord.filter((b) => b.type !== "DELETADA").map((b) => b.punchTime.slice(11, 16)))]; // tira repetida no mesmo minuto
  if (horas.length === 0 || horas.length % 2 !== 0) return { data, batidas: todas, minutosTrabalhados: null, motivoRevisao: "impar" };
  let min = 0; for (let i = 0; i < horas.length; i += 2) min += minutos(horas[i + 1]) - minutos(horas[i]);
  return { data, batidas: todas, minutosTrabalhados: min, motivoRevisao: null };
}
function apurarPontoPeriodo(empresa, { inicio, fim, departamento, incluirDemitidos }) {
  const sel = todosFuncionarios(empresa).filter((f) => f.register
    && (incluirDemitidos || !f.terminationDate) && (!departamento || f.department === departamento));
  if (sel.length > 150) throw `A seleção tem ${sel.length} colaboradores e o limite por apuração é 150. Escolha um departamento para reduzir o período de busca.`;
  // 10 em paralelo; um GET /punches/between por funcionário
  return { inicio, fim, funcionarios: sel.map((f) => {
    const dias = agruparPorDia(batidas(f), (b) => b.punchTime.slice(0, 10)).sort().map(([d, bs]) => apurarDia(d, bs));
    return { register: f.register, name: f.name, department: f.department ?? "", demitido: !!f.terminationDate,
             diasComRegistro: dias.length, minutosApurados: soma(dias.map((d) => d.minutosTrabalhados ?? 0)),
             diasARevisar: dias.filter((d) => d.motivoRevisao).length, dias };
  }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
}
```

Exemplo: batidas 08:02, 12:00, 13:01, 18:10 ⇒ (12:00−08:02) + (18:10−13:01) = 238 + 309 = 547 min.
Com uma batida `DELETADA` ⇒ revisão "excluida"; com 3 batidas ⇒ revisão "impar".

### 7.3 Hora extra para a bonificação (`calcularHorasExtras`)

```ts
// origem: hora-extra.server.ts
const normalizar = (n: string) => n.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();

function calcularHorasExtras(empresa, { inicio, fim, nomes }) {
  const alvos = unique(nomes.map(normalizar)).filter(Boolean);
  if (!alvos.length) return [];
  const cadastro = todosFuncionarios(empresa).filter((f) => f.register);
  const turnos = new Map(listarTurnos(empresa).map((t) => [t.key, t]));
  const casa = new Map<string, Funcionario>();
  for (const nome of alvos) {
    const exato = cadastro.find((f) => normalizar(f.name) === nome);          // em empate de nome, vale o último
    if (exato) { casa.set(nome, exato); continue; }
    const pref = cadastro.filter((f) => normalizar(f.name).startsWith(nome));  // 036 corta o nome em 30 caracteres
    if (pref.length === 1) casa.set(nome, pref[0]);
  }
  const out = [];
  for (const [nome, f] of casa) {                                              // 10 em paralelo
    const escala = new Map(escalaEntre(f.register, inicio, fim).map((e) => [e.date, e.shift]));
    for (const [dia, bs] of agruparPorDia(batidasEntre(f.register, inicio, fim))) {
      const ap = apurarDia(dia, bs);
      if (ap.minutosTrabalhados === null) { out.push({ nome, data: dia, hora_extra: null }); continue; }
      const turno = turnos.get(escala.get(dia) ?? "");
      const prevista = jornadaPrevista(turno);                                 // Σ pares de officeHours; inválido/hasNoOfficeHours ⇒ null
      if (prevista === null) { out.push({ nome, data: dia, hora_extra: ap.minutosTrabalhados > 0 }); continue; }  // folga: trabalhou = extra
      const tol = turno?.lateExitTolerance ? minutos(turno.lateExitTolerance) : 0;
      out.push({ nome, data: dia, hora_extra: ap.minutosTrabalhados > prevista + tol });
    }
  }
  return out;   // dia sem batida não gera linha ⇒ na apuração vira sem_registro_ponto
}
```

Exemplo: turno `08:00, 12:00, 13:00, 17:48` (528 min), tolerância `00:10`; trabalhou 545 min ⇒
545 > 538 ⇒ hora extra ⇒ nível no máximo "acelerado".

---

## 8. Não portar (código morto ou legado substituído) — com a prova

| Item | Prova | Destino |
| --- | --- | --- |
| `fechar_periodo_bonificacao` + `fecharPeriodo` + tabela `bonificacao_calculo` e policies | `fecharPeriodo` sem chamador (grep em `src`; paridade D16 "**sem chamador**"); `bonificacao_calculo` só é gravada por essa função e não é lida por tela; 0 linhas no DEVELOP | não portar |
| `registrarFaltaBonificacao`, `listarFaltasBonificacao` | só exportadas em `features/bonificacao/index.ts`, nenhum componente/rota importa (paridade D8/D9 "sem chamador"); `bonificacao_faltas` 0 linhas | não portar as rotas; regra de falta do §6.2 passo 4 — P12 |
| `is_membro_equipe` | usada só nas policies de `equipes_entrega`/`membros_equipe`; `membros_equipe.usuario_id` nunca é gravado (`addMembro` não aceita) | não portar |
| Escopo por unidade/equipe (`pode_ver_tudo` parte "sem escopo", `pode_ver_ctrc`, `p_escopo` de `_perf_filtro_ctrcs`) | nenhuma tela grava `unidade_id` (README multiempresa, pendências) nem `usuario_id` de membro; `pode_ver_tudo = true` nos 24 usuários da FR | P6 |
| `user_roles` + espelho em `plataforma_vincular_usuario` + `gravarPapel` + `app_metadata.role_key` | `calcularAcesso` não lê mais (correção 6 de 09/11); só as policies D (§1.13) e `"self read roles"` leem; escrita revogada de `authenticated` | não portar (as 3 policies D viram admin da empresa) |
| `handle_new_user` (gatilho em `auth.users`) | Supabase Auth sai | vira passo do caso de uso "criar usuário" (§3.1) |
| `_empresa_usuarios_sync_perfil` + `_empresa_unica` | copia perfil → vínculo; nenhuma tela grava `unidade_id`; `updateUser` já grava o vínculo explicitamente; `_empresa_unica` só serve com uma empresa no banco | não portar |
| `usuarios_perfil.departamento_key`, `unidade_id` | legado (o vínculo é a fonte) | não portar as colunas; `setor` e `ativo` ficam (§1.8) |
| `eh_admin_plataforma(_user_id)` com argumento | policies usam sem argumento; o backend só precisa do flag do próprio usuário | não portar |
| `config_empresa` | chamada só por `_alerta_dias_sem_movimento` e `_ocorrencias_codigos_tela` (SQL) | vira `getConfig(empresa, chave)` no backend |
| `empresa_semear` + `_trg_empresas_semear` | gatilho | vira passo do caso de uso `criarEmpresa` |
| `auditar()` / `auditoria_registrar` | gatilho/função | vira serviço de auditoria chamado pelos casos de uso (§4) |
| `contexto_sessao`, `empresa_atual`, `has_role`, `meus_papeis`, `modulo_liberado` | funções do banco | viram o contexto da requisição (§1.4–1.7) |
| `checkIsAdmin`, `checkIsSuperAdmin` | só `/dashboard` usa (rota fora do menu, linkada só pela página 404) | seguem o destino do `/dashboard` (R de performance/dashboard) |
| `foto_referencia` | tabela de teste das fases do multiempresa | não portar |
| Chave `ranking_novo` | duplicata de `ranking` (mesma página) | manter como dado (cargos têm as duas) ou normalizar na migração — P13 |

---

## 9. Dúvidas para o dono

- **P1 — Convite e senha.** Hoje o convidado entra pelo link sem definir senha e não há "esqueci
  minha senha"; depois só entra pelo Google ou se um admin definir a senha. O novo replica isso, ou
  o link do convite passa a pedir a senha (e entra a recuperação por e-mail prevista na
  arquitetura)?
- **P2 — Mensagens do login.** Hoje aparecem em inglês, cruas do Supabase ("Invalid login
  credentials"). Manter o texto ou traduzir ("E-mail ou senha incorretos")?
- **P3 — Google com e-mail desconhecido.** Hoje o Supabase cria a conta e a pessoa cai em "Sem
  acesso". No novo: recusar no login (recomendado) ou criar sem vínculo?
- **P4 — Criação de usuário atômica.** Hoje um erro no meio deixa o usuário criado com aviso
  ("Convite enviado, mas falhou ao …"). O novo faz tudo numa transação (sem aviso parcial) —
  ok? E o log de convite passa a ser obrigatório (falha de log derruba a ação)?
- **P5 — Log de senha e reenvio.** Definir senha e reenviar convite não geram log hoje. Passar a
  registrar (sem o valor)?
- **P6 — Escopo por unidade/equipe.** Regra existe no banco mas nada grava unidade nem usuário de
  membro (todos veem tudo). Portar a regra (inerte) ou deixar fora até haver tela?
- **P7 — Cargos e departamentos por empresa.** Hoje só a Plataforma edita (provisório 09/11); a
  chave de departamento é única entre empresas. Definir antes do schema `erp`.
- **P8 — Ranking de equipes por regras.** Atribuir CT-e à equipe não grava (sem policy de UPDATE
  em `ctrcs`) e nada preenche `ctrcs.equipe_id`; o piso de performance compara fração (0,95) com
  o número digitado (85) e zera sempre; DEVELOP tem 0 regras e 0 membros. Portar como está
  (paridade, sempre zero), corrigir, ou não portar as telas `admin_equipes`/`admin_bonificacao` e o
  link público?
- **P9 — Logs de integração do Admin.** Hoje a fila/aplicação SSW é lida pelo papel global legado;
  o novo usa o papel da empresa ativa (a Plataforma passa a ver). Ok?
- **P10 — Opções de unidade/parceiro em Prazos configurados.** Hoje saem de só 1000 CT-e (corte
  silencioso do PostgREST). O novo lista todas as distintas — ok (pode aparecer opção nova)?
- **P11 — Data de saída do membro.** Grava o dia UTC (após 21h vira o dia seguinte). Usar o dia de
  Brasília?
- **P12 — Faltas na bonificação de entrega.** Sem tela de cadastro, a regra "falta zera o último
  dia bonificado" nunca age. Manter a regra no cálculo, criar a tela, ou tirar?
- **P13 — Plataforma → Empresa → Usuários** usa `listRoles`/`listDepartamentos` da **empresa
  ativa** de quem opera, não da empresa editada: convidar com departamento falha ("Departamento
  inexistente") ou o vínculo recebe departamento de outra empresa. Corrigir no porte (listar os da
  empresa editada)? E normalizar `ranking`/`ranking_novo` numa chave só?
