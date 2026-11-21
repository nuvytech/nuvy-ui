# Especificações (SDD) do nuvy-ui

SDD quer dizer desenvolvimento guiado por especificação: primeiro se escreve o que a mudança deve fazer, depois como fazer, depois as tarefas, e só então o código.

## O ciclo

1. **Especificar** (`spec.md`): o quê e por quê. Histórias, requisitos numerados (RF, RNF), critérios de aceite que dá para conferir, fora de escopo.
2. **Planejar** (`plano.md`): como. Arquivos que mudam, decisões, riscos, como medir.
3. **Tarefas** (`tarefas.md`): passos pequenos, na ordem, cada um com o que prova que acabou.
4. **Implementar**: um passo por vez, com teste junto.
5. **Conferir**: `npm test` verde, a spec e o plano ainda dizem a verdade e a constituição foi respeitada.

## Regras

- Toda funcionalidade nova ou mudança de comportamento começa por uma pasta `specs/NNN-nome/` com `spec.md`, `plano.md` e `tarefas.md`. Copie de `specs/_modelo/`.
- Numeração: três dígitos em sequência (`001`, `002`...), nome curto em minúsculas com hífen. `000-estado-atual` descreve o que existe hoje e não se renumera.
- A spec vem antes do código. Se o código mudar o comportamento, a spec muda no mesmo PR.
- Os princípios de [constituicao.md](constituicao.md) valem para toda spec. Quem quiser quebrar um, escreve a exceção na spec e justifica.
- Não escreva segredo, senha, token, dado pessoal ou dado de cliente nas specs. Exemplos usam dados fictícios.
- Marque `[A CONFIRMAR]` onde não houver certeza, em vez de inventar.
- Correção pequena (um valor, um texto) não precisa de pasta nova; basta o PR citar o requisito que ela restaura.

## Conteúdo desta pasta

| Caminho                    | Para que serve                                  |
| -------------------------- | ----------------------------------------------- |
| `constituicao.md`          | princípios que não se negociam                  |
| `000-estado-atual/spec.md` | o que o repositório faz hoje                    |
| `_modelo/`                 | modelos de `spec.md`, `plano.md` e `tarefas.md` |

Decisões de desenho e planos anteriores ao SDD continuam em `docs/superpowers/` (por exemplo `specs/2026-10-18-tema-nuvytech-design.md`). Elas explicam o porquê da versão inicial; `000-estado-atual` descreve o resultado.
