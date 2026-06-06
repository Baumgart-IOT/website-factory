import http from "node:http";
import { URL } from "node:url";
import { readFile } from "node:fs/promises";
import { extname, normalize } from "node:path";
import { createProject, listProjects, getProject, createMockBuild } from "./services/projectService.js";
import { listTemplates } from "./services/templateService.js";
import { uploadLogo } from "./services/uploadService.js";
import { ensureStorage } from "./storage/jsonStore.js";
import { readBody } from "./utils/http.js";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = new URL("../public/", import.meta.url);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

await ensureStorage();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
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

  const logoMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)\/logo$/);
  if (req.method === "POST" && logoMatch) {
    sendJson(res, 200, { project: await uploadLogo(req, logoMatch[1]) });
    return;
  }

  const buildMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)\/build$/);
  if (req.method === "POST" && buildMatch) {
    sendJson(res, 200, await createMockBuild(buildMatch[1]));
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const normalized = normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const fileUrl = new URL(`.${normalized}`, PUBLIC_DIR);

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

export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}
