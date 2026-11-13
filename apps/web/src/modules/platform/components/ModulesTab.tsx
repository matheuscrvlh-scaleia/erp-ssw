import { moduloVigente } from "@erp/domain/access";
import { type ModuloDaEmpresa } from "@erp/shared/contracts/platform";
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/dates";
import { formatarData, formatarDataHora } from "@erp/shared/formatting";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { CAMPO } from "@/components/common/FormFields";
import { Painel } from "@/components/common/Panel";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { useGravacao } from "@/hooks/use-save";
import { cn } from "@/lib/utils";

import { mutacaoSalvarModulo } from "../api";
import { Carregando } from "./Loading";

/** Campo compacto das linhas de tabela (datas e observação dos módulos). */
const PEQUENO = cn(CAMPO, "h-8");

const CABECALHO = "px-4 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.04em] uppercase";

export function AbaModulos({
  empresaId,
  modulos,
  carregando,
  erro,
}: {
  empresaId: string;
  modulos: readonly ModuloDaEmpresa[] | undefined;
  carregando: boolean;
  erro: unknown;
}) {
  return (
    <Painel
      titulo="Módulos"
      descricao="Módulo vale se estiver ligado e dentro do prazo (dia de Brasília). Os essenciais valem sempre. Módulo desligado some do menu e a tela mostra o aviso."
    >
      {carregando || erro ? (
        <div className="p-4">
          <Carregando carregando={carregando} erro={erro} />
        </div>
      ) : (
        modulos && (
          <div className="rolagem-fina overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/70 text-muted-foreground">
                  <th className={CABECALHO}>Módulo</th>
                  <th className={CABECALHO}>Ligado</th>
                  <th className={CABECALHO}>Vigência</th>
                  <th className={CABECALHO}>Observação</th>
                  <th className={CABECALHO}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {modulos.map((m) => (
                  <LinhaDoModulo key={m.chave} empresaId={empresaId} modulo={m} />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </Painel>
  );
}

function LinhaDoModulo({ empresaId, modulo }: { empresaId: string; modulo: ModuloDaEmpresa }) {
  const [m, setM] = useState(modulo);
  useEffect(() => {
    setM(modulo);
  }, [modulo]);
  const alterado =
    m.ativo !== modulo.ativo ||
    m.inicio !== modulo.inicio ||
    m.fim !== modulo.fim ||
    (m.observacao ?? "") !== (modulo.observacao ?? "");
  const cliente = useQueryClient();
  const salvar = useGravacao({
    mutacao: mutacaoSalvarModulo(cliente, empresaId),
    sucesso: `Módulo ${modulo.nome} salvo`,
  });

  const fuso = useFusoDaEmpresa();
  const hoje = hojeNoFuso(fuso);
  const dias = modulo.fim ? diferencaEmDias(hoje, modulo.fim) : null;
  const bloqueado = modulo.essencial;

  return (
    <tr
      className={cn(
        "border-b border-border align-top last:border-b-0 hover:bg-muted/60",
        alterado && "bg-accent hover:bg-accent",
      )}
    >
      <td className="px-4 py-3">
        <div className="font-semibold">{modulo.nome}</div>
        {modulo.descricao && (
          <div className="text-xs text-muted-foreground">{modulo.descricao}</div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {modulo.essencial ? (
            <SeloStatus tom="neutro">Essencial · sempre ligado</SeloStatus>
          ) : moduloVigente(modulo, hoje) ? (
            <SeloStatus tom="sucesso">Liberado</SeloStatus>
          ) : (
            <SeloStatus tom="neutro">Não liberado</SeloStatus>
          )}
          {!modulo.essencial && modulo.ativo && dias !== null && dias >= 0 && dias <= 15 && (
            <SeloStatus tom="alerta">
              {dias === 0 ? "Vence hoje" : `Vence em ${String(dias)} dia${dias === 1 ? "" : "s"}`}
            </SeloStatus>
          )}
          {!modulo.essencial && dias !== null && dias < 0 && (
            <SeloStatus tom="erro">Vencido</SeloStatus>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Switch
          checked={bloqueado || m.ativo}
          disabled={bloqueado}
          onCheckedChange={(ativo) => {
            setM({ ...m, ativo });
          }}
          aria-label={`Ligar ${modulo.nome}`}
        />
      </td>
      <td className="px-4 py-3">
        {!bloqueado && (
          <Vigencia
            modulo={m}
            gravando={salvar.gravando}
            aoLiberar={async (inicio, fim) => {
              const liberado = { ...m, ativo: true, inicio, fim };
              const ok = await salvar.gravar(liberado);
              if (ok) setM(liberado);
              return ok;
            }}
          />
        )}
      </td>
      <td className="px-4 py-3">
        <input
          aria-label={`Observação de ${modulo.nome}`}
          className={cn(PEQUENO, "min-w-[180px]")}
          placeholder="Ex.: teste de 30 dias"
          value={m.observacao ?? ""}
          disabled={bloqueado}
          onChange={(e) => {
            setM({ ...m, observacao: e.target.value });
          }}
        />
        {modulo.atualizadoEm && (
          <div className="mt-1 text-xs text-muted-foreground">
            Alterado em {formatarDataHora(modulo.atualizadoEm, fuso, { virgula: true })}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {!bloqueado && (
          <Button
            size="sm"
            variant={alterado ? "default" : "outline"}
            disabled={!alterado || salvar.gravando}
            onClick={() => void salvar.gravar(m)}
          >
            Salvar
          </Button>
        )}
      </td>
    </tr>
  );
}

/** Resumo do prazo no botão do calendário. */
function resumoDoPrazo(inicio: string | null, fim: string | null): string {
  if (inicio && fim) return `${formatarData(inicio)} – ${formatarData(fim)}`;
  if (fim) return `Até ${formatarData(fim)}`;
  if (inicio) return `Desde ${formatarData(inicio)}`;
  return "Sem prazo";
}

/**
 * Prazo do módulo atrás do ícone do calendário: abre com o início, o fim e o botão Liberar, que
 * liga o módulo com essas datas e salva.
 */
function Vigencia({
  modulo,
  gravando,
  aoLiberar,
}: {
  modulo: ModuloDaEmpresa;
  gravando: boolean;
  aoLiberar: (inicio: string | null, fim: string | null) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState(modulo.inicio);
  const [fim, setFim] = useState(modulo.fim);
  const invertido = Boolean(inicio && fim && fim < inicio);
  return (
    <Popover
      open={aberto}
      onOpenChange={(abrir) => {
        if (abrir) {
          setInicio(modulo.inicio);
          setFim(modulo.fim);
        }
        setAberto(abrir);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="tabular-nums"
          aria-label={`Prazo de ${modulo.nome}`}
        >
          <CalendarDays aria-hidden />
          {resumoDoPrazo(modulo.inicio, modulo.fim)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="text-[13px] font-semibold">Prazo de {modulo.nome}</div>
        <label className="block space-y-1 text-[13px] font-medium">
          <span>Início</span>
          <input
            type="date"
            className={cn(PEQUENO, "tabular-nums")}
            value={inicio ?? ""}
            onChange={(e) => {
              setInicio(e.target.value || null);
            }}
          />
        </label>
        <label className="block space-y-1 text-[13px] font-medium">
          <span>Fim</span>
          <input
            type="date"
            className={cn(PEQUENO, "tabular-nums")}
            value={fim ?? ""}
            onChange={(e) => {
              setFim(e.target.value || null);
            }}
          />
        </label>
        {invertido && (
          <p role="alert" className="text-xs font-medium text-status-bad-fg">
            O fim vem antes do início.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Sem datas, o módulo vale sem prazo. A empresa é avisada 7, 5, 2 e 1 dia antes do fim.
        </p>
        <Button
          className="w-full"
          disabled={gravando || invertido}
          onClick={() => {
            void aoLiberar(inicio, fim).then((ok) => {
              if (ok) setAberto(false);
            });
          }}
        >
          {gravando ? "Liberando…" : "Liberar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
