# Acrobatic Train (3D)

Jogo 3D de trem acrobático em Three.js integrado com a suíte de ferramentas de decisão ultrarrápidas **TypeSafe Jev (System One)** para agentes de codificação e automação E2E.

M2 disponível: três fases, mapa/briefing, desbloqueio e progresso salvo, barreiras/trilhos rompidos/rampas, mais modo infinito. A loja preserva compras; seleção durante a corrida equipa na próxima tentativa. Execute `npm start`, `npm test` e `npm run test:browser` (Playwright instalado ou `PLAYWRIGHT_MODULE_DIR` configurado). Veja o [relatório M2](docs/planejamento/VALIDACAO_M2.md) e o [histórico M0/M1](docs/planejamento/VALIDACAO_M0_M1.md).

---

## 🛠️ Suíte de Ferramentas Jev (System One)

O projeto conta com ferramentas automatizadas alimentadas pelo modelo de decisão rápida da TypeSafe AI (`jev-latest`), operando em frações de segundo (< 0.4s) e sem custos de geração contínua de texto:

| Comando | Ferramenta | Descrição |
| :--- | :--- | :--- |
| `npm run jev:guardrail` | **Pre-Edit Guardrail** | Intercepta edições e diffs antes da gravação para garantir cumprimento estrito das regras de arquitetura e segurança (`AGENTS.md`). |
| `npm run jev:review` | **PR Review Gate** | Executa 7 perguntas objetivas (Sim/Não) sobre o diff git para aprovação rápida (*Fast-Pass*) ou escalonamento para revisão sênior. |
| `npm run jev:rerank` | **Fast File Reranker** | Substitui subagentes caros de exploração ranqueando em ~0.3s os arquivos mais relevantes para uma tarefa. |
| `npm run jev:coverage` | **Control Layer (Test Coverage)** | Audita especificações documentadas e verifica se existem testes automatizados cobrindo cada regra. |
| `npm run jev:skills` | **Skill Selection Hook** | Avalia o prompt do usuário contra o catálogo de skills em milissegundos, evitando poluição de contexto. |
| `npm run jev:browser` | **Goal-Driven Browser Action** | Seleciona o próximo elemento a ser clicado no navegador em testes E2E sem necessidade de modelos multimodais lentos. |
| `npm run jev:compact` | **Fast Context Compactor** | Triagem instantânea de histórico de contexto para compactar sessões longas com economia de tokens. |
| `npm run jev:test` | **Suite Completa** | Executa todos os testes e verificações das ferramentas Jev em sequência. |

---

## ⚙️ Configuração e Chaves

1. As dependências oficiais do TypeSafe SDK (`@typesafe-ai/sdk`) já estão instaladas.
2. A chave de API pode ser configurada via variável de ambiente ou arquivo `.env`:
   ```bash
   TYPESAFE_API_KEY=sua_chave_typesafe_aqui
   ```
3. O cliente possui modo de simulação resiliente com retentativas automáticas (`scripts/jev/client.js`).

---

## 🏗️ Diretrizes de Arquitetura (`AGENTS.md`)
O arquivo [`AGENTS.md`](./AGENTS.md) serve como fonte de verdade para o Guardrail do Jev e para o agente de codificação:
- Separação modular de Three.js (`src/core/`, `src/scene/`, `src/entities/`, `src/physics/`, `src/audio/`, `src/ui/`).
- Proibição de mutações diretas no DOM dentro de loops de render/física (60 FPS).
- Descarte limpo de geometrias e materiais WebGL ao descarregar cenas.
- Proteção absoluta de chaves e variáveis sensíveis.
