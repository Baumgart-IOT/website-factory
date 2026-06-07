# Media Library & Asset Picker

MJC6 adds a per-project media library so users can upload validated images once and reuse them — as a hero/gallery/project image, a logo, or a favicon — instead of typing raw URLs into text fields.

## Data Model

Each project stores its media assets at `project.media.assets`, an array of records shaped like:

```json
{
  "assetId": "asset-...",
  "kind": "image | logo | favicon",
  "originalName": "hero-photo.png",
  "storedName": "asset-....png",
  "extension": "png",
  "mimeType": "image/png",
  "sizeBytes": 12345,
  "url": "/uploads/projects/<projectId>/<storedName>",
  "validation": { "status": "pass | warning", "warnings": [] },
  "uploadedAt": "2026-06-07T00:00:00.000Z",
  "usage": [{ "location": "content.pages.home.sections.hero.imageUrl", "markedAt": "..." }]
}
```

Files are written under `paths.projectMedia/<projectId>/` and served statically from `/uploads/projects/<projectId>/...` with path-traversal protection (see `serveFromDirectory` in `src/server/index.js`).

## Service Layer

- `src/server/services/mediaService.js` — owns the `project.media.assets` array: `addMediaAsset`, `deleteMediaAsset`, `isAssetInUse`, `markAssetUsage`, `getMediaUsageReport`, `getUsedAssetReferences`, `normalizeFilename`.
- `src/server/services/mediaUploadService.js` — wraps the service with project loading, pre-mutation backups, and request parsing: `listProjectMedia`, `uploadProjectMedia`, `deleteProjectMedia`, `getProjectMediaAsset`, `getProjectMediaUsage`, `markProjectMediaUsage`.
- `src/server/validation/uploadValidation.js` — validates uploaded files before they are persisted (see Validation below). `parseMultipartMedia` is the general-purpose entry point used for media uploads; `parseMultipartLogo` remains for the legacy single-logo flow.

Every upload and delete creates a project backup first (`pre-media-upload` / `pre-media-delete`), matching the existing config/logo mutation pattern.

## Validation Rules

Uploads are validated end-to-end — never trusting the client-declared MIME type alone:

1. **Extension allowlist**: only `png`, `jpg`/`jpeg`, `webp`, `svg`, `ico` are accepted. Dangerous extensions (`exe`, `sh`, `js`, `html`, `svgz`, etc.) are rejected immediately with a clear security message.
2. **Size limits**: images are capped at `MAX_IMAGE_BYTES` (default 5 MB), logos at `MAX_LOGO_BYTES` (default 1 MB), and favicons additionally capped at `MAX_FAVICON_BYTES` (default 1 MB, applied as `min(maxBytes, MAX_FAVICON_BYTES)`).
3. **File signature ("magic byte") checks**: the file's actual binary signature must match its extension (PNG header, JPEG SOI marker, WEBP RIFF/WEBP chunk, ICO header, or `<svg` for SVG/SVGZ). A `.png` file that isn't really a PNG is rejected with "File content does not match its declared type."
4. **SVG sanitization**: SVG content is scanned for `<script>` tags, `on*` event-handler attributes, and external references (e.g. `xlink:href` to remote URLs). Any match is rejected with "SVG files cannot contain scripts, event handlers, or external references." Accepted SVGs still carry a warning that they render as-is and should come from trusted sources.
5. **Declared-type mismatch warnings**: if the browser-declared content type doesn't match the file extension, the upload still succeeds but is recorded with a warning.

All limits are configurable via the `MAX_LOGO_BYTES`, `MAX_IMAGE_BYTES`, and `MAX_FAVICON_BYTES` environment variables.

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/projects/:id/media` | List all media assets for a project. Returns `{ assets }`. |
| `POST` | `/api/projects/:id/media?kind=image\|logo\|favicon` | Upload a new asset (multipart `file` field). Creates a pre-upload backup, validates, persists, and returns `{ asset, project, assets }`. |
| `GET` | `/api/projects/:id/media/:assetId` | Fetch a single asset record. Returns `{ asset }`. |
| `DELETE` | `/api/projects/:id/media/:assetId[?force=true]` | Delete an asset. Blocked with a 409 "in use" error if the asset is referenced anywhere in the project's config or content unless `force=true` is supplied. Creates a pre-delete backup. |
| `POST` | `/api/projects/:id/media/:assetId/use` | Record that an asset is referenced at a given `location` (used for usage tracking and delete-protection bookkeeping). |
| `GET` | `/api/projects/:id/media/usage` | Returns a usage report (`{ usage }`) summarizing where each asset is referenced. |

Static files are served from `/uploads/projects/:projectId/...` (project media) and `/uploads/logos/...` (legacy logo uploads), both protected against path traversal.

## Dashboard: Media Library Panel

The **Media Library** panel (in `src/public/index.html` / `app.js`) lets users:

- Upload a new file with a chosen kind (`image`, `logo`, `favicon`) via `#mediaUploadForm`.
- Browse uploaded assets as cards showing a thumbnail/extension badge, file name, kind, size, validation status, and upload date (`renderMediaLibrary`, `mediaCardMarkup`).
- Delete an asset (`handleMediaGridClick` → `deleteMedia`). If the server reports the asset is in use, the user is offered a force-delete confirmation.

Errors surface in the `#mediaError` banner via `showMediaError` / `clearMediaError`.

