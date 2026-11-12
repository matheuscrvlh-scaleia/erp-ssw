import {
  contratosPlataforma as p,
  type DadosDaEmpresa,
  dadosDaEmpresa,
  type EmpresaCompleta,
} from "@erp/shared/contratos/plataforma";
import { LOGO_MAXIMO_BYTES, ROTULO_DO_STATUS, STATUS_EMPRESA } from "@erp/shared/plataforma";
import { BarChart3, Building2, ImageUp, Palette, Route, Settings2, Truck } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";

import { paletaDaMarca } from "@/acesso/marca";
import { CAMPO, Campo, Escolha } from "@/componentes/comum/CamposDeFormulario";
import { Painel } from "@/componentes/comum/Painel";
import { Button } from "@/componentes/ui/button";
import { useGravacao } from "@/hooks/use-gravacao";
import { chamar } from "@/lib/api";
import { ErroDoOperador } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { CHAVES_DA_PLATAFORMA } from "./api";

type Formulario = Record<Exclude<keyof DadosDaEmpresa, "status">, string> & {
  status: DadosDaEmpresa["status"];
};
type CampoDeTexto = Exclude<keyof Formulario, "status">;

function paraFormulario(e: EmpresaCompleta): Formulario {
  return {
    nome: e.nome,
    nomeCurto: e.nomeCurto,
    razaoSocial: e.razaoSocial ?? "",
    cnpj: e.cnpj ?? "",
    dominioSsw: e.dominioSsw ?? "",
    fuso: e.fuso,
    status: e.status,
    corPrimaria: e.corPrimaria,
    corDestaque: e.corDestaque,
    slogan: e.slogan ?? "",
  };
}

/** Mudar a marca muda o menu e as exportações de quem está na empresa: recarrega o acesso. */
const invalidarEmpresa = (id: string) => [
  CHAVES_DA_PLATAFORMA.empresa(id),
  CHAVES_DA_PLATAFORMA.empresas,
  ["acesso"],
];

