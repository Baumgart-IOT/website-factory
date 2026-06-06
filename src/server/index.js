import http from "node:http";
import { URL } from "node:url";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { paths } from "./config/paths.js";
import { createProject, listProjects, getProject, updateProjectConfig } from "./services/projectService.js";
import { getTemplate, listTemplates } from "./services/templateService.js";
import { uploadLogo } from "./services/uploadService.js";
import { ensureStorage } from "./storage/jsonStore.js";
import { readBody } from "./utils/http.js";
import { createProjectBackup, listProjectBackups, rollbackProject } from "./services/backupService.js";
import { runAgent } from "./services/agentService.js";
import { buildProject, listProjectBuilds } from "./services/buildService.js";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = new URL("../public/", import.meta.url);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

await ensureStorage();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    if (url.pathname.startsWith("/previews/")) {
      await serveFromDirectory(res, paths.previews, url.pathname.replace(/^\/previews\//, ""));
      return;
    }

    if (url.pathname.startsWith("/uploads/logos/")) {
      await serveFromDirectory(res, paths.logos, url.pathname.replace(/^\/uploads\/logos\//, ""));
      return;
    }

    await serveStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.publicMessage || "Something went wrong.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

server.listen(PORT, () => {
  console.log(`Website Factory MVP running at http://localhost:${PORT}`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/templates") {
    sendJson(res, 200, { templates: await listTemplates() });
    return;
  }

  const templateMatch = url.pathname.match(/^\/api\/templates\/([a-zA-Z0-9-]+)$/);
  if (req.method === "GET" && templateMatch) {
    const template = await getTemplate(templateMatch[1]);
    if (!template) {
      sendJson(res, 404, { error: "Template not found." });
      return;
    }
    sendJson(res, 200, { template });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/projects") {
    sendJson(res, 200, { projects: await listProjects() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/projects") {
    const payload = await readJsonBody(req);
    sendJson(res, 201, { project: await createProject(payload) });
    return;
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)$/);
  if (req.method === "GET" && projectMatch) {
    sendJson(res, 200, { project: await getProject(projectMatch[1]) });
    return;
  }

  const configMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)\/config$/);
  if (req.method === "PATCH" && configMatch) {
    const payload = await readJsonBody(req);
    sendJson(res, 200, { project: await updateProjectConfig(configMatch[1], payload) });
    return;
  }

  const logoMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)\/logo$/);
  if (req.method === "POST" && logoMatch) {
    sendJson(res, 200, { project: await uploadLogo(req, logoMatch[1]) });
    return;
  }

  const buildMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)\/build$/);
  if (req.method === "POST" && buildMatch) {
    sendJson(res, 200, await buildProject(buildMatch[1]));
    return;
  }

  const buildsMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)\/builds$/);
  if (req.method === "GET" && buildsMatch) {
    sendJson(res, 200, { builds: await listProjectBuilds(buildsMatch[1]) });
    return;
  }

  const backupsMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)\/backups$/);
  if (req.method === "POST" && backupsMatch) {
    const body = await optionalJsonBody(req);
    const project = await getProject(backupsMatch[1]);
    sendJson(res, 201, { backup: await createProjectBackup(project, body.reason || "manual") });
    return;
  }

  if (req.method === "GET" && backupsMatch) {
    sendJson(res, 200, { backups: await listProjectBackups(backupsMatch[1]) });
    return;
  }

  const rollbackMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)\/rollback\/([a-zA-Z0-9-]+)$/);
  if (req.method === "POST" && rollbackMatch) {
    sendJson(res, 200, await rollbackProject(rollbackMatch[1], rollbackMatch[2]));
    return;
  }

  const agentMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)\/agents\/(recon|security|verify|backup)$/);
  if (req.method === "POST" && agentMatch) {
    sendJson(res, 200, { agent: await runAgent(agentMatch[1], agentMatch[2]), project: await getProject(agentMatch[1]) });
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const fileUrl = new URL(`.${safePath}`, PUBLIC_DIR);

  if (!fileUrl.href.startsWith(PUBLIC_DIR.href)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }

  try {
    const data = await readFile(fileUrl);
    res.writeHead(200, { "content-type": contentTypes[extname(fileUrl.pathname)] || "application/octet-stream" });
    res.end(data);
  } catch {
    const index = await readFile(new URL("index.html", PUBLIC_DIR));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(index);
  }
}

async function serveFromDirectory(res, root, relativePath) {
  const target = resolve(root, relativePath);
  if (!target.startsWith(resolve(root))) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }

  try {
    const data = await readFile(target);
    res.writeHead(200, { "content-type": contentTypes[extname(target)] || "application/octet-stream" });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "File not found." });
  }
}

async function readJsonBody(req) {
  const body = await readBody(req, 256 * 1024);
  try {
    return JSON.parse(body || "{}");
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    error.publicMessage = "Request body must be valid JSON.";
    throw error;
  }
}

async function optionalJsonBody(req) {
  const body = await readBody(req, 64 * 1024);
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    error.publicMessage = "Request body must be valid JSON.";
    throw error;
  }
}

export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}
