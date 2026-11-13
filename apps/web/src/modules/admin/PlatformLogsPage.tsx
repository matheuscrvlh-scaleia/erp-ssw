import { useQuery } from "@tanstack/react-query";

import { Pagina } from "@/components/layout/Page";
import { consultaEmpresas } from "@/modules/platform/api";

import { useAlteracoes } from "./use-changes";

/** Plataforma › Logs: as alterações de todas as empresas e da Plataforma. */
export function PaginaLogsDaPlataforma() {
  const empresas = useQuery(consultaEmpresas);
  const alteracoes = useAlteracoes({
    empresas: (empresas.data?.empresas ?? []).map((e) => ({ id: e.id, nome: e.nome })),
  });
  return (
    <Pagina
      titulo="Logs"
      descricao="O que mudou em todas as empresas e na Plataforma, quem mudou e quando. Clique numa linha para ver o antes e o depois."
      filtros={alteracoes.filtros}
    >
      {alteracoes.conteudo}
    </Pagina>
  );
}