## Asset Picker

The asset picker is a native `<dialog id="assetPickerDialog">` that shows only image-kind assets (`renderAssetPickerGrid`, filtered with `isImageKind`). It is opened with `openAssetPicker(onSelect)`, which stores a callback in `state.assetPicker.onSelect`; selecting a card (`handleAssetPickerClick`) invokes that callback with the chosen asset and closes the dialog. It can also be dismissed via the close button or by clicking the backdrop.

### Image fields in the section editor

`getSectionEditorSchema` now supports an `image` field kind (helper `image(name, label)`), applied to:

- `hero.imageUrl`
- `projects.items[].imageUrl`
- `gallery.images[].imageUrl`

`renderField` / `renderArrayField` render these as a text input plus a **"Choose from media"** button (`renderImageField`). Clicking the button is intercepted in `handleSectionFieldClick` (via `[data-image-picker-trigger]`), which opens the asset picker and writes the selected URL back into the underlying input — dispatching `input`/`change` events so the existing dirty-tracking and `collectSectionEditorValues` flows keep working unchanged. Image fields remain plain string URL values in the content model; nothing about the schema's storage format changes.

## Branding: Logo & Favicon

The **Branding** fieldset gained two `media-field` blocks (logo and favicon), each with:

- A live preview `<img>` (hidden when empty).
- Hidden inputs for the URL (`branding.logoUrl` / `branding.faviconUrl`) and the backing asset id (`branding.logoAssetId` / `branding.faviconAssetId`).
- **Choose from media**, **Upload**, and **Clear** actions, wired through `handleBrandingMediaFieldClick`, `openAssetPicker`, and `triggerMediaUploadThenAssign` (which uploads a file on the fly, assigns it, and refreshes the library).

Selections are staged in the form and only persisted when **Save Config** is submitted, which now includes `logoAssetId`/`faviconAssetId` in the `branding` patch (`saveConfig`). Backend validation (`validateBrandingPatch` in `configValidation.js`) accepts and stores these new string fields, and `buildDefaultConfig` / `buildDefaultConfigFromProject` initialize them to empty strings.

## Renderer Integration

- `pageRenderer.js` adds `faviconLink(config)`, which emits a `<link rel="icon" ...>` tag (type inferred from the favicon URL's extension: `image/svg+xml`, `image/x-icon`, or `image/png`) whenever `config.branding.faviconUrl` is set, and includes it in the page `<head>`.
- The existing header renderer already emits `<img src="...">` for `config.branding.logoUrl`; no change was needed there beyond making sure the URL can now point at `/uploads/projects/...` media as well as `/uploads/logos/...`.
- Section renderers (hero, projects, gallery) already render `imageUrl` values as `<img>` tags — they work unchanged whether the URL was typed manually or chosen from the asset picker.

## Verify Agent Media Checks

`agentService.js` adds `checkMediaReferences(project, indexHtml)`, run as part of the `verify` agent (`verifyBuildOutput`):

- **Blocking issues**:
  - A config or content field references an `assetId` that no longer exists in the media library.
  - A config or content field points at an uploaded file under `/uploads/projects/<projectId>/...` that is missing from the media library.
- **Warnings**:
  - A media asset is missing upload-validation metadata.
  - A referenced asset is configured but doesn't appear in the generated home-page preview (e.g. the selected logo isn't present in the rendered header).

Old projects with no media-library entries and no media references are exempt from these checks so MJC2–MJC5 projects continue to pass verification unchanged.

`getUsedAssetReferences` (in `mediaService.js`) walks the project's branding config and page/section content to collect every `{ url, assetId, location }` reference that should correspond to a known media asset — this is the same data source used for delete-protection ("in use") checks and the usage report.

## Smoke Test Coverage

`npm run smoke:phase6` (`src/server/scripts/smoke-phase6.js`) exercises the full flow end to end:

1. Creates a smoke project and confirms its media library starts empty.
2. Uploads a valid PNG image, a sanitized SVG logo, and a favicon-kind PNG — all pass validation.
3. Confirms uploads are rejected for: a file whose signature doesn't match its extension, a dangerous extension, and an SVG containing scripts/event handlers.
4. Lists and fetches assets, and confirms the uploaded file is served correctly over HTTP with the right content type.
5. Applies the uploaded logo and favicon to branding via the config patch and persists `logoAssetId`/`faviconAssetId`.
6. Attaches the uploaded image to the home page hero section, marks it as in-use, and checks the usage report.
7. Builds a preview and asserts the generated HTML contains the hero heading, the hero image URL, the logo URL in the header, and a `<link rel="icon">` favicon tag.
8. Runs the verify agent and asserts there are no blocking media-reference issues.
9. Confirms deleting an in-use asset is blocked (409 "in use") without `force=true`, then succeeds with it, and that the media library reflects the deletion.
10. Runs smoke cleanup and confirms only Phase 6 projects are removed.

## Known Limitations

- There is no authentication — anyone with dashboard access can upload, select, and delete media for any project.
- SVG uploads are sanitized for scripts/handlers/external references but are still rendered inline as-is; only upload from trusted sources.
- The asset picker currently filters to image-kind assets only; non-image assets (if any are ever introduced) are not selectable from it.
- Media storage remains JSON + filesystem based, matching the rest of the project (no database migration in this phase).
