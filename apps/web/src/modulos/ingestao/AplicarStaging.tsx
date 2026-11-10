/**
 * "Aplicar importações à produção": simulação (não grava) ou aplicação em blocos de 4000 CT-e,
 * com o resumo de cada lista (até 500 itens) e o histórico das aplicações.
 */
import {
  contratosIngestao as c,
  type ResultadoDoBlocoDeAplicacao,
} from "@erp/shared/contratos/ingestao";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { Checkbox } from "@/componentes/ui/checkbox";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DA_INGESTAO, consultaAplicacoes } from "./api";
import { Abas, SeloStatus } from "./pecas";

const LOTE = 4000;
const MAX_LISTA = 500;

type Aba = "inserir" | "atualizar" | "ocorrencias" | "ignorados" | "romaneio_036";

interface Acumulado {
  dryRun: boolean;
  blocos: number;
  totais: ResultadoDoBlocoDeAplicacao["totais"];
  inserir: ResultadoDoBlocoDeAplicacao["inserir"];
  atualizar: ResultadoDoBlocoDeAplicacao["atualizar"];
  ocorrencias: ResultadoDoBlocoDeAplicacao["ocorrencias"];
  ignorados: ResultadoDoBlocoDeAplicacao["ignorados"];
  romaneio036: number | null;
  pendentes: number;
}

function somar(a: Acumulado | null, r: ResultadoDoBlocoDeAplicacao): Acumulado {
  const base: Acumulado = a ?? {
    dryRun: r.dryRun,
    blocos: 0,
    totais: { inserir: 0, atualizar: 0, ocorrencias: 0, ignorados: 0 },
    inserir: [],
    atualizar: [],
    ocorrencias: [],
    ignorados: [],
    romaneio036: null,
    pendentes: 0,
  };
  return {
    dryRun: r.dryRun,
    blocos: base.blocos + 1,
    totais: {
      inserir: base.totais.inserir + r.totais.inserir,
      atualizar: base.totais.atualizar + r.totais.atualizar,
      ocorrencias: base.totais.ocorrencias + r.totais.ocorrencias,
      ignorados: base.totais.ignorados + r.totais.ignorados,
    },
    inserir: [...base.inserir, ...r.inserir].slice(0, MAX_LISTA),
    atualizar: [...base.atualizar, ...r.atualizar].slice(0, MAX_LISTA),
    ocorrencias: [...base.ocorrencias, ...r.ocorrencias].slice(0, MAX_LISTA),
    ignorados: [...base.ignorados, ...r.ignorados].slice(0, MAX_LISTA),
    romaneio036: r.romaneio036 ?? base.romaneio036,
    pendentes: r.pendentes,
  };
}

