import {
  type Configuracao,
  contratosAdmin as c,
  type GrupoDeConfiguracao,
  GRUPOS_DE_CONFIGURACAO,
} from "@erp/shared/contratos/admin";
import { useQuery } from "@tanstack/react-query";
import { Bell, Gauge, type LucideIcon, Trophy, Truck } from "lucide-react";
import { useEffect, useState } from "react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Skeleton } from "@/componentes/ui/skeleton";
import { chamar } from "@/lib/api";

import { CHAVES, consultaConfiguracoes } from "../api";
import { CAMPO, useGravacao } from "../comum";
import { SecaoPrazos } from "./SecaoPrazos";

const ROTULO_DO_GRUPO: Record<GrupoDeConfiguracao, string> = {
  performance: "Performance",
  operacional: "Operacional",
  ranking: "Ranking",
  notificacoes: "Notificações",
};

const ICONE_DO_GRUPO: Record<GrupoDeConfiguracao, LucideIcon> = {
  performance: Gauge,
  operacional: Truck,
  ranking: Trophy,
  notificacoes: Bell,
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
      <SecaoPrazos />
    </Pagina>
  );
}

function SecaoDoGrupo({
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
    <Painel
      titulo={ROTULO_DO_GRUPO[grupo]}
      descricao={DESCRICAO_DO_GRUPO[grupo]}
      icone={ICONE_DO_GRUPO[grupo]}
      classeDoCorpo="divide-y divide-border"
      rodape={
        <>
          <span className="flex-1 text-[12.5px]">{alterado && "Alterações não salvas."}</span>
          <Button
            size="sm"
            disabled={!alterado || salvando}
            onClick={() => {
              aoSalvar(itens.map((i) => ({ ...i, valor: valores[i.chave] ?? i.valor })));
            }}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      {itens.map((i) => {
        const dica = DICA_DE_TEXTO[i.chave];
        return (
          <div
            key={i.chave}
            className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_200px] md:items-start md:gap-6"
          >
            <div className="space-y-1">
              <label htmlFor={`cfg-${i.chave}`} className="text-[13px] font-semibold">
                {ROTULO_DA_CHAVE[i.chave] ?? i.chave}
              </label>
              <p className="text-[12.5px] text-muted-foreground">{i.descricao}</p>
              <p className="font-mono text-xs text-muted-foreground">{i.chave}</p>
            </div>
            <input
              id={`cfg-${i.chave}`}
              className={`${CAMPO} tabular-nums`}
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
    </Painel>
  );
}
