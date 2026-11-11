import { diferencaEmDias, ehDataIso, hojeNoFuso, somarDias } from "@erp/shared/datas";
import { formatarDataHora } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { Fingerprint, RefreshCw, Search, UserRound } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { LinhasCarregando } from "@/componentes/comum/LinhasCarregando";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Select, SelectContent, SelectItem } from "@/componentes/ui/select";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { CampoRotulado, CLASSE_DO_CAMPO, GatilhoRotulado } from "../ranking/campos-do-filtro";
import { consultaBatidas, consultaFuncionarios } from "./api";
import { ComoFuncionaPonto } from "./ComoFuncionaPonto";

const TIPO_LABEL: Record<string, string> = {
  ORIGINAL: "Original",
  MANUAL: "Manual",
  ONLINE: "Online",
  DELETADA: "Deletada",
};

function periodoDeBatidasValido(inicio: string, fim: string): boolean {
  return ehDataIso(inicio) && ehDataIso(fim) && fim >= inicio && diferencaEmDias(inicio, fim) <= 30;
}

/** origem: features/ahgora/components/AhgoraPontoScreen.tsx (sistema atual) */
export function BatidasPorColaborador({ abas }: { abas: ReactNode }) {
  const [busca, setBusca] = useState("");
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const fuso = useFusoDaEmpresa();
  const [inicio, setInicio] = useState(() => somarDias(hojeNoFuso(fuso), -7));
  const [fim, setFim] = useState(() => hojeNoFuso(fuso));

  const funcionariosQ = useQuery(consultaFuncionarios);
  const funcionarios = useMemo(() => funcionariosQ.data ?? [], [funcionariosQ.data]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return funcionarios;
    return funcionarios.filter(
      (f) =>
        f.name.toLowerCase().includes(termo) ||
        f.register.toLowerCase().includes(termo) ||
        (f.cpf?.includes(termo) ?? false),
    );
  }, [funcionarios, busca]);

  const selecionado = funcionarios.find((f) => f.id === funcionarioId) ?? null;
  const periodoValido = periodoDeBatidasValido(inicio, fim);
  const batidasQ = useQuery(consultaBatidas(funcionarioId, inicio, fim, periodoValido));

  return (
    <Pagina
      titulo="Marcações de ponto (Ahgora)"
      descricao="Consulta em tempo real das batidas de ponto registradas no Ahgora, por colaborador e período (máximo 30 dias)."
      acoes={<ComoFuncionaPonto />}
      abas={abas}
      filtros={
        <>
          <FiltrosAvancados>
            <CampoRotulado rotulo="Buscar colaborador" htmlFor="ponto-busca">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                id="ponto-busca"
                className={cn(CLASSE_DO_CAMPO, "w-48 placeholder:text-muted-foreground")}
                placeholder="Nome, matrícula ou CPF"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                }}
              />
            </CampoRotulado>
            <Select value={funcionarioId ?? undefined} onValueChange={setFuncionarioId}>
              <GatilhoRotulado rotulo="Colaborador" placeholder="Selecione" className="max-w-96" />
              <SelectContent>
                {filtrados.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} — {f.register}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CampoRotulado rotulo="De" htmlFor="ponto-de">
              <input
                id="ponto-de"
                type="date"
                className={CLASSE_DO_CAMPO}
                value={inicio}
                onChange={(e) => {
                  setInicio(e.target.value);
                }}
              />
            </CampoRotulado>
            <CampoRotulado rotulo="Até" htmlFor="ponto-ate">
              <input
                id="ponto-ate"
                type="date"
                className={CLASSE_DO_CAMPO}
                value={fim}
                onChange={(e) => {
                  setFim(e.target.value);
                }}
              />
            </CampoRotulado>
            <Button
              variant="outline"
              onClick={() => void batidasQ.refetch()}
              disabled={!funcionarioId || !periodoValido || batidasQ.isFetching}
            >
              <RefreshCw
                className={cn(batidasQ.isFetching && "motion-safe:animate-spin")}
                aria-hidden
              />
              Consultar
            </Button>
          </FiltrosAvancados>
          {!periodoValido && (
            <p role="alert" className="text-xs text-status-bad-fg">
              Selecione um período válido de até 30 dias (data final não pode ser anterior à
              inicial).
            </p>
          )}
          {funcionariosQ.error && (
            <p role="alert" className="text-xs text-status-bad-fg">
              {mensagemAmigavel(funcionariosQ.error)}
            </p>
          )}
        </>
      }
    >
      {selecionado && (
        <Painel classeDoCorpo="flex flex-wrap items-center gap-2 px-5 py-3.5">
          <UserRound className="h-4 w-4 text-brand" aria-hidden />
          <span className="text-[15px] font-bold">{selecionado.name}</span>
          <SeloStatus tom="neutro" semIcone>
            matrícula {selecionado.register}
          </SeloStatus>
          {selecionado.department && (
            <SeloStatus tom="neutro" semIcone>
              {selecionado.department}
            </SeloStatus>
          )}
          {selecionado.jobTitle && (
            <SeloStatus tom="neutro" semIcone>
              {selecionado.jobTitle}
            </SeloStatus>
          )}
          {selecionado.terminationDate && <SeloStatus tom="erro">demitido</SeloStatus>}
        </Painel>
      )}

      <Painel
        titulo="Batidas no período"
        acoes={
          batidasQ.data && (
            <span className="text-[12.5px] text-muted-foreground">
              {batidasQ.data.data.length} registro(s)
            </span>
          )
        }
      >
        {!funcionarioId ? (
          <EstadoVazio
            icone={Fingerprint}
            mensagem="Selecione um colaborador para consultar as batidas."
          />
        ) : batidasQ.error ? (
          <MensagemErro erro={batidasQ.error} aoTentarDeNovo={() => void batidasQ.refetch()} />
        ) : batidasQ.isLoading || (batidasQ.data && batidasQ.data.data.length > 0) ? (
          <div className="rolagem-fina relative overflow-x-auto rounded-b-xl">
            <table className={CLASSE_TABELA}>
              <thead>
                <tr className={CLASSE_CABECALHO}>
                  <th scope="col" className={CLASSE_TH}>
                    Data/hora
                  </th>
                  <th scope="col" className={CLASSE_TH}>
                    Tipo
                  </th>
                  <th scope="col" className={CLASSE_TH}>
                    Dispositivo
                  </th>
                  <th scope="col" className={CLASSE_TH}>
                    Localização
                  </th>
                  <th scope="col" className={CLASSE_TH}>
                    Motivo
                  </th>
                </tr>
              </thead>
              <tbody>
                {batidasQ.isLoading && <LinhasCarregando linhas={5} colunas={5} />}
                {(batidasQ.data?.data ?? []).map((b, i) => (
                  <tr key={`${b.punchTime}-${i}`} className={CLASSE_LINHA}>
                    <td className={cn(CLASSE_TD, "whitespace-nowrap")}>
                      {formatarDataHora(b.punchTime, fuso, { virgula: true })}
                    </td>
                    <td className={CLASSE_TD}>
                      {b.type === "DELETADA" ? (
                        <SeloStatus tom="erro">{TIPO_LABEL[b.type]}</SeloStatus>
                      ) : (
                        <SeloStatus tom="neutro" semIcone>
                          {TIPO_LABEL[b.type] ?? b.type}
                        </SeloStatus>
                      )}
                    </td>
                    <td className={cn(CLASSE_TD, "text-muted-foreground")}>
                      {b.deviceName || "—"}
                    </td>
                    <td className={cn(CLASSE_TD, "text-muted-foreground")}>
                      {b.latitude !== undefined && b.longitude !== undefined
                        ? `${b.latitude.toFixed(6)}, ${b.longitude.toFixed(6)}`
                        : "—"}
                    </td>
                    <td className={cn(CLASSE_TD, "text-muted-foreground")}>{b.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio
            mensagem="Nenhuma batida encontrada no período selecionado."
            detalhe="Amplie as datas (até 30 dias)."
          />
        )}
      </Painel>
    </Pagina>
  );
}
