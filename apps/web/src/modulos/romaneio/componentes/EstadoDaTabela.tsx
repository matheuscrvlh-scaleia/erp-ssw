import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { LinhasCarregando } from "@/componentes/comum/LinhasCarregando";
import { MensagemErro } from "@/componentes/comum/MensagemErro";

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
