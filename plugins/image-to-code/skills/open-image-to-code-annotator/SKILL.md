---
name: open-image-to-code-annotator
description: Open the bundled ImageToCode Annotator web app in Codex's right-side browser. Use when the user asks to open, launch, show, or use the ImageToCode Annotator, especially in Codex's right-side web panel.
---

# Open ImageToCode Annotator

Open the bundled static Annotator app in Codex's in-app browser. This plugin contains the application build; do not require a separate checkout of the source project.

1. Locate `scripts/open-annotator.sh` inside the installed `image-to-code` plugin directory.
2. Start it from the target project working directory, passing `open-annotator.sh <port> <absolute-workspace> <current-Codex-task-id>`. Use the current task id (normally `CODEX_THREAD_ID`), never another task or a guessed id. The local Python server saves bundles into that workspace and uses `codex queue --thread ... --image ...` to send the annotated image and skill prompt back to this task. Start it in the background on port `4173`. If that port is occupied, select one unused localhost port and use it consistently for the remaining steps.
3. Use Codex's in-app Browser to make `http://127.0.0.1:<port>/` visible in the right-side panel.
4. Check `/api/context` confirms the intended task and workspace before handing off. Never reuse another task’s server. Keep that browser tab open as the user-facing deliverable. Explain that “发送 Codex” sends a snapshot and starts asset/page work in this task. Python 3 and a Codex CLI supporting `queue` are required.

If the script reports missing assets, stop and report the installation is incomplete. Do not create a second React app, change the user's workspace, or add business/API wiring.
