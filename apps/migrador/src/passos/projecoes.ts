/**
 * Projeções do Romaneio (viagens, saídas, romaneio atual, dados 038/455 e conferente da tela
 * Ocorrências): o migrador não copia matview; reconstrói com o caso de uso do worker
 * (`reconstruirProjecoesDoRomaneio`) e grava com o repositório do worker. As linhas vêm de TODA a
 * staging do `public` — não só dos 60 dias levados para `ingestao_linhas` —, porque a projeção é o
 * estado acumulado (as matviews de hoje leem a staging inteira). Depois compara as contagens com
 * as matviews.
 */
import { type Linha036 } from "@erp/dominio/romaneio/hoje";
import { linha036De, linha038De, linha306De } from "@erp/dominio/romaneio/linhas-de-relatorio";
import {
  type ChaveCte,
  chaveDoCte,
  type ExecutarLote,
  type Linha038,
  type Linha306,
  type Linha455,
  type LinhasDoCte,
  reconstruirProjecoesDoRomaneio,
  type RepositorioProjecoesRomaneio,
} from "@erp/dominio/romaneio/projecoes";

import { type PassoFinal } from "../motor/executar";
import { type Consulta } from "../motor/tipos";
import { lerJson } from "../transformacoes/json";

const TAMANHO_DO_LOTE = 500;

/** Colunas de controle da staging que não fazem parte do dado da linha. */
const CONTROLE =
  "array['id', 'lote_id', 'importado_em', 'arquivo_origem', 'linha_bruta', 'dado_hash', 'empresa_id', 'criado_em', 'numero_ctrc_norm']";

/**
 * Lote de CT-e no destino, na transação da empresa: as projeções já gravadas (`gravadas`) e a
 * gravação (`gravar`) do repositório do worker.
 */
export type ProjecoesNoDestino = (
  empresaId: string,
) => <T>(
  fn: (repo: Pick<RepositorioProjecoesRomaneio, "gravadas" | "gravar">) => Promise<T>,
) => Promise<T>;

interface LinhaDaStaging {
  sigla: string;
  numero: string;
  importado_em: string;
  dados: string;
}

function objeto(texto: string): Record<string, unknown> {
  const valor = lerJson(texto);
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
}

/** Linhas 036/306/038/455 das chaves, lidas da staging do `public` (índice pelo número). */
async function linhasDaOrigem(
  origem: Consulta,
  empresaId: string,
  chaves: readonly ChaveCte[],
): Promise<Map<string, LinhasDoCte>> {
  const numeros = [...new Set(chaves.map((c) => c.numero))];
  const pedidas = new Set(chaves.map(chaveDoCte));
  const parametros = {
    empresa: { valor: empresaId, tipo: "uuid" },
    numeros: { valor: numeros, tipo: "text[]" },
  };
  const ler = (tabela: string, campo: string, filtroDoNumero: string) =>
    origem.consultar<LinhaDaStaging>(
      `select public.ssw_sigla_ctrc(o.${campo}) as sigla, ${filtroDoNumero} as numero,
              to_json(o.importado_em) #>> '{}' as importado_em,
              (to_jsonb(o) - ${CONTROLE})::text as dados
         from public.${tabela} o
        where o.empresa_id = @empresa and ${filtroDoNumero} = any(@numeros)`,
      parametros,
    );
  const [l036, l306, l038, l455] = await Promise.all([
    ler("staging_036_romaneios", "ctrc", "public.ssw_num_ctrc(o.ctrc)"),
    ler("staging_306_ssw_mobile", "ctrc_coleta", "o.numero_ctrc_norm"),
    ler("staging_038_ctrcs_pendentes", "ctrc", "public.ssw_num_ctrc(o.ctrc)"),
    // O valor da mercadoria do 455 vem do espelho no formato antigo, como na matview de hoje.
    ler("staging_455_ctrcs_expedidos", "ctrc", "public.ssw_num_ctrc(o.ctrc)"),
  ]);
  const porCte = new Map<
    string,
    { l036: Linha036[]; l306: Linha306[]; l038: Linha038[]; l455: Linha455[] }
  >();
  const doCte = (l: LinhaDaStaging) => {
    const k = chaveDoCte(l);
    if (!pedidas.has(k)) return null;
    const atual = porCte.get(k) ?? { l036: [], l306: [], l038: [], l455: [] };
    porCte.set(k, atual);
    return atual;
  };
  for (const l of l036) doCte(l)?.l036.push(linha036De(objeto(l.dados), new Date(l.importado_em)));
  for (const l of l306) doCte(l)?.l306.push(linha306De(objeto(l.dados), new Date(l.importado_em)));
  for (const l of l038) doCte(l)?.l038.push(linha038De(objeto(l.dados), new Date(l.importado_em)));
  for (const l of l455) {
    const valor = objeto(l.dados).valor_mercadoria;
    doCte(l)?.l455.push({
      valorMercadoria: typeof valor === "number" ? valor : null,
      importadoEm: new Date(l.importado_em),
    });
  }
  return porCte;
}

