# Presenter Notes

Desktop app for people who **present code live** on a big screen. On your own PC screen you see, side by side, a **live preview of the big screen** (including the mouse cursor) and **your speaker notes**. The audience only sees the code.

> 🚧 **Early version (0.1).** All roadmap items are implemented but only smoke-tested: cursor in the preview and latency still need validation on a real two-display setup.

## The problem

When you show a project (for example, VS Code) on a big screen connected to your PC by HDMI, Windows gives you two options, and neither works well:

| Mode | What happens | Problem |
|---|---|---|
| **Duplicate** | The big screen shows exactly what is on your PC screen | Any notes window also shows up on the big screen |
| **Extend** | The big screen is a second display with only what you put on it | You can't see what you're showing, or the mouse, without turning around |

People who present (in a thesis defense, a class, a demo) end up keeping their notes on another device, or turning around to look at the screen.

## The solution

Use **Extend** mode plus an app that shows, on your PC screen:

1. A **live preview** of the big screen, cursor included.
2. **Your notes** for the talk: what to say, which file you're in, what each function does.

```
┌──────────── PC screen ─────────────┐      ┌──── big screen ─────┐
│ ┌──────────────────┐ ┌───────────┐ │      │                     │
│ │   live preview   │ │   NOTES   │ │      │       VS Code       │
│ │ of the big screen│ │           │ │      │ (only this is seen) │
│ └──────────────────┘ └───────────┘ │      │                     │
└────────────────────────────────────┘      └─────────────────────┘
```

Because the app runs on your PC screen and captures the **other** display, there is no infinite-mirror effect. The audience sees only VS Code, and you see everything without turning around.

## How it will be used

1. Plug in the HDMI cable and press `Win + P` → **Extend**.
2. Drag VS Code onto the big screen.
3. Open the app on your PC screen and pick the display of the big screen.
4. Present: you move the mouse and work on the big screen, see the result in the preview and read your notes next to it.

## Planned features

- Live preview of a second display.
- Notes read from a Markdown file, organized by topic, file or section of the code.
- Keyboard shortcuts to switch notes without leaving VS Code.
- Dark mode and large text, readable from a distance.
- Always-on-top window.
- Presentation timer.
- Teleprompter mode with auto-scroll.
- Option to hide the window from screen sharing (Teams, Meet, Zoom).

## How it works under the hood

- **Electron** (JavaScript, HTML and CSS).
- **Main process**: creates the window, registers the shortcuts and uses `desktopCapturer` to get the chosen display.
- **UI**: shows the captured video in a `<video>` element, with the notes next to it.
- **Screen sharing**: `win.setContentProtection(true)` asks the operating system to exclude the window from capture. On Windows it uses `SetWindowDisplayAffinity`.

## Limitations and things to validate

- **Duplicate mode hides nothing.** `setContentProtection` protects against capture apps (Teams, Meet, Zoom, OBS), but not against HDMI in duplicate mode. That is why the solution relies on **Extend** mode.
- **Cursor in the preview:** it still needs to be confirmed that the cursor shows up in the capture on all versions and systems.
- **Latency:** the preview lags slightly behind the real screen. It still has to be measured to see if it is acceptable in a talk.
- **macOS:** some video-call apps can bypass the capture protection, depending on their settings. The initial focus is Windows.

## Roadmap

- [x] Basic Electron window
- [x] Show the notes (dark mode, large text)
- [x] Read the notes from a `.md` file
- [x] Keyboard shortcuts (next and previous note)
- [x] Live preview of the second display
- [x] Always-on-top window and `setContentProtection`
- [x] Timer and teleprompter mode

## Similar projects

Some existing projects solve part of the problem:

| Project | Tech | License | What it does |
|---|---|---|---|
| [CueCard](https://github.com/thisisnsh/cuecard) | Tauri | MIT | Invisible teleprompter for screen sharing, with Google Slides integration |
| [Stealth Notes](https://github.com/heyadrsh/note) | Electron | MIT | Markdown notes in a window excluded from screen capture |
| [RPrez](https://github.com/nebrius/rprez) | Electron | GPL-3.0 | Presentation software with a presenter view and views assigned to different monitors |

**What this project adds:** among the projects I found, none shows a live preview of the audience's display next to the notes, aimed at people presenting **code** over HDMI.

## Planned requirements

- Node.js and npm
- Windows with two displays, in Extend mode

## Running

```bash
npm install
npm start
```

If you start it from a terminal that sets `ELECTRON_RUN_AS_NODE` (for example VS Code's), unset it first.

Notes are split into one note per `## ` heading; see `notes.md` for an example.

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+Right` / `Ctrl+Alt+Left` | Next / previous note (global) |
| `Ctrl+Alt+Space` | Start / stop teleprompter (global) |
