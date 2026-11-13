import { type ParametrosDeBonificacao } from "@erp/shared/contracts/delivery-bonus";
import { hojeNoFuso } from "@erp/shared/dates";
import { formatarMoeda } from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";

import { ComoFunciona, ComoFuncionaSecao, Formula } from "@/components/common/HowItWorks";
import { SeloStatus } from "@/components/common/StatusBadge";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";

import { consultaParametros } from "../api";
import { vigenteHoje } from "../rules";
import { NIVEL, pct } from "../texts";

type Taxas = Omit<ParametrosDeBonificacao, "id" | "vigenciaInicio" | "vigenciaFim">;

/** Valores da semente (planilha v16 + decisões de 23/09), usados até a consulta responder. */
const PADRAO: Taxas = {
  taxaTurbo: 1,
  taxaAcelerado: 0.8,
  taxaEmRotaGrande: 0.4,
  taxaEmRotaPequena: 0.6,
  metaRotaPequena: 0.9,
  metaRotaGrande: 0.95,
  metaEmRota: 0.8,
  limiteNfsRotaPequena: 15,
};

/**
 * Explicação da bonificação de entrega. Taxas e metas vêm dos parâmetros vigentes, então o texto
 * acompanha qualquer mudança de vigência. origem: ComoFuncionaBonificacao.tsx (sistema atual)
 */
