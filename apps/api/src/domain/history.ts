import { ehAdminDaEmpresa } from "@erp/shared/access/roles";
import { montarDataIso } from "@erp/shared/dates";

import { ErroDeNegocio } from "./errors";

/**
 * Anotação só é alterada ou excluída pelo autor ou por um administrador da empresa (Q09 do dono:
 * hoje a tela diz "sucesso" sem fazer nada).
 */
export function garantirQuePodeAlterarAnotacao(
  autorId: string | null,
  usuarioId: string,
  papel: string | null,
): void {
  if (autorId !== usuarioId && !ehAdminDaEmpresa(papel)) {
    throw new ErroDeNegocio(
      "SEM_PERMISSAO",
      "Só o autor ou um administrador pode alterar esta anotação.",
    );
  }
}

/** Dias distintos com alguma anotação ou feriado. */
export function diasComContexto(
  anotacoes: readonly { data: string }[],
  feriados: readonly { data: string }[],
): number {
  return new Set([...anotacoes, ...feriados].map((x) => x.data)).size;
}

const NACIONAIS_FIXOS: readonly (readonly [mes: number, dia: number, descricao: string])[] = [
  [1, 1, "Confraternização Universal"],
  [4, 21, "Tiradentes"],
  [5, 1, "Dia do Trabalho"],
  [9, 7, "Independência do Brasil"],
  [10, 12, "Nossa Senhora Aparecida"],
  [11, 2, "Finados"],
  [11, 15, "Proclamação da República"],
  [11, 20, "Consciência Negra"],
  [12, 25, "Natal"],
];

/**
 * Os 9 feriados nacionais fixos que o botão "Importar nacionais" de Histórico › Feriados grava
 * na empresa (sem os móveis: esses vêm da geração anual da Plataforma).
 * origem: importarFeriadosNacionais (src/features/historico, sistema atual)
 */
export function nacionaisFixosDoAno(ano: number): { data: string; descricao: string }[] {
  return NACIONAIS_FIXOS.map(([mes, dia, descricao]) => ({
    data: montarDataIso(ano, mes, dia),
    descricao,
  }));
}
