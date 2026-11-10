import { type SaidaDe } from "@erp/shared/contrato";
import {
  contratosAdmin as c,
  type DadosDoPrazo,
  type PrazoConfigurado,
  type TipoDePrazo,
} from "@erp/shared/contratos/admin";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/componentes/ui/dialog";
import { Switch } from "@/componentes/ui/switch";
import { chamar } from "@/lib/api";

import { CHAVES, consultaPrazos } from "../api";
import { CAMPO, Campo, useGravacao } from "../comum";

type Opcoes = SaidaDe<typeof c.listarPrazos>;
type Resultado = SaidaDe<typeof c.criarPrazo>;

/** O recálculo roda no worker; sem fila (só em desenvolvimento) vale para os CT-e novos. */
const avisoDoRecalculo = (r: Resultado) =>
  r.recalculoAgendado
    ? "A previsão dos CT-e afetados será recalculada em instantes."
    : "O recálculo dos CT-e existentes não pôde ser agendado; avise o suporte.";

const TITULO_DO_TIPO: Record<TipoDePrazo, string> = {
  unidade: "Regra por unidade",
  parceiro: "Regra por parceiro",
  transbordo: "Regra de transbordo",
};

export function SecaoPrazos() {
  const consulta = useQuery(consultaPrazos);
  const [modal, setModal] = useState<{ tipo: TipoDePrazo; regra: PrazoConfigurado | null } | null>(
    null,
  );
  const invalidar = [CHAVES.prazos];
  const salvar = useGravacao({
    executar: ({ id, dados }: { id: string | null; dados: DadosDoPrazo }) =>
      id
        ? chamar(c.alterarPrazo, { parametros: { id }, entrada: dados })
        : chamar(c.criarPrazo, { entrada: dados }),
    sucesso: (_, r) => `Regra salva. ${avisoDoRecalculo(r)}`,
    invalidar,
  });
  const ligar = useGravacao({
    executar: ({ id, ativo }: { id: string; ativo: boolean }) =>
      chamar(c.ligarPrazo, { parametros: { id }, entrada: { ativo } }),
    sucesso: ({ ativo }, r) => `Regra ${ativo ? "ativada" : "desativada"}. ${avisoDoRecalculo(r)}`,
    invalidar,
  });
  const excluir = useGravacao({
    executar: (id: string) => chamar(c.excluirPrazo, { parametros: { id } }),
    sucesso: (_, r) => `Regra removida. ${avisoDoRecalculo(r)}`,
    invalidar,
  });

  const regras = consulta.data?.regras ?? [];
  const doTipo = (tipo: TipoDePrazo) => regras.filter((r) => r.tipo === tipo);
  const acoes = {
    aoEditar: (r: PrazoConfigurado) => {
      setModal({ tipo: r.tipo, regra: r });
    },
    aoLigar: (r: PrazoConfigurado, ativo: boolean) => void ligar.gravar({ id: r.id, ativo }),
    aoExcluir: (r: PrazoConfigurado) => {
      if (window.confirm("Remover esta regra e recalcular os CT-e afetados?")) {
        void excluir.gravar(r.id);
      }
    },
  };

  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="space-y-1.5 p-6 pb-3">
        <h2 className="text-[15px] font-medium">Prazos de entrega</h2>
        <p className="text-[12px] text-muted-foreground">
          Regras manuais que sobrepõem o prazo do SSW. Prioridade: <strong>parceiro</strong> &gt;{" "}
          <strong>transbordo</strong> &gt; <strong>unidade</strong> &gt; SSW. Valem para os CT-e
          novos na hora; os já existentes são recalculados logo depois de salvar. Sem regra, o CT-e
          volta à previsão do SSW.
        </p>
      </header>
      <div className="space-y-8 p-6 pt-3">
        {consulta.isLoading && <p className="text-sm text-muted-foreground">Carregando regras…</p>}
        {consulta.error && (
          <MensagemErro
            erro={consulta.error}
            titulo="Não foi possível carregar as regras"
            aoTentarDeNovo={() => void consulta.refetch()}
          />
        )}
        {consulta.data && (
          <>
            <SubSecao
              titulo="Por unidade"
              descricao="Prazo fixo em horas após a chegada na unidade (ocorrência 84)."
              regras={doTipo("unidade")}
              aoAdicionar={() => {
                setModal({ tipo: "unidade", regra: null });
              }}
              descrever={(r) => (
                <>
                  <span className="font-mono text-[12px]">{r.unidadeCodigo}</span>
                  <span className="text-muted-foreground">{r.prazoHoras}h após chegada</span>
                </>
              )}
              {...acoes}
            />
            <SubSecao
              titulo="Por parceiro"
              descricao="Prazo em dias após a emissão, acordado com o parceiro. Tem prioridade sobre transbordo e unidade."
              regras={doTipo("parceiro")}
              aoAdicionar={() => {
                setModal({ tipo: "parceiro", regra: null });
              }}
              descrever={(r) => (
                <>
                  <span className="truncate">{r.parceiroNome ?? "—"}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {r.parceiroCnpj}
                  </span>
                  <span className="text-muted-foreground">{r.prazoDias} dias após emissão</span>
                </>
              )}
              {...acoes}
            />
            <SubSecao
              titulo="Transbordo"
              descricao="CT-e que chega em uma filial e é repassado para outra. O prazo conta em dias a partir da chegada na filial destino."
              regras={doTipo("transbordo")}
              aoAdicionar={() => {
                setModal({ tipo: "transbordo", regra: null });
              }}
              descrever={(r) => (
                <>
                  <span className="font-mono text-[12px]">
                    {r.unidadeCodigo} → {r.unidadeDestinoCodigo}
                  </span>
                  <span className="text-muted-foreground">
                    {r.prazoDias} dias após chegada em {r.unidadeDestinoCodigo}
                  </span>
                </>
              )}
              {...acoes}
            />
          </>
        )}
        {modal && consulta.data && (
          <ModalDeRegra
            tipo={modal.tipo}
            regra={modal.regra}
            opcoes={consulta.data}
            aoFechar={() => {
              setModal(null);
            }}
            aoGravar={async (dados) => {
              const gravou = await salvar.gravar({ id: modal.regra?.id ?? null, dados });
              if (gravou) setModal(null);
            }}
            gravando={salvar.gravando}
          />
        )}
      </div>
    </section>
  );
}

