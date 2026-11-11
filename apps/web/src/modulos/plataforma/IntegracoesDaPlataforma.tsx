import {
  contratosPlataforma as p,
  type IntegracaoDaPlataforma,
  type ValorDeParametro,
} from "@erp/shared/contratos/plataforma";
import { formatarDataHora } from "@erp/shared/formatacao";
import { INFO_DA_INTEGRACAO_PLATAFORMA } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Button } from "@/componentes/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { CabecalhoDaPagina, CAMPO, useGravacao } from "@/modulos/admin/comum";

import { parametrosEditados } from "./AbasDaEmpresa";
import { CHAVES_DA_PLATAFORMA, consultaIntegracoesDaPlataforma } from "./api";

const paraTexto = (v: ValorDeParametro | undefined) =>
  v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v);

/** Plataforma › Integrações: domínio, e-mail (Resend) e worker-ssw, iguais para todas as empresas. */
export function PaginaIntegracoesDaPlataforma() {
  const consulta = useQuery(consultaIntegracoesDaPlataforma);
  return (
    <div className="space-y-6">
      <CabecalhoDaPagina
        titulo="Integrações"
        descricao="Configurações da Plataforma que valem para todas as empresas. Senhas e chaves ficam cifradas; salvar vale em segundos, sem reiniciar o sistema."
      />
      {consulta.isLoading && <p className="text-[12px] text-muted-foreground">Carregando…</p>}
      {consulta.error && <MensagemErro erro={consulta.error} />}
      <div className="grid gap-4 lg:grid-cols-2">
        {consulta.data?.integracoes.map((i) => (
          <CartaoDaPlataforma key={i.tipo} integracao={i} />
        ))}
      </div>
    </div>
  );
}

function CartaoDaPlataforma({ integracao }: { integracao: IntegracaoDaPlataforma }) {
  const fuso = useFusoDaEmpresa();
  const info = INFO_DA_INTEGRACAO_PLATAFORMA[integracao.tipo];
  const [valores, setValores] = useState<Record<string, string>>({});
  const [segredo, setSegredo] = useState("");
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
  // O segredo vai cifrado para o banco; o campo nunca mostra o valor gravado.
  const gravarSegredo = useGravacao({
    executar: (valor: string) =>
      chamar(p.definirSegredoDaPlataforma, {
        parametros: { tipo: integracao.tipo },
        entrada: { segredo: valor },
      }),
    sucesso: (valor) => `${info.segredo ?? "Segredo"} ${valor ? "atualizado" : "removido"}`,
    invalidar,
    aoConcluir: () => {
      setSegredo("");
    },
  });
  const testar = useGravacao({
    executar: (para: string) => chamar(p.testarEmailDaPlataforma, { entrada: { para } }),
    sucesso: (para) => `E-mail de teste enviado para ${para}`,
    invalidar: [],
  });

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      <div>
        <h3 className="text-[14px] font-medium">{info.nome}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{info.descricao}</p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar.gravar(undefined);
        }}
      >
        {info.campos.map((c) => (
          <label key={c.chave} className="block space-y-1">
            <span className="text-[12px] font-medium">{c.rotulo}</span>
            <input
              className={`${CAMPO} h-8 text-[12px]`}
              placeholder={c.dica}
              value={valores[c.chave] ?? ""}
              onChange={(e) => {
                const valor = e.target.value;
                setValores((v) => ({ ...v, [c.chave]: valor }));
              }}
            />
          </label>
        ))}
        <Button size="sm" type="submit" disabled={salvar.gravando}>
          Salvar
        </Button>
      </form>
      {info.segredo && (
        <div className="space-y-1 border-t border-border/60 pt-3">
          <label className="block space-y-1">
            <span className="text-[12px] font-medium">{info.segredo}</span>
            <input
              type="password"
              autoComplete="new-password"
              className={`${CAMPO} h-8 text-[12px]`}
              value={segredo}
              placeholder={
                integracao.segredoDefinidoEm ? "•••••••• (digite para trocar)" : "Não definido"
              }
              onChange={(e) => {
                setSegredo(e.target.value);
              }}
            />
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!segredo.trim() || gravarSegredo.gravando}
              onClick={() => void gravarSegredo.gravar(segredo)}
            >
              Gravar
            </Button>
            {integracao.segredoDefinidoEm && (
              <Button
                size="sm"
                variant="ghost"
                disabled={gravarSegredo.gravando}
                onClick={() => {
                  if (window.confirm(`Remover ${info.segredo ?? "o segredo"}?`)) {
                    void gravarSegredo.gravar("");
                  }
                }}
              >
                Remover
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <KeyRound className="h-3 w-3" />
            {integracao.segredoDefinidoEm
              ? `Guardado cifrado em ${formatarDataHora(integracao.segredoDefinidoEm, fuso, { virgula: true })}`
              : "Não definido."}
          </div>
        </div>
      )}
      {integracao.tipo === "email" && (
        <form
          className="flex items-center gap-2 border-t border-border/60 pt-3"
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
            className={`${CAMPO} h-8 text-[12px]`}
          />
          <Button
            size="sm"
            variant="outline"
            type="submit"
            className="gap-1.5"
            disabled={testar.gravando}
          >
            <Send className="h-3.5 w-3.5" />
            Testar
          </Button>
        </form>
      )}
    </section>
  );
}
