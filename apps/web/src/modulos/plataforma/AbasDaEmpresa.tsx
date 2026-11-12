import { moduloVigente } from "@erp/dominio/acesso";
import { type NovoUsuario } from "@erp/shared/contratos/admin";
import {
  contratosPlataforma as p,
  type EmpresaCompleta,
  type IntegracaoDaEmpresa,
  type ModuloDaEmpresa,
  type ValorDeParametro,
  type VinculoNaEmpresa,
} from "@erp/shared/contratos/plataforma";
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/datas";
import { formatarDataHora } from "@erp/shared/formatacao";
import { INFO_DA_INTEGRACAO } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink, KeyRound, ListChecks } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { Skeleton } from "@/componentes/ui/skeleton";
import { Switch } from "@/componentes/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CAMPO, Campo, Escolha, useGravacao } from "@/modulos/admin/comum";
import { ModalNovoUsuario } from "@/modulos/admin/usuarios/ModalNovoUsuario";

import {
  CHAVES_DA_PLATAFORMA,
  consultaCargosDaEmpresa,
  consultaIntegracoes,
  consultaModulos,
  consultaVinculos,
} from "./api";

/** Campo compacto das linhas de tabela (datas e observação dos módulos). */
const PEQUENO = cn(CAMPO, "h-8");

function Carregando({ consulta }: { consulta: { isLoading: boolean; error: unknown } }) {
  if (consulta.isLoading) {
    return (
      <div role="status" aria-label="Carregando…" className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl bg-muted" />
        <Skeleton className="h-40 rounded-2xl bg-muted" />
      </div>
    );
  }
  return consulta.error ? (
    <Painel>
      <MensagemErro erro={consulta.error} />
    </Painel>
  ) : null;
}

// --- Módulos ---------------------------------------------------------------------------------

const CABECALHO = "px-4 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.04em] uppercase";

