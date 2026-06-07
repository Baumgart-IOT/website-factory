import { listTemplates } from "../services/templateService.js";
import { readProjects } from "../storage/jsonStore.js";
import { normalizeProjectConfig } from "../validation/configValidation.js";
import { normalizeProjectContent } from "../services/contentService.js";

const templates = await listTemplates();
const templateIds = new Set(templates.map((template) => template.id));
const projects = await readProjects();

for (const project of projects) {
  const config = normalizeProjectConfig(project);
  const templateId = config.template.selected || project.site?.templateId;
  if (!project.id || !config.business?.name || !templateIds.has(templateId)) {
    throw new Error(`Invalid project config: ${project.id || "unknown"}`);
  }
  normalizeProjectContent(project);
}

console.log(`Validated ${templates.length} templates and ${projects.length} project configs.`);
if (process.argv[1]?.endsWith("validate-data.js")) process.exit(0);
