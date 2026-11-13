import { type CriterioDeRegra, CRITERIOS_DE_REGRA } from "@erp/shared/contracts/ranking";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ModalDetalhe } from "@/components/common/Detail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PARAMETROS_PADRAO, type Rascunho } from "../rules";
import { ROTULO_DO_CRITERIO } from "../texts";

const CAMPO_TEXTO =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none";

/** Criar, editar ou copiar uma regra: nome, vigência e critérios com os parâmetros. */
export function ModalDaRegra({
  inicial,
  salvando,
  aoCancelar,
  aoSalvar,
}: {
  inicial: Rascunho;
  salvando: boolean;
  aoCancelar: () => void;
  aoSalvar: (d: Rascunho) => void;
}) {
  const [d, setD] = useState<Rascunho>(inicial);
  const trocarCriterio = (i: number, criterio: CriterioDeRegra) => {
    setD({
      ...d,
      criterios: d.criterios.map((x, j) =>
        j === i ? { criterio, parametros: { ...PARAMETROS_PADRAO[criterio] } } : x,
      ),
    });
  };
  const trocarParametro = (i: number, chave: string, valor: string) => {
    setD({
      ...d,
      criterios: d.criterios.map((x, j) =>
        j === i ? { ...x, parametros: { ...x.parametros, [chave]: valor } } : x,
      ),
    });
  };

  return (
    <ModalDetalhe
      aberto
      aoFechar={aoCancelar}
      titulo={d.id ? "Editar regra" : "Nova regra"}
      largura="larga"
    >
      <div className="space-y-4 text-[13px]">
        <div className="space-y-1.5">
          <Label htmlFor="regra-nome">Nome</Label>
          <Input
            id="regra-nome"
            placeholder="Nome (ex.: Regra Q3 2026)"
            value={d.nome}
            onChange={(e) => {
              setD({ ...d, nome: e.target.value });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regra-descricao">Descrição</Label>
          <textarea
            id="regra-descricao"
            className={CAMPO_TEXTO}
            placeholder="Descrição (opcional)"
            rows={2}
            value={d.descricao}
            onChange={(e) => {
              setD({ ...d, descricao: e.target.value });
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="regra-inicio">Vigência início</Label>
            <Input
              id="regra-inicio"
              type="date"
              value={d.vigenciaInicio}
              onChange={(e) => {
                setD({ ...d, vigenciaInicio: e.target.value });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="regra-fim">Vigência fim (opcional)</Label>
            <Input
              id="regra-fim"
              type="date"
              value={d.vigenciaFim}
              onChange={(e) => {
                setD({ ...d, vigenciaFim: e.target.value });
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="regra-ativa"
            checked={d.ativo}
            onCheckedChange={(v) => {
              setD({ ...d, ativo: v === true });
            }}
          />
          <Label htmlFor="regra-ativa">Ativa</Label>
        </div>

        <div className="space-y-2">
          <div className="label-xs">Critérios</div>
          {d.criterios.map((k, i) => (
            <div key={i} className="rounded-xl border border-border bg-superficie p-3">
              <div className="flex items-center justify-between gap-2">
                <Select
                  value={k.criterio}
                  onValueChange={(v) => {
                    const novo = CRITERIOS_DE_REGRA.find((x) => x === v);
                    if (novo) trocarCriterio(i, novo);
                  }}
                >
                  <SelectTrigger className="w-64 text-[13px]" aria-label="Critério">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRITERIOS_DE_REGRA.map((x) => (
                      <SelectItem key={x} value={x}>
                        {ROTULO_DO_CRITERIO[x]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Remover critério"
                  title="Remover critério"
                  onClick={() => {
                    setD({ ...d, criterios: d.criterios.filter((_, j) => j !== i) });
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.keys(PARAMETROS_PADRAO[k.criterio]).map((chave) => (
                  <div key={chave} className="space-y-1">
                    <Label htmlFor={`criterio-${String(i)}-${chave}`} className="text-xs">
                      {chave}
                    </Label>
                    <Input
                      id={`criterio-${String(i)}-${chave}`}
                      value={k.parametros[chave] ?? ""}
                      onChange={(e) => {
                        trocarParametro(i, chave, e.target.value);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setD({
                ...d,
                criterios: [
                  ...d.criterios,
                  {
                    criterio: "entregas_prazo",
                    parametros: { ...PARAMETROS_PADRAO.entregas_prazo },
                  },
                ],
              });
            }}
          >
            <Plus aria-hidden /> Adicionar critério
          </Button>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button
          onClick={() => {
            aoSalvar(d);
          }}
          disabled={!d.nome.trim() || salvando}
        >
          Salvar
        </Button>
      </div>
    </ModalDetalhe>
  );
}
