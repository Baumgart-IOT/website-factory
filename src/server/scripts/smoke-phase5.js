import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { cleanupSmokeProjects } from "./testUtils.js";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const smokePrefix = "smoke-phase5-";
let serverProcess = null;

try {
  await ensureServer();
  await cleanupSmokeProjects(smokePrefix);
  await runSmoke();
  console.log("Phase 5 smoke test passed.");
} finally {
  await cleanupSmokeProjects(smokePrefix).catch(() => {});
  if (serverProcess) serverProcess.kill();
}

async function runSmoke() {
  await import("./validate-data.js");
  const projectsBefore = await get("/api/projects");
  const nonSmokeBefore = new Set(projectsBefore.projects.filter((project) => !project.config.business.name.startsWith(smokePrefix)).map((project) => project.id));

  const templates = await get("/api/templates");
  const template = templates.templates[0];

  const created = await post("/api/projects", {
    name: `${smokePrefix}${Date.now()}`,
    industry: "Rich section editing",
    goal: "Build a preview from safe form-based section editors.",
    audience: "Non-technical website owners",
    palette: "forest",
    templateId: template.id,
    pages: ["Home", "Services", "FAQ", "Contact"]
  });
  const projectId = created.project.id;
  assert(projectId, "Project creation works");

  const initialized = await post(`/api/projects/${projectId}/content/initialize`);
  assert(initialized.content.pages.home, "Content initialization works");

  const hero = await post(`/api/projects/${projectId}/content/pages/home/sections`, {
    type: "hero",
    content: { heading: "Draft" }
  });
  await patch(`/api/projects/${projectId}/content/pages/home/sections/${hero.section.id}`, {
    order: 1,
    content: {
      eyebrow: "MJC5",
      heading: "MJC5 Rich Hero Heading",
      subheading: "Edited from structured controls.",
      body: "This body is authored without raw JSON.",
      primaryButtonText: "Start now",
      primaryButtonUrl: "/contact",
      secondaryButtonText: "See services",
      secondaryButtonUrl: "/services",
      imageUrl: ""
    }
  });

  const services = await post(`/api/projects/${projectId}/content/pages/home/sections`, {
    type: "services",
    content: {
      heading: "MJC5 Services",
      subheading: "Multiple edited service items.",
      items: [
        { title: "Second Service", description: "This should move down.", icon: "two" },
        { title: "MJC5 First Service", description: "This should move up.", icon: "one" }
      ]
    }
  });
  await patch(`/api/projects/${projectId}/content/pages/home/sections/${services.section.id}`, {
    content: {
      heading: "MJC5 Services",
      subheading: "Multiple edited service items.",
      items: [
        { title: "MJC5 First Service", description: "Reordered into first position.", icon: "one" },
        { title: "Second Service", description: "Moved into second position.", icon: "two" }
      ]
    }
  });

  const faq = await post(`/api/projects/${projectId}/content/pages/home/sections`, {
    type: "faq",
    content: {
      heading: "MJC5 FAQ",
      items: [
        { question: "What changed in MJC5?", answer: "Rich form editors replaced JSON-first editing." },
        { question: "Can arrays be reordered?", answer: "Yes, repeated items support ordering." }
      ]
    }
  });
  assert(faq.section.type === "faq", "Add FAQ section works");

  const testimonials = await post(`/api/projects/${projectId}/content/pages/home/sections`, {
    type: "testimonials",
    content: {
      heading: "MJC5 Testimonials",
      items: [
        { quote: "This editor finally feels approachable.", name: "Avery", role: "Founder" }
      ]
    }
  });
  assert(testimonials.section.type === "testimonials", "Add testimonials section works");

  const quote = await post(`/api/projects/${projectId}/content/pages/home/sections`, {
    type: "quote_request",
    content: {
      heading: "MJC5 Quote Request",
      body: "Visible but non-functional placeholder fields.",
      fields: [
        { label: "Project Budget", type: "select", required: true },
        { label: "Detailed Notes", type: "textarea", required: false },
        { label: "Send me updates", type: "checkbox", required: false }
      ]
    }
  });
  assert(quote.section.type === "quote_request", "Add quote_request section works");

  const build = await post(`/api/projects/${projectId}/build`);
  assert(build.build.status === "success", "Build preview works");
  const buildDir = join(paths.previews, projectId, build.build.buildId);
  await stat(join(buildDir, "index.html"));
  const index = await readFile(join(buildDir, "index.html"), "utf8");

  assert(index.includes("MJC5 Rich Hero Heading"), "Generated index contains edited hero heading");
  assert(index.includes("MJC5 First Service"), "Generated index contains edited service title");
  assert(index.indexOf("MJC5 First Service") < index.indexOf("Second Service"), "Reordered services render in selected order");
  assert(index.includes("What changed in MJC5?"), "Generated index contains edited FAQ question");
  assert(index.includes("This editor finally feels approachable."), "Generated index contains testimonial quote");
  assert(index.includes("Project Budget *"), "Generated index contains quote request field label");

  const verify = await post(`/api/projects/${projectId}/agents/verify`);
  assert(!verify.agent.blockingIssues.some((issue) => issue.includes("Generated") || issue.includes("output")), "Verify agent returns no blocking generated-file issues");

  await cleanupSmokeProjects(smokePrefix);
  const projectsAfter = await get("/api/projects");
  assert(!projectsAfter.projects.some((project) => project.config.business.name.startsWith(smokePrefix)), "Smoke cleanup removes Phase 5 projects");
  for (const id of nonSmokeBefore) {
    assert(projectsAfter.projects.some((project) => project.id === id), "Smoke cleanup preserves non-smoke projects");
  }
}

async function get(path) {
  return request(path);
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

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke assertion failed: ${message}`);
}
