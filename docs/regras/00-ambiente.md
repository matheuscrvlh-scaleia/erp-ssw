# Ambiente do sistema atual que afeta os números

Conferido em 10/11/2026, só leitura, nos dois bancos (DEVELOP e produção) — iguais:

| Item | Valor | Efeito no porte |
| --- | --- | --- |
| Fuso da sessão (`TimeZone`) | **UTC** | Todo `now()::date`, `current_date` e `timestamptz::date` do SQL atual é dia **UTC**. Onde a spec diz "dia da sessão", reproduza com UTC no backend (ex.: entrega depois das 21h de Brasília cai no dia seguinte). Onde o SQL usa `AT TIME ZONE 'America/Sao_Paulo'` explícito, use São Paulo. |
| Collation do banco (`datcollate`) | **en_US.UTF-8** | Ordenação de texto (`ORDER BY nome`) segue ICU/glibc en_US: ignora acento e caixa no 1º nível. No backend, ordene com `Intl.Collator("en-US", { sensitivity: "variant" })` quando a ordenação for feita em memória; nas consultas, o banco novo é o mesmo Postgres, então `ORDER BY` dá o mesmo resultado. |
| `statement_timeout` dos papéis da API | 8 s (funções pesadas sobem para 30 s com `SET`) | O backend define o próprio timeout por consulta; as pesadas precisam caber ou ser otimizadas. Mensagem ao estourar: "reduza o período ou aplique mais filtros". |

Regra geral até o dono decidir cada dúvida das specs: **reproduzir o comportamento de hoje**, inclusive os
pontos discutíveis, e registrar a correção proposta em `docs/duvidas-do-dono.md`.