function SubSecao({
  titulo,
  descricao,
  regras,
  descrever,
  aoAdicionar,
  aoEditar,
  aoLigar,
  aoExcluir,
}: {
  titulo: string;
  descricao: string;
  regras: PrazoConfigurado[];
  descrever: (r: PrazoConfigurado) => ReactNode;
  aoAdicionar: () => void;
  aoEditar: (r: PrazoConfigurado) => void;
  aoLigar: (r: PrazoConfigurado, ativo: boolean) => void;
  aoExcluir: (r: PrazoConfigurado) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium">{titulo}</h3>
          <p className="text-[12px] text-muted-foreground">{descricao}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={aoAdicionar}
          className="shrink-0"
          aria-label={`Adicionar ${titulo.toLowerCase()}`}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>
      {regras.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-[12px] text-muted-foreground">
          Nenhuma regra cadastrada.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {regras.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 px-3 py-2 text-[13px] ${r.ativo ? "" : "opacity-60"}`}
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
                {descrever(r)}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Switch
                    checked={r.ativo}
                    onCheckedChange={(ativo) => {
                      aoLigar(r, ativo);
                    }}
                    aria-label="Ativo"
                  />
                  {r.ativo ? "Ativa" : "Inativa"}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    aoEditar(r);
                  }}
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => {
                    aoExcluir(r);
                  }}
                  aria-label="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const soDigitos = (v: string) => v.replace(/[^0-9]/g, "");
const numeroOuNulo = (v: string) => (v ? Number(v) : null);

export function ModalDeRegra({
  tipo,
  regra,
  opcoes,
  aoFechar,
  aoGravar,
  gravando,
}: {
  tipo: TipoDePrazo;
  regra: PrazoConfigurado | null;
  opcoes: Pick<Opcoes, "unidades" | "parceiros">;
  aoFechar: () => void;
  aoGravar: (dados: DadosDoPrazo) => Promise<void>;
  gravando: boolean;
}) {
  const [campos, setCampos] = useState({
    unidade: regra?.unidadeCodigo ?? "",
    destino: regra?.unidadeDestinoCodigo ?? "",
    parceiro: regra?.parceiroCnpj ?? "",
    horas: regra?.prazoHoras?.toString() ?? "",
    dias: regra?.prazoDias?.toString() ?? "",
  });
  const mudar = (parte: Partial<typeof campos>) => {
    setCampos((c) => ({ ...c, ...parte }));
  };
  const parceiro = opcoes.parceiros.find((p) => p.cnpj === campos.parceiro) ?? null;

  // A API confere os campos obrigatórios do tipo e devolve a mensagem para o toast.
  const dados: DadosDoPrazo = {
    tipo,
    ativo: regra?.ativo ?? true,
    unidadeCodigo: tipo === "parceiro" ? null : campos.unidade || null,
    unidadeDestinoCodigo: tipo === "transbordo" ? campos.destino || null : null,
    parceiroCnpj: tipo === "parceiro" ? campos.parceiro || null : null,
    parceiroNome: tipo === "parceiro" ? (parceiro?.nome ?? null) : null,
    prazoHoras: tipo === "unidade" ? numeroOuNulo(campos.horas) : null,
    prazoDias: tipo === "unidade" ? null : numeroOuNulo(campos.dias),
  };

  const seletorDeUnidade = (rotulo: string, valor: string, aoMudar: (v: string) => void) => (
    <Campo rotulo={rotulo}>
      <select
        className={CAMPO}
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
      >
        <option value="">Selecione a unidade</option>
        {opcoes.unidades.map((u) => (
          <option key={u.codigo} value={u.codigo}>
            {u.cidade ? `${u.codigo} — ${u.cidade}` : u.codigo}
          </option>
        ))}
      </select>
    </Campo>
  );
  const campoNumerico = (
    rotulo: string,
    valor: string,
    sufixo: string,
    aoMudar: (v: string) => void,
  ) => (
    <Campo rotulo={rotulo}>
      <input
        inputMode="numeric"
        className={CAMPO}
        value={valor}
        placeholder={sufixo}
        onChange={(e) => {
          aoMudar(soDigitos(e.target.value));
        }}
      />
    </Campo>
  );

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) aoFechar();
      }}
    >
      <DialogContent className="sm:max-w-[460px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {regra ? "Editar" : "Adicionar"} — {TITULO_DO_TIPO[tipo]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {tipo === "unidade" && (
            <>
              {seletorDeUnidade("Unidade", campos.unidade, (unidade) => {
                mudar({ unidade });
              })}
              {campoNumerico("Horas para entrega", campos.horas, "h", (horas) => {
                mudar({ horas });
              })}
            </>
          )}
          {tipo === "parceiro" && (
            <>
              <Campo rotulo="Parceiro" ajuda={parceiro ? `CNPJ: ${parceiro.cnpj}` : undefined}>
                <select
                  className={CAMPO}
                  value={campos.parceiro}
                  onChange={(e) => {
                    mudar({ parceiro: e.target.value });
                  }}
                >
                  <option value="">Selecione…</option>
                  {opcoes.parceiros.map((p) => (
                    <option key={p.cnpj} value={p.cnpj}>
                      {p.nome || p.cnpj} — {p.cnpj}
                    </option>
                  ))}
                </select>
              </Campo>
              {campoNumerico("Prazo em dias", campos.dias, "dias", (dias) => {
                mudar({ dias });
              })}
            </>
          )}
          {tipo === "transbordo" && (
            <>
              {seletorDeUnidade("Unidade origem", campos.unidade, (unidade) => {
                mudar({ unidade });
              })}
              {seletorDeUnidade("Unidade destino", campos.destino, (destino) => {
                mudar({ destino });
              })}
              {campoNumerico(
                "Dias após chegada na unidade destino",
                campos.dias,
                "dias",
                (dias) => {
                  mudar({ dias });
                },
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar} disabled={gravando}>
            Cancelar
          </Button>
          <Button onClick={() => void aoGravar(dados)} disabled={gravando}>
            {gravando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
