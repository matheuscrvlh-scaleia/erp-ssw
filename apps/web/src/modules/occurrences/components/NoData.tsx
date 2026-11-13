import { EstadoVazio } from "@/components/common/EmptyState";

/** Linha de vazio do bloco. */
export function SemDados() {
  return (
    <li>
      <EstadoVazio
        mensagem="Sem dados no período."
        detalhe="Amplie o período ou tire algum filtro."
        className="py-6"
      />
    </li>
  );
}
