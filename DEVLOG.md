# Macaco Fujão 🐵🍌 — Diário de Desenvolvimento

Jogo de navegador (HTML5 Canvas + JS puro, sem build/dependências) em que um
macaco foge de um caçador, desvia de troncos, coleta bananas e atravessa rios
usando cipós.

## Arquivos

Ver a tabela completa no [`README.md`](README.md). Em resumo: `Config.js` guarda
as constantes e a definição das fases, `Theme.js` interpola o visual entre elas,
`Backdrop.js` desenha os cenários, `Environment.js` cuida de obstáculos e
colisões, `Player.js` e `Hunter.js` são os personagens e `game.js` amarra tudo
no loop principal.

## Como jogar

- **ESPAÇO**, **↑**, **W** ou toque na tela: pular / começar / reiniciar.
- **↓**, **S** ou botão CAVAR: segurar para escavar sob as rochas.
- **P** / **ESC**: pausar.
- Pule perto de um cipó (balançando sobre rios, lava e fendas) para agarrá-lo
  automaticamente; aperte pular de novo para soltar.

## Histórico de decisões e funcionalidades

1. **Base do jogo**: corredor infinito em Canvas 2D. Macaco fixo horizontalmente
   na tela (mundo rola da direita pra esquerda); pula para desviar de troncos e
   coleta bananas automaticamente ao tocar nelas. Pontuação por tempo + bônus
   por banana. Recorde salvo em `localStorage`.

2. **Caçador perseguidor**: adicionado um caçador que persegue o macaco por
   trás, representado por uma "distância" (`hunterGap`) que diminui com o
   tempo (ele se aproxima) e aumenta ao coletar bananas (ele fica pra trás).
   Medidor de perigo no HUD. Se `hunterGap` chega a zero, é game over.

3. **Corpo desenhado + gráficos "realistas"**: como o jogo não usa sprites/
   imagens (só formas de Canvas), o macaco e o caçador foram desenhados com
   primitivas (elipses, retângulos arredondados, membros articulados) e depois
   refinados com gradientes de sombreamento (efeito de volume), textura de
   pelo, sombra no chão, olhos com íris/brilho, roupas com dobras, botas, etc.

4. **Balanceamento**: o jogo ficou fácil demais porque bananas eram frequentes
   e davam bônus grande demais ao caçador. Ajustado: menos bônus por banana,
   caçador fecha a distância mais rápido, bananas menos frequentes.

5. **Rios e cipós**: rios são obstáculos largos o suficiente para que nenhum
   pulo normal os atravesse sozinho (largura calculada a partir do tempo de ar
   do pulo). Um cipó balança sobre cada rio; pular perto dele agarra
   automaticamente e inicia um arco de balanço (`monkey.swinging`) mais longo
   que o pulo normal. Enquanto o macaco balança, o caçador — se estiver na
   mesma faixa do rio — "nada" (pose e animação diferentes) e fica mais lento.

6. **Bugs corrigidos**:
   - *Rio nunca afogava*: a caixa de colisão do rio começava exatamente em
     `GROUND_Y`, mas o hitbox do macaco tem uma folga de 6px nas bordas e
     nunca chegava até lá — a colisão nunca disparava. Corrigido subindo a
     borda superior da caixa de colisão do rio.
   - *Natação do caçador imperceptível*: a checagem "caçador está no rio?"
     era recalculada a cada quadro a partir da própria posição dele, que a
     lentidão alterava — criava um efeito de 1-2 quadros (imperceptível).
     Trocado por um cronômetro fixo: ao entrar no rio, a lentidão dura um
     número fixo de quadros, sem recalcular.
   - *Bananas coladas em troncos*: troncos e bananas nasciam em temporizadores
     independentes, então às vezes apareciam quase juntos, forçando colisão
     ao pular. Corrigido com um espaçamento mínimo garantido entre o
     nascimento de um tronco e de uma banana.
   - *Cipó sem limite de tempo*: era possível ficar pendurado no cipó
     indefinidamente. Adicionado um teto de tempo (arco de balanço + folga)
     após o qual o cipó arrebenta e é game over.

