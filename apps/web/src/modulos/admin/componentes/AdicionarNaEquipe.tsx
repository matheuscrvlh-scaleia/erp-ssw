import { type Cargo } from "@erp/shared/contratos/admin";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import { CAMPO } from "@/componentes/comum/CamposDeFormulario";
import { Button } from "@/componentes/ui/button";
import { useGravacao } from "@/hooks/use-gravacao";
import { mutacaoAdicionarAdmin } from "@/modulos/plataforma/api";

/** Põe na equipe quem já tem conta (a pessoa é convidada antes, numa empresa). */
export function AdicionarNaEquipe({ cargos }: { cargos: readonly Cargo[] }) {
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const escolhido = cargo || cargos.find((c) => !c.temTudo)?.chave || (cargos[0]?.chave ?? "");
  const cliente = useQueryClient();
  const adicionar = useGravacao({
    mutacao: mutacaoAdicionarAdmin(cliente),
    sucesso: "Adicionado à equipe da Plataforma",
    aoConcluir: () => {
      setEmail("");
    },
  });
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim() && escolhido) void adicionar.gravar({ email, cargo: escolhido });
      }}
    >
      <input
        type="email"
        aria-label="E-mail de quem entra na equipe"
        placeholder="E-mail de um usuário já cadastrado"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
        }}
        className={`${CAMPO} w-full sm:w-72`}
      />
      <select
        aria-label="Cargo na Plataforma"
        className={`${CAMPO} w-full sm:w-44`}
        value={escolhido}
        onChange={(e) => {
          setCargo(e.target.value);
        }}
      >
        {cargos.map((c) => (
          <option key={c.chave} value={c.chave}>
            {c.rotulo}
          </option>
        ))}
      </select>
      <Button size="sm" type="submit" className="h-9" disabled={adicionar.gravando || !escolhido}>
        <UserPlus aria-hidden />
        Adicionar
      </Button>
    </form>
  );
}
