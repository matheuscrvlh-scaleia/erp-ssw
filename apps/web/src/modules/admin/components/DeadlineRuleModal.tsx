import { type SaidaDe } from "@erp/shared/contract";
import {
  type contratosAdmin as c,
  type DadosDoPrazo,
  type PrazoConfigurado,
  type TipoDePrazo,
} from "@erp/shared/contracts/admin";
import { useState } from "react";

import { CAMPO, Campo, Escolha } from "@/components/common/FormFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { TITULO_DO_TIPO } from "../texts";

type Opcoes = SaidaDe<typeof c.listarPrazos>;

const soDigitos = (v: string) => v.replace(/[^0-9]/g, "");
const numeroOuNulo = (v: string) => (v ? Number(v) : null);
/** Adicionar ou editar uma regra de prazo do tipo escolhido. */
export function ModalDeRegraDePrazo({
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
      <Escolha
        placeholder="Selecione a unidade"
        opcoes={opcoes.unidades.map((u) => ({
          valor: u.codigo,
          rotulo: u.cidade ? `${u.codigo} — ${u.cidade}` : u.codigo,
        }))}
        valor={valor}
        aoMudar={aoMudar}
      />
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
        className={`${CAMPO} tabular-nums`}
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
                <Escolha
                  placeholder="Selecione…"
                  opcoes={opcoes.parceiros.map((p) => ({
                    valor: p.cnpj,
                    rotulo: `${p.nome || p.cnpj} — ${p.cnpj}`,
                  }))}
                  valor={campos.parceiro}
                  aoMudar={(parceiro) => {
                    mudar({ parceiro });
                  }}
                />
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
