import crypto from "node:crypto";
import { getTemplate } from "./templateService.js";
import { readProject, readProjects, writeProject } from "../storage/jsonStore.js";
import { validateProjectInput } from "../validation/projectValidation.js";

const initialAgents = {
  recon: { label: "Recon", status: "pending", detail: "Awaiting discovery inputs." },
  security: { label: "Security", status: "pending", detail: "Static checks not started." },
  verify: { label: "Verify", status: "pending", detail: "Preview QA not started." },
  backup: { label: "Backup", status: "pending", detail: "Snapshot not created." }
};

export async function listProjects() {
  return readProjects();
}

export async function getProject(id) {
  const project = await readProject(id);
  if (!project) {
    const error = new Error("Project not found.");
    error.statusCode = 404;
    error.publicMessage = "Project not found.";
    throw error;
  }
  return project;
}

export async function createProject(input) {
  const value = validateProjectInput(input);
  const template = await getTemplate(value.templateId);

  if (!template) {
    const error = new Error("Selected template does not exist.");
    error.statusCode = 400;
    error.publicMessage = "Selected template does not exist.";
    throw error;
  }

  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    site: {
      name: value.name,
      slug: value.slug,
      industry: value.industry,
      goal: value.goal,
      audience: value.audience,
      palette: value.palette,
      templateId: value.templateId,
      templateName: template.name,
      pages: value.pages
    },
    assets: {
      logo: null
    },
    agents: initialAgents,
    builds: []
  };

  return writeProject(project);
}

export async function createMockBuild(projectId) {
  const project = await getProject(projectId);
  const build = {
    id: crypto.randomUUID(),
    status: "preview-ready",
    createdAt: new Date().toISOString(),
    previewUrl: `/mock-preview/${project.site.slug}`,
    notes: [
      "Mock preview created from saved JSON configuration.",
      "Real template rendering will attach to this orchestration point."
    ]
  };

  project.updatedAt = build.createdAt;
  project.builds.unshift(build);
  project.agents.recon = { ...project.agents.recon, status: "queued", detail: "Ready for phase-two recon agent." };
  project.agents.verify = { ...project.agents.verify, status: "queued", detail: "Mock preview awaiting automated checks." };
  await writeProject(project);
  return { build, project };
}
