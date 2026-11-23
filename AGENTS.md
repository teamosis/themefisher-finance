<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Mandatory: Project Knowledge & Development Protocol

**Before writing ANY code**, read and adhere to the project skill:
- **Skill:** [`themefisher-finance`](.agents/skills/themefisher-finance/SKILL.md)
- **References:**
  - [Architecture & File Structure](.agents/skills/themefisher-finance/references/architecture.md)
  - [Database Schema & Operations](.agents/skills/themefisher-finance/references/database.md)
  - [Business Rules & Workflows](.agents/skills/themefisher-finance/references/business-rules.md)
  - [Development History & Changelog](.agents/skills/themefisher-finance/references/changelog.md)

### Agent Rules:
1. **Follow Skill Guidelines:** All development must strictly follow the patterns, Server Action architecture, and modal/form standards documented in `themefisher-finance`.
2. **Update Changelog:** When introducing major structural changes, migrations, or business rule updates, record the change in [`.agents/skills/themefisher-finance/references/changelog.md`](.agents/skills/themefisher-finance/references/changelog.md).
3. **Validate Code:** Always ensure `npm run lint` and `npm run build` pass before completing any task.
