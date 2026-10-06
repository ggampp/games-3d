# M1 — Base da campanha e fase 1 básica

Status: planejado. Dependência: [M0](m0-integracao-loja.md). Próximo: [M2](m2-fases-faceis.md). Conteúdo: [fase 1](../fases/fase-01.md). Contratos: [comuns](../CONTRATOS.md).

## Objetivo

Entregar um ciclo finito jogável: briefing → tentativa → derrota ou chegada → repetir/voltar. A primeira versão usa a fase 1 com conteúdo mínimo; M2 completa barreiras e interface de seleção. Simulação e estado ficam testáveis sem WebGL ou DOM.

## Tarefas na ordem de execução

1. Extrair `game-state.js`: estado da tentativa, tela, causas de pausa e `runId`. Definir transições permitidas e recusar start/retry duplicado.
2. Extrair `events.js`: IDs e payloads; domínio emite dados, UI assina snapshots. Congelar/encerrar tentativa invalida comandos pendentes.
3. Extrair o relógio e passo fixo 1/60 s com limite de catch-up. RNG de percurso separado dos efeitos, algoritmo/seed versionados.
4. Extrair movimento/colisão suficiente para testes puros. Remover decisões de DOM do caminho da física; adaptar `HudManager` a snapshots, incluindo drift.
5. Criar configuração da fase 1 e geração finita. Manter trilhos de margem e retenção da cauda; `maintainTrack` não cria obstáculos depois da chegada.
6. Implementar `startLevel`, retry e ordem colisão→chegada. Emitir uma conclusão por tentativa; não liberar fase 2 até o save de M2 existir.
7. Associar `fetch` de manobra e timers de crash ao `runId`; cancelar/descartar respostas antigas. Durante pausa, enfileirar resposta válida e aplicar só se a tentativa ainda puder recebê-la ao retomar.
8. Implementar resultado básico com repetir/voltar e indicação de chegada; inputs de movimento bloqueados atrás de modais. Preservar modo infinito por adaptador.
9. Criar testes de estado/simulação/chegada e replay da fase básica. Executar smoke de navegador com IA indisponível.

## Arquivos e interfaces propostas

`src/core/game-state.js`, `events.js`, `rng.js`; extrações em `src/physics/` e `src/entities/track.js`; `src/levels/campaign.js`, `level-config.js`; adaptadores em `game.js` e `hud.js` após M0. API proposta: `startLevel(config, profile)`, `step(commands)`, `snapshot()`, `stopRun()`. Nenhuma assinatura é afirmada como já existente.

## Aceites

| ID | Resultado exigido |
| --- | --- |
| M1-A01 | Estados e causas de pausa impedem retomada ou input indevido |
| M1-A02 | Seed e passo fixo reproduzem layout/eventos, separados dos efeitos |
| M1-A03 | Chegada viva conclui uma vez; colisão no mesmo passo derrota |
| M1-A04 | Retry limpa só tentativa; `runId` antigo não causa pontuação/modal/derrota |
| M1-A05 | Fase 1 básica é jogável sem API de IA e sem compra obrigatória |
| M1-A06 | Física não toca DOM; HUD segue limite de atualização; recursos têm proprietário |
| M1-A07 | Modo infinito existente permanece acessível e não conclui campanha |

## Casos de teste

| ID / tipo | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| M1-T01 / unitário e E2E | Playing → pausa manual → loja → fechar loja → tecla de movimento | Continua paused; distância constante; remover última causa retoma; resultado/menu não aceitam movimento | M1-A01 |
| M1-T02 / integração | Replay fixo → executar a 30/60/120 FPS com efeitos ligados/desligados | Conteúdo e eventos da simulação idênticos; zero passos extras da física por render | M1-A02 |
| M1-T03 / unitário | Estado na borda da chegada → passo vivo; repetir; variante com colisão simultânea | Uma conclusão no caso vivo; zero no caso colisão; resultado terminal estável | M1-A03 |
| M1-T04 / unitário | Run A com IA/crash timer pendente → retry B → resolver A | B mantém score/saldo/estado; posições e combos resetados; saves da loja mantidos | M1-A04 |
| M1-T05 / E2E | Novo usuário/cyber/API offline → iniciar fase básica e executar rota | Resultado de sucesso exibido; sem bloqueio de rede ou loja | M1-A05 |
| M1-T06 / instrumentação | 1 s de física e updates de drift → observar UI; montar/desmontar | Zero acesso DOM pelo módulo físico; updates contínuos limitados pelo intervalo; dispose/listeners conforme proprietário | M1-A06 |
| M1-T07 / regressão | Selecionar infinito → sobreviver além de 600 m | Sem chegada/campanha/troféu; pontuação casual e retry continuam funcionais | M1-A07 |

## Gate de saída

Todos os aceites M1 passam e a fase 1 básica tem chegada/retry real. O conteúdo completo da fase 1 só é concluído em M2. Refatoração deve ocorrer em pequenas extrações com regressão; não reescrever todos os sistemas de uma vez nem adicionar multiplayer aqui.
