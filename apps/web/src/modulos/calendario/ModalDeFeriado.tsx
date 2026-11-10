import { normalizarLocal } from "@erp/dominio/calendario";
import {
  type DadosDoFeriado,
  type Feriado,
  TIPOS_FERIADO,
  UFS,
} from "@erp/shared/contratos/calendario";
import { ehDataIso } from "@erp/shared/datas";
import { z } from "@erp/shared/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { type KeyboardEvent, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { ErroDoCampo } from "@/acesso/componentes/CartaoDeEntrada";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/componentes/ui/dialog";
import { Switch } from "@/componentes/ui/switch";

import { corDoTipo } from "./calendario";

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

const CAMPO = "rounded border border-border bg-background px-2 py-1";

export function ModalDeFeriado({
  aberto,
  aoMudarAberto,
  editando,
  hoje,
  aoGravar,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  editando: Feriado | null;
  hoje: string;
  /** `false` quando não gravou (a página já avisou o operador): o modal fica aberto. */
  aoGravar: (feriado: FeriadoParaGravar) => Promise<boolean>;
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
        <form onSubmit={(e) => void salvar(e)} className="space-y-3 pt-2 text-[13px]" noValidate>
          <Controller
            control={formulario.control}
            name="tipo"
            render={({ field }) => (
              <div className="flex gap-2">
                {TIPOS_FERIADO.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => {
                      field.onChange(t);
                    }}
                    aria-pressed={field.value === t}
                    className={`rounded border px-2 py-1 text-[11px] capitalize ${field.value === t ? corDoTipo(t) : "border-border/60 text-muted-foreground"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          />
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Data</span>
            <input type="date" className={CAMPO} {...formulario.register("data")} />
          </label>
          <ErroDoCampo mensagem={errors.data?.message} />
          {tipo !== "nacional" && (
            <>
              <label className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">UF</span>
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
            </>
          )}
          {tipo === "municipal" && (
            <>
              <label className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Cidade</span>
                <input className={CAMPO} {...formulario.register("cidade")} />
              </label>
              <ErroDoCampo mensagem={errors.cidade?.message} />
            </>
          )}
          <label className="block">
            <span className="block text-muted-foreground">Descrição</span>
            <input autoFocus className={`w-full ${CAMPO}`} {...formulario.register("descricao")} />
          </label>
          <ErroDoCampo mensagem={errors.descricao?.message} />
          {!editando && (
            <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/20 px-2 py-2">
              <span className="text-[12px] text-muted-foreground">
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
          <div className="flex justify-end gap-2 pt-2">
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
