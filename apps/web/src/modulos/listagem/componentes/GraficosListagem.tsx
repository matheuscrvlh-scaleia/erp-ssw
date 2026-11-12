import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosListagem, type TipoRecorte } from "@erp/shared/contratos/listagem";
import { ListFilter } from "lucide-react";

import { KpiCard } from "@/componentes/comum/KpiCard";
import { cn } from "@/lib/utils";

import { type BuscaDaLista } from "../busca";
import { mostraGraficoDeFaixa } from "../regras";
import { GraficoDeBarras } from "./GraficoDeBarras";

type Resultado = SaidaDe<typeof contratosListagem.listar>;

/**
 * Total do recorte e os gráficos (Ocorrências, Unidade, Cidades Destino e, nos recortes de atraso,
 * Dias de Atraso). O clique numa barra filtra a lista por `aoMudar`.
 */
export function GraficosListagem({
  busca,
  recortes,
  total,
  carregando,
  rotuloDoPeriodo,
  porCodigo,
  porUnidade,
  porCidade,
  porFaixa,
  aoMudar,
}: {
  busca: BuscaDaLista;
  recortes: readonly TipoRecorte[];
  total: number;
  carregando: boolean;
  rotuloDoPeriodo: string;
  porCodigo: Resultado["porCodigo"];
  porUnidade: Resultado["porUnidade"];
  porCidade: Resultado["porCidade"];
  porFaixa: Resultado["porFaixa"];
  aoMudar: (mudanca: Partial<BuscaDaLista>) => void;
}) {
  const mostrarFaixa = mostraGraficoDeFaixa(recortes);
  const soPorFaixa = recortes.length === 1 && busca.tipo === "por_faixa_atraso";

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
      <div className="flex xl:self-start">
        <KpiCard
          rotulo="Total do recorte"
          icone={ListFilter}
          valor={carregando ? "…" : total.toLocaleString("pt-BR")}
          status="bom"
          neutro
          detalhe={`CTRCs · ${rotuloDoPeriodo}`}
        />
      </div>
      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          mostrarFaixa ? "2xl:grid-cols-4" : "2xl:grid-cols-3",
        )}
      >
        <GraficoDeBarras
          titulo="Ocorrências"
          subtitulo="Distribuição por código · clique para filtrar"
          vazio="Sem ocorrências no recorte atual."
          larguraDoRotulo={44}
          barras={porCodigo.map((a) => ({
            chave: String(a.codigo),
            rotulo: `#${String(a.codigo)}`,
            qtd: a.qtd,
            dica: `#${String(a.codigo)} — ${a.descricao ?? ""}`,
            ativa: busca.codigos.includes(a.codigo),
          }))}
          aoClicar={(chave) => {
            const codigo = Number(chave);
            const so = busca.codigos.length === 1 && busca.codigos[0] === codigo;
            aoMudar({ codigos: so ? [] : [codigo] });
          }}
        />
        <GraficoDeBarras
          titulo="Distribuição por Unidade"
          subtitulo="Clique para filtrar por unidade"
          vazio="Sem dados de unidade no recorte."
          larguraDoRotulo={44}
          barras={porUnidade.map((a) => ({
            chave: a.unidade,
            rotulo: a.unidade,
            qtd: a.qtd,
            dica: a.unidade,
            ativa: busca.unidades.includes(a.unidade),
          }))}
          aoClicar={(unidade) => {
            const so = busca.unidades.length === 1 && busca.unidades[0] === unidade;
            aoMudar({ unidades: so ? [] : [unidade] });
          }}
        />
        <GraficoDeBarras
          titulo="Cidades Destino"
          subtitulo="Top 10 · clique para filtrar"
          vazio="Sem cidade de destino no recorte."
          larguraDoRotulo={96}
          barras={porCidade.map((a) => ({
            chave: a.cidade,
            rotulo: a.cidade,
            qtd: a.qtd,
            dica: a.cidade,
            ativa: busca.cidade === a.cidade,
          }))}
          aoClicar={(cidade) => {
            aoMudar({ cidade: busca.cidade === cidade ? "" : cidade });
          }}
        />
        {mostrarFaixa && (
          <GraficoDeBarras
            titulo="Dias de Atraso"
            subtitulo="Clique para filtrar por faixa"
            vazio="Sem atrasos no recorte."
            larguraDoRotulo={78}
            barras={porFaixa.map((a) => ({
              chave: a.faixa,
              rotulo: a.faixa,
              qtd: a.qtd,
              dica: a.faixa,
              ativa: soPorFaixa
                ? busca.faixa_min === a.min && busca.faixa_max === a.max
                : busca.atraso_min === a.min && busca.atraso_max === a.max,
            }))}
            aoClicar={(chave) => {
              const faixa = porFaixa.find((a) => a.faixa === chave);
              if (!faixa) return;
              if (soPorFaixa) {
                const ativa = busca.faixa_min === faixa.min && busca.faixa_max === faixa.max;
                aoMudar({
                  faixa_min: ativa ? null : faixa.min,
                  faixa_max: ativa ? null : faixa.max,
                });
                return;
              }
              // Estreita o atraso dentro do recorte atual (sem trocar de recorte, que perderia
              // o "só em aberto" de Atrasados/Sem movimento/Previstos).
              const ativa = busca.atraso_min === faixa.min && busca.atraso_max === faixa.max;
              aoMudar({
                atraso_min: ativa ? null : faixa.min,
                atraso_max: ativa ? null : faixa.max,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
