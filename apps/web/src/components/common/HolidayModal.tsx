import { normalizarLocal } from "@erp/domain/calendar";
import {
  type DadosDoFeriado,
  type Feriado,
  TIPOS_FERIADO,
  UFS,
} from "@erp/shared/contracts/calendar";
import { ehDataIso } from "@erp/shared/dates";
import { z } from "@erp/shared/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { type KeyboardEvent, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { ErroDoCampo } from "@/access/components/LoginCard";
import { Alternador } from "@/components/common/Toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const esquema = z
  .object({
    tipo: z.enum(TIPOS_FERIADO),
    data: z.string().refine(ehDataIso, "Informe a data."),
    uf: z.union([z.enum(UFS), z.literal("")]),
    cidade: z.string().max(120),
    descricao: z.string().trim().min(3, "Descrição com pelo menos 3 caracteres.").max(200),
    recorrente: z.boolean(),
  })
  // A mesma regra de local que a API aplica (cidade e UF conforme o tipo).
  .superRefine((d, ctx) => {
    try {
      normalizarLocal(d.tipo, d.cidade, d.uf || null);
    } catch (e) {
      const semCidade = d.tipo === "municipal" && !d.cidade.trim();
      ctx.addIssue({
        code: "custom",
        path: [semCidade ? "cidade" : "uf"],
        message: e instanceof Error ? e.message : "Local inválido.",
      });
    }
  });

type Campos = z.infer<typeof esquema>;

export interface FeriadoParaGravar {
  dados: DadosDoFeriado;
  recorrente: boolean;
}

function valoresIniciais(editando: Feriado | null, hoje: string): Campos {
  if (!editando) {
    return { tipo: "municipal", data: hoje, uf: "", cidade: "", descricao: "", recorrente: true };
  }
  const uf = UFS.find((u) => u === editando.uf) ?? "";
  return {
    tipo: editando.tipo,
    data: editando.data,
    uf,
    cidade: editando.cidade ?? "",
    descricao: editando.descricao,
    recorrente: false,
  };
}

function paraGravar(c: Campos): FeriadoParaGravar {
  return {
    dados: {
      data: c.data,
      tipo: c.tipo,
      cidade: c.tipo === "municipal" ? c.cidade.trim() : null,
      uf: c.tipo === "nacional" || c.uf === "" ? null : c.uf,
      descricao: c.descricao,
    },
    recorrente: c.recorrente,
  };
}

/** Campo nativo (data, UF) com o mesmo desenho do `Input`. */
const CAMPO =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none";
const ROTULO = "grid gap-1.5 text-[13px]";
const TEXTO_DO_ROTULO = "font-medium text-foreground";

export function ModalDeFeriado({
  aberto,
  aoMudarAberto,
  editando,
  hoje,
  aoGravar,
  semRecorrencia = false,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  editando: Feriado | null;
  hoje: string;
  /** `false` quando não gravou (a página já avisou o operador): o modal fica aberto. */
  aoGravar: (feriado: FeriadoParaGravar) => Promise<boolean>;
  /** Sem a opção "recorrente" (Histórico › Feriados grava um dia só). */
  semRecorrencia?: boolean;
}) {
  const formulario = useForm<Campos>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciais(editando, hoje),
  });
  const { errors, isSubmitting } = formulario.formState;
  const tipo = formulario.watch("tipo");

  const { reset } = formulario;
  useEffect(() => {
    if (aberto) reset(valoresIniciais(editando, hoje));
  }, [aberto, editando, hoje, reset]);

  const salvar = formulario.handleSubmit(async (campos) => {
    if (await aoGravar(paraGravar(campos))) aoMudarAberto(false);
  });

  const atalho = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void salvar();
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent className="sm:max-w-md" onKeyDown={atalho} aria-describedby={undefined}>
        <DialogTitle>{editando ? "Editar feriado" : "Novo feriado"}</DialogTitle>
        <form onSubmit={(e) => void salvar(e)} className="space-y-4 pt-2 text-[13px]" noValidate>
          <Controller
            control={formulario.control}
            name="tipo"
            render={({ field }) => (
              <Alternador
                rotulo="Tipo"
                opcoes={TIPOS_FERIADO.map((t) => ({
                  valor: t,
                  rotulo: <span className="capitalize">{t}</span>,
                }))}
                valor={field.value}
                aoMudar={field.onChange}
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={ROTULO}>
                <span className={TEXTO_DO_ROTULO}>Data</span>
                <input type="date" className={CAMPO} {...formulario.register("data")} />
              </label>
              <ErroDoCampo mensagem={errors.data?.message} />
            </div>
            {tipo !== "nacional" && (
              <div>
                <label className={ROTULO}>
                  <span className={TEXTO_DO_ROTULO}>UF</span>
                  <select className={CAMPO} {...formulario.register("uf")}>
                    <option value="">—</option>
                    {UFS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <ErroDoCampo mensagem={errors.uf?.message} />
              </div>
            )}
          </div>
          {tipo === "municipal" && (
            <div>
              <label className={ROTULO}>
                <span className={TEXTO_DO_ROTULO}>Cidade</span>
                <Input className="text-[13px] md:text-[13px]" {...formulario.register("cidade")} />
              </label>
              <ErroDoCampo mensagem={errors.cidade?.message} />
            </div>
          )}
          <div>
            <label className={ROTULO}>
              <span className={TEXTO_DO_ROTULO}>Descrição</span>
              <Input
                autoFocus
                className="text-[13px] md:text-[13px]"
                {...formulario.register("descricao")}
              />
            </label>
            <ErroDoCampo mensagem={errors.descricao?.message} />
          </div>
          {!editando && !semRecorrencia && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2.5">
              <span className="text-[12.5px] text-muted-foreground">
                Recorrente todo ano (próximos 5 anos)
              </span>
              <Controller
                control={formulario.control}
                name="recorrente"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Recorrente todo ano"
                  />
                )}
              />
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                aoMudarAberto(false);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              Salvar (⌘↵)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
