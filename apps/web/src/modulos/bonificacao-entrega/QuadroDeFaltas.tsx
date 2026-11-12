import {
  contratosBonificacaoEntrega as c,
  ROTULO_DO_TIPO_DE_FALTA,
  TIPOS_DE_FALTA,
} from "@erp/shared/contratos/bonificacao-entrega";
import { formatarDiaMes } from "@erp/shared/formatacao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarX, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { usePermissao } from "@/acesso/permissao";
import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { LinhasCarregando } from "@/componentes/comum/LinhasCarregando";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
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
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { periodoDoMes } from "../ranking/periodo";
import { CHAVE_DAS_FALTAS, consultaFaltas } from "./api";

type TipoDeFalta = (typeof TIPOS_DE_FALTA)[number];

/**
 * Faltas do mês (novo: o sistema atual tinha a regra mas não a tela — Q47/P12). Cada falta zera
 * o bônus do último dia bonificado antes dela; a apuração é refeita ao registrar ou excluir.
 */
export function QuadroDeFaltas({ mes }: { mes: string }) {
  const podeRegistrar = usePermissao("admin_bonificacao_entrega", "editar");
  const podeExcluir = usePermissao("admin_bonificacao_entrega", "excluir");
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
    onError: (e) => toast.error(mensagemAmigavel(e)),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => chamar(c.excluirFalta, { parametros: { id } }),
    onSuccess: () => {
      toast.success("Falta excluída");
      void atualizar();
    },
    onError: (e) => toast.error(mensagemAmigavel(e)),
  });

  const lista = faltas.data ?? [];

  return (
    <Painel
      titulo="Faltas do mês"
      descricao="Uma falta zera o bônus do último dia bonificado antes dela. Use o nome como aparece no romaneio."
      icone={CalendarX}
    >
      {podeRegistrar && (
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="falta-nome" className="text-xs">
              Colaborador
            </Label>
            <Input
              id="falta-nome"
              className="text-[13px]"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="falta-data" className="text-xs">
              Dia
            </Label>
            <Input
              id="falta-data"
              type="date"
              className="text-[13px] tabular-nums"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="falta-tipo" className="text-xs">
              Tipo
            </Label>
            <Select
              value={tipo}
              onValueChange={(v) => {
                const escolhido = TIPOS_DE_FALTA.find((t) => t === v);
                if (escolhido) setTipo(escolhido);
              }}
            >
              <SelectTrigger id="falta-tipo" className="text-[13px] lg:w-[220px]">
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
          <div className="space-y-1.5">
            <Label htmlFor="falta-observacao" className="text-xs">
              Observação
            </Label>
            <Input
              id="falta-observacao"
              className="text-[13px]"
              value={observacao}
              onChange={(e) => {
                setObservacao(e.target.value);
              }}
            />
          </div>
          <div className="flex items-end">
            <Button
              disabled={nome.trim().length < 3 || !data || registrar.isPending}
              onClick={() => {
                registrar.mutate();
              }}
            >
              <Plus aria-hidden /> Registrar
            </Button>
          </div>
        </div>
      )}

      <div className="rolagem-fina relative overflow-x-auto rounded-b-xl">
        <table className={CLASSE_TABELA}>
          <thead>
            <tr className={CLASSE_CABECALHO}>
              <th scope="col" className={CLASSE_TH}>
                Dia
              </th>
              <th scope="col" className={CLASSE_TH}>
                Colaborador
              </th>
              <th scope="col" className={CLASSE_TH}>
                Tipo
              </th>
              <th scope="col" className={CLASSE_TH}>
                Observação
              </th>
              <th scope="col" className={CLASSE_TH}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {faltas.isLoading && <LinhasCarregando linhas={3} colunas={5} />}
            {faltas.error && (
              <tr>
                <td colSpan={5}>
                  <MensagemErro erro={faltas.error} aoTentarDeNovo={() => void faltas.refetch()} />
                </td>
              </tr>
            )}
            {lista.map((f) => (
              <tr key={f.id} className={CLASSE_LINHA}>
                <td className={CLASSE_TD}>{formatarDiaMes(f.dataFalta)}</td>
                <td className={cn(CLASSE_TD, "font-semibold")}>{f.colaboradorNome}</td>
                <td className={CLASSE_TD}>{ROTULO_DO_TIPO_DE_FALTA[f.tipo]}</td>
                <td className={cn(CLASSE_TD, "text-muted-foreground")}>{f.observacao ?? "—"}</td>
                <td className={cn(CLASSE_TD, "py-1 text-right")}>
                  {podeExcluir && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-status-bad-fg hover:text-status-bad-fg"
                      aria-label={`Excluir falta de ${f.colaboradorNome}`}
                      title={`Excluir falta de ${f.colaboradorNome}`}
                      onClick={() => {
                        if (window.confirm(`Excluir a falta de ${f.colaboradorNome}?`)) {
                          excluir.mutate(f.id);
                        }
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!faltas.isLoading && !faltas.error && lista.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EstadoVazio mensagem="Nenhuma falta registrada no mês." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}
