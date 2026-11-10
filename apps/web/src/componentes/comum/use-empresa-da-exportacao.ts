import { useQuery } from "@tanstack/react-query";

import { consultaAcesso } from "@/acesso/sessao";
import { type EmpresaExportacao } from "@/lib/exportacao";

/** Sem empresa ativa (ex.: Plataforma), o arquivo sai com a marca neutra do painel. */
const MARCA_NEUTRA: EmpresaExportacao = { nome: "Painel BI" };

/** Marca da empresa ativa para os arquivos exportados (o acesso já está em cache no layout). */
export function useEmpresaDaExportacao(): EmpresaExportacao {
  const { data } = useQuery(consultaAcesso);
  return data?.empresa ?? MARCA_NEUTRA;
}
