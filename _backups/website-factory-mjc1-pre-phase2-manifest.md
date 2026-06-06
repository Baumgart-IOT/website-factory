# Website Factory MJC1 Pre Phase 2 Backup Manifest

Date/time: 2026-06-06 21:19:20 +02:00
Current working directory: C:\Users\Brandon\Documents\Codex\2026-06-06\i-want-to-build-a-website
Backup folder path: C:\Users\Brandon\Documents\Codex\2026-06-06\i-want-to-build-a-website\_backups\website-factory-mjc1-pre-phase2-20260606-211919

## Files/folders backed up
- .env.example
- .gitignore
- data
- data\projects
- data\projects\.gitkeep
- outputs
- package.json
- README.md
- src
- src\public
- src\public\app.js
- src\public\index.html
- src\public\styles.css
- src\server
- src\server\config
- src\server\config\paths.js
- src\server\index.js
- src\server\scripts
- src\server\scripts\validate-data.js
- src\server\services
- src\server\services\projectService.js
- src\server\services\templateService.js
- src\server\services\uploadService.js
- src\server\storage
- src\server\storage\jsonStore.js
- src\server\utils
- src\server\utils\http.js
- src\server\validation
- src\server\validation\projectValidation.js
- src\server\validation\uploadValidation.js
- templates
- templates\metadata.json
- uploads
- uploads\logos
- uploads\logos\.gitkeep
- work

## Files/folders excluded
- node_modules
- .git
- _backups
- *.log
- *.tmp
- *.cache
- generated cache files

## Current known-good MVP state
- Local server runs at http://localhost:3000
- Dashboard UI: src/public/index.html
- Backend orchestrator API: src/server/index.js
- JSON project storage: data/projects/
- Template metadata: templates/metadata.json
- Upload validation: src/server/validation/uploadValidation.js
- Setup and roadmap: README.md
- node src/server/scripts/validate-data.js passes
- /, /app.js, /styles.css, and /api/templates return HTTP 200
- Project creation passed API smoke test
- Mock build passed API smoke test
- SVG logo upload validation passed API smoke test
- Visual screenshot/browser pass was not completed due to a desktop sandbox issue, but the app is served and reachable over HTTP

## Verification commands known to pass
- node src/server/scripts/validate-data.js
- Invoke-WebRequest http://localhost:3000/
- Invoke-WebRequest http://localhost:3000/app.js
- Invoke-WebRequest http://localhost:3000/styles.css
- Invoke-WebRequest http://localhost:3000/api/templates
