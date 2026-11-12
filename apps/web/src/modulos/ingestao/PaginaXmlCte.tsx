/**
 * Admin › XML CT-e (só Plataforma): sincronização automática do FTP (relatórios SSW) e upload
 * manual de XML de CT-e (Q43: a chave da NF-e passa a ser gravada).
 */
import { contratosIngestao as c, type ResultadoDoXml } from "@erp/shared/contratos/ingestao";
import { formatarDataHora } from "@erp/shared/formatacao";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileClock, Loader2, Play, RefreshCw, Server, Unlock, Upload } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { SeloDaSituacao } from "@/componentes/comum/SeloDaSituacao";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Switch } from "@/componentes/ui/switch";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { CHAVE_DA_INGESTAO, consultaArquivosXml, consultaFtp } from "./api";
import { BarraDeProgresso, ConfirmarAcao } from "./pecas";

const MAX_ARQUIVOS = 50;

/** Próximo disparo do horário de produção (todo minuto, exceto :00 e :30 — Q37). */
export function proximaExecucao(agora: Date): Date {
  const d = new Date(agora);
  d.setSeconds(0, 0);
  do d.setMinutes(d.getMinutes() + 1);
  while (d.getMinutes() === 0 || d.getMinutes() === 30);
  return d;
}

