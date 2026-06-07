# Template Renderer

Phase 3 added a real local renderer that turns saved project config into static preview files. MJC4 updates it to prefer structured `project.content` when present.

## Renderer Architecture

```text
src/server/rendering/
  renderer.js          Orchestrates full preview generation
  pageRenderer.js      Builds HTML shells, headers, footers, SEO, and page paths
  sectionRenderer.js   Renders reusable page sections
  themeRenderer.js     Generates CSS variables and site styling
  sitemapRenderer.js   Generates sitemap.xml
  robotsRenderer.js    Generates robots.txt
```

`POST /api/projects/:id/build` validates config, creates a pre-build backup, loads template metadata, calls `renderProjectPreview`, writes metadata, and stores the build record.

The renderer now chooses pages and sections from `project.content.pages` first. If content is missing, it seeds content from config in memory and keeps MJC3 projects backward compatible.

## Generated Files

Generated previews are written under:

```text
previews/{projectId}/{buildId}/
```

Each build generates at minimum:

- `index.html`
- `styles.css`
- `app.js`
- `sitemap.xml`
- `robots.txt`

Configured secondary pages are generated as slug folders:

```text
services/index.html
about/index.html
contact/index.html
```

## Supported Sections

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
- `footer`

If configured content is missing, section renderers generate professional placeholders using business name, industry, tagline, selected template, and template personality. If a section has partial user content, only missing fields fall back.

## Template Metadata Influence

`templates/metadata.json` can influence rendering with:

- `layoutStyle`
- `previewPersonality`
- `sectionOrder`
- `themeDefaults`
- existing category, description, preview tone, and recommended use fields

The renderer uses `sectionOrder` for home page layout and `themeDefaults` as branding fallbacks.

## Add A New Section Renderer

1. Add a renderer function in `src/server/rendering/sectionRenderer.js`.
2. Register it in the `sectionRenderers` map.
3. Add the section key to a template `sectionOrder` or page-specific logic.
4. Run `node src/server/scripts/smoke-phase3.js`.

## Add A New Template

1. Add a new entry to `templates/metadata.json`.
2. Include `id`, `name`, `category`, `description`, `bestUseCase`, `sectionOrder`, and `themeDefaults`.
3. Create a project using the new template.
4. Run a build and open the returned preview path.
5. Run the Verify agent.
