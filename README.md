# 🐵 Macaco Fujão 🍌

Um jogo de corrida de navegador feito em HTML5 Canvas e JavaScript puro, sem
build, sem dependências e sem frameworks. Você controla um gorila fugindo de um
caçador ao longo de **4 fases**, cada uma com cenário, obstáculos e regras
próprias — até escapar de vez a bordo do Expresso Banana.

Jogue direto abrindo o `index.html` — não precisa instalar nada.

## As 4 fases

| # | Fase | Pontos | Cenário |
|---|------|--------|---------|
| 1 | 🌴 **Selva Esmeralda** | 0 → 500 | Céu azul, sol descendo, palmeiras em parallax, folhas ao vento. Troncos 🪵 e rios 🌊. |
| 2 | 🏜️ **Dunas do Sol Poente** | 500 → 1100 | Pôr do sol enorme no horizonte, dunas, abutres circulando, areia voando. Cactos 🌵, moais 🗿 e areia movediça. |
| 3 | 🌋 **Caldeira Vulcânica** | 1100 → 1800 | Noite vermelha, cordilheira de vulcões com lava escorrendo, chuva de cinzas, dragão sobrevoando. Ossadas 🦴 e rios de lava. |
| 4 | 🛸 **Órbita Fujona** | 1800 → 2600 | Nebulosa, planetas, estrelas cadentes, a Constelação Primata. **Gravidade baixa** — os pulos ficam enormes. Meteoros ☄️ e fendas espaciais. |

Entre a fase 3 e a 4 acontece uma cutscene: um OVNI aparece, prende o gorila num
raio trator e o larga em órbita. Ao chegar em 2600 pontos, o foguete-banana
pousa e leva o gorila embora — vitória.

As transições de cenário são feitas por interpolação de cor, então o céu, o
chão, a água e os cipós vão mudando gradualmente de uma fase para a outra.

## Como jogar

- **ESPAÇO**, **↑**, **W** ou toque na tela: pular / começar / jogar de novo.
- **P** ou **ESC**: pausar (o jogo também pausa sozinho se a aba perder o foco).

### A tecla ↓ faz três coisas

O mesmo botão (ou o botão na tela, no celular) muda de função conforme a
situação — é o comando mais versátil do jogo:

| Situação | O que ↓ faz |
|----------|-------------|
| **No chão** | **Abaixa.** A única forma de escapar dos voadores. |
| **No ar** | **Mergulha.** Multiplica a gravidade por 2.7, encurtando o pulo. |
| **Parado numa rocha** | **Cava** por baixo dela. |

O mergulho é o que dá controle fino de aterrissagem quando a velocidade
aumenta — e é praticamente obrigatório na fase espacial, onde a gravidade
baixa deixa o pulo padrão longo demais para obstáculos em sequência.

### Obstáculos

O gorila fica parado horizontalmente; o mundo é que rola da direita para a
esquerda.

- **Altos** (troncos 🪵, cactos 🌵, ossadas 🦴, meteoros ☄️): **pule**.
- **Voadores** (araras 🦜, abutres 🦅, morcegos 🦇, satélites 🛰️): voam na
  altura da cabeça e vêm com um selo **"↓ ABAIXE"** enquanto se aproximam. Não
  adianta pular — pular também acerta. Aparecem a partir da metade da fase 1.
- **Rochas** (🪨 🗿 🌑): não dá para pular. Pare em frente e **segure ↓** para
  cavar. Você tem uma pequena carência antes de bater nela.
- **Rios, areia movediça, lava e fendas**: largos demais para um pulo. Pule
  perto do **cipó** que balança sobre eles para se agarrar, e aperte pular
  **de novo** para se soltar. Ficar pendurado tempo demais arrebenta o cipó.

### Itens

