import { type SincronizacaoBi2 } from "@erp/shared/contratos/ingestao-ssw";

import { SeloDaSituacao } from "@/componentes/comum/SeloDaSituacao";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";

const COLUNAS_DAS_SINCRONIZACOES: ColunaTabela<SincronizacaoBi2>[] = [
  { chave: "relatorio", titulo: "Relatório", classe: "font-mono" },
  { chave: "iniciadoEm", titulo: "Início", formato: "datahora", classe: "whitespace-nowrap" },
  { chave: "finalizadoEm", titulo: "Fim", formato: "datahora", classe: "whitespace-nowrap" },
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

export function CartaoSincronizacoes({
  linhas,
  carregando,
}: {
  linhas: SincronizacaoBi2[];
  carregando: boolean;
}) {
  return (
    <TabelaDados
      titulo="Últimas sincronizações do BI2"
      colunas={COLUNAS_DAS_SINCRONIZACOES}
      linhas={linhas}
      chaveDaLinha={(s) => `${s.relatorio}-${s.iniciadoEm}-${s.dataAlvo}`}
      carregando={carregando}
      mensagemVazia="Nenhuma sincronização registrada ainda."
      porPagina={0}
    />
  );
}
