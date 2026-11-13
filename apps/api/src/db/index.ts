export {
  comContexto,
  comInstantes,
  conectarBanco,
  CONTEXTO_VAZIO,
  type ContextoBanco,
  ehTempoEsgotado,
  ehViolacaoDeUnicidade,
  instanteDoBanco,
  type Linha,
  type Transacao,
} from "./client";
export { erroParaLog } from "./errors";
export { atribuicoes, camposDaLinha, valoresDeInsercao } from "./rows";
export { Sql, sql } from "./sql";
