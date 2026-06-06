# GPT Actions Setup

This project is ready for a future Custom GPT Action using the local orchestrator API.

## Create The Custom GPT

1. Open the GPT builder.
2. Create a GPT named `Website Factory Orchestrator`.
3. Add an Action.
4. Paste the schema from `docs/openapi/website-factory-orchestrator.openapi.yaml`.
5. Point the server URL at the deployed API when this local MVP is hosted.

## Recommended GPT Instructions

Use the Website Factory Orchestrator API to create and manage website projects. Always inspect project state before making changes. Prefer small, validated config patches over replacing full project JSON. Summarize every change in plain language.

## Required Safety Rules

- Never store secrets, passwords, API keys, tokens, private keys, access tokens, or refresh tokens in project config.
- Do not deploy externally without explicit user approval.
- Create or confirm a backup before any meaningful config, logo, build, rollback, or future deployment action.
- Treat uploaded files as untrusted and rely on the backend upload validation.
- If validation fails, report the exact backend error instead of retrying with guesses.

## Deployment Approval Rule

The GPT may prepare a deployment plan, but it must ask for explicit approval before calling future deployment endpoints or changing production traffic.

## Backup-Before-Change Rule

Before major changes, call `createProjectBackup` or use an endpoint that automatically creates a backup. Current automatic backups happen before config patches, template switches, logo replacement, builds, and rollback.

## Specialist Agent Workflow

1. Run Recon after intake or content changes.
2. Run Security before build or deployment.
3. Run Verify after every build.
4. Run Backup before rollback or deployment.
5. Resolve blocking issues before continuing to deployment.
