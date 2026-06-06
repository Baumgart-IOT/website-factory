# Website Factory MVP

An MVP architecture for a Website Factory system. It includes a professional dashboard, JSON-backed site configuration, safe logo upload validation, template metadata, an orchestrator-style backend API, agent placeholders, and a mock build preview action.

## Features

- Dashboard for creating and selecting website projects.
- Site configuration stored as JSON in `data/projects`.
- Logo upload support for PNG and SVG files with size, MIME, signature, filename, and SVG safety validation.
- Template selection driven by preview metadata in `templates/metadata.json`.
- Backend orchestrator API using dependency-free Node.js modules.
- Agent status placeholders for Recon, Security, Verify, and Backup.
- Build button that creates a mock preview result and updates the project config.
- Clean folder structure prepared for real template generation.
- No hardcoded secrets. Runtime settings are read from environment variables.

## Requirements

- Node.js 18 or newer.

## Setup

1. Copy environment defaults if you want local overrides:

   ```bash
   cp .env.example .env
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

3. Open:

   ```text
   http://localhost:3000
   ```

## Validation

Run the local data validation check:

```bash
npm run validate
```

The dashboard and backend also validate project inputs and upload payloads at request time.

## Project Structure

```text
src/
  public/                 Dashboard UI
  server/
    config/               Runtime paths and storage setup
    services/             Project, template, upload, and build orchestration
    storage/              JSON persistence helpers
    validation/           Input and upload validation
    utils/                Shared server utilities
templates/
  metadata.json           Template preview metadata
data/projects/            JSON site configurations
uploads/logos/            Validated logo uploads
```

## API

- `GET /api/templates` returns available template metadata.
- `GET /api/projects` returns saved project configurations.
- `POST /api/projects` validates input and creates a JSON project config.
- `GET /api/projects/:id` returns one project.
- `POST /api/projects/:id/logo` validates and stores a logo upload.
- `POST /api/projects/:id/build` creates a mock preview result.

## Environment

```text
PORT=3000
MAX_LOGO_BYTES=1048576
```

## Roadmap

1. Add real template generation behind the existing build orchestration endpoint.
2. Introduce durable database storage for projects, build records, and upload metadata.
3. Move logo blobs to object storage and add signed asset serving.
4. Implement the Recon agent for business intake, sitemap suggestions, and content requirements.
5. Implement the Security agent for dependency, asset, form, and header checks.
6. Implement the Verify agent for preview screenshots, accessibility checks, responsive QA, and link validation.
7. Implement the Backup agent for project snapshots, export bundles, and rollback points.
8. Add user authentication and authorization when project ownership is required.
9. Add build logs, queue status, retry handling, and artifact history.
10. Add generated preview hosting and production deployment controls.
