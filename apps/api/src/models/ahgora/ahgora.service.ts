import {
  type ChavesDeSegredo,
  contextoDoSegredo,
  decifrarSegredo,
  type SegredoCifrado,
} from "@erp/db/secrets";
import { empresaEmOperacao } from "@erp/domain/companies";
import { type HoraExtraDoDia } from "@erp/domain/delivery-bonus";
import { ErroDeNegocio } from "@erp/domain/errors";
import {
  apurarDia,
  apurarFuncionario,
  batidasPorDia,
  casarFuncionarios,
  departamentosDistintos,
  type FuncionarioApurado,
  horaExtraNoDia,
  MAXIMO_FUNCIONARIOS_POR_APURACAO,
  selecionarFuncionarios,
} from "@erp/domain/timekeeping";

import {
  type ClienteAhgora,
  type CredencialAhgora,
  criarClienteAhgora,
  emParalelo,
  type FuncionarioAhgora,
} from "../../infra/ahgora";
import { conflito, naoEncontrado, semPermissao } from "../errors";
import { type Executor } from "../repositories";

/** Medido em produção: 10 chamadas simultâneas levam ~79 ms por funcionário. */
const CONCORRENCIA = 10;

export interface IntegracaoAhgora {
  empresaNome: string;
  empresaStatus: string;
  /** Nulo = a empresa não tem a integração cadastrada. */
  ativo: boolean | null;
  parametros: Record<string, unknown>;
  segredo: SegredoCifrado | null;
}

export interface RepositorioAhgora {
  integracao(empresaId: string): Promise<IntegracaoAhgora | null>;
}

export interface DependenciasAhgora {
  /** Chaves mestras dos segredos de integração; nulo = ambiente sem cofre configurado. */
  segredos: ChavesDeSegredo | null;
  /** Transição da FR: credencial no ambiente, só com `parametros.usar_env`. */
  ambiente: { usuario?: string | undefined; senha?: string | undefined };
  http: typeof fetch;
}

/** Funcionário por id, matrícula ou PIS, no período (validado: até 30 dias). */
interface PedidoDeBatidas {
  funcionarioId?: string | undefined;
  matricula?: string | undefined;
  pis?: string | undefined;
  inicio: string;
  fim: string;
}

type BatidasDoPeriodo = Awaited<ReturnType<ClienteAhgora["batidas"]>>;

interface PedidoDeApuracao {
  inicio: string;
  fim: string;
  departamento?: string | undefined;
  incluirDemitidos: boolean;
}

export interface ApuracaoDoPeriodo {
  inicio: string;
  fim: string;
  funcionarios: FuncionarioApurado[];
}

function usaAmbiente(parametros: Record<string, unknown>): boolean {
  return parametros["usar_env"] === true || parametros["usar_env"] === "true";
}

/**
 * Credencial do Ahgora da empresa: usuário em `parametros.usuario`, senha no cofre. Empresa
 * inexistente, fora de operação ou com a integração desligada não consulta.
 * origem: authHeader (ahgora-client.server.ts) + resolverEmpresaIngestao (sistema atual)
 */
function credencialDaIntegracao(
  empresaId: string,
  integracao: IntegracaoAhgora | null,
  deps: Pick<DependenciasAhgora, "segredos" | "ambiente">,
): CredencialAhgora {
  if (!integracao) throw naoEncontrado(`Empresa "${empresaId}" não encontrada.`);
  if (!empresaEmOperacao(integracao.empresaStatus)) {
    throw semPermissao(
      `Empresa ${integracao.empresaNome} está ${integracao.empresaStatus}: a ingestão não roda.`,
    );
  }
  if (integracao.ativo !== true) {
    throw conflito(`A integração ahgora da empresa ${integracao.empresaNome} está desligada.`);
  }
  const { parametros } = integracao;
  const doParametro = typeof parametros["usuario"] === "string" ? parametros["usuario"].trim() : "";
  const comAmbiente = usaAmbiente(parametros);
  const usuario = doParametro || (comAmbiente ? (deps.ambiente.usuario ?? "") : "");
  const doCofre =
    integracao.segredo && deps.segredos
      ? decifrarSegredo(deps.segredos, integracao.segredo, contextoDoSegredo(empresaId, "ahgora"))
      : "";
  const senha = doCofre || (comAmbiente ? (deps.ambiente.senha ?? "") : "");
  if (!usuario || !senha) {
    throw conflito(
      "Credenciais do Ahgora não configuradas para esta empresa. Cadastre usuário e senha em Plataforma → Empresa → Integrações.",
    );
  }
  return { usuario, senha };
}

