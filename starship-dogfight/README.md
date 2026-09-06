# Starship Dogfight

Cópia do build publicado da demo **Starship Dogfight**, um dos jogos de demonstração do repositório
[majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills)
(skills de Three.js para agentes de código).

- Jogar online: <https://starshipdogfight.netlify.app>
- Vídeo: <https://x.com/majidmanzarpour/status/2065065340510281888>
- Loop: dogfight espacial em arena de asteroides (física Rapier)

## Conteúdo

Build de produção (Vite) baixado do site em 2026-09-05: `index.html`, bundle JS/CSS em `assets/`
e os assets carregados em runtime (modelos GLB, texturas, áudio). Não há código-fonte original;
o bundle está minificado. Fontes Google são carregadas da rede.

## Como rodar

Sirva a pasta com qualquer servidor estático (os caminhos são relativos):

```bash
npx serve .
```