7. **Soltura manual do cipó**: a soltura automática por tempo foi substituída
   por soltura manual via duplo toque em ESPAÇO dentro de uma janela curta,
   dando ao jogador controle real (e risco real) sobre o momento da soltura.

8. **Sistema de 4 fases** (reestruturação grande). O jogo deixou de ser um
   corredor infinito e passou a ter começo, meio e fim:

   | # | Fase | Pontos | Gravidade | Novidades de cenário |
   |---|------|--------|-----------|----------------------|
   | 1 | 🌴 Selva Esmeralda | 0–500 | 1.0 | palmeiras em parallax, sol descendo, folhas caindo |
   | 2 | 🏜️ Dunas do Sol Poente | 500–1100 | 1.0 | dunas, abutres, areia voando, cactos e moais |
   | 3 | 🌋 Caldeira Vulcânica | 1100–1800 | 1.0 | vulcões com lava escorrendo, cinzas, dragão, rios de lava |
   | 4 | 🛸 Órbita Fujona | 1800–2600 | **0.72** | nebulosa, planetas, constelação, meteoros, fendas espaciais |

   Decisões de arquitetura:

   - Cada fase é um objeto de dados em `Config.js` (cores, ícones, gravidade,
     multiplicadores). Adicionar uma quinta fase é acrescentar um item no array
     — nenhum `if` novo em lógica de jogo.
   - `Theme.js` interpola cores entre a fase atual e a próxima nos últimos 120
     pontos, então o cenário derrete de um para o outro em vez de dar corte
     seco. (Aproveitou o `lerpColor` que já existia mas nunca era chamado.)
   - Os ícones dos obstáculos são fixados **no momento do spawn**, não lidos do
     tema a cada frame. Se dependessem do frame, um tronco já visível trocaria
     de aparência no meio da transição.
   - A largura dos rios sai do tempo de ar do pulo, que agora depende da
     gravidade da fase — por isso `JUMP_AIR_FRAMES` virou a função
     `jumpAirFrames(gravityScale)`. Há um teto (`MAX_HAZARD_WIDTH`) para a
     gravidade baixa do espaço não gerar uma fenda maior que a tela, o que
     faria o cipó nascer fora do campo de visão.

9. **Cutscenes**: a passagem da fase 3 para a 4 é uma abdução por OVNI (raio
   trator, o gorila flutua, o caçador fica para trás) e a vitória é o pouso do
   foguete-banana. Ambas rodam como estados próprios da máquina de estados,
   com a pontuação congelada e o cenário transicionando por um blend forçado
   em vez da régua normal de pontuação.

10. **Segunda rodada de bugs corrigidos**:
   - *Jogo congelava para sempre aos 1400 pontos*: `loop()` só continuava se o
     estado fosse `playing` ou `victory`, mas a cutscene do OVNI colocava o
     jogo em `transition` — o `requestAnimationFrame` parava e nada mais
     respondia. O estado faltava na lista.
   - *Cutscene só acontecia na primeira partida*: `transitionDone` nunca era
     zerado em `resetGame()`.
   - *As cutscenes nunca desaceleravam*: `speed` era recalculado a partir da
     pontuação no topo de `update()`, **antes** das checagens de estado, então
     sobrescrevia a desaceleração das cenas todo frame. Agora só é recalculado
     durante o jogo normal.
   - *Softlock na rocha*: ao perder uma vida para uma rocha, `activeRock`
     continuava apontando para ela; como `update()` retornava cedo enquanto
     houvesse rocha ativa, o jogo congelava até as vidas acabarem. O dano agora
     limpa o obstáculo que o causou.
   - *Dano infinito no cipó*: quando o cipó arrebentava com vidas sobrando, o
     macaco continuava com `swinging = true` e `swingT` seguia crescendo, então
     o dano se repetia a cada frame. Criado `releaseVine()`, chamado antes de
     aplicar o dano.
   - *Tremor e dano repetidos durante a invulnerabilidade*: o obstáculo que
     acabou de acertar o jogador continuava sobreposto a ele. As colisões agora
     são ignoradas enquanto ele está invulnerável.
   - *Macaco piscando nas cutscenes*: `player.update()` não roda durante elas,
     então o contador de invulnerabilidade ficava preso em um valor positivo e
     o desenho continuava alternando. Zerado ao entrar nas cenas.
   - *Vidas nunca visíveis de verdade*: o jogador começava com 1 vida, o que
     tornava todo o sistema de invulnerabilidade e de corações inútil. Agora
     começa com 3 (teto de 5).