export async function clienteDaEmpresa(
  db: Executor<"ahgora">,
  empresaId: string,
  deps: DependenciasAhgora,
): Promise<ClienteAhgora> {
  const integracao = await db(({ ahgora }) => ahgora.integracao(empresaId));
  return criarClienteAhgora(credencialDaIntegracao(empresaId, integracao, deps), deps.http);
}

export async function listarFuncionarios(cliente: ClienteAhgora): Promise<FuncionarioAhgora[]> {
  return cliente.todosOsFuncionarios();
}

export async function listarDepartamentos(cliente: ClienteAhgora): Promise<string[]> {
  return departamentosDistintos(await cliente.todosOsFuncionarios());
}

export async function listarBatidas(
  cliente: ClienteAhgora,
  entrada: PedidoDeBatidas,
): Promise<BatidasDoPeriodo> {
  // Os nomes em inglês são os do filtro da API do Ahgora (/punches/between).
  return cliente.batidas({
    employeeId: entrada.funcionarioId,
    employeeRegister: entrada.matricula,
    employeePis: entrada.pis,
    start: entrada.inicio,
    end: entrada.fim,
  });
}

/**
 * Horas por colaborador no período, uma chamada de batidas por pessoa (10 ao mesmo tempo).
 * origem: apurarPontoPeriodo (apuracao-ponto.server.ts)
 */
export async function apurarPeriodo(
  cliente: ClienteAhgora,
  entrada: PedidoDeApuracao,
): Promise<ApuracaoDoPeriodo> {
  const selecionados = selecionarFuncionarios(await cliente.todosOsFuncionarios(), entrada);
  if (selecionados.length > MAXIMO_FUNCIONARIOS_POR_APURACAO) {
    throw new ErroDeNegocio(
      "ENTRADA_INVALIDA",
      `A seleção tem ${selecionados.length} colaboradores e o limite por apuração é ${MAXIMO_FUNCIONARIOS_POR_APURACAO}. Escolha um departamento para reduzir o período de busca.`,
    );
  }
  const funcionarios: FuncionarioApurado[] = await emParalelo(
    selecionados,
    CONCORRENCIA,
    async (f) => {
      const { data } = await cliente.batidas({
        employeeRegister: f.register,
        start: entrada.inicio,
        end: entrada.fim,
      });
      return apurarFuncionario(f, data);
    },
  );
  return { inicio: entrada.inicio, fim: entrada.fim, funcionarios };
}

/**
 * Se cada pessoa do romaneio fez hora extra em cada dia (separa Turbo de Acelerado). Quem não
 * casa com o cadastro do Ahgora e o dia sem batida não geram linha (= sem registro de ponto).
 * origem: calcularHorasExtras (hora-extra.server.ts)
 */
export async function calcularHorasExtras(
  cliente: ClienteAhgora,
  periodo: { inicio: string; fim: string; nomes: string[] },
): Promise<HoraExtraDoDia[]> {
  if (periodo.nomes.length === 0) return [];
  const [funcionarios, turnos] = await Promise.all([
    cliente.todosOsFuncionarios(),
    cliente.turnos(),
  ]);
  const casados = casarFuncionarios(periodo.nomes, funcionarios);
  if (casados.size === 0) return [];
  const porTurno = new Map(turnos.map((t) => [t.key, t]));
  const porPessoa = await emParalelo([...casados], CONCORRENCIA, async ([nome, funcionario]) => {
    const [batidas, escala] = await Promise.all([
      cliente.batidas({
        employeeRegister: funcionario.register,
        start: periodo.inicio,
        end: periodo.fim,
      }),
      cliente.escala(funcionario.register, periodo.inicio, periodo.fim),
    ]);
    return batidasPorDia(batidas.data).map(([dia, lista]) => ({
      nome,
      data: dia,
      horaExtra: horaExtraNoDia(apurarDia(dia, lista), porTurno.get(escala.get(dia) ?? "")),
    }));
  });
  return porPessoa.flat();
}
