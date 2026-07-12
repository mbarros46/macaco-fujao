# Macaco Fujão 🐵🍌 — Diário de Desenvolvimento

Jogo de navegador (HTML5 Canvas + JS puro, sem build/dependências) em que um
macaco foge de um caçador, desvia de troncos, coleta bananas e atravessa rios
usando cipós.

## Arquivos

- `index.html` — estrutura da página, telas de início/game over, HUD.
- `style.css` — visual (tema de selva) e estilos do medidor de perigo do caçador.
- `game.js` — toda a lógica do jogo (única IIFE, sem dependências externas).

## Como jogar

- **ESPAÇO**, **↑** ou toque na tela: pular / começar / reiniciar.
- Pule perto de um cipó (aparece balançando sobre os rios) para agarrá-lo
  automaticamente e atravessar.
- Enquanto estiver pendurado, **dois toques rápidos** em ESPAÇO (menos de
  ~350ms entre eles) soltam o cipó.

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

## Próximos passos possíveis (não implementados)

- Efeitos sonoros.
- Fases com dificuldade crescente / obstáculos novos.
- Versão mobile com controles touch dedicados (hoje reaproveita o toque na tela).
