# Website Factory MVP

Website Factory is a dependency-light local MVP for creating website project configs, validating assets, running placeholder specialist agents, creating backups, and generating static mock previews.

## Current Architecture

```text
src/
  public/                 Dashboard UI
  server/
    config/               Runtime paths
    services/             Project, backup, build, upload, template, agent logic
    storage/              JSON persistence helpers
    validation/           Project, config, and upload validation
    scripts/              Validation and smoke tests
templates/metadata.json   Template preview metadata
data/projects/            Project JSON records
data/backups/{projectId}/ Backup snapshots
data/builds/{projectId}/  Build metadata
data/previews/{projectId}/{buildId}/ Static preview files
uploads/logos/            Validated logo uploads
docs/                     Checkpoints, OpenAPI, GPT setup, visual test checklist
```

## Setup

Requires Node.js 18 or newer.

```bash
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

## Phase 2 Features

- Editable project config sections for business, branding, template, pages, features, and SEO.
- Safe config patch endpoint with validation and secret-key rejection.
- Filesystem backup system with create, list, and rollback.
- Automatic backups before config changes, template switches, logo replacement, builds, and rollback.
- Rule-based placeholder agents for Recon, Security, Verify, and Backup.
- Improved mock build flow with build metadata and a generated static preview file.
- Dashboard sections for project list, detail editor, template selector, agents, backups, and builds.
- OpenAPI schema for future Custom GPT Actions.

## API Endpoints

- `GET /api/templates`
- `GET /api/templates/:templateId`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id/config`
- `POST /api/projects/:id/logo`
- `POST /api/projects/:id/backups`
- `GET /api/projects/:id/backups`
- `POST /api/projects/:id/rollback/:backupId`
- `POST /api/projects/:id/agents/recon`
- `POST /api/projects/:id/agents/security`
- `POST /api/projects/:id/agents/verify`
- `POST /api/projects/:id/agents/backup`
- `POST /api/projects/:id/build`
- `GET /api/projects/:id/builds`

## Backup And Rollback

Backups are stored in `data/backups/{projectId}/` and include backup metadata, the full project snapshot, and the config snapshot. Rollback creates a pre-rollback backup before restoring the selected snapshot and updating `updatedAt`.

## Agent Placeholders

Agents are deterministic rule-based checks for now:

- Recon checks intake completeness and recommends pages, sections, SEO, and design direction.
- Security checks upload posture, obvious secret-like config fields, and production hardening reminders.
- Verify checks required config, template, build, preview, SEO, and pages.
- Backup checks backup existence, metadata, and rollback readiness.

## GPT Actions Readiness

Use `docs/openapi/website-factory-orchestrator.openapi.yaml` as the future Custom GPT Action schema. See `docs/gpt-actions-setup.md` for recommended GPT instructions and safety rules.

## Validation And Smoke Tests

```bash
npm run validate:data
npm run smoke:phase2
```

The smoke test checks templates, project creation, detail fetch, config patch, backups, agents, build metadata, preview path creation, rollback, and data validation.

## Known Limitations

- No authentication yet.
- No real external deployment yet.
- Agent checks are rule-based placeholders.
- Preview generation is still simple/static.
- Visual browser testing may need to be done manually if the sandbox browser fails.

## Next Roadmap

1. Replace static mock previews with real template generation.
2. Add persistent database storage and object storage for production usage.
3. Add authentication and project ownership.
4. Add a build queue, logs, retries, and artifact history.
5. Add automated accessibility, responsive, link, and security checks.
6. Add explicit deployment workflows with approval gates.
