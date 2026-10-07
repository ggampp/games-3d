# M5 — Multiplayer online: implementação e validação automatizada

Data: 07/10/2026. **Formato confirmado pelo usuário: corrida online para dois jogadores, transporte WebSocket com o pacote `ws`.** A M5 está implementada, com validação automatizada aprovada (Node e dois navegadores reais). Pendentes: rede real/móvel, latência visual em hardware e playtest.

## Arquitetura

| Peça | Arquivo | Papel |
| --- | --- | --- |
| Simulação compartilhada | `src/physics/train-sim.js` | `TrainWorld` (passo de mundo de um trem) e `TrainSimulation` (corrida a 60 Hz). O harness de rotas usa o mesmo código, então o servidor roda a física validada nas nove fases |
| Protocolo | `src/network/protocol.js` | Versão 1. Cliente envia `join`, `ready`, `input`, `ping` e `leave`; servidor envia `joined`, `lobby`, `start`, `snapshot`, `result`, `error` e `pong`. Esquema com whitelist, 4 KiB, 120 inputs/s, janela de ±30 ticks e hash do conteúdo da fase |
| Salas | `scripts/server/rooms.js` | Autoritativo e independente de transporte, com relógio injetável. Código de 5 caracteres, 2 participantes, contagem de 3 s, snapshots a 20 Hz, resultado único, carência de 5 s, lobby expira em 5 min e resultado em 2 min |
| Transporte | `scripts/serve.js` | `WebSocketServer` só em `/ws`. Frames acima de 16 KiB fecham o socket |
| Cliente | `src/network/online-client.js`, `src/core/game.js`, `src/ui/online-ui.js` | Sincronia de relógio, previsão adiantada, reconciliação, fantasma do adversário, lobby e resultado |

## Decisões

1. **Previsão adiantada (lead).** A simulação local roda `lead` ticks à frente do relógio do servidor, com `lead = ceil((RTT máx/2 + 40 ms) / 16,7 ms) + 1`, limitado a 24. Cada input sai com o tick seguinte e chega ao servidor antes de ele simular esse tick. Assim os dois aplicam o comando no mesmo tick e a previsão do próprio trem é exata. O servidor nunca confia em posição, pontos ou chegada enviados pelo cliente.
2. **Simulação desacoplada da renderização.** No modo online, a simulação avança por um timer de 10 ms guiado pelo relógio do servidor, e o `requestAnimationFrame` só desenha. O primeiro protótipo avançava por quadro; com quadros lentos, o cliente ficava atrás do servidor e os inputs chegavam atrasados.
3. **Confirmação só do que foi aplicado.** O snapshot reporta `appliedSeq`, e não o último input recebido. No protótipo, um snapshot tirado entre o recebimento e a aplicação "confirmava" o input e fazia o cliente desfazer a própria previsão. Há teste de regressão para isso.
4. **Terminal do servidor.** A colisão local é prevista, mas uma colisão do servidor prevalece (`crashMismatch` conta divergências). Cruzar a linha localmente só mostra "aguardando resultado oficial".
5. **Fora do jogo solo.** O modo online pode usar qualquer fase, mas não libera nem grava a campanha. Os itens coletados contam pontos de corrida, não saldo da loja. Pausa, loja e troca de trem ficam bloqueadas durante a corrida, porque a sala continua para os dois. O visual vem da sala (`cyber` para ambos), e o adversário aparece como fantasma translúcido, sem colisão entre jogadores.
6. **Limite de correção** (exigido para M5-A04): correção lateral máxima ≤ 0,5 m e no máximo uma correção a cada 10 inputs por corrida nos perfis de teste. A distância prevista deve coincidir exatamente com a do servidor.

## Execuções

`npm test`: **71 testes passaram**, zero falhas. Nove estão em `tests/multiplayer.test.js` e cobrem:

- protocolo (whitelist, versão, tamanho, JSON);
- entrada de dois jogadores com terceiro, versão e conteúdo recusados;
- campos forjados ignorados;
- duplicados, sequências antigas, inputs fora da janela, `runId` errado, frames malformados e limite de frequência;
- chegada com o mesmo tick de chegada do harness de rotas;
- quedas por distância e empate;
- abandono, carência, abandono duplo e expiração;
- progresso solo intacto;
- 100 salas voltando à linha de base.

E2E com dois navegadores (`npm run test:browser:m5`): ver a seção abaixo, preenchida com a execução final.

## Reprodução

```powershell
npm install
npm test
$env:PLAYWRIGHT_MODULE_DIR = '<diretorio-do-runtime>/node_modules'
npm run test:browser:m5
```
