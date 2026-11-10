import { useQuery } from "@tanstack/react-query";

import { consultaAcesso } from "@/acesso/sessao";
import { SeloAtualizacao } from "@/componentes/comum/SeloAtualizacao";

import { consultaAtualizacaoDosDados } from "./api";

/**
 * Última aplicação dos arquivos do SSW na empresa ativa (e XML aguardando, só para a Plataforma).
 * Uma consulta para todas as telas: mesma chave, renovada a cada 60 s.
 */
export function useAtualizacaoDosDados() {
  const { data: acesso } = useQuery(consultaAcesso);
  const empresa = acesso?.empresa ?? null;
  const { data } = useQuery({
    ...consultaAtualizacaoDosDados(empresa?.id ?? ""),
    enabled: empresa !== null,
  });
  return {
    atualizadoEm: data?.atualizadoEm,
    xmlAguardando: data?.xmlAguardando ?? undefined,
    fuso: empresa?.fuso,
  };
}

/**
 * "Dados atualizados em…" das telas de CT-e. `mostrarXml` liga o chip de XML aguardando (no
 * sistema atual só no Prazo do parceiro e no Relatório de período).
 * origem: components/common/SyncStatusBadge.tsx (sistema atual)
 */
export function SeloDosDados({
  mostrarXml = false,
  className = "mt-0.5",
}: {
  mostrarXml?: boolean;
  className?: string;
}) {
  const { atualizadoEm, xmlAguardando, fuso } = useAtualizacaoDosDados();
  return (
    <SeloAtualizacao
      atualizadoEm={atualizadoEm}
      xmlAguardando={mostrarXml ? xmlAguardando : undefined}
      fuso={fuso}
      className={className}
    />
  );
}
