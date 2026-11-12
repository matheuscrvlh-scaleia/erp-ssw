import {
  contratosPlataforma as p,
  type IntegracaoDaPlataforma,
} from "@erp/shared/contratos/plataforma";
import { INFO_DA_INTEGRACAO_PLATAFORMA } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { Globe, type LucideIcon, Mail, Send, Server } from "lucide-react";
import { useEffect, useState } from "react";

import { CAMPO } from "@/componentes/comum/CamposDeFormulario";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Skeleton } from "@/componentes/ui/skeleton";
import { useGravacao } from "@/hooks/use-gravacao";
import { chamar } from "@/lib/api";

import { CampoDeSegredo, CampoDoParametro, parametrosEditados, paraTexto } from "./AbasDaEmpresa";
import { CHAVES_DA_PLATAFORMA, consultaIntegracoesDaPlataforma } from "./api";

const ICONE_DA_INTEGRACAO: Record<IntegracaoDaPlataforma["tipo"], LucideIcon> = {
  dominio: Globe,
  email: Mail,
  worker_ssw: Server,
};

/**
 * Plataforma › Configurações › Integrações: domínio, e-mail (Resend) e worker-ssw, iguais para
 * todas as empresas.
 */
export function PaginaIntegracoesDaPlataforma() {
  const consulta = useQuery(consultaIntegracoesDaPlataforma);
  return (
    <Pagina
      titulo="Integrações"
      descricao="Configurações da Plataforma que valem para todas as empresas. Senhas e chaves ficam cifradas; salvar vale em segundos, sem reiniciar o sistema."
    >
      {consulta.isLoading && (
        <div role="status" aria-label="Carregando…" className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl bg-muted" />
          <Skeleton className="h-56 rounded-2xl bg-muted" />
        </div>
      )}
      {consulta.error && (
        <Painel>
          <MensagemErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
        </Painel>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {consulta.data?.integracoes.map((i) => (
          <CartaoDaPlataforma key={i.tipo} integracao={i} />
        ))}
      </div>
    </Pagina>
  );
}

function CartaoDaPlataforma({ integracao }: { integracao: IntegracaoDaPlataforma }) {
  const info = INFO_DA_INTEGRACAO_PLATAFORMA[integracao.tipo];
  const [valores, setValores] = useState<Record<string, string>>({});
  const [paraTeste, setParaTeste] = useState("");
  useEffect(() => {
    setValores(
      Object.fromEntries(
        info.campos.map((c) => [c.chave, paraTexto(integracao.parametros[c.chave])]),
      ),
    );
  }, [integracao, info]);

  const invalidar = [CHAVES_DA_PLATAFORMA.integracoes];
  const salvar = useGravacao({
    executar: () =>
      chamar(p.salvarIntegracaoDaPlataforma, {
        parametros: { tipo: integracao.tipo },
        entrada: { parametros: parametrosEditados(integracao.parametros, info.campos, valores) },
      }),
    sucesso: `${info.nome} salvo`,
    invalidar,
  });
  const gravarSegredo = useGravacao({
    executar: (valor: string) =>
      chamar(p.definirSegredoDaPlataforma, {
        parametros: { tipo: integracao.tipo },
        entrada: { segredo: valor },
      }),
    sucesso: (valor) => `${info.segredo ?? "Segredo"} ${valor ? "atualizado" : "removido"}`,
    invalidar,
  });
  const testar = useGravacao({
    executar: (para: string) => chamar(p.testarEmailDaPlataforma, { entrada: { para } }),
    sucesso: (para) => `E-mail de teste enviado para ${para}`,
    invalidar: [],
  });

  return (
    <Painel
      titulo={info.nome}
      descricao={info.descricao}
      icone={ICONE_DA_INTEGRACAO[integracao.tipo]}
      classeDoCorpo="space-y-4 p-5"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar.gravar(undefined);
        }}
      >
        {info.campos.map((c) => (
          <CampoDoParametro
            key={c.chave}
            rotulo={c.rotulo}
            dica={c.dica}
            valor={valores[c.chave] ?? ""}
            aoMudar={(valor) => {
              setValores((v) => ({ ...v, [c.chave]: valor }));
            }}
          />
        ))}
        <div className="flex justify-end">
          <Button size="sm" type="submit" disabled={salvar.gravando}>
            Salvar
          </Button>
        </div>
      </form>
      {info.segredo && (
        <CampoDeSegredo
          rotulo={info.segredo}
          definidoEm={integracao.segredoDefinidoEm}
          gravando={gravarSegredo.gravando}
          aoGravar={gravarSegredo.gravar}
        />
      )}
      {integracao.tipo === "email" && (
        <form
          className="flex items-center gap-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (paraTeste.trim()) void testar.gravar(paraTeste.trim());
          }}
        >
          <input
            type="email"
            aria-label="E-mail para o teste"
            placeholder="Enviar um teste para…"
            value={paraTeste}
            onChange={(e) => {
              setParaTeste(e.target.value);
            }}
            className={CAMPO}
          />
          <Button
            size="sm"
            variant="outline"
            type="submit"
            className="h-9"
            disabled={testar.gravando}
          >
            <Send aria-hidden />
            Testar
          </Button>
        </form>
      )}
    </Painel>
  );
}
