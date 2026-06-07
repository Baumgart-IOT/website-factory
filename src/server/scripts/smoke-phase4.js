import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { cleanupSmokeProjects } from "./testUtils.js";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const smokePrefix = "smoke-phase4-";
let serverProcess = null;

try {
  await ensureServer();
  await cleanupSmokeProjects(smokePrefix);
  await runSmoke();
  console.log("Phase 4 smoke test passed.");
} finally {
  await cleanupSmokeProjects(smokePrefix).catch(() => {});
  if (serverProcess) serverProcess.kill();
}

async function runSmoke() {
  await import("./validate-data.js");

  const projectsBefore = await get("/api/projects");
  const nonSmokeBefore = new Set(projectsBefore.projects.filter((project) => !project.config.business.name.startsWith(smokePrefix)).map((project) => project.id));

  const templates = await get("/api/templates");
  assert(templates.templates.length > 0, "Template list works");
  const template = templates.templates[0];

  const created = await post("/api/projects", {
    name: `${smokePrefix}${Date.now()}`,
    industry: "Content operations",
    goal: "Render authored structured content into real preview pages.",
    audience: "Website operators",
    palette: "forest",
    templateId: template.id,
    pages: ["Home", "Services", "Contact"]
  });
  const projectId = created.project.id;
  assert(projectId, "Smoke project creation works");

  const initialized = await post(`/api/projects/${projectId}/content/initialize`);
  assert(initialized.initialized === true, "Content initialization works");

  const contentResponse = await get(`/api/projects/${projectId}/content`);
  assert(contentResponse.content.pages.home, "GET content works");

  const pageAdd = await post(`/api/projects/${projectId}/content/pages`, {
    title: "Insights",
    seo: { title: "Insights", description: "Practical content notes." }
  });
  assert(pageAdd.pageKey === "insights", "Add page works");

  const pagePatch = await patch(`/api/projects/${projectId}/content/pages/insights`, {
    title: "Knowledge Hub",
    slug: "/insights",
    seo: {
      title: "Knowledge Hub SEO",
      description: "Edited secondary page SEO description."
    }
  });
  assert(pagePatch.content.pages.insights.title === "Knowledge Hub", "Patch page metadata works");

  const heroAdd = await post(`/api/projects/${projectId}/content/pages/home/sections`, {
    type: "hero",
    content: {
      heading: "Temporary hero"
    }
  });
  assert(heroAdd.section.type === "hero", "Add hero section works");

  const heroPatch = await patch(`/api/projects/${projectId}/content/pages/home/sections/${heroAdd.section.id}`, {
    order: 1,
    content: {
      eyebrow: "MJC4",
      heading: "Authored Hero Heading MJC4",
      subheading: "Structured content now drives the renderer.",
      primaryButtonText: "Talk to us",
      primaryButtonUrl: "/contact",
      secondaryButtonText: "See services",
      secondaryButtonUrl: "/services",
      imageUrl: ""
    }
  });
  assert(heroPatch.section.content.heading === "Authored Hero Heading MJC4", "Patch hero content works");

  const servicesAdd = await post(`/api/projects/${projectId}/content/pages/home/sections`, {
    type: "services",
    content: { heading: "Temporary services" }
  });
  assert(servicesAdd.section.type === "services", "Add services section works");

  const servicesPatch = await patch(`/api/projects/${projectId}/content/pages/home/sections/${servicesAdd.section.id}`, {
    content: {
      heading: "Authored Services",
      subheading: "Services are edited as structured JSON.",
      items: [
        { title: "Content Strategy", description: "Plan the sections that matter.", icon: "map" },
        { title: "Preview Build", description: "Render authored content into pages.", icon: "build" }
      ]
    }
  });
  assert(servicesPatch.section.content.items.length === 2, "Patch services items works");

  const ctaAdd = await post(`/api/projects/${projectId}/content/pages/home/sections`, {
    type: "cta",
    content: { heading: "Temporary CTA", buttonText: "Act", buttonUrl: "/contact" }
  });
  await post(`/api/projects/${projectId}/content/pages/home/sections/${ctaAdd.section.id}/move`, { direction: "up" });
  const ctaDisabled = await patch(`/api/projects/${projectId}/content/pages/home/sections/${ctaAdd.section.id}`, { enabled: false });
  assert(ctaDisabled.section.enabled === false, "Disable/reorder section works");
  const ctaDeleted = await del(`/api/projects/${projectId}/content/pages/home/sections/${ctaAdd.section.id}`);
  assert(!ctaDeleted.content.pages.home.sections.some((section) => section.id === ctaAdd.section.id), "Delete section works");

  const insightHero = await post(`/api/projects/${projectId}/content/pages/insights/sections`, {
    type: "hero",
    content: {
      heading: "Knowledge Hub Page Title",
      subheading: "Secondary pages render authored content too."
    }
  });
  assert(insightHero.section.id, "Secondary page section added");

  const build = await post(`/api/projects/${projectId}/build`);
  assert(build.build.status === "success", "Build uses user-authored content");

  const buildDir = join(paths.previews, projectId, build.build.buildId);
  await stat(join(buildDir, "index.html"));
  await stat(join(buildDir, "insights", "index.html"));

  const index = await readFile(join(buildDir, "index.html"), "utf8");
  assert(index.includes("Authored Hero Heading MJC4"), "Generated index.html contains edited hero heading");
  assert(index.includes("Authored Services"), "Generated index.html contains edited services content");

  const secondary = await readFile(join(buildDir, "insights", "index.html"), "utf8");
  assert(secondary.includes("Knowledge Hub"), "Generated secondary page contains edited page title");

  const servedPreview = await text(build.build.previewPath);
  assert(servedPreview.includes("Authored Hero Heading MJC4"), "Generated preview route serves edited content");

  const verify = await post(`/api/projects/${projectId}/agents/verify`);
  assert(!verify.agent.blockingIssues.some((issue) => issue.includes("Generated") || issue.includes("output")), "Verify agent has no blocking generated-file issues");

  await cleanupSmokeProjects(smokePrefix);
  const projectsAfter = await get("/api/projects");
  assert(!projectsAfter.projects.some((project) => project.config.business.name.startsWith(smokePrefix)), "Smoke cleanup removes smoke projects");
  for (const id of nonSmokeBefore) {
    assert(projectsAfter.projects.some((project) => project.id === id), "Smoke cleanup does not delete non-smoke projects");
  }
}

async function ensureServer() {
  try {
    await get("/api/templates");
  } catch {
    serverProcess = spawn("node", ["src/server/index.js"], { stdio: "ignore" });
    await waitForServer();
  }
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      await get("/api/templates");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Server did not start within 10 seconds.");
}

async function get(path) {
  return request(path);
}

async function post(path, body = {}) {
  return request(path, { method: "POST", body });
}

async function patch(path, body) {
  return request(path, { method: "PATCH", body });
}

async function del(path) {
  return request(path, { method: "DELETE" });
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function text(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}`);
  return response.text();
}

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke assertion failed: ${message}`);
}
