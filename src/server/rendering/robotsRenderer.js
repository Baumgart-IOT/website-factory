export function renderRobots(projectId, buildId, includeSitemap = true) {
  return `User-agent: *
Allow: /
${includeSitemap ? `Sitemap: /previews/${projectId}/${buildId}/sitemap.xml` : ""}
`;
}
