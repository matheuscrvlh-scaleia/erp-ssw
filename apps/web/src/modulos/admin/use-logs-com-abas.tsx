import { useState } from "react";

import { Abas } from "@/componentes/comum/Abas";

import { useAlteracoes } from "./use-alteracoes";
import { useIntegracoes } from "./use-integracoes";

type AbaDosLogs = "alteracoes" | "integracoes";

const ABAS_DOS_LOGS: readonly { valor: AbaDosLogs; rotulo: string }[] = [
  { valor: "alteracoes", rotulo: "Alterações" },
  { valor: "integracoes", rotulo: "Integrações" },
];

/**
 * Admin › Logs da empresa ativa, com as abas Alterações e Integrações (decisão Q31: a aba
 * Integrações segue o papel na empresa ativa).
 */
export function useLogsComAbas() {
  const [aba, setAba] = useState<AbaDosLogs>("alteracoes");
  const alteracoes = useAlteracoes("empresa", aba === "alteracoes");
  const integracoes = useIntegracoes({ ativo: aba === "integracoes" });
  const atual = aba === "alteracoes" ? alteracoes : integracoes;
  return {
    abas: <Abas abas={ABAS_DOS_LOGS} valor={aba} aoMudar={setAba} rotulo="Tipo de log" />,
    filtros: atual.filtros,
    conteudo: atual.conteudo,
  };
}
