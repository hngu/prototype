# Client-Side PDF Annotator

## Context

A browser-only app: upload a PDF, render it, place text boxes and signatures,
export a real modified PDF. Nothing leaves the browser.

Two libraries do the heavy lifting:

- **`pdfjs-dist`** — rasterizes pages to `<canvas>` for display.
- **`@cantoo/pdf-lib`** — writes the output. The original `pdf-lib` is unmaintained
  (1.17.1 since 2022); `@cantoo/pdf-lib` is the maintained fork.

Placement: standalone package at [`src/pdf-annotator`](../src/pdf-annotator) in the
root pnpm workspace (no Adonis / backend dependency).

---

## Architecture

```
src/pdf-annotator/                     NEW
├── package.json
├── vite.config.ts                     React 19 + React Compiler, port 5174
├── public/fonts/                      Great Vibes (OFL) for typed signatures
└── src/
    ├── pdf/
    │   ├── pdfjs.ts         single import point (legacy build)
    │   ├── document.ts      load + pristine byte copy + early writable check
    │   ├── renderPage.ts    DPR-aware, cancellable
    │   ├── coords.ts        PDF points <-> screen (unit-tested)
    │   ├── textLayout.ts    baseline / line-height shared by preview + export
    │   ├── measure.ts       canvas measureText for box sizing
    │   ├── resize.ts        aspect-locked signature corners
    │   ├── rasterize.ts     draw / type / upload -> PNG
    │   ├── winAnsi.ts       standard-font character gate
    │   └── exportPdf.ts     stamp + download
    ├── state/               reducer, undo/redo, saved signature
    ├── components/          Annotator, PageView, TextBox, Signature*, Toolbar
    └── hooks/pointerDrag.ts
```

Annotations are stored in **view space** (PDF points, origin bottom-left, with
`/Rotate` already applied). Export maps back to user space and re-applies rotation
so rotated pages stay correct.

---

## Phase 0 — Scaffold — ✅ DONE

Package joined to root `pnpm-workspace.yaml`. Vite + Mantine + oxlint mirrored
from the Adonis frontend. Dropzone landing screen.

**Landed differently:** pdf.js is imported only via `src/pdf/pdfjs.ts` from the
**legacy** build. The default `pdfjs-dist` build calls `Map.prototype.getOrInsertComputed`,
which shipping browsers do not have yet; the first `page.render` threw and blanked
the React tree. Same library, transpiled/polyfilled.

## Phase 1 — Viewer — ✅ DONE

Multi-page scroll, fit-width / fixed zoom, DPR canvas, render cancellation,
viewport-near lazy paint (`IntersectionObserver`). `coords.ts` unit-tested
including rotation and inset crop boxes.

## Phase 2 — Text boxes — ✅ DONE

Reducer with undo/redo (checkpoint-on-gesture-start so drag/typing collapse to
one undo step). Click-to-place, inline textarea, grip-bar drag, Delete/Escape.
No auto-wrap — boxes grow on explicit newlines. WinAnsi filter while typing.

## Phase 3 — Signatures — ✅ DONE

Modal tabs: Draw (`perfect-freehand`), Type (self-hosted Great Vibes), Upload
(optional light-background removal). All modes converge on a trimmed PNG.
`localStorage` reuse. Aspect-locked corner resize.

## Phase 4 — Export — ✅ DONE

`buildAnnotatedPdf` loads pristine bytes (pdf.js detaches its copy), stamps text
as real `drawText` and signatures as `embedPng`, compensates `/Rotate`. Encrypted
/ unwritable files rejected at open. Vitest round-trips inflate content streams
to assert operators.

## Phase 5 — Polish — ✅ DONE

Keyboard shortcuts, `beforeunload` when annotations exist, README, this plan
doc, Vitest for coords / resize / export.

---

## Verification

```sh
pnpm --filter pdf-annotator verify
# Manual: open http://localhost:5174, annotate, Export PDF, reopen output
```

## Risks

- Font-metric drift between preview and export mitigated by no auto-wrap + AFM
  ascender baseline; full parity would need the same TTF embedded in both.
- Malformed PDFs that pdf.js renders but pdf-lib rejects fail at open, not export.
- Very large PDFs: pages near the viewport render first; eager full-document
  paint is avoided.
