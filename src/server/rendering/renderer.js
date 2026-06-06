import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { paths } from "../config/paths.js";
import { getTemplate } from "../services/templateService.js";
import { normalizeProjectConfig, validateBuildConfig } from "../validation/configValidation.js";
import { pageOutputPath, renderPage } from "./pageRenderer.js";
import { renderSections } from "./sectionRenderer.js";
import { renderSitemap } from "./sitemapRenderer.js";
import { renderRobots } from "./robotsRenderer.js";
import { renderTheme } from "./themeRenderer.js";

export async function renderProjectPreview({ project, buildId }) {
  const config = normalizeProjectConfig(project);
  validateBuildConfig(config);
  const template = await getTemplate(config.template.selected);
  if (!template) {
    const error = new Error("Selected template is missing or invalid.");
    error.statusCode = 400;
    error.publicMessage = "Selected template is missing or invalid.";
    throw error;
  }

  const outDir = join(paths.previews, project.id, buildId);
  await mkdir(outDir, { recursive: true });

  const generatedFiles = [];
  const logs = [`Loaded template ${template.id}.`, `Rendering ${config.pages.length} pages.`];

  await writeGenerated(outDir, "styles.css", renderTheme(config, template), generatedFiles);
  await writeGenerated(outDir, "app.js", renderClientScript(), generatedFiles);

  for (const page of config.pages) {
    const outputPath = pageOutputPath(page);
    const nested = outputPath.includes("/");
    const body = renderSections(page, config, template);
    const html = renderPage({
      page,
      config,
      template,
      cssPath: nested ? "../styles.css" : "./styles.css",
      scriptPath: nested ? "../app.js" : "./app.js",
      body
    });
    await writeGenerated(outDir, outputPath, html, generatedFiles);
    logs.push(`Generated ${outputPath}.`);
  }

  if (config.seo.generateSitemap) {
    await writeGenerated(outDir, "sitemap.xml", renderSitemap(project.id, buildId, config.pages), generatedFiles);
    logs.push("Generated sitemap.xml.");
  }

  if (config.seo.generateRobots) {
    await writeGenerated(outDir, "robots.txt", renderRobots(project.id, buildId, config.seo.generateSitemap), generatedFiles);
    logs.push("Generated robots.txt.");
  }

  return {
    previewPath: `/previews/${project.id}/${buildId}/index.html`,
    generatedFiles,
    logs,
    outputDirectory: outDir
  };
}

async function writeGenerated(outDir, relativePath, content, generatedFiles) {
  const target = join(outDir, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  generatedFiles.push(relativePath.replaceAll("\\", "/"));
}

function renderClientScript() {
  return `document.documentElement.classList.add("preview-ready");
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
`;
}
