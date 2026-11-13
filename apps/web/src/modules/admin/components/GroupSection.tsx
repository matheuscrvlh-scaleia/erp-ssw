import { type Configuracao, type GrupoDeConfiguracao } from "@erp/shared/contracts/admin";
import { Bell, Gauge, type LucideIcon, Trophy, Truck } from "lucide-react";
import { useEffect, useState } from "react";

import { CAMPO } from "@/components/common/FormFields";
import { Painel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";

import { DESCRICAO_DO_GRUPO, DICA_DE_TEXTO, ROTULO_DA_CHAVE, ROTULO_DO_GRUPO } from "../texts";

const ICONE_DO_GRUPO: Record<GrupoDeConfiguracao, LucideIcon> = {
  performance: Gauge,
  operacional: Truck,
  ranking: Trophy,
  notificacoes: Bell,
};

/** Um grupo de configurações com os campos e o Salvar do grupo. */
export function SecaoDoGrupo({
  grupo,
  itens,
  salvando,
  aoSalvar,
}: {
  grupo: GrupoDeConfiguracao;
  itens: Configuracao[];
  salvando: boolean;
  aoSalvar: (itens: Configuracao[]) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  // Volta ao que está gravado quando a lista muda (depois de salvar ou recarregar).
  useEffect(() => {
    setValores(Object.fromEntries(itens.map((i) => [i.chave, i.valor])));
  }, [itens]);
  const alterado = itens.some((i) => (valores[i.chave] ?? i.valor) !== i.valor);

  return (
    <Painel
      titulo={ROTULO_DO_GRUPO[grupo]}
      descricao={DESCRICAO_DO_GRUPO[grupo]}
      icone={ICONE_DO_GRUPO[grupo]}
      classeDoCorpo="divide-y divide-border"
      rodape={
        <>
          <span className="flex-1 text-[12.5px]">{alterado && "Alterações não salvas."}</span>
          <Button
            size="sm"
            disabled={!alterado || salvando}
            onClick={() => {
              aoSalvar(itens.map((i) => ({ ...i, valor: valores[i.chave] ?? i.valor })));
            }}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      {itens.map((i) => {
        const dica = DICA_DE_TEXTO[i.chave];
        return (
          <div
            key={i.chave}
            className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_200px] md:items-start md:gap-6"
          >
            <div className="space-y-1">
              <label htmlFor={`cfg-${i.chave}`} className="text-[13px] font-semibold">
                {ROTULO_DA_CHAVE[i.chave] ?? i.chave}
              </label>
              <p className="text-[12.5px] text-muted-foreground">{i.descricao}</p>
              <p className="font-mono text-xs text-muted-foreground">{i.chave}</p>
            </div>
            <input
              id={`cfg-${i.chave}`}
              className={`${CAMPO} tabular-nums`}
              inputMode={dica ? "text" : "decimal"}
              placeholder={dica}
              value={valores[i.chave] ?? i.valor}
              onChange={(e) => {
                const valor = e.target.value;
                setValores((v) => ({ ...v, [i.chave]: valor }));
              }}
            />
          </div>
        );
      })}
    </Painel>
  );
}
