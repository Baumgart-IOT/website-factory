# Website Factory MVP

Website Factory is a dependency-light local MVP for creating website project configs, editing structured content blocks with rich section forms, validating assets, running placeholder specialist agents, creating backups, and generating live static previews from real template rendering.

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
uploads/logos/            Validated logo uploads (legacy single-logo flow)
uploads/projects/{projectId}/ Validated per-project media library uploads
docs/                     Checkpoints, OpenAPI, GPT setup, visual test checklist, media library guide
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

## MJC5 Rich Section Editors

Phase 5 replaces JSON-first section editing with form-based section editors for:

- Hero
- Services
- About
- Process
- Projects
- Gallery
- Testimonials
- FAQ
- Contact
- Quote request
- CTA

Repeated items such as services, process steps, projects, gallery images, testimonials, FAQ entries, and quote fields can be added, removed, edited, and reordered with form controls.

An `Advanced JSON editor` remains available as a collapsed fallback for power users. The form editor remains the primary path and validation still runs before saving.

The content editor now shows an unsaved-changes indicator, warns before switching pages or sections with unsaved edits, shows save/build feedback, and includes:

- Save Section
- Save and Build Preview
- Build Preview From Content
- Open Latest Preview

## MJC6 Media Library & Asset Picker

Phase 6 adds a per-project media library so users can upload validated images once and reuse them everywhere instead of typing raw URLs:

- A **Media Library** dashboard panel for uploading images/logos/favicons, browsing them as cards (thumbnail, kind, size, validation status), and deleting them (with in-use protection and a force-delete confirmation).
- An **asset picker** modal (`<dialog>`) that lets users choose an existing image asset for any image field.
- A new `image` field kind in the section editor schema, applied to hero, projects, and gallery image URLs — each renders a "Choose from media" button alongside the existing text input.
- Branding **logo** and **favicon** fields that support choosing from the library, uploading on the fly, previewing, and clearing — backed by new `branding.logoAssetId` / `branding.faviconAssetId` config fields.
- Renderer support for a generated `<link rel="icon">` favicon tag.
- Verify-agent checks that flag missing or unreferenced media assets.

Uploads are validated end-to-end (extension allowlist, size limits, binary signature checks, and SVG sanitization) before being persisted and served from `/uploads/projects/{projectId}/...`. See `docs/media-library.md` for full details on the data model, validation rules, API endpoints, and UI wiring.

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
- `GET /api/projects/:id/media`
- `POST /api/projects/:id/media?kind=image|logo|favicon`
- `GET /api/projects/:id/media/:assetId`
- `DELETE /api/projects/:id/media/:assetId[?force=true]`
- `POST /api/projects/:id/media/:assetId/use`
- `GET /api/projects/:id/media/usage`
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
npm run smoke:phase5
npm run smoke:phase6
```

The Phase 2 smoke test checks templates, project creation, detail fetch, config patch, backups, agents, build metadata, preview path creation, rollback, and data validation.

The Phase 3 smoke test checks multi-page rendering, generated files, served preview HTML, stronger Verify agent checks, and that Phase 2 smoke still passes.

The Phase 4 smoke test checks content initialization, content page CRUD, section CRUD, authored content rendering, generated preview content, Verify output checks, and cleanup.

The Phase 5 smoke test checks rich-editor-compatible section content for hero, services, FAQ, testimonials, quote request fields, rendered item order, generated preview content, Verify output checks, and cleanup.

The Phase 6 smoke test checks the media library end to end: empty-library bootstrap, validated image/logo/favicon uploads, rejection of spoofed/dangerous/unsafe-SVG uploads, asset listing and fetching, static media serving, branding logo/favicon assignment via uploaded assets, attaching an uploaded image to page content, usage tracking, generated preview references (hero image, logo, favicon link), Verify agent media checks, in-use delete protection with force-delete, and cleanup.

Smoke tests now create projects with prefixes such as `smoke-phase2-`, `smoke-phase3-`, `smoke-phase4-`, `smoke-phase5-`, and `smoke-phase6-`. Cleanup removes only those smoke-prefixed project records and their backup/build/preview/media artifacts.

## Known Limitations

- No authentication yet.
- No real external deployment yet.
- Agent checks are rule-based placeholders.
- Preview generation is static and local, though it now renders real multi-page output.
- Advanced JSON editing still exists as a fallback.
- Rich section editors are intentionally simple and do not yet include drag-and-drop.
- Content is still stored in JSON files, not a database.
- Visual browser testing may need to be done manually if the sandbox browser fails.
- The media library has no authentication — anyone with dashboard access can manage any project's assets.
- The asset picker only surfaces image-kind assets; SVG uploads are sanitized but still rendered inline as-is.

## Next Roadmap

1. Add drag-and-drop section and repeated-item ordering.
2. Add automated accessibility, responsive, link, and security checks.
3. Add persistent database storage and object storage for production usage.
4. Add authentication and project ownership.
5. Add a build queue, logs, retries, and artifact history.
6. Add real contact/quote form submission handling.
