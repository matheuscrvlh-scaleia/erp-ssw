import { type EntradaDe } from "@erp/shared/contrato";
import { type contratosAhgora as c } from "@erp/shared/contratos/ahgora";
import { hojeNoFuso } from "@erp/shared/datas";
import { useQuery } from "@tanstack/react-query";
import { Play, RefreshCw } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Aviso } from "@/componentes/comum/Aviso";
import {
  CampoRotulado,
  CLASSE_DO_CAMPO,
  GatilhoRotulado,
  InterruptorRotulado,
} from "@/componentes/comum/CamposRotulados";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Select, SelectContent, SelectItem } from "@/componentes/ui/select";
import { Skeleton } from "@/componentes/ui/skeleton";
import { Switch } from "@/componentes/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { mesDe } from "@/lib/periodo-do-mes";

import { consultaApuracaoDoPonto, consultaDepartamentos } from "../api";
import { entradaDaApuracao, TODOS } from "../regras";
import { dataBr } from "../textos";
import { CardsDaApuracao } from "./CardsDaApuracao";
import { ComoFuncionaPonto } from "./ComoFuncionaPonto";
import { TabelaDaApuracao } from "./TabelaDaApuracao";

/**
 * Aba "Apuração do período": uma tela inteira, com filtros e consultas próprios (trocar de aba
 * recomeça a outra).
 * origem: features/ahgora/components/ApuracaoPontoScreen.tsx (sistema atual)
 */
export function AbaApuracaoDoPeriodo({ abas }: { abas: ReactNode }) {
  const hoje = hojeNoFuso(useFusoDaEmpresa());
  const [mes, setMes] = useState(() => mesDe(hoje));
  const [departamento, setDepartamento] = useState<string>(TODOS);
  const [incluirDemitidos, setIncluirDemitidos] = useState(false);
  const [filtros, setFiltros] = useState<EntradaDe<typeof c.apuracao> | null>(null);

  const departamentos = useQuery(consultaDepartamentos);
  const apuracao = useQuery(consultaApuracaoDoPonto(filtros));

  function apurar() {
    setFiltros(entradaDaApuracao(mes, departamento, incluirDemitidos));
  }

  const funcionarios = apuracao.data?.funcionarios ?? [];

  return (
    <Pagina
      titulo="Apuração de ponto (Ahgora)"
      descricao="Marcações de ponto por colaborador e período, consolidadas direto do Ahgora. Dias que não fecham com segurança aparecem como “revisar” em vez de receberem um total estimado."
      acoes={<ComoFuncionaPonto />}
      abas={abas}
      filtros={
        <>
          <FiltrosAvancados>
            <CampoRotulado rotulo="Mês" htmlFor="ponto-mes">
              <input
                id="ponto-mes"
                type="month"
                className={CLASSE_DO_CAMPO}
                value={mes}
                onChange={(e) => {
                  setMes(e.target.value);
                }}
              />
            </CampoRotulado>
            <Select value={departamento} onValueChange={setDepartamento}>
              <GatilhoRotulado rotulo="Departamento" placeholder="Todos" className="max-w-80" />
              <SelectContent>
                <SelectItem value={TODOS}>Todos os departamentos</SelectItem>
                {(departamentos.data ?? []).map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InterruptorRotulado id="incluir-demitidos" rotulo="Incluir demitidos">
              <Switch
                id="incluir-demitidos"
                checked={incluirDemitidos}
                onCheckedChange={setIncluirDemitidos}
              />
            </InterruptorRotulado>
            <Button onClick={apurar} disabled={apuracao.isFetching}>
              <Play aria-hidden />
              {apuracao.isFetching ? "Apurando…" : "Apurar"}
            </Button>
          </FiltrosAvancados>
          <p className="text-xs text-muted-foreground">
            A consulta busca as batidas de um colaborador por vez no Ahgora, então apurar um
            departamento leva alguns segundos. Períodos maiores que um mês não são aceitos pela API.
          </p>
        </>
      }
    >
      {apuracao.error && (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" onClick={() => void apuracao.refetch()}>
              <RefreshCw aria-hidden /> Tentar novamente
            </Button>
          }
        >
          {mensagemAmigavel(apuracao.error)}
        </Aviso>
      )}

      {apuracao.isFetching ? (
        <div className="space-y-4" aria-busy>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl bg-muted" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl bg-muted" />
        </div>
      ) : apuracao.data ? (
        <>
          <CardsDaApuracao funcionarios={funcionarios} />

          <Painel
            titulo={`Colaboradores · ${dataBr(apuracao.data.inicio)} a ${dataBr(apuracao.data.fim)}`}
          >
            {funcionarios.length === 0 ? (
              <EstadoVazio
                mensagem="Nenhum colaborador encontrado para os filtros selecionados."
                detalhe="Escolha outro departamento ou ligue “Incluir demitidos”."
              />
            ) : (
              <TabelaDaApuracao funcionarios={funcionarios} />
            )}
          </Painel>
        </>
      ) : (
        !apuracao.error && (
          <Painel>
            <EstadoVazio
              icone={Play}
              mensagem="Escolha o mês e o departamento e clique em “Apurar”."
            />
          </Painel>
        )
      )}
    </Pagina>
  );
}
