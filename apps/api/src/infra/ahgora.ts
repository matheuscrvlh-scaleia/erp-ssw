import { ErroDeNegocio } from "@erp/dominio/erros";
import { type Turno } from "@erp/dominio/ponto";
import { batidaAhgora, funcionarioAhgora } from "@erp/shared/contratos/ahgora";
import { z } from "@erp/shared/zod";

/**
 * Cliente da API pública do Ahgora (https://api.ahgora.com.br). Nada do ponto é gravado: cada
 * tela consulta na hora.
 * origem: ahgora-client.server.ts (sistema atual)
 */
const BASE_URL = "https://api.ahgora.com.br";
const TEMPO_LIMITE_MS = 30_000;
/** A API devolve no máximo 100 por página; a listagem completa para em 5000. */
const POR_PAGINA = "100";
const MAXIMO_FUNCIONARIOS = 5000;

export interface CredencialAhgora {
  usuario: string;
  senha: string;
}

const paginaDeFuncionarios = z.object({
  data: z.array(funcionarioAhgora),
  nextPageId: z.string().optional(),
});

const turnos = z.object({
  data: z.array(
    z.object({
      key: z.string(),
      officeHours: z.array(z.string()).optional(),
      hasNoOfficeHours: z.boolean().optional(),
      lateExitTolerance: z.string().optional(),
    }),
  ),
});

const escala = z.object({ data: z.array(z.object({ date: z.string(), shift: z.string() })) });

const batidas = z.object({
  data: z.array(batidaAhgora),
  total: z.number().int().optional(),
});

export type FuncionarioAhgora = z.infer<typeof funcionarioAhgora>;

/** Filtro de /punches/between com os nomes da API do Ahgora (por isso em inglês). */
export interface FiltroDeBatidas {
  employeeId?: string | undefined;
  employeeRegister?: string | undefined;
  employeePis?: string | undefined;
  start: string;
  end: string;
}

export interface ClienteAhgora {
  todosOsFuncionarios(): Promise<FuncionarioAhgora[]>;
  turnos(): Promise<Turno[]>;
  escala(register: string, inicio: string, fim: string): Promise<Map<string, string>>;
  batidas(
    filtro: FiltroDeBatidas,
  ): Promise<{ data: z.infer<typeof batidaAhgora>[]; total: number }>;
}

const indisponivel = (mensagem: string) => new ErroDeNegocio("INDISPONIVEL", mensagem);

export function criarClienteAhgora(
  credencial: CredencialAhgora,
  http: typeof fetch = fetch,
): ClienteAhgora {
  const autorizacao = `Basic ${Buffer.from(`${credencial.usuario}:${credencial.senha}`).toString("base64")}`;

  async function obter<T>(
    caminho: string,
    parametros: Record<string, string | undefined>,
    esquema: z.ZodType<T>,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${caminho}`);
    for (const [chave, valor] of Object.entries(parametros)) {
      if (valor !== undefined && valor !== "") url.searchParams.set(chave, valor);
    }
    let resposta: Response;
    try {
      resposta = await http(url, {
        headers: { Authorization: autorizacao, Accept: "application/json" },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch (erro) {
      if (erro instanceof Error && (erro.name === "TimeoutError" || erro.name === "AbortError")) {
        throw indisponivel("Tempo limite excedido ao consultar a API do Ahgora.");
      }
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      throw indisponivel(`Falha ao consultar a API do Ahgora: ${detalhe}`);
    }
    if (resposta.status === 401 || resposta.status === 403) {
      throw indisponivel(
        "Acesso negado pela API do Ahgora. Verifique as credenciais configuradas.",
      );
    }
    if (!resposta.ok) {
      const corpo = (await resposta.text()).slice(0, 500);
      throw indisponivel(`Erro na API do Ahgora (HTTP ${resposta.status}): ${corpo}`);
    }
    const lido = esquema.safeParse(await resposta.json());
    if (!lido.success) throw indisponivel("A API do Ahgora devolveu uma resposta inesperada.");
    return lido.data;
  }

  return {
    async todosOsFuncionarios() {
      const todos: FuncionarioAhgora[] = [];
      let nextPageId: string | undefined;
      do {
        const pagina = await obter(
          "/employees",
          { limit: POR_PAGINA, nextPageId },
          paginaDeFuncionarios,
        );
        todos.push(...pagina.data);
        nextPageId = pagina.nextPageId;
      } while (nextPageId && todos.length < MAXIMO_FUNCIONARIOS);
      return todos;
    },

    async turnos() {
      return (await obter("/shifts", { limit: POR_PAGINA }, turnos)).data;
    },

    async escala(register, inicio, fim) {
      const r = await obter(
        "/schedulesAndShifts/between",
        { register, start: inicio, end: fim },
        escala,
      );
      return new Map(r.data.map((e) => [e.date, e.shift]));
    },

    async batidas(filtro) {
      const r = await obter(
        "/punches/between",
        {
          employeeId: filtro.employeeId,
          employeeRegister: filtro.employeeRegister,
          employeePis: filtro.employeePis,
          start: filtro.start,
          end: filtro.end,
        },
        batidas,
      );
      return { data: r.data, total: r.total ?? r.data.length };
    },
  };
}

/** `fn` em cada item com no máximo `concorrencia` chamadas ao mesmo tempo (a API aceita ~1000/min). */
export async function emParalelo<T, R>(
  itens: readonly T[],
  concorrencia: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = [];
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(concorrencia, itens.length) }, async () => {
      while (proximo < itens.length) {
        const indice = proximo++;
        const item = itens[indice];
        if (item !== undefined) resultados[indice] = await fn(item);
      }
    }),
  );
  return resultados;
}
