import { listTemplates } from "../services/templateService.js";
import { readProjects } from "../storage/jsonStore.js";

const templates = await listTemplates();
const templateIds = new Set(templates.map((template) => template.id));
const projects = await readProjects();

for (const project of projects) {
  if (!project.id || !project.site?.name || !templateIds.has(project.site?.templateId)) {
    throw new Error(`Invalid project config: ${project.id || "unknown"}`);
  }
}

console.log(`Validated ${templates.length} templates and ${projects.length} project configs.`);