export function ComoFuncionaBonificacao() {
  const parametros = useQuery(consultaParametros);
  const hoje = hojeNoFuso(useFusoDaEmpresa());
  const p = vigenteHoje(parametros.data ?? [], hoje) ?? PADRAO;

  const niveis: { nivel: keyof typeof NIVEL; regra: string; taxa: string }[] = [
    {
      nivel: "turbo",
      regra: "Êxito na meta da rota e SEM hora extra no dia",
      taxa: `${formatarMoeda(p.taxaTurbo)} por NF`,
    },
    {
      nivel: "acelerado",
      regra: "Êxito na meta da rota, mas fez hora extra ou está sem registro de ponto",
      taxa: `${formatarMoeda(p.taxaAcelerado)} por NF`,
    },
    {
      nivel: "em_rota",
      regra: `Êxito abaixo da meta da rota, mas a partir de ${pct(p.metaEmRota)}`,
      taxa: `${formatarMoeda(p.taxaEmRotaGrande)} por NF (rota grande) · ${formatarMoeda(p.taxaEmRotaPequena)} por NF (rota pequena)`,
    },
    {
      nivel: "sem_bonus",
      regra: `Êxito abaixo de ${pct(p.metaEmRota)}`,
      taxa: "R$ 0,00",
    },
  ];

  return (
    <ComoFunciona
      chave="bonificacao-entrega"
      titulo="Como funciona a bonificação de entrega"
      resumo="O bônus é calculado por pessoa e por dia: cada romaneio rende um valor por NF entregue, e a taxa depende do nível que a equipe atingiu naquele dia."
    >
      <ComoFuncionaSecao titulo="1. De onde vêm os dados">
        <p>
          Dos <strong>romaneios do SSW</strong> (relatório 036). Cada romaneio vira uma linha para o
          motorista e uma para cada ajudante (até 3). Todos da mesma viagem recebem o mesmo êxito.
          Romaneio cancelado não entra.
        </p>
        <p>
          O resultado de cada NF é a{" "}
          <strong>última ocorrência registrada no próprio dia do romaneio</strong>, não o desfecho
          final do CT-e. Uma NF que não foi entregue no dia 25 e só saiu no dia 26 conta como não
          entregue no bônus do dia 25.
        </p>
        <p>
          A <strong>unidade</strong> é a sigla do romaneio (as 3 primeiras letras, ex.: ARA, CAP).
        </p>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="2. Como cada NF é classificada">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Entregue</strong>: ocorrência 1 no dia.
          </li>
          <li>
            <strong>SAC</strong> (não é culpa da equipe): destinatário ausente, fechado,
            desconhecido, mercadoria em desacordo etc. Sai da conta e não penaliza.
          </li>
          <li>
            <strong>Retorno</strong> (penaliza): endereço não localizado, entrega prejudicada pelo
            horário, mercadoria não embarcada, fora de rota, falta de mercadoria, documentos, carga
            irregular etc.
          </li>
          <li>
            <strong>Pendente</strong>: ainda sem desfecho no dia (tipicamente “em rota”, 85). Conta
            como entregue, mas a tela avisa: o valor pode cair quando a ocorrência fechar.
          </li>
        </ul>
        <p>
          A lista de códigos da bonificação é própria e segue a planilha original. Ela é diferente
          da usada na tela de Ocorrências, de propósito.
        </p>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="3. Entregues e êxito">
        <Formula>NFs entregues = carregadas − SAC − retornos</Formula>
        <Formula>êxito = NFs entregues ÷ (carregadas − SAC)</Formula>
        <p>
          O êxito é <strong>truncado</strong> em 2 casas, como na planilha: 94,9% vira 94% e não
          bate a meta de 95%.
        </p>
        <p>Exemplo: 30 carregadas, 2 SAC, 1 retorno → 27 entregues, êxito 27 ÷ 28 = 96%.</p>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="4. Meta por tamanho de rota">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Rota pequena</strong> (até {p.limiteNfsRotaPequena} NFs carregadas): meta de{" "}
            {pct(p.metaRotaPequena)}.
          </li>
          <li>
            <strong>Rota grande</strong> (mais de {p.limiteNfsRotaPequena} NFs): meta de{" "}
            {pct(p.metaRotaGrande)}.
          </li>
        </ul>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="5. Níveis e valor por NF">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-muted/70 text-left">
                <th className="label-xs px-3 py-2">Nível</th>
                <th className="label-xs px-3 py-2">Quando</th>
                <th className="label-xs px-3 py-2">Paga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {niveis.map((n) => (
                <tr key={n.nivel}>
                  <td className="px-3 py-2 align-top">
                    <SeloStatus tom={NIVEL[n.nivel].tom} icone={NIVEL[n.nivel].icone}>
                      {NIVEL[n.nivel].rotulo}
                    </SeloStatus>
                  </td>
                  <td className="px-3 py-2 align-top">{n.regra}</td>
                  <td className="px-3 py-2 align-top tabular-nums">{n.taxa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Formula>bônus do dia = NFs entregues × taxa do nível</Formula>
        <p>
          Exemplo: rota grande, 27 entregues, êxito 96%, sem hora extra → Turbo → 27 ×{" "}
          {formatarMoeda(p.taxaTurbo)} = {formatarMoeda(27 * p.taxaTurbo)}.
        </p>
        {parametros.isError && (
          <p className="text-status-warn-fg">
            Não foi possível carregar os parâmetros vigentes. Os valores acima são os padrão do
            programa.
          </p>
        )}
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="6. Hora extra (vem do ponto no Ahgora)">
        <p>
          É o que separa <strong>Turbo</strong> de <strong>Acelerado</strong>. Para cada pessoa e
          dia:
        </p>
        <Formula>
          fez hora extra = horas trabalhadas &gt; jornada prevista na escala + tolerância de saída
        </Formula>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            As horas trabalhadas usam o mesmo cálculo da página de Ponto (pares entrada/saída).
          </li>
          <li>Em dia de folga ou sem jornada definida, qualquer trabalho conta como hora extra.</li>
          <li>
            <strong>Sem registro de ponto</strong> (pessoa não encontrada no Ahgora, dia sem batida,
            batidas ímpares ou excluídas): o painel não presume que ela não fez hora extra. O nível
            para em no máximo Acelerado e a linha aparece como “sem ponto”.
          </li>
          <li>
            A pessoa é encontrada no Ahgora pelo nome do romaneio. O SSW corta o nome em 30
            caracteres; nesse caso vale o começo do nome, desde que só um colaborador comece assim.
            Agregados não batem ponto e ficam sempre sem registro.
          </li>
          <li>
            Com a chave <strong>“Usar ponto do Ahgora”</strong> desligada, ninguém chega a Turbo.
          </li>
        </ul>
        <p className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-status-good" /> sem hora extra
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-status-bad" /> fez hora extra
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> sem
            ponto
          </span>
        </p>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="7. Faltas">
        <p>
          Uma falta registrada <strong>zera o bônus do último dia bonificado antes dela</strong>. Na
          tabela, o valor desse dia aparece riscado e o colaborador ganha a etiqueta “zerado por
          falta”. As faltas são lançadas no quadro “Faltas do mês”, abaixo da apuração.
        </p>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="8. Totais da tela">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Êxito médio</strong>: média simples dos êxitos diários, como na planilha. Um dia
            com 2 NFs pesa igual a um dia com 40.
          </li>
          <li>
            <strong>Custo total</strong>: soma do bônus de todas as pessoas e dias no recorte.
          </li>
          <li>Os filtros de função e hora extra refazem os totais só com as linhas filtradas.</li>
          <li>Apuração de no máximo 45 dias por vez.</li>
        </ul>
      </ComoFuncionaSecao>
    </ComoFunciona>
  );
}
