---
name: image-to-code-handoff
description: >
  Use when the user pastes an ImageToCode Handoff prompt, mentions
  output/image-to-code/<page-slug>/, AnnotatedImage, annotation.json, or asks to
  turn AnnotatorApp exports into code-ready assets and optionally a Flutter page.
---

# ImageToCode Handoff

Orchestrate an existing **HandoffBundle** into AssetPackage generation and (when requested) a single Flutter page. This skill does **not** regenerate images itself and has **no RPC** to other skills: follow the named skills' contracts by reading and obeying them.

## Prerequisites

Confirm these workspace-relative files exist for the given `page-slug`:

```text
output/image-to-code/<page-slug>/annotated.png
output/image-to-code/<page-slug>/annotation.json
output/image-to-code/<page-slug>/source.*
```

If any required file is missing, stop and tell the user to export from AnnotatorApp (or place the downloaded files) before continuing.

Read `annotation.json` for:

- `targetStack` (`flutter` | `react` | `html`)
- `flutterPagePath` (optional)
- `annotations` (IconMark SemanticName, BackgroundCallout / RegionCallout, CalloutCopy)

## Steps

1. **Inventory** the HandoffBundle and summarize IconMarks, BackgroundCallouts, and RegionCallouts (including CalloutCopy as text context only).
2. **AssetPackage** — Follow the installed skill `regenerating-ui-redbox-assets` on `annotated.png`:
   - Red rectangles → regenerate isolated transparent icon assets (never crop).
   - Arrows labeled `背景` / `background` → background callouts.
   - Prefer SemanticName values from `annotation.json` when naming files.
   - RegionCallout `calloutCopy` must remain code Text later; do **not** bake that copy into background PNGs.
3. **Page generation gate**
   - If `targetStack` is `react` or `html`: stop after a successful AssetPackage. Do not invent page generators in v1.
   - If `targetStack` is `flutter`: continue.
4. **Flutter page** — Follow `regenerating-ui-assets-to-flutter-page`:
   - Require an existing Flutter PageScaffold. Prefer `flutterPagePath` from `annotation.json`.
   - If the destination page/route cannot be identified, **stop and ask**; do not create a second Flutter app.
   - Map assets into `assets/images/<page>/`, implement the single page, skip new business/API wiring.
5. **Report** AssetPackage path, page path (if any), and any blocked gates.

## Hard stops

- Missing HandoffBundle files
- Flutter target without PageScaffold / unclear `flutterPagePath`
- Requests to wire business logic, APIs, or multi-page batch work (out of v1 scope)
