# Shotgun FPS + Braco (low-poly)

Modelo 3D low-poly da pump shotgun e do braco direito em primeira pessoa,
no estilo da imagem gerada (formas facetadas, madeira + metal).

## Arquivos
- `shotgun_fps_arm.obj`  — malha
- `shotgun_fps_arm.mtl`  — materiais (metal, madeira, pele)
- `viewer.html`          — abre no navegador para orbitar o modelo
- `preview_*.png`        — pre-visualizacoes

## Convencao
- Unidades: metros
- Origem: perto do pistol grip
- Cano aponta para +Z
- Cima: +Y
- Direita do atirador: +X

Comprimento aproximado da arma: ~1.20 m (coronha ate a boca).

## Como importar
### Blender
1. File > Import > Wavefront (.obj)
2. Selecione `shotgun_fps_arm.obj` (o .mtl entra automatico)
3. Se quiser o sombreamento do jogo: Object > Shade Flat

### Unity
1. Arraste a pasta inteira para Assets
2. No importador do OBJ: Scale Factor 1 (ou 100 se o projeto for em cm)
3. Materials: Use Embedded Materials

### Godot
1. Arraste o .obj para a cena
2. Aplique StandardMaterial3D por superficie se o MTL nao vier

## Grupos da malha
- barrel, mag_tube, receiver, pump, stock, trigger, sights
- forearm, sleeve, hand

Nao e um modelo rigado (sem ossos). E uma pose unica de viewmodel.
Pode-se separar o grupo `hand`/`forearm` do resto para animar o pump depois.

Gerado proceduralmente para combinar com a cidade western low-poly.
