# Notas do Apresentador

Aplicação de ambiente de trabalho para quem **apresenta código ao vivo** numa tela grande. No ecrã do teu PC vês, lado a lado, uma **pré-visualização em direto da tela grande** (com o rato) e as **tuas notas** do que tens de dizer. O público só vê o código.

> 🚧 **Projeto em desenvolvimento.** Este README descreve o objetivo, o desenho da solução e o plano. Ainda não existe uma versão utilizável.

## O problema

Quando mostras um projeto (por exemplo, o VS Code) numa tela grande ligada ao PC por HDMI, tens duas opções do Windows, e nenhuma serve bem:

| Modo | O que acontece | Problema |
|---|---|---|
| **Duplicar** | A tela mostra exatamente o que está no ecrã do PC | Qualquer janela de notas também aparece na tela |
| **Expandir** | A tela é um segundo ecrã, só com o que lá puseres | Não vês o que estás a mostrar nem o rato sem olhar para trás |

Quem apresenta (numa defesa, numa aula, numa demo) acaba por ter as notas noutro dispositivo, ou por andar a virar-se para a tela.

## A solução

Usar o modo **Expandir** e uma app que mostra, no ecrã do PC:

1. **Pré-visualização em direto** do ecrã da tela grande, com o rato incluído.
2. **As notas** da apresentação: o que dizer, em que ficheiro estás, o que faz cada função.

```
┌──────────── ecrã do PC ────────────┐      ┌──── tela grande ────┐
│ ┌──────────────────┐ ┌───────────┐ │      │                     │
│ │ pré-visualização │ │   NOTAS   │ │      │       VS Code       │
│ │ da tela grande   │ │           │ │      │  (só isto é visto)  │
│ └──────────────────┘ └───────────┘ │      │                     │
└────────────────────────────────────┘      └─────────────────────┘
```

Como a app está no ecrã do PC e captura o **outro** monitor, não há efeito de espelho infinito. O público vê só o VS Code e tu vês tudo sem olhar para trás.

## Como vai ser usado

1. Ligar o cabo HDMI e carregar em `Win + P` → **Expandir**.
2. Arrastar o VS Code para a tela grande.
3. Abrir a app no ecrã do PC e escolher o monitor da tela grande.
4. Apresentar: mexes o rato e trabalhas na tela grande, vês o resultado na pré-visualização e lês as notas ao lado.

## Funcionalidades planeadas

- Pré-visualização em direto de um segundo monitor.
- Notas lidas de um ficheiro Markdown, organizadas por tópico, ficheiro ou secção do código.
- Atalhos de teclado para mudar de nota sem sair do VS Code.
- Modo escuro e letra grande, para ler à distância.
- Janela sempre por cima.
- Cronómetro da apresentação.
- Modo teleprompter com scroll automático.
- Opção de esconder a janela nas partilhas de ecrã (Teams, Meet, Zoom).

## Como funciona por dentro

- **Electron** (JavaScript, HTML e CSS).
- **Processo principal**: cria a janela, regista os atalhos e usa o `desktopCapturer` para obter o monitor escolhido.
- **Interface**: mostra o vídeo capturado num elemento `<video>` e as notas ao lado.
- **Partilhas de ecrã**: `win.setContentProtection(true)` pede ao sistema para excluir a janela da captura. No Windows usa o `SetWindowDisplayAffinity`.

## Limitações e pontos a validar

- **Duplicar ecrã não esconde nada.** O `setContentProtection` protege contra apps de captura (Teams, Meet, Zoom, OBS), mas não contra o HDMI em modo duplicar. Por isso a solução depende do modo **Expandir**.
- **Rato na pré-visualização:** é preciso confirmar que o cursor aparece na captura em todas as versões e sistemas.
- **Atraso:** a pré-visualização tem um pequeno atraso em relação ao ecrã real. Falta medir se é aceitável numa apresentação.
- **macOS:** a proteção contra captura pode ser contornada por algumas apps de videochamada, dependendo das definições. O foco inicial é o Windows.

## Roadmap

- [ ] Janela Electron básica
- [ ] Mostrar as notas (modo escuro, letra grande)
- [ ] Ler as notas de um ficheiro `.md`
- [ ] Atalhos de teclado (nota seguinte e anterior)
- [ ] Pré-visualização em direto do segundo monitor
- [ ] Janela sempre por cima e `setContentProtection`
- [ ] Cronómetro e modo teleprompter

## Projetos semelhantes

Já existem projetos que resolvem uma parte do problema:

| Projeto | Tecnologia | Licença | O que faz |
|---|---|---|---|
| [CueCard](https://github.com/thisisnsh/cuecard) | Tauri | MIT | Teleprompter invisível para partilhas de ecrã, com integração com o Google Slides |
| [Stealth Notes](https://github.com/heyadrsh/note) | Electron | MIT | Notas em Markdown numa janela excluída da captura de ecrã |
| [RPrez](https://github.com/nebrius/rprez) | Electron | GPL-3.0 | Software de apresentações com vista de apresentador e vistas atribuídas a monitores diferentes |

**O que este projeto acrescenta:** nos projetos que encontrei, nenhum mostra uma pré-visualização em direto do monitor do público ao lado das notas, pensada para quem apresenta **código** num HDMI.

## Requisitos previstos

- Node.js e npm
- Windows com dois ecrãs, em modo Expandir

## Como correr

Ainda não disponível. Quando existir:

```bash
npm install
npm start
```
