import { type LinhaDeColeta } from "@erp/shared/contracts/pickups";
import { formatarDataHora } from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";

import { CampoDetalhe, GradeDetalhe } from "@/components/common/Detail";
import { MensagemErro } from "@/components/common/ErrorMessage";

import { consultaDetalhe } from "../api";
import { ROTULO_DA_ETAPA, ROTULO_DO_PRAZO } from "../texts";

/** Conteúdo da gaveta da coleta: carrega o detalhe e o histórico do SSW ao abrir. */
export function DetalheDaColeta({ coleta, fuso }: { coleta: LinhaDeColeta; fuso: string }) {
  const detalhe = useQuery(consultaDetalhe(coleta.unidade, coleta.numero));
  const d = detalhe.data;
  return (
    <>
      <GradeDetalhe>
        <CampoDetalhe rotulo="Situação" valor={ROTULO_DA_ETAPA[coleta.etapa]} />
        <CampoDetalhe rotulo="Prazo" valor={ROTULO_DO_PRAZO[coleta.statusPrazo].texto} />
        <CampoDetalhe rotulo="Cadastro" valor={formatarDataHora(coleta.cadastradaEm, fuso)} />
        <CampoDetalhe rotulo="Cadastrada por" valor={d?.cadastradaPor ?? null} />
        <CampoDetalhe
          rotulo="Comandada em"
          valor={d ? formatarDataHora(d.comandadaEm, fuso) : null}
        />
        <CampoDetalhe rotulo="Limite" valor={formatarDataHora(coleta.limiteEm, fuso)} />
        <CampoDetalhe
          rotulo="Limite inicial"
          valor={d ? formatarDataHora(d.limiteInicial, fuso) : null}
        />
        <CampoDetalhe rotulo="Coletada em" valor={formatarDataHora(coleta.coletadaEm, fuso)} />
        <CampoDetalhe rotulo="Solicitante" valor={coleta.solicitante} />
        <CampoDetalhe rotulo="Remetente" valor={coleta.remetenteNome} />
        <CampoDetalhe rotulo="Cidade coleta" valor={coleta.remetenteCidade} />
        <CampoDetalhe rotulo="Destino" valor={coleta.destinoCidade} />
        <CampoDetalhe rotulo="Motorista" valor={coleta.motorista} />
        <CampoDetalhe rotulo="Placa" valor={coleta.placa} />
        <CampoDetalhe rotulo="Setor" valor={d?.setor ?? null} />
        <CampoDetalhe rotulo="Romaneio" valor={d?.romaneio ?? null} />
        <CampoDetalhe rotulo="Mercadoria" valor={d?.mercadoria ?? null} />
        <CampoDetalhe
          rotulo="CT-e gerado"
          valor={coleta.cteNumero ? `${coleta.cteSigla ?? ""} ${coleta.cteNumero}`.trim() : null}
        />
      </GradeDetalhe>
      {d?.observacao && (
        <p className="rounded-lg bg-muted p-3 text-[13px] whitespace-pre-line">{d.observacao}</p>
      )}
      <section>
        <h3 className="label-xs mb-2">Histórico no SSW</h3>
        {detalhe.isLoading && <p className="text-[13px] text-muted-foreground">Carregando…</p>}
        {detalhe.error && <MensagemErro erro={detalhe.error} />}
        <ol className="space-y-2 text-[13px]">
          {d?.historico.map((e, i) => (
            <li key={i} className="border-l-2 border-brand/40 pl-3">
              <span className="text-xs text-muted-foreground">
                {formatarDataHora(e.em, fuso)} · {e.unidade} · {e.usuario}
              </span>
              <p>{e.texto}</p>
            </li>
          ))}
        </ol>
        {d && (
          <p className="mt-3 text-xs text-muted-foreground">
            Posição do relatório 050 de {formatarDataHora(d.relatorioEmitidoEm, fuso)}
          </p>
        )}
      </section>
    </>
  );
}
