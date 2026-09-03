# NIGHT SORTIE

**F-35A LIGHTNING II · NIGHT AIR RACE** — jogo de voo no browser: um caça furtivo procedural sobre um vale de montanha à noite, com HUD de simulador militar, oito modos de missão e drones de treino para abater.

Tudo é procedural: terreno (fbm + ridged noise), céu, luzes da cidade, pista 36 com *rabbit* de aproximação, aeronave, drones, partículas, HUD e áudio (Web Audio). Nenhum asset binário é carregado.

```bash
npm install
npm run dev      # http://127.0.0.1:5174
npm run build
```

## Modos

| Modo | Objetivo |
|---|---|
| **DOGFIGHT** | Ondas de drones PATROL / EVADER / AGGRESSOR / BOSS. 600 *training rounds*, mira com cálculo de *lead*, escudo de 3 golpes, cadeias ×1.5–×3, melhor pontuação e onda persistidas. |
| **FULL SORTIE** | Decolar da pista 36, rota de 9 portões, os cinco desafios em sequência, portão de aproximação e pouso. |
| **SLALOM** | 10 portões alternando esquerda/direita da linha. |
| **LOW-LEVEL COURSE** | Corredor iluminado abaixo de 300 ft AGL. |
| **PYLON CHECK** | Seis pilones no círculo do sensor por 1,2 s, a menos de 3 km. |
| **FORMATION HOLD** | Manter a caixa de formação na asa direita do avião-guia por 6 s. |
| **SPEED SECTION** | Pós-combustor total: sair do portão de saída a ≥ 600 kt. |
| **LANDING CHALLENGE** | Portão de aproximação, trem e flaps, pouso e parada na 36, nota por razão de descida / eixo / velocidade. |
| **FREE FLIGHT** | Sem objetivos. |

## Controles

| Ação | Teclado / mouse | Gamepad (DualSense) |
|---|---|---|
| Pitch / roll | Mouse (clique no canvas para capturar) · W A S D | Stick esquerdo |
| Yaw | Q / E ou Z / X | Stick direito (X) |
| Throttle | Shift sobe · Ctrl desce · roda do mouse | L2 analógico |
| Disparar | Espaço · botão esquerdo | R2 |
| Alternar drone / pilone | Tab | L1 / R1 |
| Limpar lock | C | ○ |
| Trem · flaps · freios | G · F · B | □ (trem) |
| Câmera | V | △ |
| Menu · controles | Esc · H | Options · Share |

Haptics: rumble via Gamepad API em qualquer controle padrão; no Chrome, o pareamento **WebHID** (em *Settings*) habilita rumble direto no DualSense e leitura do nível de bateria mostrado no HUD.

## Estrutura

```
src/
  main.ts               renderer, pós-processamento (bloom + FXAA), loop, estados
  aircraft/f35.ts       F-35A procedural: trem, flaps, superfícies, pós-combustor
  aircraft/flightModel.ts modelo de voo arcade-sim (sustentação, arrasto, estol, solo)
  world/terrain.ts      heightmap analítico + malha
  world/sky.ts          céu, estrelas, lua, luzes da cidade
  world/runway.ts       pista 36, luzes, rabbit, PAPI
  world/course.ts       portões, pilones, corredor, portão de aproximação
  drones/               tipos de drone, IA e composição das ondas
  hud/hud.ts            HUD DOM + canvas (ladder, fitas, alvo, pipper)
  ui/menu.ts            boot, seleção de missão, settings, how to fly, debrief
  missions/             uma classe por modo
  input/, audio/        teclado, mouse, gamepad, haptics WebHID, sintetizador
```
