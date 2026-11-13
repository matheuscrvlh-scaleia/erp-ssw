import { type EntradaDe } from "@erp/shared/contract";
import {
  type contratosAhgora as c,
  type funcionarioAhgora,
  type FuncionarioApurado,
} from "@erp/shared/contracts/ahgora";
import { diferencaEmDias, ehDataIso } from "@erp/shared/dates";
import { type z } from "@erp/shared/zod";

import { periodoDoMes } from "@/lib/month-period";

/** Valor do seletor de departamento que quer dizer "todos" (não vai para a API). */
export const TODOS = "__todos__";

/** Filtros da apuração a partir do mês (`AAAA-MM`), do departamento escolhido e do interruptor. */
export function entradaDaApuracao(
  mes: string,
  departamento: string,
  incluirDemitidos: boolean,
): EntradaDe<typeof c.apuracao> {
  const { inicio, fim } = periodoDoMes(mes);
  return {
    inicio,
    fim,
    departamento: departamento === TODOS ? undefined : departamento,
    incluirDemitidos: incluirDemitidos ? "true" : "false",
  };
}

/** Somas dos cards: horas apuradas (minutos), dias a revisar e dias com registro. */
export function totaisDaApuracao(funcionarios: FuncionarioApurado[]) {
  return {
    minutos: funcionarios.reduce((acc, f) => acc + f.minutosApurados, 0),
    revisar: funcionarios.reduce((acc, f) => acc + f.diasARevisar, 0),
    diasComRegistro: funcionarios.reduce((a, f) => a + f.diasComRegistro, 0),
  };
}

/** A API aceita no máximo 30 dias, com a data final igual ou depois da inicial. */
export function periodoDeBatidasValido(inicio: string, fim: string): boolean {
  return ehDataIso(inicio) && ehDataIso(fim) && fim >= inicio && diferencaEmDias(inicio, fim) <= 30;
}

/** Busca por nome, matrícula (sem caixa) ou CPF. */
export function filtrarFuncionarios(
  funcionarios: z.infer<typeof funcionarioAhgora>[],
  busca: string,
): z.infer<typeof funcionarioAhgora>[] {
  const termo = busca.trim().toLowerCase();
  if (!termo) return funcionarios;
  return funcionarios.filter(
    (f) =>
      f.name.toLowerCase().includes(termo) ||
      f.register.toLowerCase().includes(termo) ||
      (f.cpf?.includes(termo) ?? false),
  );
}
