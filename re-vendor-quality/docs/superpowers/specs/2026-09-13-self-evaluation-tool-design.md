# Self Evaluation Tool — Design

Date: 2026-09-13  
Status: Approved for implementation planning

A local, copyable web app for reviewing related video clips together. The reviewer imports clips into lettered slots, lines them up with per-clip start offsets, then plays them on one shared clock while hearing only one clip.

## Goal

Someone who only clicks (no command prompt) can start the app, import several related videos, sync them, play them together, pick which clip has audio, resize windows, and come back later with the last session restored.

## Launch and packaging

The app is a standalone folder (not part of the existing Next.js vendor-quality app). Copy the folder to another Windows laptop.

Contents:

- `Start.bat` — the only thing a reviewer clicks
- `server.js` — tiny Node HTTP server, no npm packages
- `public/` — `index.html`, CSS, JS
- `last_config.json` — created/updated automatically at the folder root

`Start.bat` starts the server and opens the default browser to the printed local URL. A console window stays open; closing it stops the server.

Node must be installed once on that laptop. If `node` is missing, the batch file shows a short message and exits without opening the browser.

## Architecture

The browser never reads disk paths. The server:

1. Serves the static page
2. Reads and writes `last_config.json`
3. Streams a video for a slot from the saved absolute path

On startup the page loads config from the server and restores slots, geometry, offsets, audio, theme, and whether the setup pane is open.

Import cannot use a normal browser file picker: the browser does not expose full disk paths. The page calls the server; the server opens a Windows file dialog (PowerShell `OpenFileDialog`, multi-select) and stores the returned absolute paths. The page then reloads config. Videos are streamed as `/video/:slot`.

Path rule: the server only streams paths already stored for a slot in `last_config.json`. It does not stream arbitrary paths from the query string.

## Slots and windows

Slots are letters **A through S** (19 max). A window exists only when that slot has a file. Four imported files create A–D only. The next import fills the next free letter (E, then F, … through S). Closing a window clears that slot; the letter becomes free. Empty letters never appear as windows.

Audio and “start time for” dropdowns list only slots that currently have a file.

“+ next” (or the first import when no slots exist) opens the dialog and assigns files in picker order to the next free letters: first file → first free letter, and so on, up to S. Clicking an existing letter chip (A, B, …) opens the dialog for a single file and replaces that slot only.

A newly created window gets a default size and a non-overlapping position. Existing windows are not reset. After that, geometry is whatever the reviewer last set.

## Playback

One shared clock.

- **Play all** starts or resumes every existing clip at `clock + that slot’s start offset`
- **Pause** pauses all clips and holds the clock
- **Stop** pauses and resets the clock to 00:00.000
- **Jump to** sets the clock to a typed timestamp; clips seek to `clock + offset` (clamped to each clip’s duration)
- **Play bar** (bottom, always visible) scrubs the same shared clock

Offset meaning: the chosen frame in that file is shared-clock zero. While playing together, `fileTime = clock + offsetMs`. If that time is before 0:00 or after the clip ends, that window shows the nearest edge frame and stays silent.

Shared play-bar duration is the maximum over slots of `(clipDuration - offset)` so the bar lasts until the last clip ends.

Per-slot start offset is set only for the **selected** slot:

- Type a timecode, or
- While the setup pane is open, the selected window shows a local scrubber on that clip. **Set as start** stores that clip’s current time as `offsetMs`.

When the setup pane is closed, or after Play all / Pause / Stop / Jump to / play-bar scrub, all clips follow the shared clock. Local scrub is only for lining up offsets.

## Audio

Exactly one slot has audio at a time (the Audio clip). All other videos are muted. Changing Audio clip switches sound immediately. If the audio slot is closed, audio falls back to the first remaining slot (A-order), or to none if no slots remain.

## UI layout

**Top bar (always visible):** app name “Self Evaluation Tool”, Play all, Pause, Stop, Jump to.

**Middle:** clip windows. Initial automatic layout; then each window can be moved (title bar) and resized (edges and corner handle). Close (×) clears that slot. Blue outline = audio slot. Gold outline = selected slot for start time. Click a window to select it.

**Bottom, always visible:** play bar (current time, scrubber, duration of the shared timeline).

**Bottom, minimizable setup pane:** Audio clip dropdown; Start time for (slot dropdown + timecode + Set as start); Import chips for existing slots and “+ next (X)”; Light / Dark switch. A setup control next to the play bar expands or collapses the pane. Open/closed state is saved.

Light / Dark is a separate feature from window resizing. Both are first-class. Theme applies to chrome; video pixels are unchanged. Default theme is dark.

## Persistence (`last_config.json`)

Written automatically after any change (import, close, offset, audio, theme, pane, geometry).

Stored fields:

- `theme`: `"dark"` | `"light"`
- `setupPaneOpen`: boolean
- `audioSlot`: letter or `null`
- `selectedSlot`: letter or `null`
- `clockMs`: last shared-clock position (milliseconds)
- `slots`: object keyed by letter A–S, each present key only if that slot has a file:
  - `path` (absolute Windows path)
  - `name` (file name for the title bar)
  - `offsetMs` (start offset)
  - `x`, `y`, `width`, `height` (window geometry in the video area)

On launch, missing paths keep the slot with a “file not found” state and a control to pick a replacement file. Other slots still play.

## Error handling

- Node missing: batch file message, no browser
- Missing/moved video: error on that slot only; replace file to recover
- Invalid Jump to or start timecode: ignore the edit; field snaps back to the last valid value
- Undecodable clip: error in that window only
- Failed config write: brief notice; playback continues

## Out of scope

- Separate OS windows or a second monitor per clip
- Bundled portable Node.exe (add later only if a target laptop cannot install Node)
- Cloud sync, accounts, or sharing sessions
- Waveforms, annotations, or scoring UI
- Playing more than 19 clips

## Testing

- `Start.bat` opens Self Evaluation Tool when Node is installed, and explains the problem when it is not
- Import 4 files → windows A–D only; fifth import creates E; letters available through S
- Play all / Pause / Stop / Jump to / play bar keep clips on the shared clock using each offset
- Set as start and typed timecode both set the selected slot’s offset
- Only the Audio clip has sound
- Resize and move windows; close removes that letter only
- Setup pane minimizes and restores; play bar stays visible
- Light / Dark applies immediately and survives restart
- Restart restores paths, offsets, audio, theme, pane, and geometry
- Missing file errors on that slot only

## Components (implementation units)

- `Start.bat` — launch
- `server.js` — static files, config GET/PUT, Windows import dialog, video stream by slot
- `public/index.html` — shell
- `public/styles.css` — light and dark
- `public/app.js` — slots, windows, clock, import, pane, theme
- `last_config.json` — session (generated)

Each unit has one job and talks through the server’s config and video URLs plus in-page events for the clock.
