import { parseArgs } from "node:util";

export class ErroDeUso extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeUso";
  }
}

export interface Argumentos {
  simulacao: boolean;
  tabelas: string[] | null;
  empresaId: string | null;
  tamanhoDoLote: number;
  recomecar: boolean;
  confirmarProducao: boolean;
  saida: string;
  ajuda: boolean;
}

export const AJUDA = `Uso: bun run --cwd apps/migrador migrar [opções]

Copia os dados do schema public (sistema atual) para o schema erp (sistema novo).

  --dry-run               lê e transforma tudo, não grava nada (relatório do que aconteceria)
  --tabelas a,b           só estes passos (nome da tabela de destino, ex.: ctes,ocorrencias)
  --empresa <uuid>        só os dados desta empresa
  --lote <n>              linhas por lote/transação (padrão 1000)
  --recomecar             ignora o checkpoint e começa do zero (o upsert regrava igual)
  --saida <pasta>         checkpoint e relatórios (padrão .migrador)
  --confirmar-producao    necessário se a conexão apontar para o projeto de produção
  --ajuda                 esta mensagem

Conexões por variável de ambiente: MIGRADOR_ORIGEM_URL e MIGRADOR_DESTINO_URL.`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerArgumentos(argv: readonly string[]): Argumentos {
  let valores;
  try {
    ({ values: valores } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        "dry-run": { type: "boolean", default: false },
        tabelas: { type: "string" },
        empresa: { type: "string" },
        lote: { type: "string" },
        recomecar: { type: "boolean", default: false },
        saida: { type: "string", default: ".migrador" },
        "confirmar-producao": { type: "boolean", default: false },
        ajuda: { type: "boolean", default: false },
      },
    }));
  } catch (erro) {
    throw new ErroDeUso(erro instanceof Error ? erro.message : "Argumentos inválidos.");
  }

  const tabelas =
    valores.tabelas === undefined
      ? null
      : valores.tabelas
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== "");
  if (tabelas?.length === 0) throw new ErroDeUso("--tabelas vazio.");

  const empresaId = valores.empresa ?? null;
  if (empresaId !== null && !UUID.test(empresaId)) {
    throw new ErroDeUso("--empresa precisa ser um uuid.");
  }

  const tamanhoDoLote = valores.lote === undefined ? 1000 : Number(valores.lote);
  if (!Number.isInteger(tamanhoDoLote) || tamanhoDoLote < 1 || tamanhoDoLote > 50_000) {
    throw new ErroDeUso("--lote precisa ser um inteiro entre 1 e 50000.");
  }

  return {
    simulacao: valores["dry-run"],
    tabelas,
    empresaId: empresaId?.toLowerCase() ?? null,
    tamanhoDoLote,
    recomecar: valores.recomecar,
    confirmarProducao: valores["confirmar-producao"],
    saida: valores.saida,
    ajuda: valores.ajuda,
  };
}
