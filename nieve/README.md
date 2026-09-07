# NIEVE — Buenos Aires, zona cero

Reimplementação de estudo do jogo **NIEVE** (https://nieve.emaalozada.com/, de @emaalozada):
survival horror em primeira pessoa numa Buenos Aires fictícia coberta de neve tóxica, com a
atmosfera de *El Eternauta*. Percorra a Avenida Corrientes, recolha suprimentos, mantenha
distância dos cascarudos e chegue à Plaza de la República.

O original é React Three Fiber + Rapier + modelos GLB. Esta versão é **Three.js puro + Vite**,
sem assets externos: cidade, letreiros, besouros, espingarda, neve e todo o áudio são procedurais.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # dist/
```

Só desktop (mouse + teclado, pointer lock).

## Controles

| Tecla | Ação |
|---|---|
| W A S D | mover |
| Mouse | olhar · clique esquerdo dispara |
| Shift | correr (gasta stamina e embaça o visor) |
| R | recarregar (2,43 s) |
| F | linterna |
| E | recolher munição / botiquín |
| Espaço | pular |
| Esc | pausa |

## Sistemas

- **Vitais**: 100 de vida, stamina 100 (−16/s correndo, +12/s parado). Stamina zero = exausto até 28.
  Correr embaça o visor (até 85 %) e acelera a respiração na máscara.
- **Saiga 12**: 8 cartuchos no carregador, 64 de reserva (cap 96), 8 balins por tiro com espalhamento.
- **Cascarudos**: 96 de vida, perseguem a última posição vista, atacam a 2,85 m (10 de dano).
- **Diretor de hordas**: `quiet → warning (6 s, chamados nas bocas de rua) → assault (8–12 besouros) → recovery`.
  Entrar na Plaza de la República inicia o **cerco** (spawn contínuo); resistir 90 s = evacuação.
- **Pickups**: 10 caixas fixas na avenida (munição +16, botiquín +35), reaparecem após 110 s.

## Estrutura

```
src/state.js    estado global, constantes, vitais, tiro/recarga/dano
src/world.js    cidade procedural, colisores AABB, line of sight, neve, meteoro, pickups
src/enemies.js  besouros (malha + IA) e diretor de hordas/cerco
src/player.js   pointer lock, movimento, viewmodel em passe separado, linterna, hitscan
src/audio.js    Web Audio procedural (vento, passos, tiro, besouros, respiração)
src/main.js     renderer, HUD, overlays, loop
```

`window.__nieve` expõe estado, diretor e `fire()` para testes com Playwright.

Ver [GDD.md](./GDD.md) para o design observado no original.
