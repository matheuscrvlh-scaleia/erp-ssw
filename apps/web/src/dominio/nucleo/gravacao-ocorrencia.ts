/**
 * Regras na gravação de ocorrência (antes eram gatilhos em `ocorrencias` e `codigos_ocorrencia`)
 * e o que a ocorrência gravada muda no CT-e (embarque, emissão pela 80).
 */
import {
  CODIGO_ANCORA_EMISSAO,
  type CodigoCadastrado,
  CODIGOS_EMBARQUE,
  type ProcessoSsw,
  type Responsavel,
  type TipoSsw,
} from "./codigos";
import { foraDeQuarentena, type OcorrenciaDoCte, ORIGEM_TRACKINGDANFE } from "./ocorrencia";
import { type DataIso, diaSp, menosDias } from "./tempo";

/** Evento do trackingdanfe mais antigo que isto antes da criação do CT-e é suspeito. */
const DIAS_LIMITE_TRACKINGDANFE = 400;

// --- Catálogo de códigos ---------------------------------------------------------------------

/**
 * Responsável, letra e penaliza derivados do tipo SSW ao **cadastrar** um código (na edição o
 * admin ajusta à mão). Sem tipo, `null` = manter o recebido.
 * origem: codigos_derivar_responsavel (sistema atual)
 */
export function derivarResponsavelPeloTipo(
  tipoSsw: TipoSsw | null,
  processoSsw: ProcessoSsw | null,
): { responsavel: Responsavel; letraResponsavel: string; penaliza: boolean } | null {
  if (tipoSsw === null) return null;
  if (tipoSsw === "PENDENCIA_TRANSPORTADORA") {
    return { responsavel: "FR", letraResponsavel: "F", penaliza: true };
  }
  if (tipoSsw === "PENDENCIA_CLIENTE") {
    return processoSsw === "ENTREGA" || processoSsw === "REENTREGA"
      ? { responsavel: "destinatario", letraResponsavel: "D", penaliza: false }
      : { responsavel: "cliente", letraResponsavel: "C", penaliza: false };
  }
  return { responsavel: "sistema", letraResponsavel: "S", penaliza: false };
}

/**
 * O que a alteração de um código exige: regravar responsável/penaliza em todas as ocorrências da
 * empresa com o código, e recalcular os CT-e que têm esse código quando muda o que entra na
 * situação (tipo SSW ou descrição — Q20 do dono; hoje isso só acontecia por tabela).
 * origem: propagate_codigo_changes (sistema atual)
 */
export function efeitoDaAlteracaoDeCodigo(
  antes: CodigoCadastrado,
  depois: CodigoCadastrado,
): {
  regravarOcorrencias: { responsavel: Responsavel; penaliza: boolean } | null;
  recalcularCtes: boolean;
} {
  const mudouResponsabilidade =
    antes.responsavel !== depois.responsavel || antes.penaliza !== depois.penaliza;
  return {
    regravarOcorrencias: mudouResponsabilidade
      ? { responsavel: depois.responsavel, penaliza: depois.penaliza }
      : null,
    recalcularCtes: antes.tipoSsw !== depois.tipoSsw || antes.descricao !== depois.descricao,
  };
}

// --- Efeitos da ocorrência no CT-e -----------------------------------------------------------

/**
 * Menor dia (Brasília) das 82/85 do CT-e; `null` = sem embarque (mantém o gravado). Quarentena
 * fora (Q21 do dono).
 * origem: sync_data_embarque_from_ocorrencia (sistema atual)
 */
export function dataEmbarque(ocorrencias: readonly OcorrenciaDoCte[]): DataIso | null {
  return menorDia(foraDeQuarentena(ocorrencias).filter((o) => CODIGOS_EMBARQUE.has(o.codigo)));
}

/**
 * A 80 válida mais antiga antecipa a emissão (nunca adia). Trackingdanfe muito anterior à
 * criação do CT-e não vale.
 * origem: sync_data_emissao_from_ocorrencia_80 (sistema atual)
 */
export function emissaoAncoradaNo80(
  cte: { dataEmissao: DataIso; criadoEm: Date },
  ocorrencias: readonly OcorrenciaDoCte[],
): DataIso {
  const limite = menosDias(cte.criadoEm, DIAS_LIMITE_TRACKINGDANFE);
  const validas = foraDeQuarentena(ocorrencias).filter(
    (o) =>
      o.codigo === CODIGO_ANCORA_EMISSAO &&
      (o.origem !== ORIGEM_TRACKINGDANFE || o.dataHora >= limite),
  );
  const menor = menorDia(validas);
  return menor !== null && menor < cte.dataEmissao ? menor : cte.dataEmissao;
}

function menorDia(ocorrencias: readonly OcorrenciaDoCte[]): DataIso | null {
  let menor: DataIso | null = null;
  for (const o of ocorrencias) {
    const dia = diaSp(o.dataHora);
    if (menor === null || dia < menor) menor = dia;
  }
  return menor;
}
