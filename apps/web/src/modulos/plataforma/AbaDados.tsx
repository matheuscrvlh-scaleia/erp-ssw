import {
  contratosPlataforma as p,
  type DadosDaEmpresa,
  dadosDaEmpresa,
  type EmpresaCompleta,
} from "@erp/shared/contratos/plataforma";
import { LOGO_MAXIMO_BYTES, ROTULO_DO_STATUS, STATUS_EMPRESA } from "@erp/shared/plataforma";
import { useEffect, useState } from "react";

import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";
import { ErroDoOperador } from "@/lib/mensagem-de-erro";
import { CAMPO, Campo, useGravacao } from "@/modulos/admin/comum";

import { CHAVES_DA_PLATAFORMA } from "./api";

type Formulario = Record<Exclude<keyof DadosDaEmpresa, "status">, string> & {
  status: DadosDaEmpresa["status"];
};

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
  const salvar = useGravacao({
    executar: (dados: DadosDaEmpresa) =>
      chamar(p.salvarEmpresa, { parametros: { id: empresa.id }, entrada: dados }),
    sucesso: "Dados salvos",
    invalidar: invalidarEmpresa(empresa.id),
  });

  const texto = (
    chave: Exclude<keyof Formulario, "status">,
    rotulo: string,
    ajuda?: string,
    exemplo?: string,
  ) => (
    <Campo rotulo={rotulo} ajuda={ajuda}>
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
    <Campo rotulo={rotulo}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={f[chave]}
          onChange={(e) => {
            mudar({ [chave]: e.target.value });
          }}
          className="h-9 w-12 cursor-pointer rounded border border-border"
          aria-label={`${rotulo} (seletor)`}
        />
        <input
          className={CAMPO}
          value={f[chave]}
          onChange={(e) => {
            mudar({ [chave]: e.target.value });
          }}
        />
      </div>
    </Campo>
  );

  return (
    <div className="max-w-3xl space-y-4 rounded-[10px] border border-border/70 bg-card p-5">
      <div className="grid gap-3 md:grid-cols-2">
        {texto("nome", "Nome")}
        {texto("nomeCurto", "Nome curto", "Usado em rótulos curtos, ex.: “Em atraso (FR)”.")}
        {texto("razaoSocial", "Razão social")}
        {texto("cnpj", "CNPJ")}
        {texto("dominioSsw", "Domínio SSW", undefined, "Ex.: FRT")}
        {texto("fuso", "Fuso horário", undefined, "America/Sao_Paulo")}
        <Campo
          rotulo="Status"
          ajuda="Suspensa ou encerrada: os usuários da empresa deixam de entrar."
        >
          <select
            className={CAMPO}
            value={f.status}
            onChange={(e) => {
              const status = STATUS_EMPRESA.find((s) => s === e.target.value);
              if (status) mudar({ status });
            }}
          >
            {STATUS_EMPRESA.map((s) => (
              <option key={s} value={s}>
                {ROTULO_DO_STATUS[s]}
              </option>
            ))}
          </select>
        </Campo>
        {texto("slogan", "Slogan")}
        {cor("corPrimaria", "Cor principal")}
        {cor("corDestaque", "Cor de destaque")}
      </div>
      <Logo empresa={empresa} />
      <div className="flex items-center justify-end gap-3">
        {!lido.success && (
          <span className="text-[11px] text-status-bad-fg">
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
    <div>
      <span className="text-[13px] font-medium">Logo</span>
      <div className="mt-1 flex items-center gap-3">
        {empresa.logoUrl ? (
          <img
            src={empresa.logoUrl}
            alt={`Logo de ${empresa.nome}`}
            className="h-14 w-14 rounded-md border border-border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
            sem logo
          </div>
        )}
        <label className="cursor-pointer">
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
          <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[12px] hover:bg-muted">
            {envio.gravando ? "Enviando…" : empresa.logoUrl ? "Trocar logo" : "Enviar logo"}
          </span>
        </label>
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
      <p className="mt-1 text-[11px] text-muted-foreground">
        PNG ou JPEG até 512 KB, de preferência quadrado. Sai no menu e nos PDFs, planilhas e
        impressões da empresa.
      </p>
    </div>
  );
}
