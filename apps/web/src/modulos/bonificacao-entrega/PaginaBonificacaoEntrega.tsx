import { agruparPorPessoa } from "@erp/dominio/bonificacao-entrega";
import { type EntradaDe } from "@erp/shared/contrato";
import { type contratosBonificacaoEntrega as c } from "@erp/shared/contratos/bonificacao-entrega";
import { hojeNoFuso } from "@erp/shared/datas";
import { useQuery } from "@tanstack/react-query";
import { Play, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import {
  CampoRotulado,
  CLASSE_DO_CAMPO,
  GatilhoRotulado,
  InterruptorRotulado,
} from "@/componentes/comum/CamposRotulados";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/componentes/comum/FiltrosAvancados";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Select, SelectContent, SelectItem } from "@/componentes/ui/select";
import { Skeleton } from "@/componentes/ui/skeleton";
import { Switch } from "@/componentes/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { mesDe, periodoDoMes } from "@/lib/periodo-do-mes";

import { consultaApuracao, consultaUnidades } from "./api";
import { ComoFuncionaBonificacao } from "./componentes/ComoFuncionaBonificacao";
import { IndicadoresBonificacao } from "./componentes/IndicadoresBonificacao";
import { QuadroDeFaltas } from "./componentes/QuadroDeFaltas";
import { TabelaPorColaborador } from "./componentes/TabelaPorColaborador";
import { TabelaPorDia } from "./componentes/TabelaPorDia";
import { agruparPorDia, filtrarLinhas, TODAS } from "./regras";
import { ROTULO_DA_HORA_EXTRA } from "./textos";

type Filtros = EntradaDe<typeof c.apurar>;
type Visao = "pessoa" | "dia";

/** origem: features/bonificacao/components/BonificacaoScreen.tsx (sistema atual) */
export function PaginaBonificacaoEntrega() {
  const hoje = hojeNoFuso(useFusoDaEmpresa());
  const [mes, setMes] = useState(() => mesDe(hoje));
  const [unidade, setUnidade] = useState<string>(TODAS);
  const [funcao, setFuncao] = useState<string>(TODAS);
  const [horaExtra, setHoraExtra] = useState<string>(TODAS);
  const [usarPonto, setUsarPonto] = useState(true);
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [visao, setVisao] = useState<Visao>("pessoa");

  const unidades = useQuery(consultaUnidades);
  const q = useQuery(consultaApuracao(filtros));

  const todasLinhas = useMemo(() => q.data ?? [], [q.data]);

  const linhas = useMemo(
    () => filtrarLinhas(todasLinhas, funcao, horaExtra),
    [todasLinhas, funcao, horaExtra],
  );

  const pessoas = useMemo(() => agruparPorPessoa(linhas), [linhas]);
  const filtrando = funcao !== TODAS || horaExtra !== TODAS;

  const porDia = useMemo(() => agruparPorDia(linhas), [linhas]);

  const total = pessoas.reduce((a, p) => a + Math.round(p.total * 10_000), 0) / 10_000;
  const semPonto = linhas.filter((l) => l.semRegistroPonto).length;
  const pendentes = linhas.filter((l) => l.pendentes > 0).length;

  function apurar() {
    const { inicio, fim } = periodoDoMes(mes);
    setFiltros({
      inicio,
      fim,
      unidades: unidade === TODAS ? undefined : [unidade],
      usarPonto,
    });
  }

  const etiquetas: EtiquetaFiltroOpcional[] = [
    funcao !== TODAS && {
      rotulo: "Função",
      valor: funcao,
      limpar: () => {
        setFuncao(TODAS);
      },
    },
    horaExtra !== TODAS && {
      rotulo: "Hora extra",
      valor: ROTULO_DA_HORA_EXTRA[horaExtra] ?? horaExtra,
      limpar: () => {
        setHoraExtra(TODAS);
      },
    },
  ];

  return (
    <Pagina
      titulo="Bonificação de entrega"
      descricao="Apuração do bônus por colaborador, a partir dos romaneios e das ocorrências do dia. A hora extra vem do ponto no Ahgora e é o que separa Turbo de Acelerado."
      acoes={<ComoFuncionaBonificacao />}
      filtros={
        <>
          <FiltrosAvancados
            ativos={filtrando}
            aoLimpar={() => {
              setFuncao(TODAS);
              setHoraExtra(TODAS);
            }}
          >
            <CampoRotulado rotulo="Mês" htmlFor="bonificacao-mes">
              <input
                id="bonificacao-mes"
                type="month"
                className={CLASSE_DO_CAMPO}
                value={mes}
                onChange={(e) => {
                  setMes(e.target.value);
                }}
              />
            </CampoRotulado>
            <Select value={unidade} onValueChange={setUnidade}>
              <GatilhoRotulado rotulo="Unidade" />
              <SelectContent>
                {(unidades.data ?? []).map((u) => (
                  <SelectItem key={u.unidade} value={u.unidade}>
                    {u.unidade}
                  </SelectItem>
                ))}
                <SelectItem value={TODAS}>Todas</SelectItem>
              </SelectContent>
            </Select>
            <InterruptorRotulado id="usar-ponto" rotulo="Usar ponto do Ahgora para hora extra">
              <Switch id="usar-ponto" checked={usarPonto} onCheckedChange={setUsarPonto} />
            </InterruptorRotulado>
            <Button onClick={apurar} disabled={q.isFetching}>
              <Play aria-hidden />
              {q.isFetching ? "Apurando…" : "Apurar"}
            </Button>
            {q.data && (
              <>
                <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />
                <Select value={funcao} onValueChange={setFuncao}>
                  <GatilhoRotulado rotulo="Função" />
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas</SelectItem>
                    <SelectItem value="Motorista">Motorista</SelectItem>
                    <SelectItem value="Ajudante">Ajudante</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={horaExtra} onValueChange={setHoraExtra}>
                  <GatilhoRotulado rotulo="Hora extra" />
                  <SelectContent>
                    {Object.entries(ROTULO_DA_HORA_EXTRA).map(([valor, rotulo]) => (
                      <SelectItem key={valor} value={valor}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </FiltrosAvancados>
          <FiltrandoPor etiquetas={etiquetas} />
          <p className="text-xs text-muted-foreground">
            Com o ponto ligado, a apuração consulta o Ahgora colaborador por colaborador e leva
            alguns segundos a mais. Sem ele, ninguém chega a Turbo.
          </p>
        </>
      }
    >
      {q.error && (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              <RefreshCw aria-hidden /> Tentar novamente
            </Button>
          }
        >
          {mensagemAmigavel(q.error)}
        </Aviso>
      )}

      {q.isFetching ? (
        <div className="space-y-4" aria-busy>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl bg-muted" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-2xl bg-muted" />
        </div>
      ) : q.data ? (
        <>
          {filtrando && (
            <Aviso tom="info">
              Filtro ativo: os totais abaixo somam só {linhas.length} de {todasLinhas.length}{" "}
              lançamentos.
            </Aviso>
          )}
          {pendentes > 0 && (
            <Aviso tom="alerta">
              {pendentes} de {linhas.length} linhas têm NF sem desfecho registrado no dia. Elas
              contam como entregues, então o valor apurado pode cair quando as ocorrências fecharem.
            </Aviso>
          )}

          <IndicadoresBonificacao
            colaboradores={pessoas.length}
            linhas={linhas}
            total={total}
            semPonto={semPonto}
          />

          <Painel
            barra={
              <Alternador
                rotulo="Visão da apuração"
                valor={visao}
                aoMudar={setVisao}
                opcoes={[
                  { valor: "pessoa", rotulo: "Por colaborador" },
                  { valor: "dia", rotulo: "Por dia" },
                ]}
              />
            }
          >
            <div className="rolagem-fina relative overflow-x-auto rounded-xl">
              {visao === "pessoa" ? (
                <TabelaPorColaborador pessoas={pessoas} total={total} />
              ) : (
                <TabelaPorDia porDia={porDia} />
              )}
            </div>
          </Painel>
        </>
      ) : (
        !q.error && (
          <Painel>
            <EstadoVazio icone={Play} mensagem="Escolha o mês e a unidade e clique em “Apurar”." />
          </Painel>
        )
      )}

      {/* key: trocar o mês recomeça o formulário no dia 1 do mês novo. */}
      <QuadroDeFaltas key={mes} mes={mes} />
    </Pagina>
  );
}
