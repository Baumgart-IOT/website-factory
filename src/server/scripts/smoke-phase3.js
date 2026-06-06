import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
let serverProcess = null;

try {
  await ensureServer();
  await runSmoke();
  await import("./smoke-phase2.js");
  console.log("Phase 3 smoke test passed.");
} finally {
  if (serverProcess) serverProcess.kill();
}

async function runSmoke() {
  const templates = await get("/api/templates");
  assert(Array.isArray(templates.templates) && templates.templates.length > 0, "Template list returns data");
  const template = templates.templates.find((item) => item.id === "launch-saas") || templates.templates[0];

  const created = await post("/api/projects", {
    name: `Renderer Smoke ${Date.now()}`,
    industry: "Software automation",
    goal: "Turn project configuration into a polished live preview.",
    audience: "Operations teams",
    palette: "cobalt",
    templateId: template.id,
    pages: ["Home", "Services", "About", "Contact"]
  });
  const projectId = created.project.id;
  assert(projectId, "Project creation works");

  const patched = await patch(`/api/projects/${projectId}/config`, {
    business: {
      name: "Renderer Smoke Co",
      tagline: "Real previews from structured config.",
      industry: "Software automation",
      location: "Remote",
      email: "preview@example.com",
      phone: "+1 555 0130"
    },
    branding: {
      primaryColor: "#2f5f93",
      accentColor: "#25a18e",
      backgroundColor: "#f7fafc",
      headingFont: "Inter",
      bodyFont: "Inter",
      darkMode: false,
      borderRadius: "medium"
    },
    template: {
      selected: template.id,
      layout: template.layoutStyle || template.category,
      animationLevel: "standard"
    },
    pages: ["Home", "Services", "About", "Contact"],
    features: {
      contactForm: true,
      quoteRequest: true,
      gallery: false,
      blog: false,
      testimonials: true,
      faq: true
    },
    seo: {
      title: "Renderer Smoke Co",
      description: "A generated multi-page Website Factory preview.",
      keywords: ["renderer", "website factory"],
      generateSitemap: true,
      generateRobots: true
    }
  });
  assert(patched.project.config.business.name === "Renderer Smoke Co", "Config patch sets business, branding, template, pages, and SEO");

  const build = await post(`/api/projects/${projectId}/build`);
  assert(build.build.status === "success", "Build endpoint creates real preview files");
  assert(build.build.generatedFiles.includes("index.html"), "Build records index.html");
  assert(build.build.generatedFiles.includes("styles.css"), "Build records styles.css");
  assert(build.build.generatedFiles.includes("sitemap.xml"), "Build records sitemap.xml");
  assert(build.build.generatedFiles.includes("robots.txt"), "Build records robots.txt");
  assert(build.build.generatedFiles.includes("services/index.html"), "At least one secondary page is generated");

  const buildDir = join(paths.previews, projectId, build.build.buildId);
  await stat(join(buildDir, "index.html"));
  await stat(join(buildDir, "styles.css"));
  await stat(join(buildDir, "sitemap.xml"));
  await stat(join(buildDir, "robots.txt"));
  await stat(join(buildDir, "services", "index.html"));

  const index = await readFile(join(buildDir, "index.html"), "utf8");
  assert(index.includes("Renderer Smoke Co"), "Preview index contains business name");
  assert(index.includes('class="nav"'), "Navigation links are generated");
  assert(index.includes('id="contact"'), "Contact section exists when enabled");

  const servedPreview = await text(build.build.previewPath);
  assert(servedPreview.includes("Renderer Smoke Co"), "Preview URL opens generated HTML");

  const verify = await post(`/api/projects/${projectId}/agents/verify`);
  assert(verify.agent.status === "pass", "Verify agent passes generated preview checks");
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
