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
} from "./cliente";
export { erroParaLog } from "./erros";
export { atribuicoes, camposDaLinha, valoresDeInsercao } from "./linhas";
export { Sql, sql } from "./sql";
