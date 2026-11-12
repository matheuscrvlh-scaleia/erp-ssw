import { ROTULO_DO_TIPO_DE_ANOTACAO, TIPOS_ANOTACAO } from "@erp/shared/contratos/historico";
import { Search } from "lucide-react";

import { Alternador } from "@/componentes/comum/Alternador";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import {
  etiquetasQueLimpam,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/componentes/comum/FiltrosAvancados";
import { FiltroUnico } from "@/componentes/comum/FiltroUnico";

import { type BuscaHistorico, etiquetasDaBusca, PERIODOS, PRESENCAS } from "../busca";
import { ROTULO_DA_PRESENCA, ROTULO_DO_PERIODO } from "../textos";

interface Opcao {
  id: string;
  nome: string;
}

/** Filtros da tela (período, tipo, dias, autor, unidade, busca) e as etiquetas do que filtra. */
export function FiltrosHistorico({
  busca,
  definir,
  aoLimpar,
  autores,
  unidades,
}: {
  busca: BuscaHistorico;
  definir: (mudanca: Partial<BuscaHistorico>) => void;
  aoLimpar: () => void;
  autores: readonly Opcao[];
  unidades: readonly Opcao[];
}) {
  const filtrosLigados =
    busca.tipos.length > 0 ||
    busca.presenca !== "todos" ||
    busca.autor !== "" ||
    busca.q !== "" ||
    busca.unidades.length > 0;
  return (
    <>
      <FiltrosAvancados ativos={filtrosLigados} aoLimpar={aoLimpar}>
        <Alternador
          rotulo="Período"
          opcoes={PERIODOS.map((p) => ({ valor: p, rotulo: ROTULO_DO_PERIODO[p] }))}
          valor={busca.periodo}
          aoMudar={(p) => {
            definir({ periodo: p });
          }}
        />
        <FiltroMultiplo
          rotulo="Tipo"
          opcoes={TIPOS_ANOTACAO.map((t) => ({
            valor: t,
            rotulo: ROTULO_DO_TIPO_DE_ANOTACAO[t],
          }))}
          selecionados={busca.tipos}
          aoMudar={(tipos) => {
            definir({ tipos: TIPOS_ANOTACAO.filter((t) => tipos.includes(t)) });
          }}
          textoVazio="todos"
        />
        <FiltroUnico
          rotulo="Dias"
          valor={busca.presenca === "todos" ? "" : busca.presenca}
          todos={ROTULO_DA_PRESENCA.todos}
          opcoes={PRESENCAS.filter((p) => p !== "todos").map((p) => ({
            valor: p,
            rotulo: ROTULO_DA_PRESENCA[p],
          }))}
          aoMudar={(v) => {
            definir({ presenca: PRESENCAS.find((p) => p === v) ?? "todos" });
          }}
        />
        <FiltroUnico
          rotulo="Autor"
          valor={busca.autor}
          todos="Todos autores"
          opcoes={autores.map((a) => ({ valor: a.id, rotulo: a.nome }))}
          aoMudar={(autor) => {
            definir({ autor });
          }}
        />
        <FiltroUnico
          rotulo="Unidade"
          valor={busca.unidades[0] ?? ""}
          todos="Todas as unidades"
          opcoes={unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))}
          aoMudar={(u) => {
            definir({ unidades: u ? [u] : [] });
          }}
        />
        <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] shadow-cartao focus-within:border-ring">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            aria-label="Buscar no texto"
            placeholder="Buscar no texto…"
            value={busca.q}
            onChange={(e) => {
              definir({ q: e.target.value });
            }}
            className="w-44 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
      </FiltrosAvancados>
      <FiltrandoPor
        etiquetas={etiquetasQueLimpam(
          etiquetasDaBusca(busca, {
            unidade: (id) => unidades.find((u) => u.id === id)?.nome,
            autor: (id) => autores.find((a) => a.id === id)?.nome,
          }),
          definir,
        )}
      />
    </>
  );
}
