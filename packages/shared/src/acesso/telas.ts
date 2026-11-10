/**
 * Catálogo de telas (chaves de permissão). As chaves e as URLs são as do sistema atual: cargo,
 * departamento e exceções gravados hoje continuam valendo sem tradução.
 * origem: src/lib/permissions.ts (sistema atual)
 */
export const TELAS = [
  "performance",
  "romaneio",
  "ocorrencias",
  "comprovantes",
  "coletas",
  "prazo_parceiro",
  "historico",
  "calendario",
  "ranking",
  "ranking_novo",
  "admin_usuarios",
  "admin_codigos",
  "admin_roles",
  "admin_departamentos",
  "admin_ingestao",
  "admin_importacao_ssw",
  "admin_historico",
  "admin_equipes",
  "admin_bonificacao",
  "admin_configuracoes",
  "admin_xml_cte",
  "admin_ahgora",
  "admin_bonificacao_entrega",
  "romaneio_placa",
  "admin_logs",
  "admin_ssw_diagnostico",
  "plataforma_empresas",
  "plataforma_logs",
  "plataforma_admins",
] as const;

export type Tela = (typeof TELAS)[number];

export function ehTela(valor: string): valor is Tela {
  return (TELAS as readonly string[]).includes(valor);
}

/** Telas só da equipe da Plataforma: nunca vêm de cargo, departamento ou exceção. */
export const TELAS_SO_PLATAFORMA: readonly Tela[] = [
  "plataforma_empresas",
  "plataforma_logs",
  "plataforma_admins",
  "admin_ingestao",
  "admin_importacao_ssw",
  "admin_xml_cte",
  "admin_ssw_diagnostico",
  "admin_ahgora",
];

/** Concedidas por regra, não por cargo: Logs da empresa = admin da empresa. */
export const TELAS_POR_REGRA: readonly Tela[] = ["admin_logs"];

/** Liberam um recurso dentro de uma tela; não têm página nem entram no menu. */
export const PERMISSOES_DE_RECURSO: readonly Tela[] = ["romaneio_placa"];

export const TELAS_ADMIN: readonly Tela[] = [
  "admin_usuarios",
  "admin_codigos",
  "admin_roles",
  "admin_departamentos",
  "admin_ingestao",
  "admin_importacao_ssw",
  "admin_historico",
  "admin_equipes",
  "admin_bonificacao",
  "admin_configuracoes",
  "admin_xml_cte",
  "admin_ahgora",
  "admin_bonificacao_entrega",
  "admin_logs",
  "admin_ssw_diagnostico",
  "plataforma_empresas",
  "plataforma_logs",
  "plataforma_admins",
];

/**
 * Telas admin que uma exceção individual pode dar a um gestor. Sem esta lista a exceção seria
 * ignorada em silêncio.
 */
export const TELAS_ADMIN_PARA_GESTOR: readonly Tela[] = ["admin_bonificacao_entrega"];

export const CAMINHO_DA_TELA: Record<Tela, string> = {
  performance: "/performance",
  romaneio: "/romaneio",
  ocorrencias: "/ocorrencias",
  comprovantes: "/comprovantes",
  coletas: "/coletas",
  prazo_parceiro: "/prazo-parceiro",
  historico: "/historico",
  calendario: "/calendario",
  ranking: "/ranking",
  ranking_novo: "/ranking",
  admin_usuarios: "/admin/usuarios",
  admin_codigos: "/admin/codigos",
  admin_roles: "/admin/roles",
  admin_departamentos: "/admin/departamentos",
  admin_ingestao: "/admin/ingestao",
  admin_importacao_ssw: "/admin/importacao-ssw",
  admin_historico: "/historico/feriados",
  admin_equipes: "/admin/equipes",
  admin_bonificacao: "/ranking/regras",
  admin_configuracoes: "/admin/configuracoes",
  admin_xml_cte: "/admin/xml-cte",
  admin_ahgora: "/admin/ahgora",
  admin_bonificacao_entrega: "/admin/bonificacao-entrega",
  romaneio_placa: "/romaneio",
  admin_logs: "/admin/logs",
  admin_ssw_diagnostico: "/admin/ssw-diagnostico",
  plataforma_empresas: "/plataforma/empresas",
  plataforma_logs: "/plataforma/logs",
  plataforma_admins: "/plataforma/administradores",
};

export const ROTULO_DA_TELA: Record<Tela, string> = {
  performance: "Performance",
  romaneio: "Romaneio",
  ocorrencias: "Ocorrências",
  comprovantes: "Comprovantes",
  coletas: "Coletas",
  prazo_parceiro: "Prazo do parceiro",
  historico: "Histórico",
  calendario: "Calendário",
  ranking: "Ranking",
  ranking_novo: "Ranking",
  admin_usuarios: "Admin · Usuários",
  admin_codigos: "Admin · Códigos",
  admin_roles: "Admin · Roles",
  admin_departamentos: "Admin · Departamentos",
  admin_ingestao: "Admin · Ingestão SSW",
  admin_importacao_ssw: "Admin · Importação SSW",
  admin_historico: "Admin · Feriados",
  admin_equipes: "Admin · Equipes",
  admin_bonificacao: "Admin · Bonificação",
  admin_configuracoes: "Admin · Configurações",
  admin_xml_cte: "Admin · Importar XML CT-e",
  admin_ahgora: "Admin · Ponto (Ahgora)",
  admin_bonificacao_entrega: "Admin · Bonificação de entrega",
  romaneio_placa: "Romaneio · Ver placa (Performance Motorista/Ajudante)",
  admin_logs: "Admin · Logs",
  admin_ssw_diagnostico: "Plataforma · Diagnóstico SSW",
  plataforma_empresas: "Plataforma · Empresas",
  plataforma_logs: "Plataforma · Logs",
  plataforma_admins: "Plataforma · Administradores",
};

/** Tela de um caminho: a primeira do catálogo que casa (igual ao guard de hoje). */
export function telaDoCaminho(caminho: string): Tela | undefined {
  return TELAS.find((t) => {
    const base = CAMINHO_DA_TELA[t];
    return caminho === base || caminho.startsWith(`${base}/`);
  });
}

/** Página inicial do usuário: a primeira tela com página; sem nenhuma, "/sem-acesso". */
export function primeiroCaminhoPermitido(telas: readonly Tela[]): string {
  const primeira = telas.find((t) => !PERMISSOES_DE_RECURSO.includes(t));
  return primeira ? CAMINHO_DA_TELA[primeira] : "/sem-acesso";
}
