import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { comContexto, conectarBanco } from "@erp/db";
import { criarRepositorioProjecoesRomaneio } from "@erp/ingestao/infra";
import { pino } from "pino";

import { carregarAmbiente } from "./cli/ambiente";
import { AJUDA, ErroDeUso, lerArgumentos } from "./cli/argumentos";
import { chavesParaExecucao } from "./cli/chaves";
import { descreverConexao, verificarAlvos } from "./cli/seguranca";
import { armazemEmArquivo } from "./motor/estado";
import { executarMigracao } from "./motor/executar";
import { criarPool, destinoPostgres, origemPostgres } from "./motor/postgres";
import { relatorioEmMarkdown } from "./motor/relatorio";
import { passosFinais } from "./passos/finais";
import { criarPassos, FORA_DO_ESCOPO } from "./tabelas/registro";

const SUCESSO = 0;
const FALHA_NA_MIGRACAO = 1;
const ERRO_DE_USO = 2;
/** Teto de cada consulta das projeções no destino (lote de 500 CT-e). */
const TETO_DAS_PROJECOES_MS = 10 * 60_000;

const log = pino({
  base: { servico: "erp-migrador" },
  // Nada de conexão, senha, token ou hash no log, nem por engano.
  redact: {
    paths: ["*.senha", "*.token", "*.segredo", "*.url", "*.hash", "*.senhaHash"],
    censor: "[oculto]",
  },
});

async function principal(): Promise<number> {
  const argumentos = lerArgumentos(process.argv.slice(2));
  if (argumentos.ajuda) {
    process.stdout.write(`${AJUDA}\n`);
    return SUCESSO;
  }
  const ambiente = carregarAmbiente(process.env);
  log.level = ambiente.LOG_NIVEL;
  verificarAlvos(
    [ambiente.MIGRADOR_ORIGEM_URL, ambiente.MIGRADOR_DESTINO_URL],
    argumentos.confirmarProducao,
  );
  const chaves = chavesParaExecucao(ambiente, argumentos.simulacao);

  const poolOrigem = criarPool(ambiente.MIGRADOR_ORIGEM_URL, "erp-migrador-origem");
  const poolDestino = criarPool(ambiente.MIGRADOR_DESTINO_URL, "erp-migrador-destino");
  // Drizzle no destino só para as projeções do Romaneio (mesmo repositório do worker).
  const projecoes = conectarBanco({
    url: ambiente.MIGRADOR_DESTINO_URL,
    maxConexoes: 2,
    timeoutConsultaMs: TETO_DAS_PROJECOES_MS,
    nomeAplicacao: "erp-migrador-projecoes",
  });
  try {
    const infra = { origem: origemPostgres(poolOrigem), destino: destinoPostgres(poolDestino) };
    log.info(
      {
        origem: descreverConexao(ambiente.MIGRADOR_ORIGEM_URL),
        destino: descreverConexao(ambiente.MIGRADOR_DESTINO_URL),
        simulacao: argumentos.simulacao,
        empresa: argumentos.empresaId,
      },
      "início",
    );
    const [catalogo] = await infra.destino.consultar<{ telas: number }>(
      "select count(*)::int as telas from erp.telas",
      {},
    );
    if (!catalogo || catalogo.telas === 0) {
      throw new ErroDeUso(
        "Schema erp sem catálogo: rode `bun run db:migrar` e o seed (`semear`) antes.",
      );
    }

    const relatorio = await executarMigracao(
      criarPassos(chaves),
      passosFinais(
        (empresaId) => (fn) =>
          comContexto(projecoes.banco, { empresaId, usuarioId: null, plataforma: false }, (tx) =>
            fn(criarRepositorioProjecoesRomaneio(tx, empresaId)),
          ),
      ),
      infra,
      armazemEmArquivo(join(argumentos.saida, "checkpoint.json")),
      argumentos,
      log,
      async () => {
        const [linha] = await infra.origem.consultar<{ agora: string }>(
          "select now()::text as agora",
          {},
        );
        if (!linha) throw new Error("Sem resposta do banco de origem.");
        return linha.agora;
      },
    );

    await mkdir(argumentos.saida, { recursive: true });
    const carimbo = relatorio.iniciadoEm.replaceAll(":", "-");
    const base = join(argumentos.saida, `relatorio-${carimbo}`);
    await writeFile(`${base}.md`, relatorioEmMarkdown(relatorio, FORA_DO_ESCOPO), "utf8");
    await writeFile(`${base}.json`, JSON.stringify(relatorio, null, 2), "utf8");
    log.info({ sucesso: relatorio.sucesso, relatorio: `${base}.md` }, "fim");
    return relatorio.sucesso ? SUCESSO : FALHA_NA_MIGRACAO;
  } finally {
    await Promise.all([poolOrigem.end(), poolDestino.end(), projecoes.encerrar()]);
  }
}

principal()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((erro: unknown) => {
    if (erro instanceof ErroDeUso) {
      process.stderr.write(`${erro.message}\n`);
      process.exitCode = ERRO_DE_USO;
      return;
    }
    // Mensagem do erro só (a pilha do driver pode citar parâmetros); sem a conexão.
    log.error({ erro: erro instanceof Error ? erro.message : "erro desconhecido" }, "falhou");
    process.exitCode = FALHA_NA_MIGRACAO;
  });
