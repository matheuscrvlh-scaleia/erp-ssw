/**
 * Leitura do Prazo do parceiro: consultas set-based parametrizadas sob o RLS da empresa.
 */
import { comInstantes, type Sql, sql, type Transacao } from "@erp/db";
import { ErroDeNegocio } from "@erp/domain/errors";
import { type FiltroDaLista } from "@erp/shared/contracts/partner-deadline";
import { MENSAGEM_TEMPO_ESGOTADO } from "@erp/shared/errors";

import { lista, tipoDocumentoDoFiltro } from "../cte/sql-cte";
import {
  type CadastroDeParceiro,
  type ConsultaPrazo,
  type FatoDoPrazo,
  type RepositorioPrazoParceiro,
} from "./partner-deadline.service";

/** Teto de CT-e numa consulta: acima disso, pedir para filtrar mais (nunca cortar calado). */
const LIMITE_DE_CTES = 200_000;

/** Dígitos do CNPJ do expedidor no CT-e. */
const cnpjDoCte = sql`nullif(regexp_replace(coalesce(ctes.parceiro_cnpj, ''), '\\D', '', 'g'), '')`;

/** Tipo efetivo do documento (455 vence o BI2), maiúsculo; sem tipo = `__SEM_TIPO__`. */
const tipoEfetivo = tipoDocumentoDoFiltro();

/** Universo do Prazo do parceiro (§2: coalesce simples, diferente do Romaneio) + filtros. */
function condicoes(c: ConsultaPrazo): Sql {
  const conds: (Sql | undefined)[] = [
    sql`not ctes.fora_universo`,
    sql`coalesce(ctes.unidade_destino, ctes.unidade_atual, ctes.filial) = any(${lista(c.filiaisProprias)}::text[])`,
    sql`ctes.data_emissao between ${c.periodo.inicio} and ${c.periodo.fim}`,
    c.unidades ? sql`ctes.unidade_id = any(${lista(c.unidades)}::uuid[])` : undefined,
    c.parceiros ? sql`ctes.parceiro_id = any(${lista(c.parceiros)}::uuid[])` : undefined,
    c.tipos ? sql`${tipoEfetivo} = any(${lista(c.tipos)}::text[])` : undefined,
    c.doParceiro
      ? sql`(ctes.parceiro_id = any(${lista(c.doParceiro.ids)}::uuid[])
          ${c.doParceiro.cnpj ? sql`or ${cnpjDoCte} = ${c.doParceiro.cnpj}` : sql.vazio()})`
      : undefined,
  ];
  return sql.juntar(
    conds.filter((x) => x !== undefined),
    sql` and `,
  );
}

function filtroDaLista(filtro: FiltroDaLista): Sql {
  switch (filtro) {
    case "nascidos":
      return sql`and ctes.data_prevista_entrega < ctes.prazo_padrao_data`;
    case "prazo_parceiro":
      return sql`and ctes.prazo_origem = 'parceiro'`;
    case "todos":
      return sql.vazio();
  }
}

const SELECT_FATO = sql`
  select ctes.id, ctes.sigla, ctes.numero, ctes.data_emissao as "dataEmissao",
         ctes.data_embarque as "dataEmbarque", ctes.data_prevista_entrega as "dataPrevista",
         ctes.prazo_padrao_data as "prazoPadraoData", ctes.prazo_origem as "prazoOrigem",
         ctes.parceiro_id as "parceiroId", ${cnpjDoCte} as "parceiroCnpj",
         coalesce(p.nome, ctes.parceiro_nome) as "parceiroNome",
         exists (select 1 from erp.ocorrencias o where o.cte_id = ctes.id and o.penaliza)
           as penalizado,
         ctes.status_atual as "statusAtual", coalesce(ctes.setor, r.setor) as setor,
         coalesce(ctes.filial, u.nome) as "unidadeNome", ctes.cidade_destino as "cidadeDestino",
         ctes.uf_destino as "ufDestino"
  from erp.ctes
  left join erp.parceiros p on p.id = ctes.parceiro_id
  left join erp.unidades u on u.id = ctes.unidade_id
  left join erp.cte_dados_relatorios r
    on r.empresa_id = ctes.empresa_id and r.sigla = ctes.sigla and r.numero = ctes.numero`;

export function criarRepositorioPrazoParceiro(
  tx: Transacao,
  /** Leitor já preso à empresa do contexto. */
  configuracoesVigentes: (chaves: readonly string[]) => Promise<Map<string, string>>,
): RepositorioPrazoParceiro {
  return {
    filiaisProprias: async () =>
      (await tx.consultar<{ sigla: string }>(sql`select sigla from erp.filiais where propria`)).map(
        (f) => f.sigla,
      ),

    configuracoes: (chaves) => configuracoesVigentes(chaves),

    parceiros: async () =>
      comInstantes<CadastroDeParceiro>(
        await tx.consultar(sql`
          select id, nome, cnpj, usa_ssw as "usaSsw", criado_em as "criadoEm",
                 prazo_acordo_horas as "prazoAcordoHoras", ativo
          from erp.parceiros`),
        ["criadoEm"],
      ),

    unidadesAtivas: () =>
      tx.consultar(sql`select id, nome from erp.unidades where ativo order by nome`),

    tiposDeDocumento: async (c) => {
      const linhas = await tx.consultar<{ tipo: string }>(sql`
        select distinct ${tipoEfetivo} as tipo from erp.ctes where ${condicoes(c)} order by 1`);
      return linhas.map((l) => l.tipo);
    },

    fatos: async (c) => {
      const linhas = await tx.consultar<FatoDoPrazo>(sql`
        ${SELECT_FATO} where ${condicoes(c)} limit ${LIMITE_DE_CTES + 1}`);
      if (linhas.length > LIMITE_DE_CTES)
        throw new ErroDeNegocio("TEMPO_ESGOTADO", MENSAGEM_TEMPO_ESGOTADO);
      return linhas;
    },

    lista: (c, filtro, pagina) =>
      tx.consultar<FatoDoPrazo>(sql`
        ${SELECT_FATO}
        where ${condicoes(c)} ${filtroDaLista(filtro)}
        order by ctes.data_embarque desc nulls last, ctes.id desc
        offset ${pagina.inicio}
        limit ${pagina.quantos}`),

    contarLista: async (c, filtro) => {
      const [linha] = await tx.consultar<{ total: number }>(sql`
        select count(*)::int as total from erp.ctes
        where ${condicoes(c)} ${filtroDaLista(filtro)}`);
      return linha?.total ?? 0;
    },
  };
}
