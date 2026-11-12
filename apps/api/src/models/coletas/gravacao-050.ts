/**
 * Gravação do relatório 050 em `coletas` pela importação da tela de Coletas, presa a uma transação
 * no contexto da empresa. O 050 do FTP é gravado pelo worker-ssw (cópia, ADR 0012).
 */
import { comInstantes, sql, type Transacao, valoresDeInsercao } from "@erp/db";
import { type RepositorioGravacao050 } from "@erp/dominio/coletas/gravacao-050";

type ColetaJaGravada = Awaited<ReturnType<RepositorioGravacao050["jaGravadas"]>>[number];

const instante = (iso: string | null) => (iso === null ? null : new Date(iso));
const comoNumeric = (valor: number | null) => (valor === null ? null : String(valor));

/** Na coleta que já existe, a gravação do 050 substitui todas as colunas menos a chave. */
const SUBSTITUIR_TUDO = sql.literal(
  [
    "tipo",
    "remetente_cnpj",
    "remetente_nome",
    "remetente_cidade",
    "setor",
    "destinatario_cnpj",
    "destinatario_nome",
    "destino_cidade",
    "solicitante",
    "motorista",
    "placa",
    "situacao",
    "etapa",
    "situacao_em",
    "limite_em",
    "limite_inicial",
    "cadastrada_em",
    "cadastrada_por",
    "dia_cadastro",
    "comandada_em",
    "coletada_em",
    "cancelada_em",
    "valor_mercadoria",
    "volumes",
    "peso_kg",
    "mercadoria",
    "tipo_frete",
    "notas_fiscais",
    "observacao",
    "cte_sigla",
    "cte_numero",
    "romaneio",
    "prejudicada_horario",
    "historico",
    "relatorio_emitido_em",
    "arquivo_origem",
    "atualizado_em",
  ]
    .map((c) => `${c} = excluded.${c}`)
    .join(", "),
);

export function criarRepositorioGravacao050(tx: Transacao): RepositorioGravacao050 {
  return {
    jaGravadas: async (empresaId, chaves) => {
      if (chaves.length === 0) return [];
      const linhas = comInstantes<ColetaJaGravada>(
        await tx.consultar(sql`
          select unidade, numero, relatorio_emitido_em as "relatorioEmitidoEm",
                 prejudicada_horario as "prejudicadaHorario", cte_sigla as "cteSigla",
                 cte_numero as "cteNumero", romaneio
          from erp.coletas
          where empresa_id = ${empresaId}
            and numero = any(${[...new Set(chaves.map((c) => c.numero))]}::int[])
            and unidade = any(${[...new Set(chaves.map((c) => c.unidade))]}::text[])`),
        ["relatorioEmitidoEm"],
      );
      const pedidas = new Set(chaves.map((c) => `${c.unidade}|${c.numero}`));
      return linhas.filter((l) => pedidas.has(`${l.unidade}|${l.numero}`));
    },

    gravar: async (empresaId, novas, agora) => {
      if (novas.length === 0) return;
      const linhas = novas.map((c) => ({
        empresaId,
        unidade: c.unidade,
        numero: c.numero,
        tipo: c.tipo,
        remetenteCnpj: c.remetenteCnpj,
        remetenteNome: c.remetenteNome,
        remetenteCidade: c.remetenteCidade,
        setor: c.setor,
        destinatarioCnpj: c.destinatarioCnpj,
        destinatarioNome: c.destinatarioNome,
        destinoCidade: c.destinoCidade,
        solicitante: c.solicitante,
        motorista: c.motorista,
        placa: c.placa,
        situacao: c.situacao,
        etapa: c.etapa,
        situacaoEm: instante(c.situacaoEm),
        limiteEm: instante(c.limiteEm),
        limiteInicial: c.limiteInicial,
        cadastradaEm: instante(c.cadastradaEm),
        cadastradaPor: c.cadastradaPor,
        diaCadastro: c.diaCadastro,
        comandadaEm: instante(c.comandadaEm),
        coletadaEm: instante(c.coletadaEm),
        canceladaEm: instante(c.canceladaEm),
        valorMercadoria: comoNumeric(c.valorMercadoria),
        volumes: c.volumes === null ? null : Math.round(c.volumes),
        pesoKg: comoNumeric(c.pesoKg),
        mercadoria: c.mercadoria,
        tipoFrete: c.tipoFrete,
        notasFiscais: c.notasFiscais,
        observacao: c.observacao,
        cteSigla: c.cteSigla,
        cteNumero: c.cteNumero,
        romaneio: c.romaneio,
        prejudicadaHorario: c.prejudicadaHorario,
        historico: sql.json(c.historico),
        relatorioEmitidoEm: c.relatorioEmitidoEm,
        arquivoOrigem: c.arquivoOrigem,
        atualizadoEm: agora,
      }));
      await tx.executar(sql`
        insert into erp.coletas ${valoresDeInsercao(linhas)}
        on conflict (empresa_id, unidade, numero) do update set ${SUBSTITUIR_TUDO}`);
    },
  };
}
