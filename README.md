# Website Factory MVP

Website Factory is a dependency-light local MVP for creating website project configs, editing structured content blocks, validating assets, running placeholder specialist agents, creating backups, and generating live static previews from real template rendering.

## Current Architecture

```text
src/
  public/                 Dashboard UI
  server/
    config/               Runtime paths
    services/             Project, content, backup, build, upload, template, agent logic
    storage/              JSON persistence helpers
    validation/           Project, config, content, and upload validation
    scripts/              Validation and smoke tests
    rendering/            Static preview renderer
templates/metadata.json   Template preview metadata
data/projects/            Project JSON records
data/backups/{projectId}/ Backup snapshots
data/builds/{projectId}/  Build metadata
previews/{projectId}/{buildId}/ Static preview files
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

## Phase 3 Renderer

Phase 3 replaces the single mock preview with a renderer that generates a real static site from project config and template metadata.

Renderer modules live in `src/server/rendering/`:

- `renderer.js` orchestrates full preview generation.
- `pageRenderer.js` renders HTML shells, SEO metadata, navigation, footer, and page paths.
- `sectionRenderer.js` renders reusable sections.
- `themeRenderer.js` writes CSS variables and site styling.
- `sitemapRenderer.js` writes `sitemap.xml`.
- `robotsRenderer.js` writes `robots.txt`.

Generated previews are written to:

```text
previews/{projectId}/{buildId}/
```

Each build generates at minimum:

```text
index.html
styles.css
app.js
sitemap.xml
robots.txt
```

Configured pages generate slug-based files, such as `services/index.html`, `about/index.html`, and `contact/index.html`.

## Build Output Format

`POST /api/projects/:id/build` returns:

```json
{
  "build": {
    "buildId": "build_...",
    "projectId": "...",
    "status": "success",
    "createdAt": "...",
    "previewPath": "/previews/{projectId}/{buildId}/index.html",
    "generatedFiles": ["index.html", "styles.css", "app.js", "sitemap.xml", "robots.txt"],
    "logs": []
  }
}
```

Open `previewPath` in the browser while the local server is running.

## Template Rendering Behaviour

`templates/metadata.json` influences layout style, section ordering, colour fallbacks, typography fallbacks, and preview personality. The renderer does not hardcode one template; it reads the selected template and applies its metadata.

## MJC4 Structured Content

Phase 4 adds editable structured content per page and per section. Projects can now store:

```json
{
  "content": {
    "pages": {
      "home": {
        "title": "Home",
        "slug": "/",
        "seo": {
          "title": "",
          "description": ""
        },
        "sections": []
      }
    }
  }
}
```

Supported section types:

- `hero`
- `services`
- `about`
- `process`
- `projects`
- `gallery`
- `testimonials`
- `faq`
- `contact`
- `quote_request`
- `cta`

Each section has `id`, `type`, `enabled`, `order`, and `content`.

The dashboard includes a basic Content editor for page metadata, page creation/deletion, section creation, section JSON editing, enable/disable, move up/down, and deletion. Array-heavy content, such as services, FAQ, testimonials, and gallery items, is edited as JSON in MJC4.

## Content Rendering Fallback

The renderer prefers `project.content.pages` when present. Existing MJC3 projects without `content` still validate and build because the renderer seeds a compatible content model from project config in memory.

If a section has user-authored content, that content is used. If only some fields are filled, the renderer fills missing fields with professional fallbacks based on business name, industry, tagline, selected template, and template personality.

Use `POST /api/projects/:id/content/initialize` to persist seeded content into an existing project.

## API Endpoints

- `GET /api/templates`
- `GET /api/templates/:templateId`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id/config`
- `GET /api/projects/:id/content`
- `PATCH /api/projects/:id/content`
- `POST /api/projects/:id/content/initialize`
- `POST /api/projects/:id/content/pages`
- `PATCH /api/projects/:id/content/pages/:pageKey`
- `DELETE /api/projects/:id/content/pages/:pageKey`
- `POST /api/projects/:id/content/pages/:pageKey/sections`
- `PATCH /api/projects/:id/content/pages/:pageKey/sections/:sectionId`
- `DELETE /api/projects/:id/content/pages/:pageKey/sections/:sectionId`
- `POST /api/projects/:id/content/pages/:pageKey/sections/:sectionId/move`
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
npm run smoke:phase3
npm run smoke:phase4
```

The Phase 2 smoke test checks templates, project creation, detail fetch, config patch, backups, agents, build metadata, preview path creation, rollback, and data validation.

The Phase 3 smoke test checks multi-page rendering, generated files, served preview HTML, stronger Verify agent checks, and that Phase 2 smoke still passes.

The Phase 4 smoke test checks content initialization, content page CRUD, section CRUD, authored content rendering, generated preview content, Verify output checks, and cleanup.

Smoke tests now create projects with prefixes such as `smoke-phase2-`, `smoke-phase3-`, and `smoke-phase4-`. Cleanup removes only those smoke-prefixed project records and their backup/build/preview artifacts.

## Known Limitations

- No authentication yet.
- No real external deployment yet.
- Agent checks are rule-based placeholders.
- Preview generation is static and local, though it now renders real multi-page output.
- Content arrays are edited as JSON textareas in MJC4.
- Content is still stored in JSON files, not a database.
- Visual browser testing may need to be done manually if the sandbox browser fails.

## Next Roadmap

1. Add richer per-section editor controls instead of JSON textareas.
2. Add automated accessibility, responsive, link, and security checks.
3. Add persistent database storage and object storage for production usage.
4. Add authentication and project ownership.
5. Add a build queue, logs, retries, and artifact history.
6. Add explicit deployment workflows with approval gates.
