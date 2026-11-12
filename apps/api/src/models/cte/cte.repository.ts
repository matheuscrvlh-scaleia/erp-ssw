/**
 * Gravação de CT-e pelo núcleo no banco do ERP (a regra é `regravarCte` de
 * `@erp/dominio/nucleo`). Usada pelos jobs de recálculo; o worker-ssw tem a cópia dele (ADR 0012).
 * Preso a uma transação no contexto da empresa (RLS); toda gravação leva a empresa explícita.
 */
import {
  atribuicoes,
  camposDaLinha,
  instanteDoBanco,
  type Linha,
  sql,
  type Transacao,
  valoresDeInsercao,
} from "@erp/db";
import { configuracoesVigentes } from "@erp/dominio/configuracoes";
import {
  type CadastrosDoNucleo,
  cnpjsPropriosDaEmpresa,
  type CteGravado,
  lerConfiguracaoDoNucleo,
  montarCatalogo,
  type OcorrenciaDoCte,
  type RepositorioCteNucleo,
} from "@erp/dominio/nucleo";

/** Colunas `timestamptz` de `erp.ctes`: chegam do banco como texto e o núcleo usa `Date`. */
const INSTANTES_DO_CTE = [
  "dataEntregaRealizada",
  "dataBasePrazo",
  "previsaoSswDataBase",
  "comprovanteEscaneadoEm",
  "ultimaOcorrData0013",
  "ultOcorrData0174",
  "ocorr036Data",
  "ocorrEfetivaData",
  "canceladoEm",
  "criadoEm",
  "atualizadoEm",
] as const;

/**
 * Linha de `erp.ctes` (`select *` / `returning *`) como o núcleo a usa: campos em `camelCase`,
 * instantes em `Date`, `numero_cte` (bigint) em número. Data sem hora e numeric ficam em texto.
 */
export function comoCte(linha: Linha): CteGravado {
  const cte = camposDaLinha(linha);
  for (const campo of INSTANTES_DO_CTE) {
    const valor = cte[campo];
    cte[campo] = typeof valor === "string" ? instanteDoBanco(valor) : null;
  }
  if (cte["numeroCte"] !== null) cte["numeroCte"] = Number(cte["numeroCte"]);
  return cte as unknown as CteGravado;
}

/** Configurações que o núcleo lê (padrões em `CONFIGURACAO_PADRAO`). */
const CHAVES_DO_NUCLEO = [
  "alerta_dias_sem_movimento",
  "ctrc_data_minima_emissao",
  "prazo_padrao_dias",
  "raiz_cnpj_troca",
];

const LOTE_DE_GRAVACAO = 500;
const LOTE_DE_LEITURA = 5000;

function emBlocos<T>(itens: readonly T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) blocos.push(itens.slice(i, i + tamanho));
  return blocos;
}

export function criarRepositorioCteNucleo(
  tx: Transacao,
  empresaId: string,
): RepositorioCteNucleo<CteGravado> {
  return {
    async cadastrosDoNucleo() {
      const codigos = await tx.consultar<Parameters<typeof montarCatalogo>[0][number]>(sql`
        select codigo, descricao, tipo_ssw as "tipoSsw", processo_ssw as "processoSsw",
               responsavel, penaliza
        from erp.codigos_ocorrencia where empresa_id = ${empresaId}`);
      const listaDeFiliais = await tx.consultar<CadastrosDoNucleo["filiais"][number]>(sql`
        select sigla, cidade, uf, propria from erp.filiais where empresa_id = ${empresaId}`);
      const regras = await tx.consultar<
        Omit<CadastrosDoNucleo["regrasDePrazo"][number], "criadoEm"> & { criadoEm: string }
      >(sql`
        select id, tipo, unidade_codigo as "unidadeCodigo",
               unidade_destino_codigo as "unidadeDestinoCodigo", parceiro_cnpj as "parceiroCnpj",
               prazo_horas as "prazoHoras", prazo_dias as "prazoDias", ativo,
               criado_em as "criadoEm"
        from erp.prazos_configurados where empresa_id = ${empresaId}`);
      const [xml] = await tx.consultar<{ parametros: Record<string, unknown> }>(sql`
        select parametros from erp.empresa_integracoes
        where empresa_id = ${empresaId} and tipo = 'xml_cte'`);
      const [empresa] = await tx.consultar<{ cnpj: string; dominioSsw: string | null }>(sql`
        select cnpj, dominio_ssw as "dominioSsw" from erp.empresas where id = ${empresaId}`);
      if (!empresa) throw new Error(`Empresa inexistente: ${empresaId}`);
      const config = await tx.consultar<{ empresaId: string | null; chave: string; valor: string }>(
        sql`
          select empresa_id as "empresaId", chave, valor from erp.configuracoes
          where chave = any(${CHAVES_DO_NUCLEO}::text[])
            and (empresa_id = ${empresaId} or empresa_id is null)`,
      );
      const emitentes = xml?.parametros["cnpjs_emitentes"];
      return {
        catalogo: montarCatalogo(codigos),
        filiais: listaDeFiliais,
        regrasDePrazo: regras.map((r) => ({ ...r, criadoEm: instanteDoBanco(r.criadoEm) })),
        config: lerConfiguracaoDoNucleo(configuracoesVigentes(config)),
        cnpjsProprios: cnpjsPropriosDaEmpresa(
          empresa.cnpj,
          Array.isArray(emitentes) ? emitentes.map(String) : [],
        ),
        dominioSsw: empresa.dominioSsw,
      };
    },

    async ocorrenciasDosCtes(ids) {
      const saida = new Map<string, OcorrenciaDoCte[]>();
      for (const bloco of emBlocos([...new Set(ids)], LOTE_DE_LEITURA)) {
        const linhas = await tx.consultar<
          Omit<OcorrenciaDoCte, "dataHora" | "criadoEm"> & {
            cteId: string;
            dataHora: string;
            criadoEm: string;
          }
        >(sql`
          select id, cte_id as "cteId", codigo, descricao, data_hora as "dataHora", filial, origem,
                 quarentena, criado_em as "criadoEm"
          from erp.ocorrencias
          where empresa_id = ${empresaId} and cte_id = any(${bloco}::uuid[])`);
        for (const { cteId, dataHora, criadoEm, ...o } of linhas) {
          const ocorrencia = {
            ...o,
            dataHora: instanteDoBanco(dataHora),
            criadoEm: instanteDoBanco(criadoEm),
          };
          saida.set(cteId, [...(saida.get(cteId) ?? []), ocorrencia]);
        }
      }
      return saida;
    },

    async inserirCtes(novos) {
      const saida: CteGravado[] = [];
      for (const bloco of emBlocos(novos, LOTE_DE_GRAVACAO)) {
        const linhas = await tx.consultar(sql`
          insert into erp.ctes ${valoresDeInsercao(bloco.map((c) => ({ ...c, empresaId, camposSsw: [...c.camposSsw] })))}
          on conflict do nothing
          returning *`);
        saida.push(...linhas.map(comoCte));
      }
      return saida;
    },

    async atualizarCte(id, campos) {
      const { camposSsw, ...resto } = campos;
      await tx.executar(sql`
        update erp.ctes
        set ${atribuicoes({ ...resto, ...(camposSsw ? { camposSsw: [...camposSsw] } : {}) })}
        where empresa_id = ${empresaId} and id = ${id}`);
    },

    async registrarTrocaDePrevisao(cteId, troca) {
      await tx.executar(sql`
        insert into erp.cte_prazo_historico ${valoresDeInsercao([{ empresaId, cteId, ...troca }])}`);
    },
  };
}
