# Skywatch — voo 3D

Globo em ECEF com Three.js. Dois modos:

- **Assistir**: replay de voos do catálogo (BA246 GRU→LHR etc.) ou posição ao vivo via OpenSky.
  Câmeras de perseguição, órbita, cabine, asa e globo.
- **Pilotar**: campanha de 5 fases com anéis, tempestades e trechos, mais voo livre.
  Modelo de voo arcade (`src/flight/FlightModel.ts`), missões em `src/missions/`,
  anéis em `src/world/rings.ts`, áudio de motor sintetizado em `src/systems/EngineAudio.ts`.
  Aeronaves: A350-1000 e A320neo (`src/models/`). Progresso salvo em `localStorage`.

## Controles (modo piloto)

| Tecla | Ação |
|---|---|
| W / S | nariz para baixo / para cima |
| A / D | rolagem |
| Q / E | leme |
| Shift / Ctrl | manete + / − |
| G | trem de pouso (automático abaixo de 700 m) |
| 1–5 | câmeras |
| R | repetir fase |
| Esc | painel da campanha |
| arrastar o mouse | pitch e rolagem |

## Rodar

```bash
npm install
npm run dev        # http://127.0.0.1:5188
npm run build
npm test           # Playwright: canvas renderiza sem erros
```
