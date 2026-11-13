import { type IntegracaoDaEmpresa } from "@erp/shared/contracts/platform";
import { formatarDataHora } from "@erp/shared/formatting";
import { INFO_DA_INTEGRACAO, ROTULO_DA_SITUACAO_DA_INTEGRACAO } from "@erp/shared/platform";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { Painel } from "@/components/common/Panel";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { useGravacao } from "@/hooks/use-save";

import { mutacaoDefinirSegredo, mutacaoSalvarIntegracao } from "../api";
import { parametrosEditados } from "../rules";
import { paraTexto, TOM_DA_SITUACAO_DA_INTEGRACAO } from "../texts";
import { CampoDoParametro } from "./ParameterField";
import { CampoDeSegredo } from "./SecretField";

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

  const conexao = integracao.ultimaConexao;
  const dado = integracao.ultimoDado;
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
        {!info.semMonitoramento && (
          <SeloStatus tom={TOM_DA_SITUACAO_DA_INTEGRACAO[integracao.situacao]}>
            {ROTULO_DA_SITUACAO_DA_INTEGRACAO[integracao.situacao]}
          </SeloStatus>
        )}
        {!integracao.configurada && <SeloStatus tom="alerta">Não configurada</SeloStatus>}
      </div>
      {!info.semMonitoramento && (
        <dl className="space-y-1 rounded-lg bg-muted px-3 py-2 text-[13px]">
          <div>
            <dt className="inline text-muted-foreground">Última conexão: </dt>
            <dd className="inline">
              {conexao ? (
                <>
                  {formatarDataHora(conexao.em, fuso, { virgula: true })} ·{" "}
                  <span className={conexao.ok ? "text-status-good-fg" : "text-status-bad-fg"}>
                    {conexao.ok ? "ok" : "com erro"}
                  </span>
                  {conexao.mensagem && (
                    <span className="block text-xs text-muted-foreground">{conexao.mensagem}</span>
                  )}
                </>
              ) : (
                "nenhuma registrada"
              )}
            </dd>
          </div>
          {info.ultimoDado && (
            <div>
              <dt className="inline text-muted-foreground">{info.ultimoDado}: </dt>
              <dd className="inline">
                {dado
                  ? `${formatarDataHora(dado.em, fuso, { virgula: true })}${dado.detalhe ? ` · ${dado.detalhe}` : ""}`
                  : "nenhum ainda"}
              </dd>
            </div>
          )}
        </dl>
      )}
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
