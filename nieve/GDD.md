# GDD — NIEVE (Buenos Aires, zona cero)

Design observado no build publicado em https://nieve.emaalozada.com/ (bundle minificado, sem
código-fonte). Valores numéricos extraídos do bundle em 2026-09-06.

## 1. Conceito

Survival horror em primeira pessoa. Uma Buenos Aires fictícia (Avenida Corrientes, do quarteirão
de Suipacha até o Obelisco) parou sob uma nevasca tóxica; um meteoro vermelho ilumina o céu.
Cascarudos gigantes caçam quem ainda se move. Tagline: *"La ciudad se detuvo. Algo más sigue moviéndose."*
Inspiração explícita: a atmosfera de *El Eternauta*.

## 2. Loop

Explorar a avenida → recolher munição e botiquíns → sobreviver às hordas → chegar à Plaza de la
República → resistir ao cerco. Perder = ser devorado (tela "LA NIEVE MATA").

## 3. Mecânicas

**Jogador**: andar 3,8 m/s, correr 6,5 m/s. Vida 100. Stamina 100, −16/s correndo, +12/s recuperando;
exausto em 0 até voltar a 28. Correr embaça o visor (fog do visor até 0,85, proporcional à stamina
gasta) e eleva o "esfuerzo", que controla a respiração audível na máscara.
Rótulos: RESPIRACIÓN ESTABLE / ESFUERZO ELEVADO / RECUPERANDO EL ALIENTO.

**Arma (Saiga 12 semiauto)**: carregador 8, reserva inicial 64, cap 96, recarga 2,43 s, cadência 0,24 s.

**Cascarudo**: 96 HP, corre 3,4 m/s (+15 % no cerco), ataca a menos de 2,85 m com janela de 1,65 s,
dano 10. Persegue a última posição vista (visão a 42 m com line of sight). Ao levar tiro fica lento
por um instante. Separação entre besouros a 2,7 m.

**Pickups**: 10 posições fixas (5 munição +16, 5 botiquín +35), respawn em 110 s, raio de interação 2,7 m.

## 4. Diretor de hordas

Estados `quiet → warning → assault → recovery`, mais `siege`:
- *warning*: 6 s; escolhe 2–3 "entradas" (bocas de rua a 23–115 m), toca chamados e estática de rádio.
- *assault*: 8–12 besouros em levas de 3–4, sempre a mais de 20 m e preferencialmente fora do campo de visão.
- *recovery*: quando todos morrem, espera e recomeça.
- *siege*: ao entrar num raio de 24 m do Obelisco; 7 s de chamados crescentes, depois spawn contínuo
  (6 por leva nos 2 primeiros segundos, 3 depois) a partir de 5 entradas da praça.

## 5. Mundo

Avenida em Z (início z = 92, Obelisco em z = −155), ruas transversais a cada 39 m. Letreiros de
locais reais reinterpretados: Gran Rex, Ópera, Café Paulín, Kiosco 24 hs, Farmacia, Librería
Corrientes, Las Cuartetas, Subte B, Galería Corrientes, Óptica Corrientes, Hotel República,
ônibus Línea 59. Avisos "NO SALGAN · LA NIEVE MATA" e "EVACUACIÓN · PLAZA DE LA REPÚBLICA →".
Carros abandonados (sedan, hatchback, ônibus), postes com luz falhando, neve caindo.

## 6. Apresentação

Paleta azul-petróleo (#0a151e) com o vermelho do meteoro. Tipografia Saira Extra Condensed +
Share Tech Mono. HUD: marca "N°", setor "NIEVE TÓXICA · EXTERIOR", vitais com 10 blocos, barra de
stamina, contador 08/64 com 8 cartuchos, dicas R/SHIFT/F. Loading: "CARGANDO EL SECTOR",
"DESCARGANDO MODELOS", "COMPILANDO SOMBRAS", "SECTOR LISTO". Só desktop.

## 7. Áudio

Ambience loop de vento, respiração na máscara, passos na neve/vidro, passos do besouro, recarga,
estática de rádio nos avisos de horda. Menu recomenda auriculares.

## 8. Diferenças desta reimplementação

- Three.js puro, sem física (colisão AABB própria) e sem GLB: besouros e arma em primitivas.
- Sem pós-processamento; visor via CSS (blur/vinheta/hurt).
- Condição de vitória adicionada: resistir 90 s ao cerco da praça = evacuação.
- Áudio sintetizado em Web Audio em vez de samples.
