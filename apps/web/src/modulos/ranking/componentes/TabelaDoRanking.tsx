import { type TipoRecorte } from "@erp/shared/contratos/listagem";
import { type LinhaDoRanking } from "@erp/shared/contratos/ranking";
import {
  formatarDecimal,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatacao";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Eye, EyeOff, SearchX } from "lucide-react";
import { type KeyboardEvent } from "react";

import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { LinhasCarregando } from "@/componentes/comum/LinhasCarregando";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { cn } from "@/lib/utils";

import { type ChaveDeOrdem, nivelDoSla } from "../regras";
import { COR_DO_NIVEL } from "../textos";

// Tabela larga (15 colunas): células um pouco mais justas que as do TabelaDados.
const TD = "px-2.5 py-2.5";

/**
 * Tabela do ranking (uma linha por parceiro ou cidade), com ordenação pelos cabeçalhos e o olho
 * do Frete. Clique no número abre o recorte daquela coluna; no resto da linha, todos os CT-e dela.
 */
export function TabelaDoRanking({
  grupo,
  rotuloDoGrupo,
  plural,
  descricao,
  linhas,
  filtradas,
  ordenadas,
  rotuloDoFiltro,
  filtrando,
  aoVerTodos,
  carregando,
  erro,
  aoTentarDeNovo,
  meta,
  alerta,
  nomeCurto,
  nomeDe,
  subDe,
  ordem,
  aoOrdenar,
  freteVisivel,
  aoAlternarFrete,
  aoAbrir,
}: {
  grupo: "pagador" | "cidade";
  rotuloDoGrupo: string;
  plural: string;
  descricao: string;
  linhas: readonly LinhaDoRanking[];
  filtradas: readonly LinhaDoRanking[];
  ordenadas: readonly LinhaDoRanking[];
  rotuloDoFiltro: string;
  /** Algum card filtra a tabela (mostra a barra "Mostrando N de M"). */
  filtrando: boolean;
  aoVerTodos: () => void;
  carregando: boolean;
  erro: Error | null;
  aoTentarDeNovo: () => void;
  meta: number;
  alerta: number;
  nomeCurto: string;
  nomeDe: (r: LinhaDoRanking) => string;
  subDe: (r: LinhaDoRanking) => string;
  ordem: { chave: ChaveDeOrdem; direcao: "asc" | "desc" };
  aoOrdenar: (chave: ChaveDeOrdem) => void;
  freteVisivel: boolean;
  aoAlternarFrete: () => void;
  aoAbrir: (r: LinhaDoRanking, tipo?: TipoRecorte) => void;
}) {
  const teclaNaLinha = (e: KeyboardEvent<HTMLTableRowElement>, r: LinhaDoRanking) => {
    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    aoAbrir(r);
  };

  const celula = (r: LinhaDoRanking, valor: number, tipo: TipoRecorte, dica: string) => (
    <td className={cn(TD, "text-right")}>
      <button
        type="button"
        title={`Ver: ${dica}`}
        onClick={(e) => {
          e.stopPropagation();
          aoAbrir(r, tipo);
        }}
        className="-mx-1 rounded-md px-1 py-0.5 underline-offset-2 hover:bg-brand-suave hover:text-brand hover:underline"
      >
        {formatarInteiro(valor)}
      </button>
    </td>
  );

  const cabecalhos: { chave: ChaveDeOrdem; rotulo: string; alinhar: "left" | "right" }[] = [
    { chave: "nome", rotulo: rotuloDoGrupo, alinhar: "left" },
    { chave: "totalCtes", rotulo: "CT-e", alinhar: "right" },
    { chave: "entregue", rotulo: "Entregue", alinhar: "right" },
    { chave: "noPrazo", rotulo: "No Prazo", alinhar: "right" },
    { chave: "foraPrazo", rotulo: "Fora", alinhar: "right" },
    { chave: "foraCliente", rotulo: "Cliente", alinhar: "right" },
    { chave: "foraTransp", rotulo: "Transp.", alinhar: "right" },
    { chave: "slaPct", rotulo: "SLA", alinhar: "right" },
    { chave: "aEntregar", rotulo: "A Entregar", alinhar: "right" },
    { chave: "atrasadas", rotulo: "Atrasadas", alinhar: "right" },
    { chave: "peso", rotulo: "Peso", alinhar: "right" },
    { chave: "volumes", rotulo: "Volumes", alinhar: "right" },
    { chave: "frete", rotulo: "Frete", alinhar: "right" },
  ];

  const textoDoOlho = freteVisivel ? "Ocultar valores de frete" : "Mostrar valores de frete";

  return (
    <Painel
      titulo={`Ranking por ${rotuloDoGrupo}`}
      descricao={descricao}
      barra={
        filtrando && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span>
              Mostrando {formatarInteiro(filtradas.length)} de {formatarInteiro(linhas.length)}{" "}
              {plural} {rotuloDoFiltro}.
            </span>
            <button
              type="button"
              onClick={() => {
                aoVerTodos();
              }}
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              Ver todos
            </button>
          </div>
        )
      }
      rodape={
        <p className="text-xs">
          SLA = (entregue − atrasos por culpa da transportadora) ÷ entregue — atraso de
          responsabilidade do cliente não penaliza. Clique num número para ver os CT-e daquela
          coluna, ou no resto da linha para ver todos os CT-e do parceiro ou da cidade.
          {grupo === "cidade"
            ? " A cidade considera tudo emitido para ela, independente de parceiro."
            : ""}
        </p>
      }
    >
      <div className="rolagem-fina relative overflow-x-auto">
        <table className={CLASSE_TABELA} aria-busy={carregando}>
          <thead>
            <tr className={CLASSE_CABECALHO}>
              <th scope="col" className={cn(CLASSE_TH, "px-2.5")}>
                #
              </th>
              {cabecalhos.map((h) => {
                const ativo = ordem.chave === h.chave;
                const IconeOrdem = !ativo
                  ? ArrowUpDown
                  : ordem.direcao === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <th
                    key={h.chave}
                    scope="col"
                    aria-sort={
                      ativo ? (ordem.direcao === "asc" ? "ascending" : "descending") : undefined
                    }
                    className={cn(
                      CLASSE_TH,
                      "px-2.5",
                      h.alinhar === "right" ? "text-right" : "text-left",
                      ativo && "text-foreground",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {h.chave === "frete" && (
                        <button
                          type="button"
                          onClick={aoAlternarFrete}
                          title={textoDoOlho}
                          aria-label={textoDoOlho}
                          className="rounded-md p-0.5 hover:bg-muted hover:text-foreground"
                        >
                          {freteVisivel ? (
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          aoOrdenar(h.chave);
                        }}
                        title="Ordenar por esta coluna"
                        className="inline-flex items-center gap-0.5 uppercase hover:text-foreground"
                      >
                        {h.rotulo}
                        <IconeOrdem className={cn("h-3 w-3", !ativo && "opacity-50")} aria-hidden />
                      </button>
                    </span>
                  </th>
                );
              })}
              <th scope="col" className="w-8">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhasCarregando linhas={8} colunas={15} />}
            {!carregando && erro && (
              <tr>
                <td colSpan={15}>
                  <MensagemErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} />
                </td>
              </tr>
            )}
            {!carregando && !erro && linhas.length === 0 && (
              <tr>
                <td colSpan={15}>
                  <EstadoVazio
                    icone={SearchX}
                    mensagem={`Nenhum ${rotuloDoGrupo.toLowerCase()} no período.`}
                    detalhe="Amplie o período ou tire filtros."
                  />
                </td>
              </tr>
            )}
            {linhas.length > 0 && filtradas.length === 0 && (
              <tr>
                <td colSpan={15}>
                  <EstadoVazio
                    mensagem={`Nenhum ${rotuloDoGrupo.toLowerCase()} ${rotuloDoFiltro} no período.`}
                  />
                </td>
              </tr>
            )}
            {ordenadas.map((r, i) => {
              const nivel = nivelDoSla(r.slaPct, meta, alerta);
              return (
                <tr
                  key={r.chave}
                  tabIndex={0}
                  onClick={() => {
                    aoAbrir(r);
                  }}
                  onKeyDown={(e) => {
                    teclaNaLinha(e, r);
                  }}
                  title="Ver todos os CT-e (clique num número para ver só aquela coluna)"
                  className={cn(
                    CLASSE_LINHA,
                    "cursor-pointer focus-visible:bg-accent focus-visible:outline-none",
                  )}
                  style={nivel === "ruim" ? { background: COR_DO_NIVEL.ruim.fundo } : undefined}
                >
                  <td className={cn(TD, "text-muted-foreground")}>{i + 1}</td>
                  <td className={cn(TD, "max-w-[280px]")}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50"
                        style={nivel ? { background: COR_DO_NIVEL[nivel].cor } : undefined}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">{nomeDe(r)}</div>
                        {subDe(r) ? (
                          <div className="truncate text-xs text-muted-foreground">{subDe(r)}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  {celula(r, r.totalCtes, "emitidos", "CT-e emitidos")}
                  {celula(r, r.entregue, "entregues", "CT-e entregues")}
                  {celula(r, r.noPrazo, "no_prazo", "CT-e entregues no prazo")}
                  <td className={cn(TD, "text-right")}>{formatarInteiro(r.foraPrazo)}</td>
                  <td className={cn(TD, "text-right text-muted-foreground")}>
                    {formatarInteiro(r.foraCliente)}
                  </td>
                  {celula(r, r.foraTransp, "fora_prazo", `Fora do prazo por culpa da ${nomeCurto}`)}
                  <td
                    className={cn(TD, "text-right font-bold")}
                    style={nivel ? { color: COR_DO_NIVEL[nivel].texto } : undefined}
                  >
                    {formatarPercentual(r.slaPct)}
                  </td>
                  {celula(r, r.aEntregar, "previstos_por_status", "CT-e a entregar (em aberto)")}
                  {celula(r, r.atrasadas, "em_atraso", "CT-e em aberto com prazo vencido")}
                  <td className={cn(TD, "text-right")}>{formatarDecimal(r.peso, 0)}</td>
                  <td className={cn(TD, "text-right")}>{formatarInteiro(Math.round(r.volumes))}</td>
                  <td className={cn(TD, "text-right whitespace-nowrap")}>
                    {freteVisivel ? (
                      formatarMoeda(r.frete, { centavos: false })
                    ) : (
                      <span className="text-muted-foreground" aria-label="valor oculto">
                        R$ •••••
                      </span>
                    )}
                  </td>
                  <td className="pr-3 text-right">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}
