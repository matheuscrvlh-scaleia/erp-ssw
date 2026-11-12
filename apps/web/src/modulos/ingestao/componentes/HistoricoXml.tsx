/** Histórico dos XML importados (últimos 50) e a fila de órfãos, com o reprocessamento. */
import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosIngestao } from "@erp/shared/contratos/ingestao";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileClock, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SeloDaSituacao } from "@/componentes/comum/SeloDaSituacao";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { mutacaoReprocessarOrfaos } from "../api";
import { dataHora } from "../textos";

export function HistoricoXml({
  dados,
  carregando,
  erro,
  aoTentarDeNovo,
}: {
  dados: SaidaDe<typeof contratosIngestao.arquivosXml> | undefined;
  carregando: boolean;
  erro: Error | null;
  aoTentarDeNovo: () => void;
}) {
  const queryClient = useQueryClient();
  const reprocessarOrfaos = useMutation(mutacaoReprocessarOrfaos(queryClient));
  const [reprocessando, setReprocessando] = useState(false);
  const orfaos = dados?.orfaos;

  const reprocessar = () => {
    setReprocessando(true);
    reprocessarOrfaos.mutate({
      aoTerminar: (r, e) => {
        if (r)
          toast.success(`${r.casados} de ${r.tentados} XML órfão(s) casado(s)`, {
            description:
              r.expirados > 0 ? `${r.expirados} expirado(s) (mais de 5 dias).` : undefined,
          });
        else toast.error("Não foi possível reprocessar", { description: mensagemAmigavel(e) });
        setReprocessando(false);
      },
    });
  };

  return (
    <TabelaDados
      titulo="Histórico (últimas 50)"
      acoes={
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          {orfaos && (
            <SeloStatus
              tom={orfaos.pendentes > 0 ? "alerta" : "neutro"}
              icone={FileClock}
              className="h-auto min-h-6 rounded-xl py-0.5 [&>span]:whitespace-normal"
            >
              {orfaos.pendentes} XML aguardando o CT-e
              {orfaos.maisAntigo && ` (mais antigo ${dataHora(orfaos.maisAntigo)})`}
            </SeloStatus>
          )}
          <Button size="sm" variant="outline" disabled={reprocessando} onClick={reprocessar}>
            {reprocessando ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <RefreshCw aria-hidden />
            )}
            Reprocessar
          </Button>
        </div>
      }
      colunas={[
        { chave: "criadoEm", titulo: "Data", formato: "datahora", classe: "whitespace-nowrap" },
        { chave: "nomeArquivo", titulo: "Arquivo", classe: "font-mono max-w-[300px] truncate" },
        { chave: "tipo", titulo: "Tipo" },
        {
          chave: "status",
          titulo: "Situação",
          celula: (a) => <SeloDaSituacao status={a.status} />,
          valor: (a) => a.status,
        },
        { chave: "ctesProcessados", titulo: "CT-e", formato: "inteiro" },
        { chave: "cancelamentos", titulo: "Cancelamentos", formato: "inteiro" },
        { chave: "xmlsPulados", titulo: "Já importados", formato: "inteiro" },
        { chave: "erroMensagem", titulo: "Erro", classe: "max-w-[280px] truncate" },
      ]}
      linhas={dados?.arquivos ?? []}
      chaveDaLinha={(a) => a.id}
      carregando={carregando}
      erro={erro}
      aoTentarDeNovo={aoTentarDeNovo}
      mensagemVazia="Nenhum XML importado ainda."
      porPagina={0}
    />
  );
}
