import { type IntegracaoDaPlataforma } from "@erp/shared/contracts/platform";
import { INFO_DA_INTEGRACAO_PLATAFORMA } from "@erp/shared/platform";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, type LucideIcon, Mail, Send, Server } from "lucide-react";
import { useEffect, useState } from "react";

import { CAMPO } from "@/components/common/FormFields";
import { Painel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { useGravacao } from "@/hooks/use-save";

import {
  mutacaoDefinirSegredoDaPlataforma,
  mutacaoSalvarIntegracaoDaPlataforma,
  mutacaoTestarEmailDaPlataforma,
} from "../api";
import { parametrosEditados } from "../rules";
import { paraTexto } from "../texts";
import { CampoDoParametro } from "./ParameterField";
import { CampoDeSegredo } from "./SecretField";

const ICONE_DA_INTEGRACAO: Record<IntegracaoDaPlataforma["tipo"], LucideIcon> = {
  dominio: Globe,
  email: Mail,
  worker_ssw: Server,
};

/** Uma integração da Plataforma: parâmetros, segredo e, no e-mail, o envio de teste. */
export function CartaoDaPlataforma({ integracao }: { integracao: IntegracaoDaPlataforma }) {
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

  const cliente = useQueryClient();
  const salvar = useGravacao({
    mutacao: mutacaoSalvarIntegracaoDaPlataforma(cliente, integracao.tipo),
    sucesso: `${info.nome} salvo`,
  });
  const gravarSegredo = useGravacao({
    mutacao: mutacaoDefinirSegredoDaPlataforma(cliente, integracao.tipo),
    sucesso: (valor) => `${info.segredo ?? "Segredo"} ${valor ? "atualizado" : "removido"}`,
  });
  const testar = useGravacao({
    mutacao: mutacaoTestarEmailDaPlataforma(),
    sucesso: (para) => `E-mail de teste enviado para ${para}`,
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
          void salvar.gravar({
            parametros: parametrosEditados(integracao.parametros, info.campos, valores),
          });
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
