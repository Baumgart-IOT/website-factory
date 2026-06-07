import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { cleanupSmokeProjects } from "./testUtils.js";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const smokePrefix = "smoke-phase6-";
let serverProcess = null;

// Minimal valid 1x1 transparent PNG (signature + IHDR/IDAT/IEND), used as a safe test fixture.
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const PNG_BUFFER = Buffer.from(PNG_BASE64, "base64");
const SAFE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#176b5b"/><circle cx="16" cy="16" r="8" fill="#f9f3e8"/></svg>';
const UNSAFE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect onload="alert(2)" width="10" height="10"/></svg>';
const FAKE_PNG_WRONG_SIGNATURE = Buffer.from("this-is-not-actually-a-png-file-but-claims-to-be-one", "utf8");

try {
  await ensureServer();
  await cleanupSmokeProjects(smokePrefix);
  await runSmoke();
  console.log("Phase 6 smoke test passed.");
} finally {
  await cleanupSmokeProjects(smokePrefix).catch(() => {});
  if (serverProcess) serverProcess.kill();
}

async function runSmoke() {
  // 1. Baseline: existing validation script and project listing still work.
  await import("./validate-data.js");
  const projectsBefore = await get("/api/projects");
  const nonSmokeBefore = new Set(projectsBefore.projects.filter((project) => !project.config.business.name.startsWith(smokePrefix)).map((project) => project.id));

  const templates = await get("/api/templates");
  const template = templates.templates[0];

  const created = await post("/api/projects", {
    name: `${smokePrefix}${Date.now()}`,
    industry: "Media library and asset picker",
    goal: "Upload and select validated media instead of pasting raw URLs.",
    audience: "Non-technical website owners",
    palette: "forest",
    templateId: template.id,
    pages: ["Home", "Services", "Contact"]
  });
  const projectId = created.project.id;
  assert(projectId, "Project creation works");

  // 2. Media library starts empty for a new project.
  const emptyMedia = await get(`/api/projects/${projectId}/media`);
  assert(Array.isArray(emptyMedia.assets) && emptyMedia.assets.length === 0, "New project starts with an empty media library");

  // 3. Upload a valid PNG image asset.
  const pngUpload = await uploadMedia(projectId, "image", { filename: "hero-photo.png", contentType: "image/png", buffer: PNG_BUFFER });
  assert(pngUpload.asset?.assetId, "Uploading a valid PNG returns an asset record");
  assert(pngUpload.asset.kind === "image", "Uploaded PNG is recorded with the requested kind");
  assert(["pass", "warning"].includes(pngUpload.asset.validation?.status), "Uploaded PNG passes validation checks");
  assert(typeof pngUpload.asset.url === "string" && pngUpload.asset.url.startsWith(`/uploads/projects/${projectId}/`), "Uploaded PNG is served from the project media path");
  const imageAssetId = pngUpload.asset.assetId;

  // 4. Upload a valid sanitized SVG as a logo candidate.
  const svgUpload = await uploadMedia(projectId, "logo", { filename: "brand-mark.svg", contentType: "image/svg+xml", buffer: Buffer.from(SAFE_SVG, "utf8") });
  assert(svgUpload.asset?.assetId, "Uploading a sanitized SVG returns an asset record");
  assert(svgUpload.asset.kind === "logo", "Uploaded SVG is recorded with the logo kind");
  const logoAssetId = svgUpload.asset.assetId;

  // 5. Upload a valid favicon-kind PNG.
  const faviconUpload = await uploadMedia(projectId, "favicon", { filename: "favicon.png", contentType: "image/png", buffer: PNG_BUFFER });
  assert(faviconUpload.asset?.assetId, "Uploading a favicon-kind PNG returns an asset record");
  const faviconAssetId = faviconUpload.asset.assetId;

  // 6. Reject a file whose content does not match its declared/extension type (signature check).
  await assertRejected(
    () => uploadMedia(projectId, "image", { filename: "spoofed.png", contentType: "image/png", buffer: FAKE_PNG_WRONG_SIGNATURE }),
    /content does not match|signature|declared type/i,
    "Upload is rejected when file content does not match its declared type"
  );

  // 7. Reject a file with a dangerous/unsupported extension outright.
  await assertRejected(
    () => uploadMedia(projectId, "image", { filename: "payload.exe", contentType: "application/octet-stream", buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]) }),
    /not allowed|not supported/i,
    "Upload is rejected for dangerous or unsupported file extensions"
  );

  // 8. Reject an SVG that contains scripts/event handlers.
  await assertRejected(
    () => uploadMedia(projectId, "image", { filename: "evil.svg", contentType: "image/svg+xml", buffer: Buffer.from(UNSAFE_SVG, "utf8") }),
    /script|event handler|external reference/i,
    "Upload is rejected when an SVG contains scripts or event handlers"
  );

  // 9. Listing media now reflects only the successfully validated uploads.
  const listed = await get(`/api/projects/${projectId}/media`);
  assert(listed.assets.length === 3, "Media library lists exactly the three successfully validated uploads");
  assert(listed.assets.some((asset) => asset.assetId === imageAssetId), "Media list includes the uploaded image asset");
  assert(listed.assets.some((asset) => asset.assetId === logoAssetId), "Media list includes the uploaded logo asset");
  assert(listed.assets.some((asset) => asset.assetId === faviconAssetId), "Media list includes the uploaded favicon asset");

  // 10. Fetching a single media asset by id works.
  const singleAsset = await get(`/api/projects/${projectId}/media/${imageAssetId}`);
  assert(singleAsset.asset?.assetId === imageAssetId || singleAsset.assetId === imageAssetId, "Fetching a single media asset by id returns its record");

  // 11. The uploaded image is reachable over HTTP from the static media route.
  const assetResponse = await fetch(`${baseUrl}${pngUpload.asset.url}`);
  assert(assetResponse.ok, "Uploaded media asset is served over HTTP from the static project media route");
  assert((assetResponse.headers.get("content-type") || "").includes("image/png"), "Served media asset has the correct content type");

  // 12. Apply the uploaded logo and favicon to project branding via the config patch.
  const configured = await patch(`/api/projects/${projectId}/config`, {
    branding: {
      logoUrl: svgUpload.asset.url,
      logoAssetId,
      faviconUrl: faviconUpload.asset.url,
      faviconAssetId
    }
  });
  assert(configured.project.config.branding.logoAssetId === logoAssetId, "Config patch persists the selected logo asset id");
  assert(configured.project.config.branding.faviconAssetId === faviconAssetId, "Config patch persists the selected favicon asset id");

  // 13. Reference the uploaded image inside page content (hero image field) so renderer + verify checks exercise it.
  const initialized = await post(`/api/projects/${projectId}/content/initialize`);
  assert(initialized.content.pages.home, "Content initialization works for the media smoke project");
  const heroSection = initialized.content.pages.home.sections.find((section) => section.type === "hero");
  assert(heroSection, "Initialized home page has a hero section to attach media to");
  await patch(`/api/projects/${projectId}/content/pages/home/sections/${heroSection.id}`, {
    content: {
      ...heroSection.content,
      heading: "MJC6 Media Library Hero",
      imageUrl: pngUpload.asset.url
    }
  });

  // 14. Mark the image asset as in-use (asset usage tracking endpoint).
  const usage = await post(`/api/projects/${projectId}/media/${imageAssetId}/use`, { location: "content.pages.home.sections.hero.imageUrl" });
  assert(usage, "Marking a media asset as in-use succeeds");
  const usageReport = await get(`/api/projects/${projectId}/media/usage`);
  assert(usageReport, "Media usage report endpoint responds");

  // 15. Build the preview and confirm the generated HTML references the selected media.
  const build = await post(`/api/projects/${projectId}/build`);
  assert(build.build.status === "success", "Build preview works with media references in place");
  const buildDir = join(paths.previews, projectId, build.build.buildId);
  await stat(join(buildDir, "index.html"));
  const index = await readFile(join(buildDir, "index.html"), "utf8");
  assert(index.includes("MJC6 Media Library Hero"), "Generated index contains the hero heading referencing uploaded media");
  assert(index.includes(pngUpload.asset.url), "Generated index references the uploaded hero image URL");
  assert(index.includes(svgUpload.asset.url), "Generated index references the uploaded logo URL in the header");
  assert(index.includes(faviconUpload.asset.url) && /<link[^>]+rel="icon"/i.test(index), "Generated index includes a favicon link referencing the uploaded favicon");

  // 16. Verify agent passes media-reference checks with no blocking issues.
  const verify = await post(`/api/projects/${projectId}/agents/verify`);
  assert(!verify.agent.blockingIssues.some((issue) => /media|asset|logo|favicon/i.test(issue)), "Verify agent reports no blocking media-reference issues");

  // 17. Deleting an in-use asset is blocked unless forced; force delete then succeeds.
  await assertRejected(
    () => request(`/api/projects/${projectId}/media/${imageAssetId}`, { method: "DELETE" }),
    /in use/i,
    "Deleting a media asset that is referenced in content is blocked without force"
  );
  const forced = await request(`/api/projects/${projectId}/media/${imageAssetId}?force=true`, { method: "DELETE" });
  assert(forced, "Force-deleting an in-use media asset succeeds");

  const afterDelete = await get(`/api/projects/${projectId}/media`);
  assert(!afterDelete.assets.some((asset) => asset.assetId === imageAssetId), "Deleted media asset no longer appears in the media library");
  assert(afterDelete.assets.length === 2, "Media library reflects the remaining assets after deletion");

  // 18. Smoke cleanup removes phase 6 projects (and their media) without disturbing other projects.
  await cleanupSmokeProjects(smokePrefix);
  const projectsAfter = await get("/api/projects");
  assert(!projectsAfter.projects.some((project) => project.config.business.name.startsWith(smokePrefix)), "Smoke cleanup removes Phase 6 projects");
  for (const id of nonSmokeBefore) {
    assert(projectsAfter.projects.some((project) => project.id === id), "Smoke cleanup preserves non-smoke projects");
  }
}

async function uploadMedia(projectId, kind, file) {
  const body = new FormData();
  body.append("file", new Blob([file.buffer], { type: file.contentType }), file.filename);
  return request(`/api/projects/${projectId}/media?kind=${encodeURIComponent(kind)}`, { method: "POST", rawBody: body });
}

async function assertRejected(action, messagePattern, description) {
  try {
    await action();
  } catch (error) {
    assert(messagePattern.test(error.message), `${description} (error message: ${error.message})`);
    return;
  }
  throw new Error(`Smoke assertion failed: ${description} — request unexpectedly succeeded.`);
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
  const fetchOptions = { method: options.method || "GET" };
  if (options.rawBody) {
    fetchOptions.body = options.rawBody;
  } else if (options.body) {
    fetchOptions.headers = { "content-type": "application/json" };
    fetchOptions.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${path}`, fetchOptions);
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (payload.error || JSON.stringify(payload)) : payload;
    throw new Error(`${options.method || "GET"} ${path} failed: ${message}`);
  }
  return payload;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke assertion failed: ${message}`);
}
