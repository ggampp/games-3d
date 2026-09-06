# Neon Ridge Drift — GDD

> Versão 1.0 · 2026-09-06 · equipe games-3d · status: **documentação de build publicado**
> (engenharia reversa do bundle; não há código-fonte local — ver seção 7).

## 1. Visão geral
Corrida arcade de drift em uma serra neon à noite: três voltas contra três rivais, onde derrapar
nas curvas carrega o turbo. Gênero: arcade racer / drift. Plataforma: browser (Three.js r184),
teclado e toque. Público: casual, sessões de 3 a 5 minutos.

## 2. Pilares de design
- **Drift é o motor**: a única forma de ganhar turbo é derrapar bem, então a curva é a recompensa.
- **Legibilidade neon**: pista, checkpoints e rivais brilham; nada compete com a linha de corrida.
- **Sessão curta, recorde sempre visível**: melhor volta e melhor tempo aparecem no HUD.
- O que NÃO é: simulação, campeonato longo, tuning de carro.

## 3. Mecânicas (M)
| Ação | Teclado | Toque |
|---|---|---|
| Acelerar / frear | ↑ W · ↓ S | botões gas / brake |
| Esterçar | ← → · A D | steer-l / steer-r |
| Drift | Espaço | botão drift |
| Turbo | Shift | botão boost |
| Reiniciar · pausa · som | R · P · botão | |

Regras: 3 voltas; checkpoints em sequência (pular checkpoint não conta a volta); drift sustentado
enche a barra de turbo; colisão com rival/borda reduz velocidade; pontuação por drift acumulado.
Vitória: cruzar a linha após 3 voltas (posição 1–4 exibida). Sem derrota: só tempo e posição.

## 4. Dinâmicas (D)
- **30 s**: reta → freada → drift na curva → turbo na saída.
- **5 min**: uma corrida completa; comparar melhor volta e tentar de novo.
- **Curva de dificuldade**: rivais com IA fixa; a dificuldade vem do traçado (curvas fechadas,
  mudanças de elevação).
- **Fases**: um único circuito (Neon Ridge). Não há seleção de pista nem desbloqueio.

## 5. Estética (E)
Synthwave: céu panorâmico noturno, asfalto texturizado com faixas emissivas, prédios com
outdoors, logo com brilho ciano/magenta; fontes Orbitron/Rajdhani. Câmera chase baixa. Áudio:
motor, cantada de pneu, turbo, impacto, checkpoint, volta, chegada e trilha `music-race`.

## 6. Conteúdo & assets
Modelos GLB: `hero`, `rival`, `rival2`, `building-a/b/c`. Texturas: `asphalt`, `billboards`,
`sky-panorama`, `logo`. Áudio: 10 arquivos MP3 em `assets/audio/`. Fontes via Google Fonts.

## 7. Técnico
Build de produção Vite, bundle único minificado (`assets/index-*.js`, ~726 kB) + CSS. Não há
`src/`, `package.json` nem testes. Rodar: `npx serve .`. O bundle inclui Three.js r184.
**Limitação**: alterações de jogabilidade, fases e modelos exigiriam reescrever o jogo do zero
ou editar código minificado, o que não foi feito nesta rodada.

## 8. Roadmap & estado
Pronto: build jogável idêntico ao publicado (copiado em 2026-09-05).
Backlog (para uma recriação com fonte própria): seleção de pistas (3 traçados), campeonato de
3 corridas com pontos, ghost da melhor volta, tuning simples (aderência × velocidade), dano visual.