export function AbaDados({ empresa }: { empresa: EmpresaCompleta }) {
  const [f, setF] = useState(() => paraFormulario(empresa));
  useEffect(() => {
    setF(paraFormulario(empresa));
  }, [empresa]);
  const mudar = (parte: Partial<Formulario>) => {
    setF((v) => ({ ...v, ...parte }));
  };
  const lido = dadosDaEmpresa.safeParse(f);
  /** Primeiro problema de cada campo, mostrado embaixo dele. */
  const erroDe = (campo: keyof Formulario) =>
    lido.success ? null : (lido.error.issues.find((i) => i.path[0] === campo)?.message ?? null);
  const salvar = useGravacao({
    executar: (dados: DadosDaEmpresa) =>
      chamar(p.salvarEmpresa, { parametros: { id: empresa.id }, entrada: dados }),
    sucesso: "Dados salvos",
    invalidar: invalidarEmpresa(empresa.id),
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

      <Painel titulo="Operação" icone={Settings2} classeDoCorpo="grid gap-4 p-5 md:grid-cols-2">
        {texto("dominioSsw", "Domínio SSW", undefined, "Ex.: FRT")}
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
        <Logo empresa={empresa} />
      </Painel>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-flutuante">
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
  );
}

/** Itens de menu da amostra da barra lateral (o primeiro aparece ativo). */
const ITENS_DA_AMOSTRA = [
  { rotulo: "Performance", icone: BarChart3 },
  { rotulo: "Romaneio", icone: Truck },
  { rotulo: "Ocorrências", icone: Route },
] as const;

/**
 * Amostra ao vivo da paleta que a cor principal gera (`paletaDaMarca`, a mesma do painel): barra
 * lateral, botão primário e texto da marca nos dois temas. A amostra escura liga o tema escuro só
 * nela e troca a cor da marca pela digitada, então os tokens do tema resolvem com a cor nova.
 */
function PreviaDaMarca({ cor, nomeCurto }: { cor: string; nomeCurto: string }) {
  const paleta = paletaDaMarca(cor);
  const de = (nome: string) => paleta[nome] ?? "";
  const temaEscuro: CSSProperties & Record<`--${string}`, string> = {
    "--marca-clara": de("--marca-clara"),
    "--marca-clara-fg": de("--marca-clara-fg"),
  };
  return (
    <section aria-label="Pré-visualização da cor principal" className="space-y-3">
      <div>
        <div className="label-xs">Pré-visualização</div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          A cor principal muda o painel inteiro da empresa: barra lateral, botões, links, gráficos e
          o tema escuro. O contraste é ajustado sozinho para continuar legível.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div
          className="flex flex-col gap-1 rounded-xl p-2.5 shadow-cartao"
          style={{ backgroundColor: de("--lateral") }}
          aria-label="Barra lateral"
          role="img"
        >
          <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
              style={{ backgroundColor: de("--lateral-destaque"), color: de("--lateral") }}
            >
              {(nomeCurto.trim() || "FR").slice(0, 2).toUpperCase()}
            </span>
            <span className="text-[13px] font-semibold text-sidebar-accent-foreground">
              {nomeCurto.trim() || "Empresa"}
            </span>
          </div>
          {ITENS_DA_AMOSTRA.map(({ rotulo, icone: Icone }, i) => (
            <span
              key={rotulo}
              className={cn(
                "relative flex h-8 items-center gap-2 rounded-lg px-2 text-[12.5px]",
                i === 0
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground",
              )}
            >
              <Icone
                className="h-4 w-4"
                aria-hidden
                style={i === 0 ? { color: de("--lateral-destaque") } : undefined}
              />
              {rotulo}
              {i === 0 && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-0 bottom-1.5 w-[3px] rounded-full"
                  style={{ backgroundColor: de("--lateral-destaque") }}
                />
              )}
            </span>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-[Canvas] p-4 text-[CanvasText] [color-scheme:light]">
            <div className="label-xs opacity-60">Tema claro</div>
            <p className="text-[15px] font-bold" style={{ color: de("--marca-texto") }}>
              Texto da marca
            </p>
            <span
              className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-semibold shadow-cartao"
              style={{ backgroundColor: de("--marca"), color: de("--marca-fg") }}
            >
              Botão primário
            </span>
          </div>
          <div
            className="dark space-y-3 rounded-xl border border-border bg-background p-4 text-foreground"
            style={temaEscuro}
          >
            <div className="label-xs text-muted-foreground">Tema escuro</div>
            <p className="text-[15px] font-bold text-brand">Texto da marca</p>
            <span className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground shadow-cartao">
              Botão primário
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Conteúdo do arquivo em base64 (sem o prefixo `data:...;base64,`). */
function lerBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const texto = typeof leitor.result === "string" ? leitor.result : "";
      resolve(texto.replace(/^data:[^,]*,/, ""));
    };
    leitor.onerror = () => {
      reject(new Error("Não foi possível ler o arquivo."));
    };
    leitor.readAsDataURL(arquivo);
  });
}

/** Confere tipo e tamanho antes de enviar; a API confere de novo pelo conteúdo. */
export function problemaDoLogo(arquivo: { type: string; size: number }): string | null {
  if (!/^image\/(png|jpeg)$/.test(arquivo.type)) return "Envie o logo em PNG ou JPEG.";
  if (arquivo.size > LOGO_MAXIMO_BYTES) {
    return "O logo passa de 512 KB. Reduza a imagem e envie de novo.";
  }
  return null;
}

function Logo({ empresa }: { empresa: EmpresaCompleta }) {
  const invalidar = invalidarEmpresa(empresa.id);
  const envio = useGravacao({
    executar: async (arquivo: File) => {
      const problema = problemaDoLogo(arquivo);
      if (problema) throw new ErroDoOperador(problema);
      return chamar(p.enviarLogo, {
        parametros: { id: empresa.id },
        entrada: { conteudoBase64: await lerBase64(arquivo) },
      });
    },
    sucesso: "Logo enviado",
    invalidar,
  });
  const remocao = useGravacao({
    executar: () => chamar(p.removerLogo, { parametros: { id: empresa.id } }),
    sucesso: "Logo removido",
    invalidar,
  });
  const ocupado = envio.gravando || remocao.gravando;

  return (
    <div className="space-y-1.5">
      <span className="block text-[13px] font-medium">Logo</span>
      <div className="flex flex-wrap items-center gap-3">
        {empresa.logoUrl ? (
          <img
            src={empresa.logoUrl}
            alt={`Logo de ${empresa.nome}`}
            className="h-14 w-14 rounded-xl border border-border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
            sem logo
          </div>
        )}
        <Button
          asChild
          size="sm"
          variant="outline"
          className="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
        >
          <label className={cn(ocupado && "pointer-events-none opacity-50")}>
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              disabled={ocupado}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) void envio.gravar(arquivo);
              }}
            />
            <ImageUp aria-hidden />
            {envio.gravando ? "Enviando…" : empresa.logoUrl ? "Trocar logo" : "Enviar logo"}
          </label>
        </Button>
        {empresa.logoUrl && (
          <Button
            variant="ghost"
            size="sm"
            disabled={ocupado}
            onClick={() => void remocao.gravar(undefined)}
          >
            Remover
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        PNG ou JPEG até 512 KB, de preferência quadrado. Sai no menu e nos PDFs, planilhas e
        impressões da empresa.
      </p>
    </div>
  );
}
