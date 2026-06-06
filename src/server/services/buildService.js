import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { createProjectBackup } from "./backupService.js";
import { getProject, saveProject } from "./projectService.js";
import { normalizeProjectConfig, validateBuildConfig } from "../validation/configValidation.js";
import { writeJsonAtomic } from "../storage/jsonStore.js";

export async function buildProject(projectId) {
  const project = await getProject(projectId);
  const config = normalizeProjectConfig(project);
  validateBuildConfig(config);
  await createProjectBackup(project, "pre-build");

  const now = new Date().toISOString();
  const buildId = crypto.randomUUID();
  const previewPath = `/previews/${project.id}/${buildId}/index.html`;
  const build = {
    buildId,
    projectId: project.id,
    status: "success",
    createdAt: now,
    previewPath,
    logs: [
      "Validated required project config.",
      "Created pre-build backup.",
      "Generated static mock preview.",
      "Stored preview metadata record."
    ]
  };

  await writePreview(project.id, buildId, config);
  await writeJsonAtomic(join(paths.builds, project.id, `${buildId}.json`), build);

  project.updatedAt = now;
  project.config = config;
  project.builds = [build, ...(project.builds || [])];
  project.agents.verify = {
    ...project.agents.verify,
    status: "queued",
    detail: "New preview is ready for verification."
  };
  await saveProject(project);

  return { build, project };
}

export async function listProjectBuilds(projectId) {
  const project = await getProject(projectId);
  return project.builds || [];
}

async function writePreview(projectId, buildId, config) {
  const folder = join(paths.previews, projectId, buildId);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "index.html"), renderPreview(config), "utf8");
}

function renderPreview(config) {
  const nav = config.pages.map((page) => `<a href="#${slug(page)}">${escapeHtml(page)}</a>`).join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(config.seo.title || config.business.name)}</title>
    <meta name="description" content="${escapeHtml(config.seo.description || config.business.tagline)}">
    <style>
      :root {
        --primary: ${config.branding.primaryColor};
        --accent: ${config.branding.accentColor};
        --background: ${config.branding.backgroundColor};
        --radius: ${radius(config.branding.borderRadius)};
        font-family: ${cssFont(config.branding.bodyFont)}, Arial, sans-serif;
      }
      body { margin: 0; background: var(--background); color: #1f2523; }
      header { display: flex; justify-content: space-between; gap: 24px; padding: 24px 7vw; background: #fff; border-bottom: 1px solid #ddd; }
      nav { display: flex; flex-wrap: wrap; gap: 14px; }
      a { color: var(--primary); font-weight: 700; text-decoration: none; }
      main { display: grid; gap: 48px; padding: 56px 7vw; }
      h1, h2 { font-family: ${cssFont(config.branding.headingFont)}, Arial, sans-serif; margin: 0 0 16px; }
      .hero { display: grid; gap: 18px; max-width: 860px; }
      .hero h1 { font-size: clamp(38px, 7vw, 76px); line-height: 1; color: var(--primary); }
      .cta { width: fit-content; border-radius: var(--radius); background: var(--accent); color: #fff; padding: 13px 18px; }
      section { max-width: 980px; }
      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
      .card { background: #fff; border: 1px solid #ddd; border-radius: var(--radius); padding: 18px; }
    </style>
  </head>
  <body>
    <header>
      <strong>${escapeHtml(config.business.name)}</strong>
      <nav>${nav}</nav>
    </header>
    <main>
      <section class="hero">
        <p>${escapeHtml(config.template.selected)} template</p>
        <h1>${escapeHtml(config.business.name)}</h1>
        <p>${escapeHtml(config.business.tagline)}</p>
        <a class="cta" href="#contact">Start a conversation</a>
      </section>
      <section id="services">
        <h2>Services</h2>
        <div class="cards">
          <div class="card"><h3>Strategy</h3><p>Focused guidance for ${escapeHtml(config.business.industry)} teams.</p></div>
          <div class="card"><h3>Delivery</h3><p>Clear execution plans shaped around your customer journey.</p></div>
          <div class="card"><h3>Support</h3><p>Practical next steps for growth, trust, and conversion.</p></div>
        </div>
      </section>
      <section id="contact">
        <h2>Contact</h2>
        <p>${escapeHtml(config.business.email || "Add an email address in the project editor.")}</p>
        <p>${escapeHtml(config.business.phone || "Add a phone number in the project editor.")}</p>
      </section>
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function cssFont(value) {
  return JSON.stringify(String(value || "Inter"));
}

function radius(value) {
  return {
    none: "0",
    small: "4px",
    medium: "8px",
    large: "16px"
  }[value] || "8px";
}