export function AplicarStaging() {
  const queryClient = useQueryClient();
  const historico = useQuery(consultaAplicacoes);
  const [confirmado, setConfirmado] = useState(false);
  const [rodando, setRodando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Acumulado | null>(null);
  const [aba, setAba] = useState<Aba>("inserir");

  const executar = async (dryRun: boolean) => {
    setResultado(null);
    let acumulado: Acumulado | null = null;
    let offset = 0;
    try {
      for (let bloco = 1; ; bloco++) {
        setRodando(`${dryRun ? "Simulando" : "Aplicando"} bloco ${bloco}…`);
        const r = await chamar(c.aplicar, { entrada: { dryRun, limite: LOTE, offset } });
        acumulado = somar(acumulado, r);
        setResultado(acumulado);
        if (!r.temMais) break;
        offset += dryRun ? LOTE : 0;
      }
      toast.success(dryRun ? "Simulação concluída (nada foi gravado)" : "Aplicação concluída");
    } catch (e) {
      toast.error("Não foi possível concluir", { description: mensagemAmigavel(e) });
    } finally {
      setRodando(null);
      setConfirmado(false);
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
    }
  };

  const abas: { valor: Aba; rotulo: string }[] = resultado
    ? [
        { valor: "inserir", rotulo: `Inserir (${resultado.totais.inserir})` },
        { valor: "atualizar", rotulo: `Atualizar (${resultado.totais.atualizar})` },
        { valor: "ocorrencias", rotulo: `Ocorrências (${resultado.totais.ocorrencias})` },
        { valor: "ignorados", rotulo: `Ignorados (${resultado.totais.ignorados})` },
        { valor: "romaneio_036", rotulo: `Romaneio 036 (${resultado.romaneio036 ?? 0})` },
      ]
    : [];

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Aplica as linhas da staging nos CT-e e nas ocorrências, em blocos de{" "}
        {LOTE.toLocaleString("pt-BR")} CT-e. A simulação mostra o que mudaria sem gravar nada.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          disabled={rodando !== null}
          onClick={() => void executar(true)}
        >
          Simular (não grava)
        </Button>
        <label className="flex items-center gap-2 text-[12px]">
          <Checkbox
            checked={confirmado}
            onCheckedChange={(v) => {
              setConfirmado(v === true);
            }}
            disabled={rodando !== null}
          />
          Confirmo a aplicação à produção
        </label>
        <Button
          size="sm"
          disabled={!confirmado || rodando !== null}
          onClick={() => void executar(false)}
        >
          Aplicar à produção
        </Button>
        {rodando && (
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {rodando}
          </span>
        )}
      </div>

      {resultado && (
        <div className="space-y-3">
          <p className="text-[12px] text-muted-foreground">
            {resultado.dryRun ? "Simulação" : "Aplicação"} em {resultado.blocos} bloco(s)
            {!resultado.dryRun && ` · ${resultado.pendentes} CT-e ainda na fila`}
          </p>
          <Abas abas={abas} ativa={aba} aoMudar={setAba} />
          {aba === "inserir" && (
            <TabelaDados
              colunas={[
                { chave: "chave", titulo: "CT-e", classe: "font-mono" },
                { chave: "dataEmissao", titulo: "Emissão", formato: "data" },
                { chave: "previsao", titulo: "Previsão", formato: "data" },
              ]}
              linhas={resultado.inserir}
              chaveDaLinha={(l) => l.chave}
              porPagina={25}
              mensagemVazia="Nenhum CT-e novo."
            />
          )}
          {aba === "atualizar" && (
            <TabelaDados
              colunas={[
                { chave: "chave", titulo: "CT-e", classe: "font-mono" },
                { chave: "campos", titulo: "Campos", valor: (l) => l.campos.join(", ") },
              ]}
              linhas={resultado.atualizar}
              chaveDaLinha={(l) => l.chave}
              porPagina={25}
              mensagemVazia="Nenhum CT-e para atualizar."
            />
          )}
          {aba === "ocorrencias" && (
            <TabelaDados
              colunas={[
                { chave: "chave", titulo: "CT-e", classe: "font-mono" },
                { chave: "codigo", titulo: "Código", formato: "inteiro" },
                { chave: "dataHora", titulo: "Data/hora", formato: "datahora" },
              ]}
              linhas={resultado.ocorrencias}
              chaveDaLinha={(l) => `${l.chave}-${l.codigo}-${l.dataHora}`}
              porPagina={25}
              mensagemVazia="Nenhuma ocorrência nova."
            />
          )}
          {aba === "ignorados" && (
            <TabelaDados
              colunas={[
                { chave: "motivo", titulo: "Motivo" },
                { chave: "chave", titulo: "CT-e", classe: "font-mono" },
              ]}
              linhas={resultado.ignorados}
              chaveDaLinha={(l) => `${l.motivo}-${l.chave}`}
              porPagina={25}
              mensagemVazia="Nenhum CT-e ignorado."
            />
          )}
          {aba === "romaneio_036" && (
            <p className="text-[12px]">
              {resultado.romaneio036 === null
                ? "O romaneio pelo 036 roda no último bloco."
                : `${resultado.romaneio036} CT-e com romaneio/ocorrência do 036 ${resultado.dryRun ? "a atualizar" : "atualizados"}.`}
            </p>
          )}
        </div>
      )}

      <TabelaDados
        titulo="Histórico das aplicações"
        colunas={[
          { chave: "iniciadoEm", titulo: "Início", formato: "datahora" },
          {
            chave: "simulacao",
            titulo: "Tipo",
            valor: (a) => (a.simulacao ? "Simulação" : "Aplicação"),
          },
          {
            chave: "status",
            titulo: "Situação",
            celula: (a) => <SeloStatus status={a.status} />,
            valor: (a) => a.status,
          },
          { chave: "totalInseridos", titulo: "Inseridos", formato: "inteiro" },
          { chave: "totalAtualizados", titulo: "Atualizados", formato: "inteiro" },
          { chave: "totalOcorrencias", titulo: "Ocorrências", formato: "inteiro" },
          { chave: "totalIgnorados", titulo: "Ignorados", formato: "inteiro" },
          { chave: "erro", titulo: "Erro", classe: "max-w-[280px] truncate" },
        ]}
        linhas={historico.data?.aplicacoes ?? []}
        chaveDaLinha={(a) => a.id}
        carregando={historico.isLoading}
        erro={historico.error}
        aoTentarDeNovo={() => void historico.refetch()}
        mensagemVazia="Nenhuma aplicação registrada."
        porPagina={10}
      />
    </div>
  );
}
