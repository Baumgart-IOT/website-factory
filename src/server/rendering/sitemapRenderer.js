import { pageOutputPath } from "./pageRenderer.js";

export function renderSitemap(projectId, buildId, pages) {
  const urls = pages.map((page) => `/previews/${projectId}/${buildId}/${pageOutputPath(page).replace(/index\.html$/, "")}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${xmlEscape(url || "/")}</loc></url>`).join("\n")}
</urlset>
`;
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
