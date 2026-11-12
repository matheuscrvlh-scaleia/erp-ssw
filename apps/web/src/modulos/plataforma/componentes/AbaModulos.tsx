import { moduloVigente } from "@erp/dominio/acesso";
import { type ModuloDaEmpresa } from "@erp/shared/contratos/plataforma";
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/datas";
import { formatarDataHora } from "@erp/shared/formatacao";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { CAMPO } from "@/componentes/comum/CamposDeFormulario";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { Button } from "@/componentes/ui/button";
import { Switch } from "@/componentes/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { useGravacao } from "@/hooks/use-gravacao";
import { cn } from "@/lib/utils";

import { mutacaoSalvarModulo } from "../api";
import { Carregando } from "./Carregando";

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
                  <th className={CABECALHO}>Início</th>
                  <th className={CABECALHO}>Fim</th>
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
        <input
          type="date"
          aria-label={`Início de ${modulo.nome}`}
          className={cn(PEQUENO, "w-[150px] tabular-nums")}
          value={m.inicio ?? ""}
          disabled={bloqueado}
          onChange={(e) => {
            setM({ ...m, inicio: e.target.value || null });
          }}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          aria-label={`Fim de ${modulo.nome}`}
          className={cn(PEQUENO, "w-[150px] tabular-nums")}
          value={m.fim ?? ""}
          disabled={bloqueado}
          onChange={(e) => {
            setM({ ...m, fim: e.target.value || null });
          }}
        />
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
