import { type PainelDeComprovantes } from "@erp/shared/contracts/delivery-proofs";

import { type ColunaTabela } from "@/components/common/data-table";
import { TabelaDados } from "@/components/common/DataTable";

type LinhaResumo = Omit<PainelDeComprovantes["porUnidade"][number], "unidade"> & {
  chave: string;
};

const colunasDoResumo = (coluna: string): ColunaTabela<LinhaResumo>[] => [
  { chave: "chave", titulo: coluna, classe: "font-mono" },
  { chave: "entregues", titulo: "Entregues", formato: "inteiro" },
  { chave: "digitalizados", titulo: "Digitalizados", formato: "inteiro" },
  { chave: "pendentes", titulo: "Pendentes", formato: "inteiro" },
  { chave: "pct", titulo: "%", formato: "percentual" },
];

/** Resumo por unidade e por tipo de documento, lado a lado. */
export function TabelasDeResumo({
  porUnidade,
  porTipoDocumento,
  carregando,
  subtitulo,
}: {
  porUnidade: PainelDeComprovantes["porUnidade"];
  porTipoDocumento: PainelDeComprovantes["porTipoDocumento"];
  carregando: boolean;
  subtitulo: string;
}) {
  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      <TabelaDados
        titulo="Por unidade"
        colunas={colunasDoResumo("Unidade")}
        linhas={porUnidade.map((u) => ({ ...u, chave: u.unidade }))}
        chaveDaLinha={(l) => l.chave}
        carregando={carregando}
        porPagina={0}
        exportacao={{
          arquivo: "comprovantes-por-unidade",
          titulo: "Comprovantes por unidade",
          subtitulo,
        }}
      />
      <TabelaDados
        titulo="Por tipo de documento"
        colunas={colunasDoResumo("Tipo")}
        linhas={porTipoDocumento.map((t) => ({
          ...t,
          chave: t.tipoDocumento,
        }))}
        chaveDaLinha={(l) => l.chave}
        carregando={carregando}
        porPagina={0}
        exportacao={{
          arquivo: "comprovantes-por-tipo",
          titulo: "Comprovantes por tipo de documento",
          subtitulo,
        }}
      />
    </div>
  );
}
