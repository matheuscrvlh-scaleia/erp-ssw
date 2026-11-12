import { type IntegracaoDaEmpresa } from "@erp/shared/contratos/plataforma";
import { formatarDataHora } from "@erp/shared/formatacao";
import { INFO_DA_INTEGRACAO } from "@erp/shared/plataforma";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { Button } from "@/componentes/ui/button";
import { Switch } from "@/componentes/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { useGravacao } from "@/hooks/use-gravacao";

import { mutacaoDefinirSegredo, mutacaoSalvarIntegracao } from "../api";
import { parametrosEditados } from "../regras";
import { paraTexto } from "../textos";
import { CampoDeSegredo } from "./CampoDeSegredo";
import { CampoDoParametro } from "./CampoDoParametro";

export function CartaoDeIntegracao({
  empresaId,
  integracao,
}: {
  empresaId: string;
  integracao: IntegracaoDaEmpresa;
}) {
  const fuso = useFusoDaEmpresa();
  const info = INFO_DA_INTEGRACAO[integracao.tipo];
  const [ativo, setAtivo] = useState(integracao.ativo);
  const [valores, setValores] = useState<Record<string, string>>({});
  useEffect(() => {
    setAtivo(integracao.ativo);
    setValores(
      Object.fromEntries(
        info.campos.map((c) => [c.chave, paraTexto(integracao.parametros[c.chave])]),
      ),
    );
  }, [integracao, info]);

  const cliente = useQueryClient();
  const salvar = useGravacao({
    mutacao: mutacaoSalvarIntegracao(cliente, empresaId, integracao.tipo),
    sucesso: `${info.nome} salvo`,
  });
  const gravarSegredo = useGravacao({
    mutacao: mutacaoDefinirSegredo(cliente, empresaId, integracao.tipo),
    sucesso: (valor) => `${info.segredo ?? "Segredo"} ${valor ? "atualizado" : "removido"}`,
  });

  const conhecidas = new Set(info.campos.map((c) => c.chave));
  const extras = Object.entries(integracao.parametros).filter(([k]) => !conhecidas.has(k));

  return (
    <Painel
      titulo={info.nome}
      descricao={info.descricao}
      acoes={
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <SeloStatus tom={ativo ? "sucesso" : "neutro"}>
            {ativo ? "Ligada" : "Desligada"}
          </SeloStatus>
          <Switch checked={ativo} onCheckedChange={setAtivo} aria-label={`Ligar ${info.nome}`} />
        </label>
      }
      classeDoCorpo="space-y-4 p-5"
      rodape={
        <>
          {info.tela ? (
            <a
              href={info.tela}
              className="mr-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Tela da integração
            </a>
          ) : (
            <span className="mr-auto" />
          )}
          <Button
            size="sm"
            disabled={salvar.gravando}
            onClick={() =>
              void salvar.gravar({
                ativo,
                parametros: parametrosEditados(integracao.parametros, info.campos, valores),
              })
            }
          >
            {salvar.gravando ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {integracao.ultimoTesteEm ? (
          <span title={integracao.ultimoTesteMsg ?? undefined}>
            <SeloStatus tom={integracao.ultimoTesteOk ? "sucesso" : "erro"}>
              {`Último teste ${integracao.ultimoTesteOk ? "ok" : "com erro"} em ${formatarDataHora(integracao.ultimoTesteEm, fuso, { virgula: true })}`}
            </SeloStatus>
          </span>
        ) : (
          <SeloStatus tom="neutro">Nunca testada</SeloStatus>
        )}
        {!integracao.configurada && <SeloStatus tom="alerta">Não configurada</SeloStatus>}
      </div>
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
      {extras.length > 0 && (
        <dl className="space-y-0.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {extras.map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-semibold">{k}:</dt>{" "}
              <dd className="inline">{paraTexto(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {info.segredo && (
        <CampoDeSegredo
          rotulo={info.segredo}
          definidoEm={integracao.segredoDefinidoEm}
          gravando={gravarSegredo.gravando}
          aoGravar={gravarSegredo.gravar}
        />
      )}
    </Painel>
  );
}
