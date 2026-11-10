/**
 * Ponto (Ahgora): horas trabalhadas por dia, apuração do período e hora extra para a
 * bonificação de entrega.
 * origem: apuracao-ponto.server.ts, hora-extra.server.ts (sistema atual)
 */

export interface Batida {
  /** Com o fuso já aplicado pela API ("2026-09-01T08:06:00.000-03:00"). */
  punchTime: string;
  type: string;
}

export interface Funcionario {
  register: string;
  name: string;
  department?: string | undefined;
  /** Vem como "" para quem está ativo. */
  terminationDate?: string | undefined;
}

export interface Turno {
  key: string;
  /** Horários previstos aos pares: entrada, saída, entrada, saída. */
  officeHours?: string[] | undefined;
  hasNoOfficeHours?: boolean | undefined;
  lateExitTolerance?: string | undefined;
}

export type MotivoRevisao = "impar" | "excluida";

export interface DiaApurado {
  data: string;
  batidas: { hora: string; tipo: string }[];
  /** Nulo quando o dia não fecha com segurança. */
  minutosTrabalhados: number | null;
  motivoRevisao: MotivoRevisao | null;
}

export interface FuncionarioApurado {
  register: string;
  name: string;
  department: string;
  demitido: boolean;
  diasComRegistro: number;
  minutosApurados: number;
  diasARevisar: number;
  dias: DiaApurado[];
}

/** Acima disso a apuração passa de ~12 s e arrisca estourar o gateway. */
export const MAXIMO_FUNCIONARIOS_POR_APURACAO = 150;

export const BATIDA_EXCLUIDA = "DELETADA";

function minutosDoDia(hora: string): number {
  const [h = 0, m = 0] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** Dia e hora locais pelo texto (`new Date()` jogaria uma batida das 22h para o dia seguinte). */
const diaDaBatida = (b: Batida) => b.punchTime.slice(0, 10);
const horaDaBatida = (b: Batida) => b.punchTime.slice(11, 16);

/**
 * Horas do dia pelos pares entrada/saída. Batida excluída ou número ímpar de batidas manda o dia
 * para revisão em vez de virar um número errado; batida repetida no mesmo minuto conta uma vez.
 */
export function apurarDia(data: string, batidas: readonly Batida[]): DiaApurado {
  const ordenadas = [...batidas].sort((a, b) => a.punchTime.localeCompare(b.punchTime));
  const todas = ordenadas.map((b) => ({ hora: horaDaBatida(b), tipo: b.type }));
  if (ordenadas.some((b) => b.type === BATIDA_EXCLUIDA)) {
    return { data, batidas: todas, minutosTrabalhados: null, motivoRevisao: "excluida" };
  }
  const horas = [...new Set(ordenadas.map(horaDaBatida))];
  if (horas.length === 0 || horas.length % 2 !== 0) {
    return { data, batidas: todas, minutosTrabalhados: null, motivoRevisao: "impar" };
  }
  let minutos = 0;
  for (let i = 0; i < horas.length; i += 2) {
    minutos += minutosDoDia(horas[i + 1] ?? "00:00") - minutosDoDia(horas[i] ?? "00:00");
  }
  return { data, batidas: todas, minutosTrabalhados: minutos, motivoRevisao: null };
}

/** Batidas agrupadas pelo dia local, em ordem de data. */
export function batidasPorDia(batidas: readonly Batida[]): [string, Batida[]][] {
  const porDia = new Map<string, Batida[]>();
  for (const b of batidas) {
    const dia = diaDaBatida(b);
    const lista = porDia.get(dia);
    if (lista) lista.push(b);
    else porDia.set(dia, [b]);
  }
  return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function apurarFuncionario(
  funcionario: Funcionario,
  batidas: readonly Batida[],
): FuncionarioApurado {
  const dias = batidasPorDia(batidas).map(([data, lista]) => apurarDia(data, lista));
  return {
    register: funcionario.register,
    name: funcionario.name,
    department: funcionario.department ?? "",
    demitido: Boolean(funcionario.terminationDate),
    diasComRegistro: dias.length,
    minutosApurados: dias.reduce((acc, d) => acc + (d.minutosTrabalhados ?? 0), 0),
    diasARevisar: dias.filter((d) => d.motivoRevisao !== null).length,
    dias,
  };
}

/** Quem entra na apuração: tem matrícula, não é demitido (salvo pedido) e é do departamento. */
export function selecionarFuncionarios<F extends Funcionario>(
  todos: readonly F[],
  filtro: { departamento?: string | undefined; incluirDemitidos?: boolean | undefined },
): F[] {
  return todos.filter(
    (f) =>
      f.register &&
      (filtro.incluirDemitidos === true || !f.terminationDate) &&
      (!filtro.departamento || f.department === filtro.departamento),
  );
}

export function departamentosDistintos(funcionarios: readonly Funcionario[]): string[] {
  const nomes = new Set(funcionarios.map((f) => f.department ?? "").filter(Boolean));
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Nome para casar 036 × Ahgora: maiúsculas, sem acento, só letras e um espaço entre palavras. */
export function normalizarNome(nome: string): string {
  return nome
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Funcionário do Ahgora de cada nome do romaneio. O 036 corta o nome em 30 caracteres: sem nome
 * igual, vale o começo do nome se só um colaborador começar assim. Nome igual repetido: vale o
 * último do cadastro.
 */
export function casarFuncionarios<F extends Funcionario>(
  nomes: readonly string[],
  cadastro: readonly F[],
): Map<string, F> {
  const comMatricula = cadastro.filter((f) => f.register);
  const exato = new Map(comMatricula.map((f) => [normalizarNome(f.name), f]));
  const casados = new Map<string, F>();
  for (const nome of new Set(nomes.map(normalizarNome))) {
    if (!nome) continue;
    const direto = exato.get(nome);
    if (direto) {
      casados.set(nome, direto);
      continue;
    }
    const candidatos = comMatricula.filter((f) => normalizarNome(f.name).startsWith(nome));
    const [unico] = candidatos;
    if (candidatos.length === 1 && unico) casados.set(nome, unico);
  }
  return casados;
}

/** Jornada prevista do turno: soma dos pares de `officeHours`; inválida ou sem jornada = nulo. */
export function jornadaPrevistaMinutos(turno: Turno | undefined): number | null {
  if (!turno || turno.hasNoOfficeHours) return null;
  const horas = (turno.officeHours ?? []).filter((h) => /^\d{2}:\d{2}$/.test(h));
  if (horas.length === 0 || horas.length % 2 !== 0) return null;
  let total = 0;
  for (let i = 0; i < horas.length; i += 2) {
    total += minutosDoDia(horas[i + 1] ?? "00:00") - minutosDoDia(horas[i] ?? "00:00");
  }
  return total > 0 ? total : null;
}

/**
 * Fez hora extra no dia? Dia que não fecha = nulo (sem registro). Folga ou turno sem jornada:
 * qualquer trabalho é extra. Senão, passou da jornada + tolerância de saída.
 */
export function horaExtraNoDia(dia: DiaApurado, turno: Turno | undefined): boolean | null {
  if (dia.minutosTrabalhados === null) return null;
  const prevista = jornadaPrevistaMinutos(turno);
  if (prevista === null) return dia.minutosTrabalhados > 0;
  const tolerancia = turno?.lateExitTolerance ? minutosDoDia(turno.lateExitTolerance) : 0;
  return dia.minutosTrabalhados > prevista + tolerancia;
}
