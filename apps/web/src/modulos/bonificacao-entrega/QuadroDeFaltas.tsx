import {
  contratosBonificacaoEntrega as c,
  ROTULO_DO_TIPO_DE_FALTA,
  TIPOS_DE_FALTA,
} from "@erp/shared/contratos/bonificacao-entrega";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { chamar } from "@/lib/api";

import { diaCurto, periodoDoMes } from "../ranking/periodo";
import { CHAVE_DAS_FALTAS, consultaFaltas } from "./api";

type TipoDeFalta = (typeof TIPOS_DE_FALTA)[number];

const mensagemDe = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir. Tente de novo.";

/**
 * Faltas do mês (novo: o sistema atual tinha a regra mas não a tela — Q47/P12). Cada falta zera
 * o bônus do último dia bonificado antes dela; a apuração é refeita ao registrar ou excluir.
 */
export function QuadroDeFaltas({ mes }: { mes: string }) {
  const qc = useQueryClient();
  const { inicio, fim } = periodoDoMes(mes);
  const faltas = useQuery(consultaFaltas(inicio, fim));

  const [nome, setNome] = useState("");
  const [data, setData] = useState(inicio);
  const [tipo, setTipo] = useState<TipoDeFalta>("falta_injustificada");
  const [observacao, setObservacao] = useState("");

  const atualizar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: CHAVE_DAS_FALTAS }),
      qc.invalidateQueries({ queryKey: ["bonificacao-apuracao"] }),
    ]);

  const registrar = useMutation({
    mutationFn: () =>
      chamar(c.registrarFalta, {
        entrada: {
          colaboradorNome: nome,
          dataFalta: data,
          tipo,
          observacao: observacao.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Falta registrada");
      setNome("");
      setObservacao("");
      void atualizar();
    },
    onError: (e) => toast.error(mensagemDe(e)),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => chamar(c.excluirFalta, { parametros: { id } }),
    onSuccess: () => {
      toast.success("Falta excluída");
      void atualizar();
    },
    onError: (e) => toast.error(mensagemDe(e)),
  });

  const lista = faltas.data ?? [];

  return (
    <section className="space-y-3 rounded-[10px] border border-border/70 bg-card p-3">
      <div>
        <h2 className="text-[14px] font-medium">Faltas do mês</h2>
        <p className="text-[11px] text-muted-foreground">
          Uma falta zera o bônus do último dia bonificado antes dela. Use o nome como aparece no
          romaneio.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor="falta-nome" className="text-[11px]">
            Colaborador
          </Label>
          <Input
            id="falta-nome"
            className="h-8 text-[12px]"
            value={nome}
            onChange={(e) => { setNome(e.target.value); }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="falta-data" className="text-[11px]">
            Dia
          </Label>
          <Input
            id="falta-data"
            type="date"
            className="h-8 text-[12px]"
            value={data}
            onChange={(e) => { setData(e.target.value); }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Tipo</Label>
          <Select
            value={tipo}
            onValueChange={(v) => {
              const escolhido = TIPOS_DE_FALTA.find((t) => t === v);
              if (escolhido) setTipo(escolhido);
            }}
          >
            <SelectTrigger className="h-8 w-[210px] text-[12px]" aria-label="Tipo de falta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DE_FALTA.map((t) => (
                <SelectItem key={t} value={t}>
                  {ROTULO_DO_TIPO_DE_FALTA[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="falta-observacao" className="text-[11px]">
            Observação
          </Label>
          <Input
            id="falta-observacao"
            className="h-8 text-[12px]"
            value={observacao}
            onChange={(e) => { setObservacao(e.target.value); }}
          />
        </div>
        <div className="flex items-end">
          <Button
            size="sm"
            className="h-8"
            disabled={nome.trim().length < 3 || !data || registrar.isPending}
            onClick={() => { registrar.mutate(); }}
          >
            <Plus className="mr-1.5 h-3 w-3" /> Registrar
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border/70">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Dia</th>
              <th className="px-3 py-2 text-left">Colaborador</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Observação</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {lista.map((f) => (
              <tr key={f.id}>
                <td className="px-3 py-1.5 font-mono">{diaCurto(f.dataFalta)}</td>
                <td className="px-3 py-1.5">{f.colaboradorNome}</td>
                <td className="px-3 py-1.5">{ROTULO_DO_TIPO_DE_FALTA[f.tipo]}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.observacao ?? "—"}</td>
                <td className="px-3 py-1.5 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Excluir falta de ${f.colaboradorNome}`}
                    onClick={() => {
                      if (window.confirm(`Excluir a falta de ${f.colaboradorNome}?`)) {
                        excluir.mutate(f.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-rose-400" />
                  </Button>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                  {faltas.isLoading ? "Carregando…" : "Nenhuma falta registrada no mês."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
