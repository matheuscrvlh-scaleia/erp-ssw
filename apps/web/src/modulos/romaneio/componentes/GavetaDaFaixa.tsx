import { type CteDaFaixa } from "@erp/shared/contratos/romaneio";
import { formatarInteiro } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";

import { DrawerDetalhe } from "@/componentes/comum/Detalhe";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { ordenarPorPlaca } from "@/componentes/comum/ordenar-por-placa";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { useAbrirCte } from "@/hooks/use-abrir-cte";
import { COLUNA_LINK_SSW, urlCtrcNoSsw } from "@/lib/exportacao";

import { consultaCtesDoDia } from "../api";
import { entradaDaHoje, type FiltrosHoje } from "../regras";
import { cidadeUf, type Faixa, ROTULO_FAIXA } from "../textos";

type CteDaGaveta = CteDaFaixa & { cidadeUf: string | null };

const COLUNAS_DA_GAVETA: readonly ColunaTabela<CteDaGaveta>[] = [
  { chave: "numeroNf", titulo: "NF", classe: "font-mono text-[12px]" },
  { chave: "numero", titulo: "CT-e", classe: "font-mono text-[12px]" },
  { chave: "romaneio", titulo: "Romaneio", classe: "font-mono text-[12px]" },
  { chave: "destinatario", titulo: "Destinatário" },
  { chave: "pagador", titulo: "Pagador" },
  { chave: "cidadeUf", titulo: "Cidade/UF" },
  { chave: "dataEmissao", titulo: "Emissão", formato: "data" },
  { chave: "dataPrevista", titulo: "Prazo", formato: "data" },
  { chave: "status", titulo: "Situação" },
  { chave: "placa", titulo: "Placa", classe: "font-mono text-[12px]" },
];

/** Gaveta lateral com os CT-e da faixa clicada. */
export function GavetaDaFaixa({
  faixa,
  somenteEmRota,
  filtros,
  aoFechar,
}: {
  faixa: Faixa | null;
  /** Só os ainda não entregues (os do card "Em rota de entrega"). */
  somenteEmRota: boolean;
  filtros: FiltrosHoje;
  aoFechar: () => void;
}) {
  const abrirCte = useAbrirCte();
  const q = useQuery({
    ...consultaCtesDoDia({
      faixa: faixa ?? "todas",
      apenasNaoEntregues: somenteEmRota,
      ...entradaDaHoje(filtros),
    }),
    enabled: faixa !== null,
  });
  // Ordena por placa (vazias no fim), a mesma ordem do arquivo exportado.
  const linhas = ordenarPorPlaca(
    (q.data?.linhas ?? []).map((l) => ({ ...l, cidadeUf: cidadeUf(l.cidadeDestino, l.ufDestino) })),
    [{ chave: "placa", titulo: "Placa" }],
  );
  const total = q.data?.total ?? 0;
  const rotulo = faixa ? ROTULO_FAIXA[faixa] : "";
  return (
    <DrawerDetalhe
      aberto={faixa !== null}
      aoFechar={aoFechar}
      largura="larga"
      titulo={`${rotulo}${somenteEmRota ? " · em rota" : ""}${q.data ? ` · ${formatarInteiro(total)} CT-e` : ""}`}
      descricao={`${
        somenteEmRota
          ? "CT-e desta faixa que ainda não foram entregues, inclusive os que receberam ocorrência depois da saída."
          : "CT-e dos romaneios emitidos hoje nesta faixa de prazo, em qualquer status."
      }${
        q.data && total > q.data.limite
          ? ` Mostrando os ${formatarInteiro(q.data.limite)} primeiros de ${formatarInteiro(total)}.`
          : ""
      }`}
      acoes={
        <ExportMenu
          arquivo="romaneio-hoje-faixa"
          titulo={`Romaneio · ${rotulo || "faixa de prazo"}`}
          subtitulo={rotulo}
          colunas={[
            { chave: "numeroNf", titulo: "NF" },
            { chave: "numero", titulo: "CT-e" },
            { chave: "romaneio", titulo: "Romaneio" },
            { chave: "destinatario", titulo: "Destinatário" },
            { chave: "pagador", titulo: "Pagador" },
            { chave: "cidadeUf", titulo: "Cidade/UF" },
            { chave: "dataEmissao", titulo: "Emissão", formato: "data" },
            { chave: "dataPrevista", titulo: "Prazo", formato: "data" },
            { chave: "status", titulo: "Situação" },
            { chave: "placa", titulo: "Placa" },
            { chave: "linkSsw", titulo: COLUNA_LINK_SSW },
          ]}
          linhas={linhas.map((l) => ({
            ...l,
            linkSsw: urlCtrcNoSsw(l.sigla, l.numero, l.dataEmissao),
          }))}
          soIcone
        />
      }
    >
      <TabelaDados
        colunas={COLUNAS_DA_GAVETA}
        linhas={linhas}
        chaveDaLinha={(l) => `${l.sigla ?? ""}-${l.numero}-${l.romaneio ?? ""}`}
        aoClicarLinha={(l) => {
          abrirCte(l.numero);
        }}
        carregando={q.isLoading}
        erro={q.error}
        aoTentarDeNovo={() => void q.refetch()}
        mensagemVazia="Nenhum CT-e nesta faixa."
        porPagina={0}
        rotuloTotal={(n) => `${formatarInteiro(n)} CT-e`}
      />
    </DrawerDetalhe>
  );
}
