import { type SaidaDe } from "@erp/shared/contract";
import { type contratosPerformance } from "@erp/shared/contracts/performance";
import { FileBarChart, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ExportMenu } from "@/components/common/ExportMenu";
import { Button } from "@/components/ui/button";

import { COLUNAS_DA_EXPORTACAO } from "../export";
import { ComoFuncionaPerformance } from "./PerformanceHowItWorks";

/** Ações do cabeçalho: como funciona, Atualizar, Exportar e o botão do relatório de período. */
export function AcoesDaPerformance({
  otifVisivel,
  nomeCurto,
  atualizando,
  aoAtualizar,
  arquivo,
  subtitulo,
  exportar,
  relatorioAberto,
  aoAlternarRelatorio,
}: {
  otifVisivel: boolean;
  nomeCurto: string;
  atualizando: boolean;
  aoAtualizar: () => void;
  arquivo: string;
  subtitulo: string;
  exportar: () => Promise<SaidaDe<typeof contratosPerformance.exportacao>>;
  relatorioAberto: boolean;
  aoAlternarRelatorio: () => void;
}) {
  return (
    <>
      <ComoFuncionaPerformance otifVisivel={otifVisivel} nomeCurto={nomeCurto} />
      <Button size="sm" variant="ghost" onClick={aoAtualizar} disabled={atualizando}>
        <RefreshCw className={atualizando ? "animate-spin" : undefined} aria-hidden />
        Atualizar
      </Button>
      <ExportMenu
        arquivo={arquivo}
        titulo="Performance"
        subtitulo={subtitulo}
        colunas={COLUNAS_DA_EXPORTACAO}
        linhas={[]}
        carregarLinhas={async () => {
          const r = await exportar();
          if (r.truncado)
            toast.warning("Arquivo limitado aos primeiros 10.000 CT-e. Reduza o período.");
          return r.linhas;
        }}
        desabilitado={atualizando}
        className="h-8"
      />
      <Button size="sm" onClick={aoAlternarRelatorio}>
        <FileBarChart aria-hidden />
        {relatorioAberto ? "Fechar relatório" : "Relatório de período"}
      </Button>
    </>
  );
}
