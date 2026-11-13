import { type LinhaAuditoria, type OrigemIntegracao } from "@erp/shared/contracts/audit";

/**
 * Rótulos e texto curto das telas de Logs (tela e exportação).
 * origem: src/features/auditoria/types.ts (sistema atual)
 */
export const ROTULO_DA_ENTIDADE: Record<string, string> = {
  empresa: "Empresa",
  usuario_empresa: "Vínculo com a empresa",
  modulo: "Módulo",
  integracao: "Integração",
  empresa_integracao: "Integração",
  admin_plataforma: "Admin da Plataforma",
  catalogo_modulo: "Catálogo de módulos",
  usuario: "Usuário",
  permissao_usuario: "Permissão do usuário",
  departamento: "Departamento",
  permissao_departamento: "Permissão do departamento",
  cargo: "Cargo",
  permissao_cargo: "Permissão do cargo",
  configuracao: "Configuração",
  codigo_ocorrencia: "Código de ocorrência",
  prazo_configurado: "Prazo configurado",
  parceiro: "Parceiro",
  unidade: "Unidade",
  filial: "Filial",
  meta: "Meta",
  feriado: "Feriado",
  equipe: "Equipe",
  membro_equipe: "Membro de equipe",
  regra_bonificacao: "Regra de bonificação",
};

export const ROTULO_DA_ACAO: Record<string, string> = {
  criar: "Criou",
  alterar: "Alterou",
  excluir: "Excluiu",
  trocar_empresa: "Trocou de empresa",
  convidar: "Convidou",
  reenviar_convite: "Reenviou convite",
  definir_senha: "Definiu senha",
  definir_segredo: "Definiu senha/token",
  remover_segredo: "Removeu senha/token",
  login: "Entrou",
  aceitar_convite: "Aceitou convite",
  redefinir_senha: "Redefiniu senha",
  gerar_nacionais: "Gerou feriados nacionais",
};

export const ROTULO_DO_ATOR: Record<LinhaAuditoria["atorTipo"], string> = {
  usuario: "Usuário",
  plataforma: "Plataforma",
  sistema: "Sistema",
  integracao: "Integração",
};

export const ROTULO_DA_ORIGEM: Record<OrigemIntegracao, string> = {
  sftp_xml: "SFTP · XML de CT-e",
  relatorio_ssw: "SFTP · Relatórios SSW",
  aplicacao_ssw: "Aplicação dos relatórios",
  bi2: "BI2 do SSW",
};

function valorCurto(valor: unknown): string {
  if (valor === null || valor === undefined) return "vazio";
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  return texto.length > 60 ? `${texto.slice(0, 57)}…` : texto;
}

/** O que mudou, em uma linha: o resumo; ou `campo: antes → depois; …`; ou criado/excluído. */
export function descreverMudanca(
  linha: Pick<LinhaAuditoria, "resumo" | "acao" | "antes" | "depois">,
): string {
  if (linha.resumo) return linha.resumo;
  if (linha.acao === "alterar" && linha.depois) {
    return Object.keys(linha.depois)
      .map((k) => `${k}: ${valorCurto(linha.antes?.[k])} → ${valorCurto(linha.depois?.[k])}`)
      .join("; ");
  }
  if (linha.acao === "criar") return "Registro criado";
  if (linha.acao === "excluir") return "Registro excluído";
  return "";
}
