# /maestro
# Purpose: Invoke the official Meta-Architect umbrella surface exactly as packaged upstream.

- LOAD: `.cursor/skills/maestro/SKILL.md`
- SKILL FAMILY INSTALLED:
  - umbrella: `maestro`
  - gated lanes: `arch`, `sage`, `flow`, `vet`, `vibe`, `build`
  - helper lanes: `align`, `diagnose`, `tdd`, `cleanup`
- RULES:
  1. `$maestro` is the only umbrella in-session surface.
  2. Do not create a separate umbrella workflow beside `maestro`.
  3. Keep the fixed sequence:
     - `$arch -> $sage -> $flow -> $vet -> $vibe -> $build`
  4. Helper lanes support but do not replace gated ownership.
  5. End with: current situation summary, best next step, why that step is next, recommended lane, what to avoid doing yet, exact next trigger.