11. **Acabamento**: barra de progresso da fase no HUD, banner anunciando cada
    fase, pausa (`P`/`ESC` e ao perder o foco da aba), canvas responsivo por
    CSS (a resolução interna continua 800×400, então a lógica não precisa saber
    o tamanho da tela) e novos sons (fase, raio trator, decolagem, coração).

12. **A tecla ↓ vira um comando contextual**. Antes ela só cavava sob rochas —
    um uso raríssimo para uma tecla inteira. Agora faz três coisas conforme o
    contexto, resolvidas em `Player.applyDownInput()`:

    | Contexto | Ação |
    |----------|------|
    | rocha na frente | cavar (prioridade máxima, controlada pelo `game.js`) |
    | no ar | mergulho — gravidade × 2.7 |
    | no chão | agachar |

    - O agachamento troca `h` de 40 para 20 e reposiciona `y`. Como só é
      permitido no chão, dá para reposicionar direto sem risco de atravessar o
      cenário.
    - A caixa de colisão saiu de um cálculo repetido em cada checagem e virou
      `Player.hitbox()`, justamente porque agora ela **muda de tamanho**.
    - Visualmente o agachamento é um `ctx.scale(1.16, 0.5)`: como o corpo já era
      desenhado a partir dos pés, achatar no eixo Y produz a pose sem mexer em
      nenhuma coordenada do desenho.
    - `jump()` desfaz o agachamento antes de aplicar o impulso — senão o macaco
      decolaria com a altura errada.
    - O botão de toque virou "ABAIXAR"/"CAVAR" conforme o contexto, e só pulsa
      quando há uma rocha esperando.

13. **Obstáculos voadores** (araras, abutres, morcegos, satélites). Ocupam a
    faixa da cabeça, calibrada para que:

    - de pé (hitbox começa em `GROUND_Y-34`) → **acerta**;
    - pulando → **acerta** (não dá para escapar por cima, de propósito);
    - agachado (hitbox começa em `GROUND_Y-17`) → **passa livre**, com ~9px de
      folga.

    Só aparecem da fase 2 em diante, para a fase 1 continuar ensinando pulo e
    cipó sem sobrecarregar. Não nascem perto de rochas (que obrigam a parar) nem
    de rios (onde o jogador está pendurado, sem controle de altura).

14. **Três poderes novos**, escolhidos para não interferir na física já
    calibrada:

    - 🛡️ **Escudo** — absorve um golpe inteiro. Tratado no início de
      `handleDamage()`, antes de encostar nas vidas. O mais raro do pool.
    - 🧲 **Ímã** — atrai bananas num raio de 165px.
    - 🧊 **Gelo** — congela o caçador por 6s. Foi preferido a uma "câmera lenta"
      porque mexer na velocidade do mundo quebraria a matemática de travessia
      dos rios: a duração do balanço no cipó é calculada no spawn a partir da
      velocidade, e alterá-la no meio do balanço faria o jogador cair na água.

    Os poderes ativos passaram a ser listados no canto superior esquerdo. Antes
    cada um desenhava o próprio rótulo em cima do macaco, empilhando texto sobre
    o personagem justamente quando ele mais precisa estar visível.

15. **Bug encontrado no caminho**: `flierIcon` foi adicionado às fases em
    `Config.js` mas não propagado no `computeTheme()`, então o jogo desenhava
    literalmente a palavra "undefined" na tela. Ao adicionar um campo novo de
    fase, ele precisa ser repassado nos **dois** lugares.

## Próximos passos possíveis (não implementados)

- Chefão no fim de cada fase.
- Placar online / leaderboard.
- Controles touch dedicados para pulo (hoje reaproveita o toque na tela).
