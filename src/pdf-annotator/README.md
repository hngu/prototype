# PDF Annotator

Browser-only PDF annotator. Upload a PDF, place text boxes and signatures, then
download a modified PDF. Nothing is uploaded — the file is read, rendered, and
rewritten entirely in the tab.

## Stack

- Vite 8 + React 19 + TypeScript
- Mantine v9 for UI
- `pdfjs-dist` (legacy build) for rendering
- `@cantoo/pdf-lib` for writing the export
- `perfect-freehand` for drawn signatures

## Run

From the repo root (or this package):

```sh
pnpm --filter pdf-annotator install   # if needed after cloning
pnpm --filter pdf-annotator dev
```

Dev server listens on **http://localhost:5174** (5173 is reserved for the Adonis
frontend).

```sh
pnpm --filter pdf-annotator verify   # lint + typecheck + test + build
```

## Usage

1. Drop or choose a PDF on the landing screen.
2. **Add text** — click the tool, then click the page. Type in the box. Font,
   size, and colour apply to the selected box and become the default for the next one.
3. **Add signature** — Draw, Type (Great Vibes), or Upload. Then click the page
   to place it. The last signature is kept in `localStorage` for reuse.
4. Drag via the blue grip bar; signatures also have corner resize (aspect locked).
5. **Export PDF** downloads `<name>-annotated.pdf`.

### Keyboard

| Key | Action |
| --- | --- |
| ⌘/Ctrl+Z | Undo |
| ⌘/Ctrl+Shift+Z | Redo |
| Delete / Backspace | Remove selected annotation |
| Escape | Clear selection / cancel placement |

Closing the tab with unsaved annotations prompts the browser's leave warning.

## Limits

- Standard PDF fonts only (Helvetica, Times-Roman, Courier) — WinAnsi characters.
  Non-Latin input is stripped while typing and refused at export.
- Encrypted PDFs are rejected at open time (pdf-lib cannot rewrite them).
- Text boxes do not auto-wrap; they grow with explicit newlines so preview and
  export stay aligned.

## Layout

```
src/
  pdf/           load, render, coords, measure, export
  state/         annotation reducer + undo/redo
  components/    viewer, text/signature UI, toolbar
  hooks/         pointer drag
```
