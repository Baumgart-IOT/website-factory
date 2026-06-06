import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";

export async function listTemplates() {
  const data = await readFile(join(paths.templates, "metadata.json"), "utf8");
  return JSON.parse(data).templates;
}

export async function getTemplate(templateId) {
  const templates = await listTemplates();
  return templates.find((template) => template.id === templateId) || null;
}
