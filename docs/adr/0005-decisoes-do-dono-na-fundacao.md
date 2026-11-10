# ADR 0005 — Decisões do dono que a fundação já aplica

**Status:** aceita (10/11/2026)

## Contexto
O dono delegou as dúvidas de `docs/duvidas-do-dono.md`: vale a recomendação de cada item. Algumas
mudam o que a fundação entrega (schema de acesso, Calendário, login).

## Decisão
- **Q30 — cargos por empresa.** `cargos` e `cargo_telas` ganham `empresa_id` (PK
  `(empresa_id, chave)`), com RLS "empresa ou Plataforma"; o vínculo aponta para o cargo da
  própria empresa (FK composta). As chaves `super_admin`, `admin` e `gestor` continuam com
  significado fixo no código. Departamentos já eram por empresa (PK `(empresa_id, chave)`, o que
  também acaba com a chave única entre empresas).
- **Q28 — só a Plataforma cria feriado nacional.** A rota `POST /api/v1/calendario/feriados-nacionais`
  exige `exigirAdminPlataforma`, e o RLS de `feriados` só deixa gravar linha com `empresa_id` nulo
  em sessão de Plataforma. O registro de auditoria da geração é da Plataforma (empresa nula).
- **Feriado repetido** (seção 1 das dúvidas): 409 "Já existe um feriado igual nesta data." em vez
  do erro técnico. Violação de chave única em corrida vira 409 genérico no tratador central.
- **Q26 — escopo por unidade/equipe.** Uma regra só, desligada até existir a tela que grava a
  unidade do usuário: hoje todos veem tudo da própria empresa. A fundação guarda
  `empresa_usuarios.unidade_id` (FK para `unidades`, `on delete set null`) e não escreve a regra
  ainda (seria código sem uso). Quem fizer a tela escreve `podeVerTudo`/`podeVerCte` no
  `packages/dominio` seguindo `docs/regras/05` §1.11 e aplica nas consultas de CT-e e ocorrência.
- **Q33, Q34, Q35** já estavam na fundação: convite define a senha, "esqueci minha senha" por
  e-mail, mensagens do login em português e Google sem cadastro aberto (e-mail que não é usuário
  volta para `/login?erro=sem_conta`).

## Consequências
- Empresa nova precisa receber os cargos padrão (`super_admin` protegido, `admin`, `gestor`,
  `operador`, `equipe`) no caso de uso de criação de empresa da Plataforma (onda 1). O migrador
  copia os cargos globais de hoje para cada empresa.
- O setor legado continua no vínculo (ADR 0003), não no usuário.