export function AbaModulos({ empresaId }: { empresaId: string }) {
  const consulta = useQuery(consultaModulos(empresaId));
  return (
    <Painel
      titulo="Módulos"
      descricao="Módulo vale se estiver ligado e dentro do prazo (dia de Brasília). Os essenciais valem sempre. Módulo desligado some do menu e a tela mostra o aviso."
    >
      {consulta.isLoading || consulta.error ? (
        <div className="p-4">
          <Carregando consulta={consulta} />
        </div>
      ) : (
        consulta.data && (
          <div className="rolagem-fina overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/70 text-muted-foreground">
                  <th className={CABECALHO}>Módulo</th>
                  <th className={CABECALHO}>Ligado</th>
                  <th className={CABECALHO}>Início</th>
                  <th className={CABECALHO}>Fim</th>
                  <th className={CABECALHO}>Observação</th>
                  <th className={CABECALHO}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {consulta.data.modulos.map((m) => (
                  <LinhaDoModulo key={m.chave} empresaId={empresaId} modulo={m} />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </Painel>
  );
}

function LinhaDoModulo({ empresaId, modulo }: { empresaId: string; modulo: ModuloDaEmpresa }) {
  const [m, setM] = useState(modulo);
  useEffect(() => {
    setM(modulo);
  }, [modulo]);
  const alterado =
    m.ativo !== modulo.ativo ||
    m.inicio !== modulo.inicio ||
    m.fim !== modulo.fim ||
    (m.observacao ?? "") !== (modulo.observacao ?? "");
  const salvar = useGravacao({
    executar: () =>
      chamar(p.salvarModulo, {
        parametros: { id: empresaId, modulo: m.chave },
        entrada: { ativo: m.ativo, inicio: m.inicio, fim: m.fim, observacao: m.observacao },
      }),
    sucesso: `Módulo ${modulo.nome} salvo`,
    invalidar: [CHAVES_DA_PLATAFORMA.empresa(empresaId), CHAVES_DA_PLATAFORMA.empresas, ["acesso"]],
  });

  const fuso = useFusoDaEmpresa();
  const hoje = hojeNoFuso(fuso);
  const dias = modulo.fim ? diferencaEmDias(hoje, modulo.fim) : null;
  const bloqueado = modulo.essencial;

  return (
    <tr
      className={cn(
        "border-b border-border align-top last:border-b-0 hover:bg-muted/60",
        alterado && "bg-accent hover:bg-accent",
      )}
    >
      <td className="px-4 py-3">
        <div className="font-semibold">{modulo.nome}</div>
        {modulo.descricao && (
          <div className="text-xs text-muted-foreground">{modulo.descricao}</div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {modulo.essencial ? (
            <SeloStatus tom="neutro">Essencial · sempre ligado</SeloStatus>
          ) : moduloVigente(modulo, hoje) ? (
            <SeloStatus tom="sucesso">Liberado</SeloStatus>
          ) : (
            <SeloStatus tom="neutro">Não liberado</SeloStatus>
          )}
          {!modulo.essencial && modulo.ativo && dias !== null && dias >= 0 && dias <= 15 && (
            <SeloStatus tom="alerta">
              {dias === 0 ? "Vence hoje" : `Vence em ${String(dias)} dia${dias === 1 ? "" : "s"}`}
            </SeloStatus>
          )}
          {!modulo.essencial && dias !== null && dias < 0 && (
            <SeloStatus tom="erro">Vencido</SeloStatus>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Switch
          checked={bloqueado || m.ativo}
          disabled={bloqueado}
          onCheckedChange={(ativo) => {
            setM({ ...m, ativo });
          }}
          aria-label={`Ligar ${modulo.nome}`}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          aria-label={`Início de ${modulo.nome}`}
          className={cn(PEQUENO, "w-[150px] tabular-nums")}
          value={m.inicio ?? ""}
          disabled={bloqueado}
          onChange={(e) => {
            setM({ ...m, inicio: e.target.value || null });
          }}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          aria-label={`Fim de ${modulo.nome}`}
          className={cn(PEQUENO, "w-[150px] tabular-nums")}
          value={m.fim ?? ""}
          disabled={bloqueado}
          onChange={(e) => {
            setM({ ...m, fim: e.target.value || null });
          }}
        />
      </td>
      <td className="px-4 py-3">
        <input
          aria-label={`Observação de ${modulo.nome}`}
          className={cn(PEQUENO, "min-w-[180px]")}
          placeholder="Ex.: teste de 30 dias"
          value={m.observacao ?? ""}
          disabled={bloqueado}
          onChange={(e) => {
            setM({ ...m, observacao: e.target.value });
          }}
        />
        {modulo.atualizadoEm && (
          <div className="mt-1 text-xs text-muted-foreground">
            Alterado em {formatarDataHora(modulo.atualizadoEm, fuso, { virgula: true })}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {!bloqueado && (
          <Button
            size="sm"
            variant={alterado ? "default" : "outline"}
            disabled={!alterado || salvar.gravando}
            onClick={() => void salvar.gravar(undefined)}
          >
            Salvar
          </Button>
        )}
      </td>
    </tr>
  );
}

// --- Usuários --------------------------------------------------------------------------------

/** Vínculos da empresa editada; os cargos são os dela (Q29). */
export function AbaUsuarios({ empresaId }: { empresaId: string }) {
  const vinculos = useQuery(consultaVinculos(empresaId));
  const cadastros = useQuery(consultaCargosDaEmpresa(empresaId));
  const invalidar = [CHAVES_DA_PLATAFORMA.empresa(empresaId), CHAVES_DA_PLATAFORMA.empresas];
  const salvar = useGravacao({
    executar: (v: VinculoNaEmpresa) =>
      chamar(p.salvarVinculo, {
        parametros: { id: empresaId, usuarioId: v.usuarioId },
        entrada: { papel: v.papel, ativo: v.ativo },
      }),
    sucesso: "Vínculo atualizado",
    invalidar,
  });
  const convidar = useGravacao({
    executar: (novo: NovoUsuario) =>
      chamar(p.convidarUsuario, { parametros: { id: empresaId }, entrada: novo }),
    sucesso: (novo, r) =>
      r.jaExistia
        ? "O e-mail já tinha conta: usuário vinculado à empresa"
        : novo.modo === "convite"
          ? "Convite enviado"
          : "Usuário criado",
    invalidar,
  });

  const cargos = (cadastros.data?.cargos ?? []).map((c) => ({ chave: c.chave, rotulo: c.rotulo }));

  const colunas: ColunaTabela<VinculoNaEmpresa>[] = [
    {
      chave: "nome",
      titulo: "Nome",
      celula: (u) => (
        <>
          <div className="font-semibold">{u.nome ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{u.email}</div>
          {(u.adminPlataforma || u.totalEmpresas > 1) && (
            <div className="mt-1 flex gap-1">
              {u.adminPlataforma && (
                <SeloStatus tom="info" icone={KeyRound}>
                  Plataforma
                </SeloStatus>
              )}
              {u.totalEmpresas > 1 && (
                <SeloStatus
                  tom="neutro"
                  semIcone
                >{`${String(u.totalEmpresas)} empresas`}</SeloStatus>
              )}
            </div>
          )}
        </>
      ),
    },
    {
      chave: "papel",
      titulo: "Cargo",
      celula: (u) => (
        <Escolha
          rotulo={`Cargo de ${u.email}`}
          className="h-8 w-[180px]"
          vazio="Sem cargo"
          opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.rotulo }))}
          valor={u.papel ?? ""}
          disabled={salvar.gravando}
          aoMudar={(papel) => void salvar.gravar({ ...u, papel: papel || null })}
        />
      ),
    },
    {
      chave: "ativo",
      titulo: "Ativo",
      ordenavel: false,
      celula: (u) => (
        <Switch
          checked={u.ativo}
          disabled={salvar.gravando}
          onCheckedChange={(ativo) => void salvar.gravar({ ...u, ativo })}
          aria-label={`Vínculo ativo de ${u.email}`}
        />
      ),
    },
    { chave: "criadoEm", titulo: "Desde", formato: "datahora", classe: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-[13px] text-muted-foreground">
          O cargo vale por empresa e vem dos cargos desta empresa (o que cada um vê e faz é definido
          em Usuários e cargos da empresa). E-mail que já tem conta só ganha o vínculo.
        </p>
        <ModalNovoUsuario cargos={cargos} aoGravar={convidar.gravar} />
      </div>
      <TabelaDados
        colunas={colunas}
        linhas={vinculos.data?.usuarios ?? []}
        chaveDaLinha={(u) => u.usuarioId}
        carregando={vinculos.isLoading || cadastros.isLoading}
        erro={vinculos.error ?? cadastros.error}
        aoTentarDeNovo={() => {
          void vinculos.refetch();
          void cadastros.refetch();
        }}
        mensagemVazia="Nenhum usuário vinculado ainda."
      />
    </div>
  );
}

// --- Integrações -----------------------------------------------------------------------------

export function AbaIntegracoes({ empresaId }: { empresaId: string }) {
  const consulta = useQuery(consultaIntegracoes(empresaId));
  return (
    <>
      <Carregando consulta={consulta} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {consulta.data?.integracoes.map((i) => (
          <CartaoDeIntegracao key={i.tipo} empresaId={empresaId} integracao={i} />
        ))}
      </div>
    </>
  );
}

export const paraTexto = (v: ValorDeParametro | undefined) =>
  v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v);

/**
 * Parâmetros que a tela edita trocados pelo digitado (lista separada por vírgula); os que ela não
 * conhece ficam como estão.
 */
export function parametrosEditados(
  atuais: Record<string, ValorDeParametro>,
  campos: readonly { chave: string; lista?: boolean }[],
  digitados: Record<string, string>,
): Record<string, ValorDeParametro> {
  const editados = new Set(campos.map((c) => c.chave));
  const parametros = Object.fromEntries(Object.entries(atuais).filter(([k]) => !editados.has(k)));
  for (const c of campos) {
    const bruto = (digitados[c.chave] ?? "").trim();
    if (bruto)
      parametros[c.chave] = c.lista
        ? bruto
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : bruto;
  }
  return parametros;
}

/** Dica curta vai no placeholder; a longa (instrução) vai embaixo do campo, inteira. */
const DICA_LONGA = 40;

/** Um parâmetro de integração (empresa ou Plataforma). */
export function CampoDoParametro({
  rotulo,
  dica,
  valor,
  aoMudar,
}: {
  rotulo: string;
  dica?: string | undefined;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  const longa = dica !== undefined && dica.length > DICA_LONGA;
  return (
    <Campo rotulo={rotulo} ajuda={longa ? dica : undefined}>
      <input
        className={CAMPO}
        placeholder={longa ? undefined : dica}
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
      />
    </Campo>
  );
}

/**
 * Senha/token de uma integração: vai cifrado para o banco e o campo nunca mostra o valor gravado.
 * `aoGravar("")` remove. Usado nas integrações da empresa e nas da Plataforma.
 */
export function CampoDeSegredo({
  rotulo,
  definidoEm,
  gravando,
  aoGravar,
}: {
  rotulo: string;
  definidoEm: string | null;
  gravando: boolean;
  aoGravar: (valor: string) => Promise<boolean>;
}) {
  const fuso = useFusoDaEmpresa();
  const [segredo, setSegredo] = useState("");
  const gravar = async (valor: string) => {
    if (await aoGravar(valor)) setSegredo("");
  };
  return (
    <div className="space-y-2 rounded-xl border border-border bg-superficie p-3">
      <Campo rotulo={rotulo}>
        <input
          type="password"
          autoComplete="new-password"
          className={CAMPO}
          value={segredo}
          placeholder={definidoEm ? "•••••••• (digite para trocar)" : "Não definido"}
          onChange={(e) => {
            setSegredo(e.target.value);
          }}
        />
      </Campo>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!segredo.trim() || gravando}
          onClick={() => void gravar(segredo)}
        >
          Gravar
        </Button>
        {definidoEm && (
          <Button
            size="sm"
            variant="ghost"
            disabled={gravando}
            onClick={() => {
              if (window.confirm(`Remover ${rotulo}?`)) void gravar("");
            }}
          >
            Remover
          </Button>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          {definidoEm
            ? `Guardado cifrado em ${formatarDataHora(definidoEm, fuso, { virgula: true })}`
            : "Não definido."}
        </span>
      </div>
    </div>
  );
}

function CartaoDeIntegracao({
  empresaId,
  integracao,
}: {
  empresaId: string;
  integracao: IntegracaoDaEmpresa;
}) {
  const fuso = useFusoDaEmpresa();
  const info = INFO_DA_INTEGRACAO[integracao.tipo];
  const [ativo, setAtivo] = useState(integracao.ativo);
  const [valores, setValores] = useState<Record<string, string>>({});
  useEffect(() => {
    setAtivo(integracao.ativo);
    setValores(
      Object.fromEntries(
        info.campos.map((c) => [c.chave, paraTexto(integracao.parametros[c.chave])]),
      ),
    );
  }, [integracao, info]);

  const invalidar = [CHAVES_DA_PLATAFORMA.empresa(empresaId), CHAVES_DA_PLATAFORMA.empresas];
  const salvar = useGravacao({
    executar: () =>
      chamar(p.salvarIntegracao, {
        parametros: { id: empresaId, tipo: integracao.tipo },
        entrada: {
          ativo,
          parametros: parametrosEditados(integracao.parametros, info.campos, valores),
        },
      }),
    sucesso: `${info.nome} salvo`,
    invalidar,
  });
  const gravarSegredo = useGravacao({
    executar: (valor: string) =>
      chamar(p.definirSegredo, {
        parametros: { id: empresaId, tipo: integracao.tipo },
        entrada: { segredo: valor },
      }),
    sucesso: (valor) => `${info.segredo ?? "Segredo"} ${valor ? "atualizado" : "removido"}`,
    invalidar,
  });

  const conhecidas = new Set(info.campos.map((c) => c.chave));
  const extras = Object.entries(integracao.parametros).filter(([k]) => !conhecidas.has(k));

  return (
    <Painel
      titulo={info.nome}
      descricao={info.descricao}
      acoes={
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <SeloStatus tom={ativo ? "sucesso" : "neutro"}>
            {ativo ? "Ligada" : "Desligada"}
          </SeloStatus>
          <Switch checked={ativo} onCheckedChange={setAtivo} aria-label={`Ligar ${info.nome}`} />
        </label>
      }
      classeDoCorpo="space-y-4 p-5"
      rodape={
        <>
          {info.tela ? (
            <a
              href={info.tela}
              className="mr-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Tela da integração
            </a>
          ) : (
            <span className="mr-auto" />
          )}
          <Button
            size="sm"
            disabled={salvar.gravando}
            onClick={() => void salvar.gravar(undefined)}
          >
            {salvar.gravando ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {integracao.ultimoTesteEm ? (
          <span title={integracao.ultimoTesteMsg ?? undefined}>
            <SeloStatus tom={integracao.ultimoTesteOk ? "sucesso" : "erro"}>
              {`Último teste ${integracao.ultimoTesteOk ? "ok" : "com erro"} em ${formatarDataHora(integracao.ultimoTesteEm, fuso, { virgula: true })}`}
            </SeloStatus>
          </span>
        ) : (
          <SeloStatus tom="neutro">Nunca testada</SeloStatus>
        )}
        {!integracao.configurada && <SeloStatus tom="alerta">Não configurada</SeloStatus>}
      </div>
      {info.campos.map((c) => (
        <CampoDoParametro
          key={c.chave}
          rotulo={c.rotulo}
          dica={c.dica}
          valor={valores[c.chave] ?? ""}
          aoMudar={(valor) => {
            setValores((v) => ({ ...v, [c.chave]: valor }));
          }}
        />
      ))}
      {extras.length > 0 && (
        <dl className="space-y-0.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {extras.map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-semibold">{k}:</dt>{" "}
              <dd className="inline">{paraTexto(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {info.segredo && (
        <CampoDeSegredo
          rotulo={info.segredo}
          definidoEm={integracao.segredoDefinidoEm}
          gravando={gravarSegredo.gravando}
          aoGravar={gravarSegredo.gravar}
        />
      )}
    </Painel>
  );
}

// --- Implantação -----------------------------------------------------------------------------

interface ItemDaImplantacao {
  titulo: string;
  detalhe: string;
  feito: boolean;
}

/** Checklist de implantação a partir do estado da empresa (mesmos dados das outras abas). */
export function itensDaImplantacao(
  empresa: Pick<EmpresaCompleta, "razaoSocial" | "cnpj" | "dominioSsw" | "status">,
  modulos: readonly ModuloDaEmpresa[],
  integracoes: readonly IntegracaoDaEmpresa[],
  vinculos: readonly VinculoNaEmpresa[],
  hoje: string,
): ItemDaImplantacao[] {
  const faltando = [
    !empresa.razaoSocial && "razão social",
    !empresa.cnpj && "CNPJ",
    !empresa.dominioSsw && "domínio SSW",
  ].filter((x): x is string => typeof x === "string");
  const liberados = modulos.filter((m) => !m.essencial && moduloVigente(m, hoje));
  const ligadas = integracoes.filter((i) => i.ativo);
  const semSegredo = ligadas.filter(
    (i) => INFO_DA_INTEGRACAO[i.tipo].segredo && !i.segredoDefinidoEm,
  );
  const daEmpresa = vinculos.filter((u) => u.ativo && !u.adminPlataforma);
  const plural = (n: number) => (n === 1 ? "" : "s");
  return [
    {
      titulo: "Dados da empresa",
      detalhe: faltando.length ? `Falta: ${faltando.join(", ")}.` : "Completos.",
      feito: faltando.length === 0,
    },
    {
      titulo: "Módulos liberados",
      detalhe: liberados.length
        ? liberados.map((m) => m.nome).join(", ")
        : "Nenhum módulo além dos essenciais.",
      feito: liberados.length > 0,
    },
    {
      titulo: "Integrações configuradas",
      detalhe: ligadas.length
        ? ligadas.map((i) => INFO_DA_INTEGRACAO[i.tipo].nome).join(", ")
        : "Nenhuma integração ligada.",
      feito: ligadas.length > 0,
    },
    {
      titulo: "Senhas e tokens das integrações",
      detalhe: semSegredo.length
        ? `Falta: ${semSegredo.map((i) => INFO_DA_INTEGRACAO[i.tipo].segredo ?? i.tipo).join(", ")}.`
        : "Todas as integrações ligadas têm o segredo gravado.",
      feito: ligadas.length > 0 && semSegredo.length === 0,
    },
    {
      titulo: "Usuários convidados",
      detalhe: daEmpresa.length
        ? `${String(daEmpresa.length)} usuário${plural(daEmpresa.length)} da empresa.`
        : "Nenhum usuário da empresa (fora a equipe da Plataforma).",
      feito: daEmpresa.length > 0,
    },
    {
      titulo: "Empresa ativa",
      detalhe:
        empresa.status === "ativa"
          ? "Em produção."
          : "Mude o status para Ativa na aba Dados quando a implantação terminar.",
      feito: empresa.status === "ativa",
    },
  ];
}

export function AbaImplantacao({ empresa }: { empresa: EmpresaCompleta }) {
  const modulos = useQuery(consultaModulos(empresa.id));
  const vinculos = useQuery(consultaVinculos(empresa.id));
  const integracoes = useQuery(consultaIntegracoes(empresa.id));
  if (!modulos.data || !vinculos.data || !integracoes.data) {
    return (
      <Carregando
        consulta={{
          isLoading: modulos.isLoading || vinculos.isLoading || integracoes.isLoading,
          error: modulos.error ?? vinculos.error ?? integracoes.error,
        }}
      />
    );
  }
  const itens = itensDaImplantacao(
    empresa,
    modulos.data.modulos,
    integracoes.data.integracoes,
    vinculos.data.usuarios,
    hojeNoFuso(empresa.fuso),
  );
  const feitos = itens.filter((i) => i.feito).length;
  return (
    <Painel
      className="max-w-[960px]"
      rotulo="Implantação"
      titulo={`${String(feitos)} de ${String(itens.length)} etapas concluídas`}
      icone={ListChecks}
    >
      <div
        className="mx-5 mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Etapas concluídas"
        aria-valuemin={0}
        aria-valuemax={itens.length}
        aria-valuenow={feitos}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${String((feitos / itens.length) * 100)}%` }}
        />
      </div>
      <ol className="divide-y divide-border px-1 py-2">
        {itens.map((i) => (
          <ItemDaLista key={i.titulo} feito={i.feito} titulo={i.titulo}>
            {i.detalhe}
          </ItemDaLista>
        ))}
      </ol>
    </Painel>
  );
}

function ItemDaLista({
  feito,
  titulo,
  children,
}: {
  feito: boolean;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      {feito ? (
        <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-status-good" aria-hidden />
      ) : (
        <Circle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-status-warn" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">{titulo}</div>
        <div className="text-[12.5px] text-muted-foreground">{children}</div>
      </div>
      <SeloStatus tom={feito ? "sucesso" : "alerta"}>{feito ? "Feito" : "Pendente"}</SeloStatus>
    </li>
  );
}