const dataHora = (iso: string | null | undefined) => (iso ? formatarDataHora(iso) : "—");

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-5 py-4">
      <dt className="label-xs">{rotulo}</dt>
      <dd className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-foreground tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function CartaoFtp() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaFtp);
  const [agindo, setAgindo] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const dados = consulta.data;
  const ultima = dados?.historico[0];
  const p = dados?.progresso;
  const rodando = dados?.travaAtiva ?? false;

  const agir = async (acao: () => Promise<unknown>, sucesso: string) => {
    setAgindo(true);
    try {
      await acao();
      toast.success(sucesso);
    } catch (e) {
      toast.error("Não foi possível concluir", { description: mensagemAmigavel(e) });
    } finally {
      setAgindo(false);
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
    }
  };

  return (
    <Painel
      icone={Server}
      titulo="Sincronização automática FTP"
      descricao={
        dados ? `Horário: ${dados.agenda}` : "Relatórios do SSW depositados no SFTP da empresa."
      }
      barra={
        <>
          <label className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[13px] font-medium shadow-cartao">
            <Switch
              checked={dados?.ativo ?? true}
              disabled={!dados || agindo}
              onCheckedChange={(ativo) =>
                void agir(
                  () => chamar(c.pausarFtp, { entrada: { ativo } }),
                  ativo ? "Sincronização retomada" : "Sincronização pausada",
                )
              }
            />
            {dados?.ativo === false ? "Pausada" : "Ativa"}
          </label>
          <Button
            size="sm"
            disabled={agindo || rodando}
            onClick={() =>
              void agir(
                () => chamar(c.rodarFtp),
                "Sincronização iniciada. Acompanhe o andamento abaixo.",
              )
            }
          >
            <Play aria-hidden /> Rodar agora
          </Button>
        </>
      }
    >
      {consulta.error ? (
        <MensagemErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
      ) : (
        <>
          {rodando && p && (
            <div className="space-y-2.5 rounded-t-xl border-b border-border bg-status-info-bg/60 px-5 py-4 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span role="status" className="flex min-w-0 flex-wrap items-center gap-2">
                  <Loader2
                    className="h-4 w-4 shrink-0 text-status-info-fg motion-safe:animate-spin"
                    aria-hidden
                  />
                  <span className="font-semibold text-foreground">
                    {p.fase === "conectando"
                      ? "Conectando ao SFTP…"
                      : `Arquivo ${p.arquivoAtualIndice} de ${p.totalArquivos}`}
                  </span>
                  {p.arquivoAtualNome && (
                    <span className="truncate font-mono text-xs">{p.arquivoAtualNome}</span>
                  )}
                  {p.mensagem && <span className="text-muted-foreground">· {p.mensagem}</span>}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-status-bad-fg hover:bg-status-bad-bg hover:text-status-bad-fg"
                  disabled={agindo}
                  onClick={() => {
                    setLiberando(true);
                  }}
                >
                  <Unlock aria-hidden /> Liberar trava
                </Button>
              </div>
              <BarraDeProgresso
                valor={p.totalArquivos > 0 ? p.arquivoAtualIndice / p.totalArquivos : 0}
                rotulo="Andamento da sincronização"
              />
              <p className="text-xs text-muted-foreground">
                Último sinal: {dataHora(p.heartbeatEm)}
              </p>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
            <Dado rotulo="Última execução">
              {dataHora(ultima?.executadoEm)} {ultima && <SeloDaSituacao status={ultima.status} />}
            </Dado>
            <Dado rotulo="Processados">{ultima?.arquivosProcessados ?? "—"}</Dado>
            <Dado rotulo="Com erro">
              <span
                className={cn(
                  ultima !== undefined && ultima.arquivosComErro > 0 && "text-status-bad-fg",
                )}
              >
                {ultima?.arquivosComErro ?? "—"}
              </span>
            </Dado>
            <Dado rotulo="Próxima execução">
              {dados?.ativo === false
                ? "Pausada"
                : formatarDataHora(proximaExecucao(new Date()).toISOString())}
            </Dado>
          </dl>
          {ultima && (Boolean(ultima.mensagem) || ultima.erros.length > 0) && (
            <div className="space-y-3 border-t border-border px-5 py-4 text-[13px]">
              {ultima.mensagem && <p>{ultima.mensagem}</p>}
              {ultima.erros.length > 0 && (
                <details className="rounded-xl border border-border">
                  <summary className="cursor-pointer rounded-xl px-3 py-2 font-medium text-status-bad-fg hover:bg-muted/60">
                    Ver erros ({ultima.erros.length})
                  </summary>
                  <ul className="rolagem-fina max-h-48 space-y-1 overflow-auto border-t border-border px-3 py-2 font-mono text-xs">
                    {ultima.erros.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </>
      )}
      <ConfirmarAcao
        aberto={liberando}
        aoMudarAberto={setLiberando}
        titulo="Liberar a trava?"
        descricao="Use só se a sincronização travou (sem andamento há minutos)."
        rotuloDoBotao="Liberar trava"
        aoConfirmar={() => void agir(() => chamar(c.liberarTravaFtp), "Trava liberada")}
      />
    </Painel>
  );
}

async function emBase64(arquivo: File): Promise<string> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let texto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(texto);
}

function UploadXml() {
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null);
  const [resultados, setResultados] = useState<ResultadoDoXml[]>([]);
  const [arrastando, setArrastando] = useState(false);

  const enviar = async (lista: File[]) => {
    const validos = lista.filter((f) => /\.(xml|zip)$/i.test(f.name));
    if (validos.length === 0) {
      toast.error("Envie arquivos .xml ou .zip.");
      return;
    }
    if (validos.length > MAX_ARQUIVOS) {
      toast.error(`Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.`);
      return;
    }
    const saida: ResultadoDoXml[] = [];
    for (const [i, arquivo] of validos.entries()) {
      setEnviando({ atual: i + 1, total: validos.length });
      try {
        saida.push(
          await chamar(c.importarXml, {
            entrada: { nome: arquivo.name, base64: await emBase64(arquivo) },
          }),
        );
      } catch (e) {
        saida.push({
          arquivo: arquivo.name,
          status: "erro",
          ctesProcessados: 0,
          cancelamentos: 0,
          orfaos: 0,
          pulados: 0,
          erros: [{ nome: arquivo.name, erro: mensagemAmigavel(e) }],
        });
      }
      setResultados([...saida]);
    }
    setEnviando(null);
    await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
  };

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => {
          setArrastando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void enviar([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center text-[13px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          arrastando
            ? "border-brand bg-brand-suave text-foreground"
            : "border-border text-muted-foreground hover:border-brand/50 hover:bg-muted/50",
          enviando !== null && "pointer-events-none opacity-60",
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-brand shadow-cartao">
          <Upload className="h-5 w-5" aria-hidden />
        </span>
        Arraste os arquivos .xml ou .zip aqui, ou clique para escolher (até {MAX_ARQUIVOS})
        <input
          type="file"
          multiple
          accept=".xml,.zip"
          className="sr-only"
          disabled={enviando !== null}
          onChange={(e) => void enviar([...(e.target.files ?? [])])}
        />
      </label>
      {enviando && (
        <div role="status" className="space-y-1.5 text-[13px]">
          <p className="font-medium">
            Enviando {enviando.atual} de {enviando.total}…
          </p>
          <BarraDeProgresso
            valor={(enviando.atual - 1) / enviando.total}
            rotulo="Envio dos arquivos"
          />
        </div>
      )}
      {resultados.length > 0 && (
        <TabelaDados
          titulo="Última importação"
          colunas={[
            { chave: "arquivo", titulo: "Arquivo", classe: "font-mono max-w-[300px] truncate" },
            {
              chave: "status",
              titulo: "Situação",
              celula: (r) => <SeloDaSituacao status={r.status} />,
              valor: (r) => r.status,
            },
            { chave: "ctesProcessados", titulo: "CT-e", formato: "inteiro" },
            { chave: "cancelamentos", titulo: "Cancelamentos", formato: "inteiro" },
            { chave: "orfaos", titulo: "Órfãos", formato: "inteiro" },
            { chave: "pulados", titulo: "Já importados", formato: "inteiro" },
            {
              chave: "erros",
              titulo: "Erros",
              valor: (r) => r.erros.map((e) => `${e.nome}: ${e.erro}`).join("; "),
              classe: "max-w-[320px] truncate",
            },
          ]}
          linhas={resultados}
          chaveDaLinha={(r) => r.arquivo}
          porPagina={0}
        />
      )}
    </div>
  );
}

function Historico() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaArquivosXml);
  const [reprocessando, setReprocessando] = useState(false);
  const orfaos = consulta.data?.orfaos;

  const reprocessar = async () => {
    setReprocessando(true);
    try {
      const r = await chamar(c.reprocessarOrfaos);
      toast.success(`${r.casados} de ${r.tentados} XML órfão(s) casado(s)`, {
        description: r.expirados > 0 ? `${r.expirados} expirado(s) (mais de 5 dias).` : undefined,
      });
    } catch (e) {
      toast.error("Não foi possível reprocessar", { description: mensagemAmigavel(e) });
    } finally {
      setReprocessando(false);
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
    }
  };

  return (
    <TabelaDados
      titulo="Histórico (últimas 50)"
      acoes={
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          {orfaos && (
            <SeloStatus
              tom={orfaos.pendentes > 0 ? "alerta" : "neutro"}
              icone={FileClock}
              className="h-auto min-h-6 rounded-xl py-0.5 [&>span]:whitespace-normal"
            >
              {orfaos.pendentes} XML aguardando o CT-e
              {orfaos.maisAntigo && ` (mais antigo ${dataHora(orfaos.maisAntigo)})`}
            </SeloStatus>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={reprocessando}
            onClick={() => void reprocessar()}
          >
            {reprocessando ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <RefreshCw aria-hidden />
            )}
            Reprocessar
          </Button>
        </div>
      }
      colunas={[
        { chave: "criadoEm", titulo: "Data", formato: "datahora", classe: "whitespace-nowrap" },
        { chave: "nomeArquivo", titulo: "Arquivo", classe: "font-mono max-w-[300px] truncate" },
        { chave: "tipo", titulo: "Tipo" },
        {
          chave: "status",
          titulo: "Situação",
          celula: (a) => <SeloDaSituacao status={a.status} />,
          valor: (a) => a.status,
        },
        { chave: "ctesProcessados", titulo: "CT-e", formato: "inteiro" },
        { chave: "cancelamentos", titulo: "Cancelamentos", formato: "inteiro" },
        { chave: "xmlsPulados", titulo: "Já importados", formato: "inteiro" },
        { chave: "erroMensagem", titulo: "Erro", classe: "max-w-[280px] truncate" },
      ]}
      linhas={consulta.data?.arquivos ?? []}
      chaveDaLinha={(a) => a.id}
      carregando={consulta.isLoading}
      erro={consulta.error}
      aoTentarDeNovo={() => void consulta.refetch()}
      mensagemVazia="Nenhum XML importado ainda."
      porPagina={0}
    />
  );
}

export function PaginaXmlCte() {
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: CHAVE_DA_INGESTAO }) > 0;
  return (
    <Pagina
      titulo="Importação de XMLs CT-e"
      descricao="Sincronização automática do FTP e upload manual de XML de CT-e"
      acoes={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO })}
          disabled={atualizando}
        >
          <RefreshCw className={cn(atualizando && "motion-safe:animate-spin")} aria-hidden />
          Atualizar
        </Button>
      }
    >
      <CartaoFtp />
      <Painel
        icone={Upload}
        titulo="Upload de XML de CT-e"
        descricao="Completa os CT-e já existentes (chave, endereço, peso, parceiro, chave da NF-e). XML sem CT-e espera 5 dias na fila de órfãos."
        classeDoCorpo="p-5"
      >
        <UploadXml />
      </Painel>
      <Historico />
    </Pagina>
  );
}
