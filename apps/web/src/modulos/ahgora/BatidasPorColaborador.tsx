import { diferencaEmDias, ehDataIso } from "@erp/shared/datas";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { Skeleton } from "@/componentes/ui/skeleton";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { isoLocal } from "../ranking/periodo";
import { consultaBatidas, consultaFuncionarios } from "./api";
import { ComoFuncionaPonto } from "./ComoFuncionaPonto";

const TIPO_LABEL: Record<string, string> = {
  ORIGINAL: "Original",
  MANUAL: "Manual",
  ONLINE: "Online",
  DELETADA: "Deletada",
};

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function diasAtras(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return isoLocal(d);
}

function periodoDeBatidasValido(start: string, end: string): boolean {
  return ehDataIso(start) && ehDataIso(end) && end >= start && diferencaEmDias(start, end) <= 30;
}

/** origem: features/ahgora/components/AhgoraPontoScreen.tsx (sistema atual) */
export function BatidasPorColaborador() {
  const [busca, setBusca] = useState("");
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [start, setStart] = useState(() => diasAtras(7));
  const [end, setEnd] = useState(() => isoLocal(new Date()));

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
  const periodoValido = periodoDeBatidasValido(start, end);
  const batidasQ = useQuery(consultaBatidas(funcionarioId, start, end, periodoValido));

  return (
    <div className="space-y-4">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-medium tracking-tight">Marcações de ponto (Ahgora)</h1>
          <ComoFuncionaPonto />
        </div>
        <p className="text-[12px] text-muted-foreground">
          Consulta em tempo real das batidas de ponto registradas no Ahgora, por colaborador e
          período (máximo 30 dias).
        </p>
      </header>

      <section className="rounded-[10px] border border-border/70 bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
          <div className="space-y-1">
            <Label htmlFor="ponto-busca" className="text-[11px]">
              Buscar colaborador
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="ponto-busca"
                className="h-8 pl-7 text-[12px]"
                placeholder="Nome, matrícula ou CPF"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Colaborador</Label>
            <Select value={funcionarioId ?? undefined} onValueChange={setFuncionarioId}>
              <SelectTrigger className="h-8 text-[12px]" aria-label="Colaborador">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {filtrados.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} — {f.register}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ponto-de" className="text-[11px]">
              De
            </Label>
            <Input
              id="ponto-de"
              type="date"
              className="h-8 text-[12px]"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ponto-ate" className="text-[11px]">
              Até
            </Label>
            <Input
              id="ponto-ate"
              type="date"
              className="h-8 text-[12px]"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
              }}
            />
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => void batidasQ.refetch()}
              disabled={!funcionarioId || !periodoValido || batidasQ.isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-3 w-3 ${batidasQ.isFetching ? "animate-spin" : ""}`}
              />
              Consultar
            </Button>
          </div>
        </div>
        {!periodoValido && (
          <p className="mt-2 text-[11px] text-destructive">
            Selecione um período válido de até 30 dias (data final não pode ser anterior à inicial).
          </p>
        )}
        {funcionariosQ.error && (
          <p className="mt-2 text-[11px] text-destructive">
            {mensagemAmigavel(funcionariosQ.error)}
          </p>
        )}
      </section>

      {selecionado && (
        <section className="rounded-[10px] border border-border/70 bg-card p-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-medium">{selecionado.name}</span>
            <Badge variant="secondary">matrícula {selecionado.register}</Badge>
            {selecionado.department && <Badge variant="outline">{selecionado.department}</Badge>}
            {selecionado.jobTitle && <Badge variant="outline">{selecionado.jobTitle}</Badge>}
            {selecionado.terminationDate && <Badge variant="destructive">demitido</Badge>}
          </div>
        </section>
      )}

      <section className="rounded-[10px] border border-border/70 bg-card">
        <header className="flex items-center justify-between border-b border-border/70 px-3 py-2">
          <h2 className="text-[13px] font-medium">Batidas no período</h2>
          {batidasQ.data && (
            <span className="text-[11px] text-muted-foreground">
              {batidasQ.data.data.length} registro(s)
            </span>
          )}
        </header>

        {!funcionarioId ? (
          <div className="p-6 text-center text-[12px] text-muted-foreground">
            Selecione um colaborador para consultar as batidas.
          </div>
        ) : batidasQ.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : batidasQ.error ? (
          <div className="p-6 text-center text-[12px] text-destructive">
            {mensagemAmigavel(batidasQ.error)}
          </div>
        ) : batidasQ.data && batidasQ.data.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Data/hora</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Dispositivo</th>
                  <th className="px-3 py-2 text-left">Localização</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {batidasQ.data.data.map((b, i) => (
                  <tr key={`${b.punchTime}-${i}`}>
                    <td className="px-3 py-1.5 font-mono text-[11px]">
                      {formatarDataHora(b.punchTime)}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge
                        variant={b.type === "DELETADA" ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {TIPO_LABEL[b.type] ?? b.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{b.deviceName || "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {b.latitude !== undefined && b.longitude !== undefined
                        ? `${b.latitude.toFixed(6)}, ${b.longitude.toFixed(6)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{b.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-[12px] text-muted-foreground">
            Nenhuma batida encontrada no período selecionado.
          </div>
        )}
      </section>
    </div>
  );
}
