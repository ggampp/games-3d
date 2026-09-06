# Tide Singer

Cópia do build publicado da demo **Tide Singer**, um dos jogos de demonstração do repositório
[majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills)
(skills de Three.js para agentes de código).

- Jogar online: <https://tidesinger.netlify.app>
- Vídeo: <https://x.com/majidmanzarpour/status/2065570428723007555>
- Loop: exploração submarina com cardumes e criaturas

## Conteúdo

Build de produção (Vite) baixado do site em 2026-09-05: `index.html`, bundle JS/CSS em `assets/`
e os assets carregados em runtime (modelos GLB, texturas, áudio). Não há código-fonte original;
o bundle está minificado. Fontes Google são carregadas da rede.

## Como rodar

Sirva a pasta com qualquer servidor estático (os caminhos são relativos):

```bash
npx serve .
```
