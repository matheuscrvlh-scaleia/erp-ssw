import { type SaidaDe } from "@erp/shared/contract";
import { type contratosRanking as c, type Equipe } from "@erp/shared/contracts/ranking";
import { AlertTriangle } from "lucide-react";

import { EstadoVazio } from "@/components/common/EmptyState";
import { MensagemErro } from "@/components/common/ErrorMessage";
import { LinhasCarregando } from "@/components/common/LoadingRows";
import { Painel } from "@/components/common/Panel";
import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/components/common/table-classes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CteParaAtribuir = SaidaDe<typeof c.ctesParaAtribuir>["ctes"][number];

/** CTRCs sem equipe no período, para marcar e atribuir a uma equipe. */
export function TabelaDeAtribuicao({
  inicio,
  fim,
  aoMudarInicio,
  aoMudarFim,
  equipes,
  equipeAlvo,
  aoMudarEquipe,
  podeGravar,
  ctes,
  carregando,
  erro,
  aoTentarDeNovo,
  selecionados,
  aoMudarSelecionados,
  atribuindo,
  aoAtribuir,
}: {
  inicio: string;
  fim: string;
  aoMudarInicio: (data: string) => void;
  aoMudarFim: (data: string) => void;
  equipes: Equipe[];
  equipeAlvo: string;
  aoMudarEquipe: (id: string) => void;
  podeGravar: boolean;
  ctes: CteParaAtribuir[];
  carregando: boolean;
  erro: Error | null;
  aoTentarDeNovo: () => void;
  selecionados: Set<string>;
  aoMudarSelecionados: (ids: Set<string>) => void;
  atribuindo: boolean;
  aoAtribuir: () => void;
}) {
  return (
    <Painel
      titulo="Atribuir CTRCs sem equipe"
      icone={AlertTriangle}
      barra={
        <>
          <Input
            type="date"
            aria-label="De"
            className="h-9 w-auto text-[13px]"
            value={inicio}
            onChange={(e) => {
              aoMudarInicio(e.target.value);
            }}
          />
          <Input
            type="date"
            aria-label="Até"
            className="h-9 w-auto text-[13px]"
            value={fim}
            onChange={(e) => {
              aoMudarFim(e.target.value);
            }}
          />
          {podeGravar && (
            <>
              <Select value={equipeAlvo} onValueChange={aoMudarEquipe}>
                <SelectTrigger className="w-56 text-[13px]" aria-label="Equipe">
                  <SelectValue placeholder="Selecione equipe…" />
                </SelectTrigger>
                <SelectContent>
                  {equipes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={selecionados.size === 0 || !equipeAlvo || atribuindo}
                onClick={() => {
                  aoAtribuir();
                }}
              >
                Atribuir {selecionados.size > 0 ? `(${selecionados.size})` : ""}
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="rolagem-fina relative max-h-80 overflow-auto rounded-xl">
        <table className={CLASSE_TABELA}>
          <thead>
            <tr className={cn(CLASSE_CABECALHO, "sticky top-0 z-10 bg-muted")}>
              <th scope="col" className={cn(CLASSE_TH, "w-10")}>
                <span className="sr-only">Selecionar</span>
              </th>
              <th scope="col" className={CLASSE_TH}>
                CTRC
              </th>
              <th scope="col" className={CLASSE_TH}>
                Emissão
              </th>
              <th scope="col" className={CLASSE_TH}>
                Destino
              </th>
              <th scope="col" className={CLASSE_TH}>
                Motorista (SSW)
              </th>
            </tr>
          </thead>
          <tbody>
            {carregando && <LinhasCarregando linhas={4} colunas={5} />}
            {erro && (
              <tr>
                <td colSpan={5}>
                  <MensagemErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} />
                </td>
              </tr>
            )}
            {ctes.map((cte) => (
              <tr
                key={cte.id}
                className={cn(CLASSE_LINHA, selecionados.has(cte.id) && "bg-accent")}
              >
                <td className={CLASSE_TD}>
                  <Checkbox
                    aria-label={`Selecionar ${cte.sigla}${cte.numero}`}
                    disabled={!podeGravar}
                    checked={selecionados.has(cte.id)}
                    onCheckedChange={(marcado) => {
                      const novos = new Set(selecionados);
                      if (marcado === true) novos.add(cte.id);
                      else novos.delete(cte.id);
                      aoMudarSelecionados(novos);
                    }}
                  />
                </td>
                <td className={cn(CLASSE_TD, "font-mono")}>
                  {cte.sigla}
                  {cte.numero}
                </td>
                <td className={CLASSE_TD}>{cte.dataEmissao}</td>
                <td className={CLASSE_TD}>
                  {cte.cidadeDestino}/{cte.ufDestino}
                </td>
                <td className={CLASSE_TD}>{cte.motoristaNome ?? "—"}</td>
              </tr>
            ))}
            {!carregando && !erro && ctes.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EstadoVazio
                    mensagem="Nenhum CTRC sem equipe no período."
                    detalhe="Amplie as datas para procurar mais."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}
