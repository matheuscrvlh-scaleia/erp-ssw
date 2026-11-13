import { EstadoVazio } from "@/components/common/EmptyState";
import { MensagemErro } from "@/components/common/ErrorMessage";
import { LinhasCarregando } from "@/components/common/LoadingRows";

/** Carregando (esqueleto), erro (com "Tentar novamente") e vazio no corpo da tabela. */
export function EstadoDaTabela({
  colunas,
  carregando,
  erro,
  aoTentarDeNovo,
  vazio,
  mensagem,
}: {
  colunas: number;
  carregando: boolean;
  erro?: unknown;
  aoTentarDeNovo?: (() => void) | undefined;
  vazio: boolean;
  mensagem: string;
}) {
  if (carregando) return <LinhasCarregando linhas={5} colunas={colunas} />;
  if (erro !== undefined && erro !== null) {
    return (
      <tr>
        <td colSpan={colunas}>
          <MensagemErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} />
        </td>
      </tr>
    );
  }
  if (!vazio) return null;
  return (
    <tr>
      <td colSpan={colunas}>
        <EstadoVazio mensagem={mensagem} />
      </td>
    </tr>
  );
}