/** Todos os CT-e (sigla + número) com linha 036/306/038/455 na staging da empresa. */
async function chavesDaOrigem(origem: Consulta, empresaId: string): Promise<ChaveCte[]> {
  return origem.consultar<ChaveCte>(
    `select numero, sigla from (
       select public.ssw_num_ctrc(ctrc) as numero, public.ssw_sigla_ctrc(ctrc) as sigla
         from public.staging_036_romaneios where empresa_id = @empresa
       union
       select numero_ctrc_norm, public.ssw_sigla_ctrc(ctrc_coleta)
         from public.staging_306_ssw_mobile where empresa_id = @empresa
       union
       select public.ssw_num_ctrc(ctrc), public.ssw_sigla_ctrc(ctrc)
         from public.staging_038_ctrcs_pendentes where empresa_id = @empresa
       union
       select public.ssw_num_ctrc(ctrc), public.ssw_sigla_ctrc(ctrc)
         from public.staging_455_ctrcs_expedidos where empresa_id = @empresa
     ) k
     where numero is not null and sigla is not null
     order by numero, sigla`,
    { empresa: { valor: empresaId, tipo: "uuid" } },
  );
}

/** Contagem por projeção no destino × a matview equivalente de hoje (informativo). */
const CONFERENCIAS = [
  ["romaneio_viagens_cte", "mv_romaneio_viagem_ctrc"],
  ["romaneio_cte_atual", "mv_romaneio_ctrc_motorista"],
  ["cte_dados_relatorios", "mv_ctrc_staging_enriquecido"],
  ["romaneio_conferente_cte", null],
] as const;

async function contar(c: Consulta, tabela: string, empresaId: string): Promise<number> {
  const [linha] = await c.consultar<{ n: number }>(
    `select count(*)::int as n from ${tabela} where empresa_id = @empresa`,
    { empresa: { valor: empresaId, tipo: "uuid" } },
  );
  return linha?.n ?? 0;
}

export function passoDasProjecoes(noDestino: ProjecoesNoDestino): PassoFinal {
  return {
    nome: "recalcular-projecoes",
    executar: async (infra, filtros, simulacao) => {
      if (simulacao) return ["não roda na simulação (grava as projeções no destino)"];
      const empresas = await infra.destino.consultar<{ id: string }>(
        "select id::text as id from erp.empresas where @empresa is null or id = @empresa order by id",
        { empresa: { valor: filtros.empresaId, tipo: "uuid" } },
      );
      const notas: string[] = [];
      for (const { id } of empresas) {
        const chaves = await chavesDaOrigem(infra.origem, id);
        const posicao = new Map(chaves.map((c, i) => [chaveDoCte(c), i]));
        const executarLote: ExecutarLote = (fn) =>
          noDestino(id)((destino) =>
            fn({
              ...destino,
              linhasDosCtes: (pedidas) => linhasDaOrigem(infra.origem, id, pedidas),
              chavesComLinhas: (apos, limite) => {
                const inicio = apos ? (posicao.get(chaveDoCte(apos)) ?? -1) + 1 : 0;
                return Promise.resolve(chaves.slice(inicio, inicio + limite));
              },
            }),
          );
        const resumo = await reconstruirProjecoesDoRomaneio(executarLote, TAMANHO_DO_LOTE);
        const contagens: string[] = [];
        for (const [tabela, matview] of CONFERENCIAS) {
          const novo = await contar(infra.destino, `erp.${tabela}`, id);
          const hoje = matview ? await contar(infra.origem, `public.${matview}`, id) : null;
          contagens.push(
            `${tabela} ${String(novo)}${hoje === null ? "" : ` (${matview}: ${String(hoje)})`}`,
          );
        }
        notas.push(
          `empresa ${id}: ${String(resumo.ctes)} CT-e reconstruídos, ${String(resumo.alterados)} gravados; ` +
            contagens.join("; "),
        );
      }
      return notas;
    },
  };
}
