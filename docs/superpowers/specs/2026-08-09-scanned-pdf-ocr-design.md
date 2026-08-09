# Reading scanned PDFs with in-browser OCR

**Date:** 2026-08-09
**Status:** Implemented

## Problem

Lesehelfer makes words hoverable by reading a PDF's text layer. Scanned books
have no text layer, so the page renders but nothing is hoverable — the app is
useless for them.

The motivating document is `studio d B2 — Kurs- und Übungsbuch Teilband 1`:
234 pages, 191 MB, no text layer on any sampled page, every page a single
full-page JPEG at ~300 DPI. The scan itself is clean and straight. The hard part
is the layout — a colourful coursebook with multi-column interviews, tinted
exercise boxes, vertical margin text, line numbers in the gutter, text baked
into photographs, and constant hyphenation across line breaks.

## Approach

In-browser OCR with tesseract.js, run lazily with read-ahead.

Rejected alternatives:

- **Pre-OCR the book locally** into a text-layer PDF. Best accuracy and zero app
  changes, but it's a manual step per book tied to one machine, and it doesn't
  give the app the capability that was actually asked for.
- **Cloud OCR** (Google Vision, Azure Read). Better on complex layouts, but an
  API key needs a backend to stay secret, which breaks the static-site property
  the whole app depends on, and it costs per page.

tesseract.js keeps everything client-side, works on GitHub Pages with no
backend, costs nothing, and generalises to any scanned PDF opened in future.

## Design

### Detection

At load, up to five pages spread through the document are sampled for a text
layer. Under 20 total characters means scanned. Individual pages still fall back
to OCR on their own if they yield no words, which covers mixed documents.
Ordinary PDFs never touch the OCR path.

### Language

`languageDetector` worked by reading the text layer, so on a scan it silently
fell through to the `'en'` default — meaning every German word would have been
looked up as English even with perfect OCR.

For scanned documents, one page from the middle of the book (more representative
than a cover) is recognised with a combined `deu+eng` model, and the resulting
text is fed to the existing detector. Roughly 11 MB of models and one slower
page, in exchange for it being automatic. A source-language picker in the header
corrects a wrong guess; if detection fails entirely, the book still opens and
falls back to German.

### Coordinates

`extractWordsFromPage` used to bake the display scale into its output. Both
paths now return **unscaled PDF units**, and the renderer multiplies by the
current zoom. Without this, zooming would invalidate every OCR box and force
pages to be recognised again — seconds of work rather than microseconds.

### The per-page pipeline

OCR gets its own render pass at 300 DPI, independent of display zoom: at
`scale: 1.5` a page is ~830 px wide and Tesseract's accuracy collapses; it needs
~2300 px. The canvas is released immediately after encoding (~31 MB each), and
the page is handed to the worker as a JPEG — the source is already JPEG, so
re-encoding costs no meaningful accuracy and is far faster than PNG.

Words below confidence 60 are dropped so they never become hover targets.

### Hyphenation

Coursebooks hyphenate constantly, and looking up `Fernseh-` or `macher` alone
returns nonsense. When a line ends in a hyphen preceded by a letter and the next
line continues in lowercase, both halves stay individually hoverable but both
resolve to the whole word.

Two refinements came out of testing against the real book:

- **Margin noise.** Tesseract merges a text column with whatever shares its
  horizontal band, so a continuation line can begin with line numbers or
  fragments of an adjacent photo (`£` at confidence 0, `EEE` at 33). The
  continuation is the first token that is non-empty, not purely numeric, and
  above the confidence floor.
- **Untrustworthy case.** An uppercase continuation normally means the hyphen was
  real (`Kino-Events`). But where the text overlaps a photo, `macher` came back
  as `Macher` at confidence 61. Below a confidence of 75 the casing is not
  treated as evidence.

### Scheduling

One Tesseract worker with a priority queue: the visible page jumps ahead of
read-ahead work for the next three pages. The read-ahead backlog is capped at
six so scrolling can't starve the page actually on screen.

### Caching

Per page, keyed on `fileName|fileSize|pageCount|page|lang|schemaVersion`, in an
`ocr` store in the existing `lesehelfer` database. A few KB per page — 1–2 MB for
the whole book. The schema version allows future changes to invalidate stale
results. A shared `db.ts` now owns the database version and upgrade path, since
two modules opening the same database at different versions would deadlock.

### Storage

`savePdf` wrote every PDF's bytes to IndexedDB with room for ten entries. At
191 MB each that is ~2 GB, plus a long freeze while the buffer is cloned, and
`QuotaExceededError` was thrown asynchronously with nothing catching it.

Files over 75 MB now store metadata only: they stay in the recent list, their
OCR cache survives, and reopening asks for the file again. Every write handles
quota failure by evicting and retrying rather than failing silently.

### Windowing

`PdfViewer` mounted every page at once. For this book that is 234 canvases —
close to a gigabyte — and 234 simultaneous OCR requests. Pages now render only
within 150% of the viewport and release their canvas when they leave, which also
provides the signal for OCR priority and read-ahead.

### Failure handling

- Model download failure surfaces a message rather than a page that never
  becomes hoverable.
- Recognition is capped at 120 s per page; a timeout tears down the worker so the
  next page starts clean.
- Rendering is capped at 45 s and cancelled on stall. pdf.js drives rendering off
  `requestAnimationFrame`, which browsers freeze in a backgrounded or
  non-compositing tab — the render promise then never settles at all. This was
  observed in practice during verification.
- A failed page shows a retry and never affects the rest of the book. The page
  always still renders and reads; only the hover layer is lost.

## Verification

Unit tests (27) cover the geometry transform, hyphenation, token cleaning,
confidence filtering, cache keys and scanned detection.

The recognition path was run against the real book — pages 21, 40 and 101, three
very different layouts — in Node and again in the browser, with identical
results. Page 40: 478 hoverable words, 0 out of bounds, all five hyphenation
cases joined correctly, 33 words containing umlauts or ß read correctly, ~8.5 s.
Across pages, 83–86% of boxes are real words of three or more letters.

Not verified end-to-end in a browser: pdf.js canvas rendering, because the
automated browser pane runs without compositing and freezes
`requestAnimationFrame`. This affects the pre-existing display path identically
and is what prompted the render timeout above.
