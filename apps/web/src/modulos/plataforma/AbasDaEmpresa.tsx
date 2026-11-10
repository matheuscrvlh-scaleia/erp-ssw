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
import { CheckCircle2, Circle, ExternalLink, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { Switch } from "@/componentes/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { CAMPO, Selo, useGravacao } from "@/modulos/admin/comum";
import { ModalNovoUsuario } from "@/modulos/admin/usuarios/ModalNovoUsuario";

import {
  CHAVES_DA_PLATAFORMA,
  consultaCadastros,
  consultaIntegracoes,
  consultaModulos,
  consultaVinculos,
} from "./api";

const PEQUENO = "h-8 rounded-md border border-input bg-background px-2 text-[12px] shadow-sm";

function Carregando({ consulta }: { consulta: { isLoading: boolean; error: unknown } }) {
  if (consulta.isLoading) return <p className="text-[12px] text-muted-foreground">Carregando…</p>;
  return consulta.error ? <MensagemErro erro={consulta.error} /> : null;
}

// --- Módulos ---------------------------------------------------------------------------------

export function AbaModulos({ empresaId }: { empresaId: string }) {
  const consulta = useQuery(consultaModulos(empresaId));
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        Módulo vale se estiver ligado e dentro do prazo (dia de Brasília). Os essenciais valem
        sempre. Módulo desligado some do menu e a tela mostra o aviso.
      </p>
      <Carregando consulta={consulta} />
      {consulta.data && (
        <div className="overflow-x-auto rounded-[10px] border border-border/70 bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Módulo</th>
                <th className="px-4 py-2.5 font-medium">Ligado</th>
                <th className="px-4 py-2.5 font-medium">Início</th>
                <th className="px-4 py-2.5 font-medium">Fim</th>
                <th className="px-4 py-2.5 font-medium">Observação</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {consulta.data.modulos.map((m) => (
                <LinhaDoModulo key={m.chave} empresaId={empresaId} modulo={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
    <tr className="border-t border-border/60 align-top">
      <td className="px-4 py-2.5">
        <div className="font-medium">{modulo.nome}</div>
        {modulo.descricao && (
          <div className="text-[11px] text-muted-foreground">{modulo.descricao}</div>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {modulo.essencial ? (
            <Selo>Essencial · sempre ligado</Selo>
          ) : moduloVigente(modulo, hoje) ? (
            <Selo tom="bom">Liberado</Selo>
          ) : (
            <Selo>Não liberado</Selo>
          )}
          {!modulo.essencial && modulo.ativo && dias !== null && dias >= 0 && dias <= 15 && (
            <Selo tom="alerta">
              {dias === 0 ? "Vence hoje" : `Vence em ${String(dias)} dia${dias === 1 ? "" : "s"}`}
            </Selo>
          )}
          {!modulo.essencial && dias !== null && dias < 0 && <Selo tom="ruim">Vencido</Selo>}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <Switch
          checked={bloqueado || m.ativo}
          disabled={bloqueado}
          onCheckedChange={(ativo) => {
            setM({ ...m, ativo });
          }}
          aria-label={`Ligar ${modulo.nome}`}
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          type="date"
          aria-label={`Início de ${modulo.nome}`}
          className={`${PEQUENO} w-[140px]`}
          value={m.inicio ?? ""}
          disabled={bloqueado}
          onChange={(e) => {
            setM({ ...m, inicio: e.target.value || null });
          }}
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          type="date"
          aria-label={`Fim de ${modulo.nome}`}
          className={`${PEQUENO} w-[140px]`}
          value={m.fim ?? ""}
          disabled={bloqueado}
          onChange={(e) => {
            setM({ ...m, fim: e.target.value || null });
          }}
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          aria-label={`Observação de ${modulo.nome}`}
          className={`${PEQUENO} min-w-[180px]`}
          placeholder="Ex.: teste de 30 dias"
          value={m.observacao ?? ""}
          disabled={bloqueado}
          onChange={(e) => {
            setM({ ...m, observacao: e.target.value });
          }}
        />
        {modulo.atualizadoEm && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            Alterado em {formatarDataHora(modulo.atualizadoEm, fuso, { virgula: true })}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
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

/** Vínculos da empresa editada; papéis e departamentos são os dela (Q29). */
export function AbaUsuarios({ empresaId }: { empresaId: string }) {
  const vinculos = useQuery(consultaVinculos(empresaId));
  const cadastros = useQuery(consultaCadastros(empresaId));
  const invalidar = [CHAVES_DA_PLATAFORMA.empresa(empresaId), CHAVES_DA_PLATAFORMA.empresas];
  const salvar = useGravacao({
    executar: (v: VinculoNaEmpresa) =>
      chamar(p.salvarVinculo, {
        parametros: { id: empresaId, usuarioId: v.usuarioId },
        entrada: { papel: v.papel, departamento: v.departamento, ativo: v.ativo },
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
  const departamentos = (cadastros.data?.departamentos ?? [])
    .filter((d) => d.ativo)
    .map((d) => ({ chave: d.chave, rotulo: d.rotulo }));

  const colunas: ColunaTabela<VinculoNaEmpresa>[] = [
    {
      chave: "nome",
      titulo: "Nome",
      celula: (u) => (
        <>
          <div className="font-medium">{u.nome ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">{u.email}</div>
          <div className="mt-0.5 flex gap-1">
            {u.adminPlataforma && <Selo>Plataforma</Selo>}
            {u.totalEmpresas > 1 && <Selo>{`${String(u.totalEmpresas)} empresas`}</Selo>}
          </div>
        </>
      ),
    },
    {
      chave: "papel",
      titulo: "Papel",
      celula: (u) => (
        <select
          aria-label={`Papel de ${u.email}`}
          className={`${PEQUENO} w-[150px]`}
          value={u.papel ?? ""}
          disabled={salvar.gravando}
          onChange={(e) => void salvar.gravar({ ...u, papel: e.target.value || null })}
        >
          <option value="">Sem papel</option>
          {cargos.map((c) => (
            <option key={c.chave} value={c.chave}>
              {c.rotulo}
            </option>
          ))}
        </select>
      ),
    },
    {
      chave: "departamento",
      titulo: "Departamento",
      celula: (u) => (
        <select
          aria-label={`Departamento de ${u.email}`}
          className={`${PEQUENO} w-[160px]`}
          value={u.departamento ?? ""}
          disabled={salvar.gravando}
          onChange={(e) => void salvar.gravar({ ...u, departamento: e.target.value || null })}
        >
          <option value="">Sem departamento</option>
          {departamentos.map((d) => (
            <option key={d.chave} value={d.chave}>
              {d.rotulo}
            </option>
          ))}
        </select>
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
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-[12px] text-muted-foreground">
          Papel e departamento valem por empresa e vêm dos cadastros desta empresa. E-mail que já
          tem conta só ganha o vínculo.
        </p>
        <ModalNovoUsuario
          cargos={cargos}
          departamentos={departamentos}
          aoGravar={convidar.gravar}
        />
      </div>
      <TabelaDados
        colunas={colunas}
        linhas={vinculos.data?.usuarios ?? []}
        chaveDaLinha={(u) => u.usuarioId}
        carregando={vinculos.isLoading || cadastros.isLoading}
        erro={vinculos.error ?? cadastros.error}
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
      <div className="grid gap-4 lg:grid-cols-2">
        {consulta.data?.integracoes.map((i) => (
          <CartaoDeIntegracao key={i.tipo} empresaId={empresaId} integracao={i} />
        ))}
      </div>
    </>
  );
}

const paraTexto = (v: ValorDeParametro | undefined) =>
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
  const [segredo, setSegredo] = useState("");
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
  // O segredo vai cifrado para o banco; o campo nunca mostra o valor gravado.
  const gravarSegredo = useGravacao({
    executar: (valor: string) =>
      chamar(p.definirSegredo, {
        parametros: { id: empresaId, tipo: integracao.tipo },
        entrada: { segredo: valor },
      }),
    sucesso: (valor) => `${info.segredo ?? "Segredo"} ${valor ? "atualizado" : "removido"}`,
    invalidar,
    aoConcluir: () => {
      setSegredo("");
    },
  });

  const conhecidas = new Set(info.campos.map((c) => c.chave));
  const extras = Object.entries(integracao.parametros).filter(([k]) => !conhecidas.has(k));

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-medium">{info.nome}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{info.descricao}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {ativo ? "Ligada" : "Desligada"}
          </span>
          <Switch checked={ativo} onCheckedChange={setAtivo} aria-label={`Ligar ${info.nome}`} />
        </div>
      </div>
      {info.campos.map((c) => (
        <label key={c.chave} className="block space-y-1">
          <span className="text-[12px] font-medium">{c.rotulo}</span>
          <input
            className={`${CAMPO} h-8 text-[12px]`}
            placeholder={c.dica}
            value={valores[c.chave] ?? ""}
            onChange={(e) => {
              const valor = e.target.value;
              setValores((v) => ({ ...v, [c.chave]: valor }));
            }}
          />
        </label>
      ))}
      {extras.length > 0 && (
        <div className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
          {extras.map(([k, v]) => (
            <div key={k}>
              <span className="font-medium">{k}:</span> {paraTexto(v)}
            </div>
          ))}
        </div>
      )}
      {info.segredo && (
        <div className="space-y-1">
          <label className="block space-y-1">
            <span className="text-[12px] font-medium">{info.segredo}</span>
            <input
              type="password"
              autoComplete="new-password"
              className={`${CAMPO} h-8 text-[12px]`}
              value={segredo}
              placeholder={
                integracao.segredoDefinidoEm ? "•••••••• (digite para trocar)" : "Não definido"
              }
              onChange={(e) => {
                setSegredo(e.target.value);
              }}
            />
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!segredo.trim() || gravarSegredo.gravando}
              onClick={() => void gravarSegredo.gravar(segredo)}
            >
              Gravar
            </Button>
            {integracao.segredoDefinidoEm && (
              <Button
                size="sm"
                variant="ghost"
                disabled={gravarSegredo.gravando}
                onClick={() => {
                  if (window.confirm(`Remover ${info.segredo ?? "o segredo"}?`)) {
                    void gravarSegredo.gravar("");
                  }
                }}
              >
                Remover
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <KeyRound className="h-3 w-3" />
            {integracao.segredoDefinidoEm
              ? `Guardado cifrado em ${formatarDataHora(integracao.segredoDefinidoEm, fuso, { virgula: true })}`
              : "Não definido."}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {integracao.ultimoTesteEm ? (
          <Selo
            tom={integracao.ultimoTesteOk ? "bom" : "ruim"}
            title={integracao.ultimoTesteMsg ?? undefined}
          >
            {`Último teste ${integracao.ultimoTesteOk ? "ok" : "com erro"} em ${formatarDataHora(integracao.ultimoTesteEm, fuso, { virgula: true })}`}
          </Selo>
        ) : (
          <Selo>Nunca testada</Selo>
        )}
        {!integracao.configurada && <Selo>Não configurada</Selo>}
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        {info.tela ? (
          <a
            href={info.tela}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            Tela da integração
          </a>
        ) : (
          <span />
        )}
        <Button size="sm" disabled={salvar.gravando} onClick={() => void salvar.gravar(undefined)}>
          {salvar.gravando ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </section>
  );
}

// --- Implantação -----------------------------------------------------------------------------

export interface ItemDaImplantacao {
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
  return (
    <div className="max-w-3xl space-y-2">
      {itens.map((i) => (
        <div
          key={i.titulo}
          className="flex items-start gap-3 rounded-[10px] border border-border/70 bg-card px-4 py-3"
        >
          {i.feito ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-good" />
          ) : (
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-status-warn" />
          )}
          <div>
            <div className="text-[13px] font-medium">{i.titulo}</div>
            <div className="text-[12px] text-muted-foreground">{i.detalhe}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
