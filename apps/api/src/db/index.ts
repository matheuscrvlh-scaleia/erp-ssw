export {
  type Banco,
  comContexto,
  comInstantes,
  conectarBanco,
  type ConexaoBanco,
  type ConfigBanco,
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
export { compilar, Sql, sql } from "./sql";
