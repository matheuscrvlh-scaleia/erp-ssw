import { dadosDaEmpresa, type EmpresaCompleta } from "@erp/shared/contracts/platform";
import { ROTULO_DO_STATUS, STATUS_EMPRESA } from "@erp/shared/platform";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Palette, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

import { CAMPO, Campo, Escolha } from "@/components/common/FormFields";
import { Painel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { useGravacao } from "@/hooks/use-save";
import { cn } from "@/lib/utils";

import { mutacaoSalvarEmpresa } from "../api";
import { type FormularioDaEmpresa as Formulario, formularioDaEmpresa } from "../rules";
import { ImagemDaMarca } from "./BrandImage";
import { PreviaDaMarca } from "./BrandPreview";

type CampoDeTexto = Exclude<keyof Formulario, "status">;

export function AbaDados({ empresa }: { empresa: EmpresaCompleta }) {
  const [f, setF] = useState(() => formularioDaEmpresa(empresa));
  useEffect(() => {
    setF(formularioDaEmpresa(empresa));
  }, [empresa]);
  const mudar = (parte: Partial<Formulario>) => {
    setF((v) => ({ ...v, ...parte }));
  };
  const lido = dadosDaEmpresa.safeParse(f);
  /** Primeiro problema de cada campo, mostrado embaixo dele. */
  const erroDe = (campo: keyof Formulario) =>
    lido.success ? null : (lido.error.issues.find((i) => i.path[0] === campo)?.message ?? null);
  const cliente = useQueryClient();
  const salvar = useGravacao({
    mutacao: mutacaoSalvarEmpresa(cliente, empresa.id),
    sucesso: "Dados salvos",
  });

  const texto = (chave: CampoDeTexto, rotulo: string, ajuda?: string, exemplo?: string) => (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erroDe(chave)}>
      <input
        className={CAMPO}
        value={f[chave]}
        placeholder={exemplo}
        onChange={(e) => {
          mudar({ [chave]: e.target.value });
        }}
      />
    </Campo>
  );
  const cor = (chave: "corPrimaria" | "corDestaque", rotulo: string) => (
    <Campo rotulo={rotulo} erro={erroDe(chave)}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={f[chave]}
          onChange={(e) => {
            mudar({ [chave]: e.target.value });
          }}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1"
          aria-label={`${rotulo} (seletor)`}
        />
        <input
          className={cn(CAMPO, "font-mono uppercase")}
          value={f[chave]}
          onChange={(e) => {
            mudar({ [chave]: e.target.value });
          }}
        />
      </div>
    </Campo>
  );

  return (
    <div className="max-w-[960px] space-y-5">
      <Painel
        titulo="Identificação"
        icone={Building2}
        classeDoCorpo="grid gap-4 p-5 md:grid-cols-2"
      >
        {texto("nome", "Nome")}
        {texto("nomeCurto", "Nome curto", "Usado em rótulos curtos, ex.: “Em atraso (FR)”.")}
        {texto("razaoSocial", "Razão social")}
        {texto("cnpj", "CNPJ")}
      </Painel>

      {/* O domínio SSW fica na aba Integrações, com os sistemas integrados. */}
      <Painel titulo="Operação" icone={Settings2} classeDoCorpo="grid gap-4 p-5 md:grid-cols-2">
        {texto("fuso", "Fuso horário", undefined, "America/Sao_Paulo")}
        <Campo
          rotulo="Status"
          ajuda="Suspensa ou encerrada: os usuários da empresa deixam de entrar."
        >
          <Escolha
            opcoes={STATUS_EMPRESA.map((s) => ({ valor: s, rotulo: ROTULO_DO_STATUS[s] }))}
            valor={f.status}
            aoMudar={(v) => {
              const status = STATUS_EMPRESA.find((s) => s === v);
              if (status) mudar({ status });
            }}
          />
        </Campo>
      </Painel>

      <Painel titulo="Marca" icone={Palette} classeDoCorpo="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {cor("corPrimaria", "Cor principal")}
          {cor("corDestaque", "Cor de destaque")}
        </div>
        <PreviaDaMarca cor={f.corPrimaria} nomeCurto={f.nomeCurto} />
        <div className="grid gap-4 md:grid-cols-2">{texto("slogan", "Slogan")}</div>
        <div className="grid gap-5 md:grid-cols-2">
          <ImagemDaMarca empresa={empresa} imagem="logo" />
          <ImagemDaMarca empresa={empresa} imagem="favicon" />
        </div>
      </Painel>

      {/* Faixa com o fundo da página: o conteúdo que rola por baixo não aparece em volta da barra. */}
      <div className="sticky bottom-0 z-10 bg-background pt-2 pb-4">
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-flutuante">
          {!lido.success && (
            <span role="alert" className="mr-auto text-xs font-medium text-status-bad-fg">
              {lido.error.issues[0]?.message ?? "Confira os campos."}
            </span>
          )}
          <Button
            disabled={salvar.gravando || !lido.success}
            onClick={() => {
              if (lido.success) void salvar.gravar(lido.data);
            }}
          >
            {salvar.gravando ? "Salvando…" : "Salvar dados"}
          </Button>
        </div>
      </div>
    </div>
  );
}
