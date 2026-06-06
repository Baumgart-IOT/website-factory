import crypto from "node:crypto";
import { getTemplate, listTemplates } from "./templateService.js";
import { createProjectBackup } from "./backupService.js";
import { readProject, readProjects, writeProject } from "../storage/jsonStore.js";
import { validateProjectInput } from "../validation/projectValidation.js";
import { buildDefaultConfig, mergeConfig, normalizeProjectConfig, syncProjectFromConfig, validateConfigPatch } from "../validation/configValidation.js";

const initialAgents = {
  recon: emptyAgent("Recon", "Awaiting discovery inputs."),
  security: emptyAgent("Security", "Static checks not started."),
  verify: emptyAgent("Verify", "Preview QA not started."),
  backup: emptyAgent("Backup", "Snapshot not created.")
};

export async function listProjects() {
  const projects = await readProjects();
  return projects.map(normalizeProject);
}

export async function getProject(id) {
  const project = await readProject(id);
  if (!project) {
    const error = new Error("Project not found.");
    error.statusCode = 404;
    error.publicMessage = "Project not found.";
    throw error;
  }
  return normalizeProject(project);
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
    config: buildDefaultConfig(value, template),
    agents: structuredClone(initialAgents),
    builds: []
  };

  return writeProject(syncProjectFromConfig(project, template));
}

export async function updateProjectConfig(projectId, patch) {
  const project = await getProject(projectId);
  const templates = await listTemplates();
  validateConfigPatch(patch, templates);
  const reason = patch.template?.selected && patch.template.selected !== project.config.template.selected ? "pre-template-switch" : "pre-config-patch";

  await createProjectBackup(project, reason);

  project.config = mergeConfig(project.config, patch);
  const selectedTemplate = await getTemplate(project.config.template.selected);
  project.updatedAt = new Date().toISOString();
  project.agents.recon = { ...project.agents.recon, status: "queued", detail: "Config changed; recon should be re-run." };
  project.agents.verify = { ...project.agents.verify, status: "queued", detail: "Config changed; verification should be re-run." };
  return writeProject(syncProjectFromConfig(project, selectedTemplate));
}

export async function saveProject(project) {
  return writeProject(normalizeProject(project));
}

function normalizeProject(project) {
  project.config = normalizeProjectConfig(project);
  project.agents = {
    ...structuredClone(initialAgents),
    ...(project.agents || {})
  };
  project.builds = project.builds || [];
  return syncProjectFromConfig(project);
}

function emptyAgent(label, detail) {
  return {
    label,
    status: "pending",
    lastRun: null,
    blockingIssues: [],
    warnings: [],
    recommendations: [],
    detail
  };
}
