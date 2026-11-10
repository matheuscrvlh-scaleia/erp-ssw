import {
  type AcaoEmLote,
  type AlteracaoDoCodigo,
  type EstatisticasDoCatalogo,
  type LetraDeResponsavel,
} from "@erp/shared/contratos/codigos-ocorrencia";
import { type Responsavel } from "@erp/shared/contratos/ocorrencias";

import { efeitoDaAlteracaoDeCodigo } from "../nucleo";

/** origem: updateCodigoOcorrencia (src/features/admin/codigos, sistema atual) */
export const RESPONSAVEL_DA_LETRA: Record<LetraDeResponsavel, Responsavel> = {
  F: "FR",
  C: "cliente",
  D: "destinatario",
  T: "transportador",
  S: "sistema",
  O: "outro",
};

/**
 * Campos do código que entram na auditoria, com o nome da coluna (o histórico migrado do sistema
 * atual usa esses nomes). Carimbos de alteração ficam de fora.
 */
export const CAMPOS_AUDITADOS = [
  "descricao",
  "responsavel",
  "penaliza",
  "letra_responsavel",
  "ativo",
  "pendente_classificacao",
  "notas",
] as const;
export type CampoAuditado = (typeof CAMPOS_AUDITADOS)[number];
export type RegistroAuditavel = Record<CampoAuditado, string | boolean | null>;

export interface ClassificacaoDoCodigo {
  descricao: string;
  responsavel: Responsavel;
  penaliza: boolean;
  letraResponsavel: string | null;
  ativo: boolean;
  pendenteClassificacao: boolean;
  notas: string | null;
}

export function registroAuditavel(c: ClassificacaoDoCodigo): RegistroAuditavel {
  return {
    descricao: c.descricao,
    responsavel: c.responsavel,
    penaliza: c.penaliza,
    letra_responsavel: c.letraResponsavel,
    ativo: c.ativo,
    pendente_classificacao: c.pendenteClassificacao,
    notas: c.notas,
  };
}

/** Só os campos que mudaram, antes e depois; nulo se nada mudou (não gera auditoria). */
export function diferencas(
  antes: RegistroAuditavel,
  depois: RegistroAuditavel,
): { antes: Partial<RegistroAuditavel>; depois: Partial<RegistroAuditavel> } | null {
  const mudaram = CAMPOS_AUDITADOS.filter((campo) => antes[campo] !== depois[campo]);
  if (mudaram.length === 0) return null;
  return {
    antes: Object.fromEntries(mudaram.map((c) => [c, antes[c]])),
    depois: Object.fromEntries(mudaram.map((c) => [c, depois[c]])),
  };
}

/**
 * O que a alteração feita no Admin exige (regra do núcleo): regravar responsável/penaliza nas
 * ocorrências do código e/ou recalcular os CT-e com o código. O Admin não muda tipo nem processo
 * do SSW, então eles entram iguais dos dois lados.
 */
export function efeitoDaAlteracao(
  codigo: number,
  antes: Pick<ClassificacaoDoCodigo, "descricao" | "responsavel" | "penaliza">,
  depois: Pick<ClassificacaoDoCodigo, "descricao" | "responsavel" | "penaliza">,
): ReturnType<typeof efeitoDaAlteracaoDeCodigo> {
  const comoCadastro = (c: typeof antes) => ({
    codigo,
    descricao: c.descricao,
    responsavel: c.responsavel,
    penaliza: c.penaliza,
    tipoSsw: null,
    processoSsw: null,
  });
  return efeitoDaAlteracaoDeCodigo(comoCadastro(antes), comoCadastro(depois));
}

/** origem: bulkUpdateCodigos (src/features/admin/codigos, sistema atual) */
export function alteracaoDoLote(acao: AcaoEmLote): { ativo?: boolean; penaliza?: boolean } {
  switch (acao) {
    case "ativar":
      return { ativo: true };
    case "desativar":
      return { ativo: false };
    case "penaliza_true":
      return { penaliza: true };
    case "penaliza_false":
      return { penaliza: false };
  }
}

/**
 * Cards do topo do Admin › Códigos. Pendentes inclui os inativos (tudo o que não é
 * "classificado e ativo").
 * origem: get_codigos_admin_stats (sistema atual)
 */
export function estatisticasDoCatalogo(
  catalogo: readonly (Pick<ClassificacaoDoCodigo, "ativo" | "pendenteClassificacao"> & {
    codigo: number;
  })[],
  ocorrencias30dPorCodigo: ReadonlyMap<number, number>,
): EstatisticasDoCatalogo {
  const classificados = catalogo.filter((c) => !c.pendenteClassificacao && c.ativo).length;
  const ocorrencias30d = [...ocorrencias30dPorCodigo.values()].reduce((a, b) => a + b, 0);
  const ocorrenciasEmPendentes = catalogo
    .filter((c) => c.pendenteClassificacao)
    .reduce((soma, c) => soma + (ocorrencias30dPorCodigo.get(c.codigo) ?? 0), 0);
  return {
    total: catalogo.length,
    classificados,
    pendentes: catalogo.length - classificados,
    ocorrenciasEmPendentes,
    precisao: ocorrencias30d > 0 ? 1 - ocorrenciasEmPendentes / ocorrencias30d : 1,
  };
}

export interface RegistroDeAuditoria {
  id: string;
  criadoEm: Date;
  acao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  autorNome: string | null;
}

const comoTexto = (valor: unknown): string | null =>
  valor === undefined || valor === null
    ? null
    : typeof valor === "string"
      ? valor
      : JSON.stringify(valor);

/**
 * Aba Histórico do código: criar e excluir viram uma linha; alterar vira uma linha por campo
 * (ativo → "desativou"/"reativou"; pendente_classificacao para falso → "classificou").
 * origem: getCodigoHistory (src/features/admin/codigos, sistema atual)
 */
export function historicoDoCodigo(registros: readonly RegistroDeAuditoria[]): AlteracaoDoCodigo[] {
  return registros.flatMap((r): AlteracaoDoCodigo[] => {
    const base = { criadoEm: r.criadoEm.toISOString(), autorNome: r.autorNome };
    if (r.acao === "criar") {
      return [
        {
          ...base,
          id: r.id,
          acao: "criou",
          campo: null,
          valorAntigo: null,
          valorNovo: comoTexto(r.depois),
        },
      ];
    }
    if (r.acao === "excluir") {
      return [
        {
          ...base,
          id: r.id,
          acao: "excluiu",
          campo: null,
          valorAntigo: comoTexto(r.antes),
          valorNovo: null,
        },
      ];
    }
    const depois = r.depois ?? {};
    return CAMPOS_AUDITADOS.filter((campo) => campo in depois).map((campo) => {
      const novo = depois[campo];
      const acao =
        campo === "ativo"
          ? novo
            ? "reativou"
            : "desativou"
          : campo === "pendente_classificacao" && novo === false
            ? "classificou"
            : "editou";
      return {
        ...base,
        id: `${r.id}-${campo}`,
        acao,
        campo,
        valorAntigo: comoTexto(r.antes?.[campo]),
        valorNovo: comoTexto(novo),
      };
    });
  });
}
