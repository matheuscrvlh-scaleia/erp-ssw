import { formatarData, formatarDataHora } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Building2, ChartColumnBig, HeartPulse, Plug, RefreshCw, TrendingUp } from "lucide-react";

import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { GraficoBarras } from "@/componentes/comum/Graficos";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";

import { consultaPainelDaPlataforma } from "./api";
import { GraficoIntegracoes } from "./componentes/GraficoIntegracoes";
import { KpisDoPainel } from "./componentes/KpisDoPainel";
import { TabelaEmpresas } from "./componentes/TabelaEmpresas";
import { serieDoCrescimento, serieDosCtes } from "./regras";

export function PaginaPainel() {
  const navigate = useNavigate();
  const consulta = useQuery(consultaPainelDaPlataforma);
  const painel = consulta.data;
  const abrir = (id: string) => void navigate({ to: "/plataforma/empresas/$id", params: { id } });
  const vazio = painel !== undefined && painel.empresas.length === 0;
  const crescimento = serieDoCrescimento(painel);
  const ctesPorMes = serieDosCtes(painel);

  return (
    <Pagina
      titulo="Dashboard"
      descricao="Empresas, crescimento, integrações e uso da Plataforma."
      meta={
        painel && (
          <p className="text-[12.5px] text-muted-foreground">
            Montado em {formatarDataHora(painel.geradoEm)}
            {painel.meses[0] && ` · 12 meses desde ${formatarData(`${painel.meses[0]}-01`)}`}
          </p>
        )
      }
      acoes={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void consulta.refetch()}
          disabled={consulta.isFetching}
        >
          <RefreshCw
            aria-hidden
            className={consulta.isFetching ? "motion-safe:animate-spin" : ""}
          />
          Atualizar
        </Button>
      }
    >
      {consulta.isError ? (
        <MensagemErro
          erro={consulta.error}
          titulo="Não foi possível montar o Dashboard"
          aoTentarDeNovo={() => void consulta.refetch()}
        />
      ) : vazio ? (
        <EstadoVazio
          icone={Building2}
          mensagem="Nenhuma empresa cadastrada."
          detalhe="Cadastre a primeira em Plataforma › Empresas."
        />
      ) : (
        <>
          <KpisDoPainel painel={painel} />

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Painel
              titulo="Crescimento da Plataforma"
              descricao="Empresas cadastradas até o fim de cada mês; em destaque, as que entraram no mês."
              icone={TrendingUp}
            >
              <GraficoBarras
                descricao="Empresas na Plataforma por mês, separando as que entraram no mês"
                dados={crescimento}
                eixoX="rotulo"
                formato="inteiro"
                carregando={consulta.isLoading}
                mensagemVazia="Nenhuma empresa nos últimos 12 meses."
                series={[
                  {
                    chave: "existentes",
                    nome: "Já na Plataforma",
                    cor: "var(--grafico-comparacao)",
                    pilha: "a",
                  },
                  { chave: "novas", nome: "Novas no mês", pilha: "a" },
                ]}
              />
            </Painel>
            <Painel
              titulo="CT-e processados por mês"
              descricao="Todas as empresas, pela data de emissão. O último mês está em andamento."
              icone={ChartColumnBig}
            >
              <GraficoBarras
                descricao="CT-e emitidos por mês, somando todas as empresas"
                dados={ctesPorMes}
                eixoX="rotulo"
                formato="inteiro"
                carregando={consulta.isLoading}
                mensagemVazia="Nenhum CT-e nos últimos 12 meses."
                series={[{ chave: "ctes", nome: "CT-e" }]}
              />
            </Painel>
            <Painel
              titulo="Integrações"
              descricao="Empresas ativas ou em implantação com cada integração ligada."
              icone={Plug}
            >
              {painel ? (
                <GraficoIntegracoes painel={painel} />
              ) : (
                <EstadoVazio mensagem="Carregando…" className="min-h-[220px]" />
              )}
            </Painel>
          </div>

          <Painel
            titulo="Empresas"
            descricao="Saúde, integração com o SSW, uso e CT-e de cada empresa. Clique numa empresa para abrir o cadastro."
            icone={HeartPulse}
          >
            <TabelaEmpresas painel={painel} carregando={consulta.isLoading} aoAbrir={abrir} />
          </Painel>
        </>
      )}
    </Pagina>
  );
}
