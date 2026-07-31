<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AirAware conventions

Read `DESIGN.md` first — it is the approved scope and the milestone plan.

- **Engine decides, LLM narrates.** Every threshold (UV, heat, AQI, pollen)
  lives in `backend/exposure.py` with a citable source — never in a prompt.
  The engine annotates, vetoes, and re-checks at accept time.
- **Mock-first, real-shaped.** `lib/types.ts` defines the core records once;
  `lib/mock.ts` fills them until real APIs exist. Never reshape the UI when
  swapping mocks for data.
- **Band colors are design tokens.** The official UV and EPA AQI palettes are
  CSS custom properties in `globals.css`; components never hardcode colors.
- **Pollen is nullable everywhere.** Coverage is regional (CAMS in Europe,
  Pollen.com in the US, nothing elsewhere). Code, UI, and prompts must all
  tolerate `null` — the agent never invents a pollen level.
- **Never assert environmental facts from memory** — the agent verifies with
  live tools, then answers.
- **Tool errors are data.** Wrap every tool; return the error string to the
  model and let it self-correct.
- **Patch prompts with asserts.** A prompt edit that can silently no-op is a
  bug that ships for hours.
- **Ship every session.** Each milestone ends with a deploy and a git tag
  (`milestone-N-name`).
- **Never commit keys.** `.env` + platform variables only; scan history
  before making the repo public.
- Every screen carries the label: **"General guidance, not medical advice."**
