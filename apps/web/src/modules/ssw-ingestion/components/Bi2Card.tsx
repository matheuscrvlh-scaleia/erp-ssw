import { type SincronizacaoBi2 } from "@erp/shared/contracts/ssw-ingestion";
import { formatarData, formatarDataHora, formatarInteiro } from "@erp/shared/formatting";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type ColunaTabela, TabelaDados } from "@/components/common/DataTable";
import { MensagemErro } from "@/components/common/ErrorMessage";
import { Painel } from "@/components/common/Panel";
import { SeloDaSituacao } from "@/components/common/SituationBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mensagemAmigavel } from "@/lib/error-message";

import { consultaBi2, mutacaoRodarBi2 } from "../api";

const COLUNAS_DO_BI2: ColunaTabela<SincronizacaoBi2>[] = [
  { chave: "iniciadoEm", titulo: "Início", formato: "datahora", classe: "whitespace-nowrap" },
  { chave: "dataAlvo", titulo: "Data", formato: "data" },
  { chave: "modo", titulo: "Modo" },
  {
    chave: "status",
    titulo: "Status",
    celula: (s) => <SeloDaSituacao status={s.status} />,
    valor: (s) => s.status,
  },
  { chave: "totalLinhas", titulo: "Linhas", formato: "inteiro" },
  { chave: "atualizados", titulo: "Atualizados", formato: "inteiro" },
  { chave: "erro", titulo: "Erro", classe: "max-w-[320px] truncate" },
];

/** BI2 0017: última execução, rodar uma data específica e as últimas execuções. */
export function CartaoBi2() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaBi2);
  const [data, setData] = useState("");
  const rodar = useMutation({
    ...mutacaoRodarBi2(queryClient, (r) => {
      if (r.pendente) toast.info("BI2 0017 enfileirado. O resultado aparece aqui ao terminar.");
      else
        toast.success(
          `BI2 0017 concluído · ${formatarInteiro(r.resultado?.atualizados ?? 0)} CT-e atualizado(s)`,
        );
    }),
    onError: (e) =>
      toast.error("Não foi possível rodar o BI2", { description: mensagemAmigavel(e) }),
  });
  const ultima = consulta.data?.ultima ?? null;

  return (
    <Painel
      icone={Database}
      titulo="SSW BI2 (0017)"
      descricao="cron contínuo às :12 e :42, lookback de 2 dias"
      classeDoCorpo="space-y-4 p-5"
    >
      <p className="text-[13px] text-muted-foreground">
        Atualiza entrega, previsão e prazo dos CT-e pelo relatório 0017. O BI2 nunca altera CT-e em
        andamento; depois da entrega, só o ajuste de prazo entra.
      </p>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {consulta.error ? (
          <MensagemErro
            erro={consulta.error}
            titulo="Não foi possível carregar o BI2"
            aoTentarDeNovo={() => void consulta.refetch()}
            className="items-start py-0 text-left"
          />
        ) : ultima ? (
          <div className="min-w-0 space-y-1.5">
            <div className="label-xs">Última execução</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] tabular-nums">
              <span className="font-semibold">{formatarDataHora(ultima.iniciadoEm)}</span>
              <SeloDaSituacao status={ultima.status} />
              <span className="text-muted-foreground">
                data {formatarData(ultima.dataAlvo)} · {formatarInteiro(ultima.totalLinhas)}{" "}
                linha(s) · {formatarInteiro(ultima.atualizados)} atualizado(s)
              </span>
            </div>
            {ultima.erro && <p className="text-[13px] text-status-bad-fg">{ultima.erro}</p>}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhuma execução registrada ainda.</p>
        )}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (data) rodar.mutate(data);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bi2-data" className="text-[13px]">
              Data específica
            </Label>
            <Input
              id="bi2-data"
              type="date"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
              }}
              className="h-9 w-[170px]"
            />
          </div>
          <Button type="submit" disabled={!data || rodar.isPending}>
            <Play aria-hidden />
            {rodar.isPending ? "Rodando…" : "Rodar data específica"}
          </Button>
        </form>
      </div>
      <TabelaDados
        titulo="Últimas execuções"
        colunas={COLUNAS_DO_BI2}
        linhas={consulta.data?.recentes ?? []}
        chaveDaLinha={(s) => `${s.iniciadoEm}-${s.dataAlvo}-${s.modo}`}
        carregando={consulta.isLoading}
        mensagemVazia="Nenhuma execução registrada ainda."
        porPagina={0}
        embutida
      />
    </Painel>
  );
}
