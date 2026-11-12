import { comInstantes, type Sql, sql, type Transacao } from "@erp/db";
import { type CteEntregue } from "@erp/dominio/comprovantes/comprovantes";
import { CODIGOS_ENTREGA } from "@erp/dominio/nucleo";

import {
  casaAlgumPadrao,
  filiaisProprias,
  inteiros,
  nfIgual,
  textos,
  tipoDocumentoDoFiltro,
} from "../cte/sql-cte";
import {
  type ComprovanteDaLista,
  type FiltroDeEntregues,
  type PedidoDaLista,
  type RepositorioComprovantes,
} from "./comprovantes.service";

/** Ocorrência que marca o comprovante de entrega digitalizado. */
const CODIGO_COMPROVANTE_DIGITALIZADO = 88;

/** Tem a 88 fora da quarentena (Q21 do dono: a 88 em quarentena não conta). */
const tem88 = sql`exists (
  select 1 from erp.ocorrencias
  where ocorrencias.cte_id = ctes.id and ocorrencias.codigo = ${CODIGO_COMPROVANTE_DIGITALIZADO}
    and not ocorrencias.quarentena)`;

const dataEntrega = sql`coalesce(ctes.data_entrega_realizada, ctes.ocorr_efetiva_data)`;

const digitalizado = sql`(ctes.comprovante_escaneado is true or ${tem88})`;

/**
 * Mesma regra de `classificarComprovantes` e `listarComprovantes` (dominio/comprovantes), em SQL
 * para a lista paginar no banco: digitalizado = 88 ou "escaneado" no 455; pendente = não
 * digitalizado num dia coberto (930 importado) ou com a coluna do 455.
 */
function ondeDaLista(f: FiltroDeEntregues, p: PedidoDaLista): Sql {
  const coberto = sql`(ctes.data_conclusao_efetiva = any(${textos(p.diasCobertos)}::date[]) or ctes.comprovante_escaneado is not null)`;
  return sql.e(
    ondeEntregues(f),
    p.tipos.length > 0 ? sql`${tipoDocumentoDoFiltro()} = any(${textos(p.tipos)})` : undefined,
    p.status === "digitalizados" ? digitalizado : undefined,
    p.status === "pendentes" ? sql`not ${digitalizado} and ${coberto}` : undefined,
  );
}

function buscaDeCtrc(termo: string): Sql {
  return termo === "" ? sql`false` : sql`ctes.numero = ${termo}`;
}

function buscaDeNf(termo: string): Sql {
  return termo === "" ? sql`(ctes.numero_nf is null or ctes.numero_nf = 0)` : nfIgual(termo);
}

/**
 * Entregue = entrega gravada ou ocorrência efetiva de entrega. O período é o dia da entrega em
 * São Paulo (Q11 do dono), que para o CT-e entregue é a `data_conclusao_efetiva` gravada.
 */
function ondeEntregues(f: FiltroDeEntregues): Sql {
  return sql.e(
    sql`ctes.empresa_id = ${f.empresaId}`,
    sql`not ctes.fora_universo`,
    sql`ctes.filial_efetiva in (${filiaisProprias(f.empresaId)})`,
    sql`(ctes.data_entrega_realizada is not null
      or ctes.ocorr_efetiva_codigo_num = any(${inteiros([...CODIGOS_ENTREGA])}))`,
    sql`(ctes.data_entrega_realizada is not null or ctes.ocorr_efetiva_data is not null)`,
    sql`ctes.data_conclusao_efetiva between ${f.inicio} and ${f.fim}`,
    f.unidades.length > 0 ? sql`ctes.filial_efetiva = any(${textos(f.unidades)})` : undefined,
    f.filiais.length > 0 ? sql`ctes.filial_efetiva = any(${textos(f.filiais)})` : undefined,
    f.pagadores.length > 0
      ? sql`ctes.pagador_cnpj_digitos = any(${textos(f.pagadores)})`
      : undefined,
    f.remetente ? casaAlgumPadrao(sql`ctes.remetente`, f.remetente) : undefined,
    f.destino ? casaAlgumPadrao(sql`ctes.cidade_destino`, f.destino) : undefined,
    f.ctrc !== null ? buscaDeCtrc(f.ctrc) : undefined,
    f.nf !== null ? buscaDeNf(f.nf) : undefined,
  );
}

export function criarRepositorioComprovantes(tx: Transacao): RepositorioComprovantes {
  return {
    entregues: async (filtro, limite) => {
      const linhas = comInstantes<Omit<CteEntregue, "dia"> & { dia: string | null }>(
        await tx.consultar(sql`
          select ctes.id, ctes.filial_efetiva as unidade, ctes.data_conclusao_efetiva as dia,
                 ${dataEntrega} as "dataEntrega", ctes.criado_em as "criadoEm",
                 ctes.tipo_documento_455 as "tipoDocumento455",
                 ctes.tipo_documento as "tipoDocumento",
                 ctes.comprovante_escaneado as "comprovanteEscaneado", ${tem88} as tem88
          from erp.ctes
          where ${ondeEntregues(filtro)}
          limit ${limite}`),
        ["dataEntrega", "criadoEm"],
      );
      return linhas.flatMap((l) => (l.dia === null ? [] : [{ ...l, dia: l.dia }]));
    },

    arquivos930Importados: async (empresaId) => {
      const linhas = await tx.consultar<{ nome: string }>(sql`
        select nome_arquivo as nome from erp.ingestao_arquivos
        where empresa_id = ${empresaId} and status = 'importado'
          and nome_arquivo like '930\\_ocorrencias\\_%'`);
      return linhas.map((l) => l.nome);
    },

    lista: async (filtro, pedido, pagina) => {
      const onde = ondeDaLista(filtro, pedido);
      const linhas = comInstantes<ComprovanteDaLista & { total: number }>(
        await tx.consultar(sql`
          select ctes.id, ctes.numero, ctes.sigla, ctes.numero_nf as "numeroNf",
                 ctes.data_emissao as "dataEmissao", ${dataEntrega} as "dataEntrega",
                 ctes.filial_efetiva as unidade, ctes.setor, ctes.pagador_nome as "pagadorNome",
                 ctes.remetente, ctes.destinatario, ctes.cidade_destino as "cidadeDestino",
                 ${tipoDocumentoDoFiltro()} as "tipoEfetivo", ${digitalizado} as digitalizado,
                 (count(*) over ())::int as total
          from erp.ctes
          where ${onde}
          -- Entrega mais recente primeiro; empate pelo CT-e gravado por último (Q07) e pelo id.
          order by ${dataEntrega} desc, ctes.criado_em desc, ctes.id desc
          limit ${pagina.limite}
          offset ${pagina.deslocamento}`),
        ["dataEntrega"],
      );
      const primeira = linhas[0];
      // Página depois da última: o total vem de uma contagem à parte (Q10).
      const contarAParte = async () => {
        const [linha] = await tx.consultar<{ n: number }>(sql`
          select count(*)::int as n from erp.ctes where ${onde}`);
        return linha?.n ?? 0;
      };
      const total = primeira?.total ?? (pagina.deslocamento === 0 ? 0 : await contarAParte());
      return { total, linhas: linhas.map(({ total: _total, ...l }) => l) };
    },
  };
}
