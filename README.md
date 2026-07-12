# 🐵 Macaco Fujão 🍌

Um corredor infinito (*endless runner*) de navegador, feito em HTML5 Canvas e
JavaScript puro, sem build, sem dependências e sem frameworks. Você controla
um macaco fugindo de um caçador, desviando de troncos, coletando bananas e
atravessando rios pendurado em cipós.

Jogue direto abrindo o `index.html` — não precisa instalar nada.

## Como jogar

- **ESPAÇO**, **↑** ou toque na tela: pular / começar a partida / jogar de novo.
- O macaco fica parado horizontalmente na tela; o mundo é que rola da direita
  para a esquerda.
- Pule para desviar dos **troncos** no chão.
- Toque nas **bananas** para coletá-las automaticamente — elas valem pontos
  extras e atrasam o caçador.
- Ao se aproximar de um **cipó** balançando sobre um rio, pule perto dele para
  se agarrar automaticamente e atravessar balançando.
- Enquanto estiver pendurado no cipó, dê **dois toques rápidos** em ESPAÇO
  (menos de ~350ms de intervalo) para se soltar no momento certo. Ficar
  pendurado tempo demais faz o cipó arrebentar — game over.

### O caçador

Um caçador persegue o macaco por trás. A distância entre os dois
(medidor "🏹 Caçador" no HUD) diminui com o tempo — ele vai se aproximando —
e aumenta quando você coleta bananas. Se a distância chegar a zero, é fim de
jogo. Quando o caçador precisa atravessar um rio, ele nada e fica mais lento,
dando um respiro ao jogador.

### Pontuação

A pontuação sobe com o tempo de sobrevivência e recebe bônus por banana
coletada. O recorde (`highscore`) fica salvo no `localStorage` do navegador,
então ele persiste entre sessões no mesmo navegador/dispositivo.

## Como rodar localmente

Não há dependências nem processo de build. Duas opções:

1. **Abrir direto no navegador**: dê duplo clique em `index.html` (ou
   arraste-o para uma aba do navegador).
2. **Servir com um servidor local** (recomendado, evita eventuais restrições
   do navegador ao abrir arquivos via `file://`):

   ```bash
   # Python 3
   python -m http.server 8000

   # ou, com Node.js instalado
   npx serve .
   ```

   Depois acesse `http://localhost:8000` no navegador.

## Estrutura do projeto

| Arquivo       | Responsabilidade                                                          |
|---------------|-----------------------------------------------------------------------------|
| `index.html`  | Estrutura da página, telas de início/game over e HUD.                     |
| `style.css`   | Visual (tema de selva) e estilo do medidor de perigo do caçador.          |
| `game.js`     | Toda a lógica do jogo — loop principal, física, colisões, desenho — em uma única IIFE, sem dependências externas. |
| `DEVLOG.md`   | Histórico de decisões de design, bugs corrigidos e próximos passos.       |

## Publicando no GitHub Pages

Como é um projeto 100% estático, dá para publicar direto com o GitHub Pages:

1. Suba o repositório para o GitHub.
2. Em **Settings → Pages**, selecione a branch `main` e a pasta raiz (`/`).
3. O jogo fica disponível em `https://<seu-usuário>.github.io/<nome-do-repo>/`.

## Mais detalhes

Para o histórico de decisões de design, bugs corrigidos e ideias futuras
(efeitos sonoros, fases com dificuldade crescente, controles touch
dedicados), veja o [`DEVLOG.md`](DEVLOG.md).
