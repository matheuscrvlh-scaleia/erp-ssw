import {
  type LinhaDeColeta,
  STATUS_DA_LISTA,
  type StatusDaLista,
} from "@erp/shared/contratos/coletas";
import { formatarDataHora, formatarInteiro } from "@erp/shared/formatacao";

import { BuscaDocumento } from "@/componentes/comum/BuscaDocumento";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";

import { type BuscaColetas } from "../busca";
import { ROTULO_DA_ETAPA, ROTULO_DO_PRAZO, ROTULO_DO_STATUS } from "../textos";

function colunasDaLista(fuso: string): ColunaTabela<LinhaDeColeta>[] {
  const dh = (v: string | null) => formatarDataHora(v, fuso);
  return [
    { chave: "unidade", titulo: "Unidade", classe: "font-mono", fixa: true },
    { chave: "numero", titulo: "Coleta", classe: "font-mono whitespace-nowrap" },
    { chave: "tipo", titulo: "Tipo" },
    { chave: "etapa", titulo: "Situação", valor: (l) => ROTULO_DA_ETAPA[l.etapa] },
    {
      chave: "statusPrazo",
      titulo: "Prazo",
      valor: (l) => ROTULO_DO_PRAZO[l.statusPrazo].texto,
      celula: (l) => (
        <SeloStatus tom={ROTULO_DO_PRAZO[l.statusPrazo].tom}>
          {ROTULO_DO_PRAZO[l.statusPrazo].texto}
        </SeloStatus>
      ),
    },
    {
      chave: "cadastradaEm",
      titulo: "Cadastro",
      formato: "datahora",
      celula: (l) => dh(l.cadastradaEm),
    },
    { chave: "limiteEm", titulo: "Limite", formato: "datahora", celula: (l) => dh(l.limiteEm) },
    {
      chave: "coletadaEm",
      titulo: "Coletada em",
      formato: "datahora",
      celula: (l) => dh(l.coletadaEm),
    },
    { chave: "canceladaEm", titulo: "Cancelada em", formato: "datahora", oculta: true },
    { chave: "solicitante", titulo: "Solicitante", classe: "max-w-[160px] truncate" },
    { chave: "remetenteCnpj", titulo: "CNPJ remetente", oculta: true },
    { chave: "remetenteNome", titulo: "Remetente", classe: "max-w-[200px] truncate" },
    { chave: "remetenteCidade", titulo: "Cidade coleta" },
    { chave: "destinatarioNome", titulo: "Destinatário", oculta: true },
    { chave: "destinoCidade", titulo: "Destino", oculta: true },
    { chave: "motorista", titulo: "Motorista", oculta: true },
    { chave: "placa", titulo: "Placa", classe: "font-mono" },
    { chave: "volumes", titulo: "Volumes", formato: "inteiro" },
    { chave: "pesoKg", titulo: "Peso (kg)", formato: "decimal" },
    { chave: "valorMercadoria", titulo: "Valor mercadoria", formato: "moeda", oculta: true },
    { chave: "tipoFrete", titulo: "Frete", oculta: true },
    { chave: "notasFiscais", titulo: "Notas fiscais", oculta: true },
    {
      chave: "cte",
      titulo: "CT-e gerado",
      valor: (l) => (l.cteNumero ? `${l.cteSigla ?? ""} ${l.cteNumero}`.trim() : null),
      classe: "font-mono",
    },
    { chave: "cteTipoDocumento", titulo: "Tipo do CT-e", oculta: true },
    {
      chave: "prejudicadaHorario",
      titulo: "Prejudicada pelo horário",
      oculta: true,
      valor: (l) => (l.prejudicadaHorario ? "Sim" : null),
    },
    { chave: "ultimoEvento", titulo: "Último evento", classe: "max-w-[220px] truncate" },
  ];
}

/** A lista paginada no servidor, com o filtro de situação e a busca por documento. */
export function TabelaColetas({
  fuso,
  linhas,
  total,
  carregando,
  erro,
  aoTentarDeNovo,
  aberta,
  aoAbrir,
  pagina,
  porPagina,
  aoMudarPagina,
  status,
  termo,
  aoMudarTermo,
  subtitulo,
  carregarLinhas,
  aoMudar: mudar,
}: {
  fuso: string;
  linhas: readonly LinhaDeColeta[];
  total: number;
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  aberta: LinhaDeColeta | null;
  aoAbrir: (coleta: LinhaDeColeta) => void;
  pagina: number;
  porPagina: number;
  aoMudarPagina: (pagina: number) => void;
  status: StatusDaLista;
  termo: string;
  aoMudarTermo: (termo: string) => void;
  subtitulo: string;
  /** A lista inteira (todas as páginas) para a exportação. */
  carregarLinhas: () => Promise<readonly LinhaDeColeta[]>;
  aoMudar: (m: Partial<BuscaColetas>) => void;
}) {
  return (
    <TabelaDados
      titulo="Detalhe das coletas"
      colunas={colunasDaLista(fuso)}
      linhas={linhas}
      chaveDaLinha={(l) => `${l.unidade}-${String(l.numero)}`}
      carregando={carregando}
      erro={erro}
      aoTentarDeNovo={aoTentarDeNovo}
      mensagemVazia="Nenhuma coleta encontrada."
      aoClicarLinha={aoAbrir}
      linhaAtiva={aberta ? `${aberta.unidade}-${String(aberta.numero)}` : null}
      configurarColunas
      paginacaoServidor={{
        pagina,
        porPagina,
        total,
        aoMudarPagina,
      }}
      rotuloTotal={(n) => `${formatarInteiro(n)} coleta(s)`}
      exportacao={{
        arquivo: `coletas-${status}`,
        titulo: `Coletas — ${ROTULO_DO_STATUS[status]}`,
        subtitulo,
        carregarLinhas,
      }}
      acoes={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              mudar({ status: STATUS_DA_LISTA.find((s) => s === v) ?? "todas" });
            }}
          >
            <SelectTrigger className="h-9 w-[210px] text-[13px]" aria-label="Situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_DA_LISTA.map((s) => (
                <SelectItem key={s} value={s} className="text-[13px]">
                  {ROTULO_DO_STATUS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <BuscaDocumento
            valor={termo}
            placeholder="Coleta, CT-e, NF, remetente…"
            className="w-[240px]"
            aoMudar={aoMudarTermo}
          />
        </div>
      }
    />
  );
}
