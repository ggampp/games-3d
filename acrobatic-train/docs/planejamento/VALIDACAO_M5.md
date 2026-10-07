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

`npm test`: **72 testes passaram**, zero falhas. Dez estão em `tests/multiplayer.test.js` e cobrem:

- protocolo (whitelist, versão, tamanho, JSON);
- entrada de dois jogadores com terceiro, versão e conteúdo recusados;
- campos forjados ignorados;
- duplicados, sequências antigas, inputs fora da janela, `runId` errado, frames malformados e limite de frequência;
- chegada com o mesmo tick de chegada do harness de rotas;
- quedas por distância e empate;
- abandono, carência, abandono duplo e expiração;
- progresso solo intacto;
- 100 salas voltando à linha de base;
- buffer do adversário (interpolação, extrapolação limitada a 250 ms e adversário caído).

### E2E com dois navegadores reais (`npm run test:browser:m5`)

São dois contextos Chromium contra o servidor real (`/ws`), em tempo real, com RTT e jitter simulados no enlace do cliente (FIFO). Em todos os perfis, os dois clientes mostraram exatamente o mesmo resultado autoritativo.

| Perfil | Fase | Resultado oficial | Correções | Desvio de distância | Lead em cada input | Erros |
| --- | --- | --- | --- | --- | --- | --- |
| RTT 50 ms, sem jitter | 4 | Empate por chegada no mesmo instante (tick 2267, rotas idênticas) | 0 / 0 | 0 | 6 e 7 ticks | nenhum |
| RTT 150 ms, jitter 25 ms | 6 | Ana vence pela chegada (tick 2393); Bia cai no vagão a 144,2 m | 0 / 0 | 0 | 10 ticks | nenhum |
| RTT 300 ms, jitter 50 ms | 9 | Bia vence pela chegada (tick 2437); Ana cai na barreira a 115,0 m | 0 / 0 | 0 | 15 ticks | nenhum |

Também verificado:

- **M5-T01**: os dois jogadores largaram com o mesmo `startAt`/`runId`. O terceiro navegador recebeu "A sala já tem dois jogadores." e um cliente com protocolo v0 recebeu `version`.
- **M5-T06**: P (pausa), B (loja) e T (troca de trem) foram recusados durante a corrida, que avançou 91 ticks nesse intervalo. O trem continuou `cyber`. Save da campanha e saldo (777) ficaram intactos nos dois navegadores.
- **Fantasma do adversário**: visível nas três corridas.
- **M5-T07**: depois das corridas, **0 salas, 0 conexões, 0 sockets e o laço do servidor parado**.

Evidências: [resultados](../../artifacts/validation/m5-e2e-20261007/browser-results.json); capturas de [lobby](../../artifacts/validation/m5-e2e-20261007/m5-rtt50-lobby.png), [corrida com o fantasma](../../artifacts/validation/m5-e2e-20261007/m5-rtt50-racing.png) e [resultado](../../artifacts/validation/m5-e2e-20261007/m5-rtt300-result.png).

### Achados do E2E corrigidos antes desta execução

1. O buffer do adversário guardava o tick da simulação do participante, que congela quando ele cai. Com isso, o HUD indicava "conexão instável" assim que o adversário caía. Agora prevalece o tick do servidor, e há teste para isso.
2. A janela de inputs atrasados subiu de 30 para 60 ticks: o comando de um cliente travado é aplicado no próximo tick, em vez de descartado.
3. A contagem regressiva ficou configurável (`ROOM_COUNTDOWN_MS`, padrão 3 s). No E2E ela é de 10 s, porque a GPU por software trava a página por segundos compilando shaders no primeiro quadro. Com contagem curta, a largada caía dentro desse travamento.
4. O E2E espaça os desenhos (`renderIntervalMs`, só em teste) para não saturar os 4 núcleos com duas páginas em SwiftShader. Simulação e rede não mudam.

## Aceites M5

| Aceite | Estado | Evidência |
| --- | --- | --- |
| M5-A01 | Aprovado automaticamente | Dois navegadores largam juntos; terceiro e versão incompatível recusados |
| M5-A02 | Aprovado automaticamente | Servidor define layout, perfil e resultado; campos forjados ignorados (Node) |
| M5-A03 | Aprovado automaticamente | Duplicados, sequências antigas e futuras, janela, frames malformados e limite de frequência (Node); zero erros nos navegadores |
| M5-A04 | Aprovado nos perfis simulados | 0 correções (limite: ≤ 0,5 m e ≤ 1 a cada 10 inputs), desvio de distância 0 e resultado igual nos dois clientes. Movimento local aplicado no tick seguinte (16,7 ms de simulação). **Latência visual p95 em hardware e redes reais não medidas** |
| M5-A05 | Aprovado automaticamente | Chegada, empate, quedas, abandono, carência, abandono duplo e expiração com resultado único (Node e navegador) |
| M5-A06 | Aprovado automaticamente | Pausa, loja e trem bloqueados na corrida; save, saldo e troféu solo intactos |
| M5-A07 | Aprovado automaticamente | 100 salas (Node) e navegadores voltam à linha de base. A regressão solo segue nas suítes M2–M4; carga real de produção não foi medida |

## Limites

Os perfis de rede são simulados no cliente com entrega FIFO. Não foram testados rede real, rádio móvel, reconexão, mais de dois jogadores, matchmaking nem carga de produção, e o MVP não prevê nenhum desses itens. A latência visual depende do hardware: no SwiftShader a renderização roda a ~1–2 FPS e não serve para medir os 100 ms do p95.

## Reprodução

```powershell
npm install
npm test
$env:PLAYWRIGHT_MODULE_DIR = '<diretorio-do-runtime>/node_modules'
npm run test:browser:m5
```
