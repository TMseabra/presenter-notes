# Sample talk

**Controlos** (carrega em *Help* para voltar a ver isto)

**De qualquer sítio, mesmo com o VS Code em foco**
- `Ctrl+Shift+↑` / `Ctrl+Shift+↓` - scroll das notas para cima / baixo
- `Ctrl+Alt+→` / `Ctrl+Alt+←` - nota seguinte / anterior
- `Ctrl+Alt+H` - Clean view: só o preview, sem barras
- `Ctrl+Alt+Espaço` - liga / desliga o teleprompter

**Com a janela da app em foco**
- `H` ou `Esc` - Clean view (duplo clique no preview também)
- `N` - só notas / só preview / os dois
- `P` - congela o preview
- `T` - tema claro / escuro
- `[` e `]` - teleprompter mais lento / mais rápido
- `Home`, `End`, `1`-`9` - saltar de nota
- `Ctrl` + roda do rato - tamanho do texto
- Arrastar a barra do meio - tamanho do preview e das notas

**Bloco de notas**: cola ou escreve; usa a barra para cor, marcador e tamanho.
As teclas de uma letra ficam desligadas enquanto escreves nele.

## Introduction
- Say hello and introduce the **project**
- Explain the problem: `Duplicate` vs `Extend`

## File: main.js
- Creates the window
- Uses `desktopCapturer` to capture the other display

```js
win.setContentProtection(true)
```

## File: renderer.js
1. Fills the display picker
2. Starts the capture in a `<video>`
3. Renders the notes

## Wrap-up
- Recap the three points
- Questions?
