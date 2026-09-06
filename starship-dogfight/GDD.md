# Starship Dogfight Arena — GDD

> Versão 1.0 · 2026-09-06 · equipe games-3d · status: **documentação de build publicado**
> (engenharia reversa do bundle; não há código-fonte local — ver seção 7).

## 1. Visão geral
Combate espacial em arena de asteroides por ondas: uma nave, canhões laser, mísseis limitados,
escudo e casco, contra gunships cada vez mais numerosos e um Dreadnought a cada ciclo. Gênero:
space shooter / arena. Plataforma: browser (Three.js + Rapier WASM embutido). Público: arcade;
sessões de 5 a 10 minutos.

## 2. Pilares de design
- **Voo com peso**: física Rapier de corpos rígidos, boost com inércia, asteroides que empurram.
- **Pressão por ondas**: cada onda anuncia hostis; o chefe muda o ritmo.
- **Recursos escassos**: mísseis e escudo só voltam com pickups.
- O que NÃO é: simulação newtoniana completa; o multiplayer (Colyseus) está no bundle mas não é
  exposto no menu ("LAST SHIP STANDING" é o modo em rede, sem servidor aqui).

## 3. Mecânicas (M)
| Ação | Entrada |
|---|---|
| Direção | WASD / mouse |
| Boost | Shift |
| Lasers | Espaço / clique |
| Míssil (lock) | F |
| Pausa | P |

Recursos: SHIELD 100 (regenera), HULL 100 (não regenera), BOOST, mísseis (máx. de slots no HUD).
Pickups (18 % de chance ao destruir): `health`, `shield` (+recarga), `missiles +3`. Pontuação
com multiplicador; onda limpa paga `wave × 200`. Derrota: HULL 0 → "ROUND OVER" com pontuação.

## 4. Dinâmicas (D)
- **30 s**: perseguir gunship, alinhar, disparar, desviar de asteroide, pegar pickup.
- **5 min**: 3–5 ondas; decidir quando gastar míssil.
- **Curva**: hostis por onda crescem; chefe "Dreadnought" em ondas específicas ("BOSS DESTROYED").
- **Fases**: ondas infinitas; não há mapas alternativos.

## 5. Estética (E)
Nebulosa rosa/azul de fundo, planeta com anéis, asteroides escuros, HUD ciano com Orbitron,
bloom via EffectComposer. Áudio: 9 SFX (laser, míssil, vazio, hit, explosão, pickup, rocha,
onda, morte) e música `combat`.

## 6. Conteúdo & assets
GLB: `hero`, `gunship`, `asteroid`, `pickups/health`, `pickups/shield`. Textura `nebula-backdrop`.
Áudio em `assets/audio/sfx` e `music`. Rapier em base64 dentro do bundle.

## 7. Técnico
Build Vite, bundle de 2,9 MB (Three.js + Rapier + Colyseus). Rodar: `npx serve .`. Sem fonte,
testes ou servidor de rede (o menu não mostra o modo online). Melhorias exigiriam recriação.

## 8. Roadmap & estado
Pronto: build single-player idêntico ao publicado. Backlog para recriação: setores com layout
próprio (campo de asteroides, estação, cinturão de gelo), árvore de upgrades entre ondas,
aliados de IA, modo online com servidor Colyseus próprio.
