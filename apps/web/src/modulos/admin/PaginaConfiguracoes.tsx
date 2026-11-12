import { GRUPOS_DE_CONFIGURACAO } from "@erp/shared/contratos/admin";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Skeleton } from "@/componentes/ui/skeleton";
import { useGravacao } from "@/hooks/use-gravacao";

import {
  consultaConfiguracoes,
  consultaPrazos,
  mutacaoExcluirPrazo,
  mutacaoLigarPrazo,
  mutacaoSalvarConfiguracoes,
  mutacaoSalvarPrazo,
} from "./api";
import { SecaoDoGrupo } from "./componentes/SecaoDoGrupo";
import { SecaoPrazos } from "./componentes/SecaoPrazos";
import { avisoDoRecalculo } from "./textos";

export function PaginaConfiguracoes() {
  const cliente = useQueryClient();
  const consulta = useQuery(consultaConfiguracoes);
  const salvar = useGravacao({
    mutacao: mutacaoSalvarConfiguracoes(cliente),
    sucesso: "Configurações atualizadas",
  });
  const configuracoes = consulta.data?.configuracoes ?? [];

  const prazos = useQuery(consultaPrazos);
  const salvarPrazo = useGravacao({
    mutacao: mutacaoSalvarPrazo(cliente),
    sucesso: (_, r) => `Regra salva. ${avisoDoRecalculo(r)}`,
  });
  const ligarPrazo = useGravacao({
    mutacao: mutacaoLigarPrazo(cliente),
    sucesso: ({ ativo }, r) => `Regra ${ativo ? "ativada" : "desativada"}. ${avisoDoRecalculo(r)}`,
  });
  const excluirPrazo = useGravacao({
    mutacao: mutacaoExcluirPrazo(cliente),
    sucesso: (_, r) => `Regra removida. ${avisoDoRecalculo(r)}`,
  });

  return (
    <Pagina
      largura="estreita"
      titulo="Configurações"
      descricao="Ajuste thresholds e parâmetros usados em todo o sistema. As mudanças propagam em até 5 minutos (ou imediatamente após salvar)."
    >
      {consulta.error && (
        <Painel>
          <MensagemErro
            erro={consulta.error}
            titulo="Não foi possível carregar as configurações"
            aoTentarDeNovo={() => void consulta.refetch()}
          />
        </Painel>
      )}
      {consulta.isLoading && (
        <Painel titulo="Carregando…" classeDoCorpo="space-y-4 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_200px] md:gap-6">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-1/2 bg-muted" />
                <Skeleton className="h-3 w-3/4 bg-muted" />
              </div>
              <Skeleton className="h-9 bg-muted" />
            </div>
          ))}
        </Painel>
      )}
      {GRUPOS_DE_CONFIGURACAO.map((grupo) => {
        const itens = configuracoes.filter((x) => x.grupo === grupo);
        return itens.length === 0 ? null : (
          <SecaoDoGrupo
            key={grupo}
            grupo={grupo}
            itens={itens}
            salvando={salvar.gravando}
            aoSalvar={(alterados) => void salvar.gravar({ grupo, itens: alterados })}
          />
        );
      })}
      <SecaoPrazos
        consulta={prazos}
        salvar={salvarPrazo}
        ligar={ligarPrazo}
        excluir={excluirPrazo}
      />
    </Pagina>
  );
}