| Item | Efeito |
|------|--------|
| 🍌 **Banana** | +10 pontos e atrasa o caçador. |
| 🍌 **Casca** | +15 pontos e empurra o caçador bem para trás. |
| 🦘 **Mola** | Pulo turbinado por 10 segundos — e você atravessa rochas por cima. |
| 🛡️ **Escudo** | Absorve **um golpe inteiro** sem custar vida. O mais raro. |
| 🧲 **Ímã** | Atrai as bananas próximas por 8 segundos. |
| 🧊 **Gelo** | Congela o caçador por 6 segundos — ele para e o cenário o deixa para trás. |
| ❤️ **Coração** | +1 vida (máximo de 5). Você começa com 3. |

Os poderes ativos aparecem numa lista no canto superior esquerdo da tela, com
uma barra mostrando quanto tempo resta.

### O caçador

Um caçador persegue o gorila por trás. O medidor "🏹 Caçador" mostra a distância
entre os dois: ela diminui com o tempo e aumenta quando você coleta bananas. Se
chegar a zero, você perde uma vida e ele é empurrado para trás.

A IA dele se adapta: se você ficar muito tempo na distância máxima, ele **dispara
num sprint** (indicado por 💢); se estiver quase te pegando, ele alivia um pouco.
Quando precisa atravessar um rio, ele nada e fica mais lento. No espaço ele
improvisa um capacete e continua a caçada.

### Pontuação

A pontuação sobe com o tempo de sobrevivência mais os bônus por item. O recorde
fica salvo no `localStorage`, então persiste entre sessões no mesmo navegador.

## Como rodar localmente

Não há dependências nem processo de build:

```bash
python -m http.server 8000    # ou: npx serve .
```

Depois acesse `http://localhost:8000`. Rodar por um servidor local é necessário
porque o jogo usa **módulos ES**, que o navegador bloqueia via `file://`.

Em `localhost` fica disponível um atalho de depuração no console:

```js
__macaco.state          // estado, pontos, fase, vidas, velocidade
__macaco.player         // postura, hitbox, timers de poder
__macaco.world          // voadores em cena, gelo, distância do caçador
__macaco.skipTo(1800)   // pula para uma pontuação
__macaco.godMode()      // 99 vidas
__macaco.give("shield") // shield | magnet | freeze | spring
__macaco.spawnFlier()   // invoca um voador
__macaco.clearHazards() // limpa troncos/rochas/rios
__macaco.step(60)       // avança N quadros sem depender do requestAnimationFrame
```

`step()` existe porque o Chrome suspende o `requestAnimationFrame` quando a aba
não está visível — sem ele, testar o jogo de forma automatizada é impossível.

## Estrutura do projeto

| Arquivo | Responsabilidade |
|---------|------------------|
| `index.html` | Estrutura da página, telas de início/game over/vitória/pausa e HUD. |
| `style.css` | Visual, medidores de fase e de perigo, layout responsivo. |
| `Config.js` | Constantes de física e a **definição das 4 fases** (cores, ícones, gravidade, ritmo). |
| `Theme.js` | Interpola cores e ícones entre a fase atual e a próxima. |
| `Backdrop.js` | Cenários de fundo: parallax, corpos celestes e partículas ambientes. |
| `Environment.js` | Obstáculos, itens, spawn e colisões. |
| `Player.js` | Física e desenho do gorila. |
| `Hunter.js` | IA e desenho do caçador. |
| `Helpers.js` | Utilitários de cor e primitivas de desenho compartilhadas. |
| `game.js` | Loop principal, máquina de estados, cutscenes, áudio e entrada. |
| `DEVLOG.md` | Histórico de decisões de design e bugs corrigidos. |

Todo o áudio é sintetizado em tempo real com a Web Audio API — não há nenhum
arquivo de som no repositório.

## Publicando no GitHub Pages

Como é um projeto 100% estático, dá para publicar direto:

1. Suba o repositório para o GitHub.
2. Em **Settings → Pages**, selecione a branch `main` e a pasta raiz (`/`).
3. O jogo fica em `https://<seu-usuário>.github.io/<nome-do-repo>/`.

## Mais detalhes

Para o histórico de decisões de design e a lista de bugs corrigidos, veja o
[`DEVLOG.md`](DEVLOG.md).
