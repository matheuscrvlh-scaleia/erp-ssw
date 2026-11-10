import {
  type Configuracao,
  contratosAdmin as c,
  GRUPOS_DE_CONFIGURACAO,
  type GrupoDeConfiguracao,
} from "@erp/shared/contratos/admin";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";

import { CHAVES, consultaConfiguracoes } from "../api";
import { CabecalhoDaPagina, CAMPO, useGravacao } from "../comum";
import { SecaoPrazos } from "./SecaoPrazos";

const ROTULO_DO_GRUPO: Record<GrupoDeConfiguracao, string> = {
  performance: "Performance",
  operacional: "Operacional",
  ranking: "Ranking",
  notificacoes: "Notificações",
};

const DESCRICAO_DO_GRUPO: Record<GrupoDeConfiguracao, string> = {
  performance: "Metas de SLA e taxa de devolução usadas nas telas de performance e dashboard.",
  operacional: "Thresholds do dia a dia (romaneio, alertas de CT-e parado).",
  ranking: "Faixas usadas para colorir e categorizar equipes no ranking.",
  notificacoes: "Programação de envios automáticos (WhatsApp).",
};

const ROTULO_DA_CHAVE: Record<string, string> = {
  sla_meta_pct: "Meta de SLA geral (%)",
  sla_alerta_amarelo_pct: "SLA para alerta amarelo (%)",
  sla_alerta_vermelho_pct: "SLA para alerta vermelho (%)",
  taxa_retorno_meta_pct: "Taxa máxima de devolução (%)",
  romaneio_peso_critico_kg: 'Peso mínimo para "Carga Pesada" (kg)',
  romaneio_volume_critico: 'Volumes mínimos para "Alto Volume"',
  alerta_dias_sem_movimento: "Dias sem movimento para alerta crítico",
  atrasos_excluir_responsabilidades: "Responsabilidades excluídas dos alertas de atraso (CSV)",
  ranking_threshold_positivo_pct: "Ranking · destaque positivo (%)",
  ranking_threshold_atencao_pct: "Ranking · atenção (%)",
  ranking_threshold_critico_pct: "Ranking · crítico (%)",
  whatsapp_horario_envio: "Horário de envio do WhatsApp",
  alerta_queda_sla_pp: "Alerta · queda de SLA (p.p.)",
  alerta_janela_tendencia_dias: "Alerta · janela de tendência (dias)",
  alerta_janela_vencimento_h: "Alerta · janela de vencimento (horas)",
  alerta_min_vencimento: "Alerta · volume mínimo vencendo",
  alerta_nascido_atrasado: "Alerta · volume mínimo saiu para entrega com prazo vencido",
  alerta_desvio_finsistema_pp: "Alerta · desvio finalizado em sistema (p.p.)",
  alerta_dias_sem_atualizacao: "Alerta · dias sem atualização",
  parceiros_estrategicos: "Parceiros estratégicos (UUIDs separados por vírgula)",
};

const DICA_DE_TEXTO: Record<string, string> = {
  whatsapp_horario_envio: "HH:MM",
  atrasos_excluir_responsabilidades: "cliente,destinatario",
  parceiros_estrategicos: "uuid1,uuid2,...",
};

export function PaginaConfiguracoes() {
  const consulta = useQuery(consultaConfiguracoes);
  const salvar = useGravacao({
    executar: ({ grupo, itens }: { grupo: GrupoDeConfiguracao; itens: Configuracao[] }) =>
      chamar(c.salvarConfiguracoes, {
        parametros: { grupo },
        entrada: { itens: itens.map((i) => ({ chave: i.chave, valor: i.valor })) },
      }),
    sucesso: "Configurações atualizadas",
    invalidar: [CHAVES.configuracoes, CHAVES.publicas],
  });
  const configuracoes = consulta.data?.configuracoes ?? [];

  return (
    <div className="space-y-6">
      <CabecalhoDaPagina
        titulo="Configurações"
        descricao="Ajuste thresholds e parâmetros usados em todo o sistema. As mudanças propagam em até 5 minutos (ou imediatamente após salvar)."
      />
      {consulta.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {consulta.error && (
        <MensagemErro
          erro={consulta.error}
          titulo="Não foi possível carregar as configurações"
          aoTentarDeNovo={() => void consulta.refetch()}
        />
      )}
      <div className="grid gap-5">
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
        <SecaoPrazos />
      </div>
    </div>
  );
}

export function SecaoDoGrupo({
  grupo,
  itens,
  salvando,
  aoSalvar,
}: {
  grupo: GrupoDeConfiguracao;
  itens: Configuracao[];
  salvando: boolean;
  aoSalvar: (itens: Configuracao[]) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  // Volta ao que está gravado quando a lista muda (depois de salvar ou recarregar).
  useEffect(() => {
    setValores(Object.fromEntries(itens.map((i) => [i.chave, i.valor])));
  }, [itens]);
  const alterado = itens.some((i) => (valores[i.chave] ?? i.valor) !== i.valor);

  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="space-y-1.5 p-6 pb-3">
        <h2 className="text-[15px] font-medium">{ROTULO_DO_GRUPO[grupo]}</h2>
        <p className="text-[12px] text-muted-foreground">{DESCRICAO_DO_GRUPO[grupo]}</p>
      </header>
      <div className="space-y-5 p-6 pt-3">
        {itens.map((i) => {
          const dica = DICA_DE_TEXTO[i.chave];
          return (
            <div
              key={i.chave}
              className="grid gap-1.5 md:grid-cols-[minmax(0,1fr)_180px] md:items-start md:gap-4"
            >
              <div className="space-y-1">
                <label htmlFor={`cfg-${i.chave}`} className="text-[13px] font-medium">
                  {ROTULO_DA_CHAVE[i.chave] ?? i.chave}
                </label>
                <p className="text-[12px] text-muted-foreground">{i.descricao}</p>
                <p className="font-mono text-[11px] text-muted-foreground/70">{i.chave}</p>
              </div>
              <input
                id={`cfg-${i.chave}`}
                className={`${CAMPO} md:mt-0.5`}
                inputMode={dica ? "text" : "decimal"}
                placeholder={dica}
                value={valores[i.chave] ?? i.valor}
                onChange={(e) => {
                  const valor = e.target.value;
                  setValores((v) => ({ ...v, [i.chave]: valor }));
                }}
              />
            </div>
          );
        })}
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            disabled={!alterado || salvando}
            onClick={() => {
              aoSalvar(itens.map((i) => ({ ...i, valor: valores[i.chave] ?? i.valor })));
            }}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </section>
  );
}
