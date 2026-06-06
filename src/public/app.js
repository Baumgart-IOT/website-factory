const state = {
  templates: [],
  projects: [],
  selectedProject: null,
  backups: [],
  builds: []
};

const els = {
  createForm: document.querySelector("#createProjectForm"),
  configForm: document.querySelector("#configForm"),
  logoForm: document.querySelector("#logoForm"),
  projectList: document.querySelector("#projectList"),
  projectCount: document.querySelector("#projectCount"),
  workspaceTitle: document.querySelector("#workspaceTitle"),
  notice: document.querySelector("#notice"),
  templateGrid: document.querySelector("#templateGrid"),
  templateSelect: document.querySelector("#templateSelect"),
  createTemplateId: document.querySelector("#createTemplateId"),
  pageChecks: document.querySelector("#pageChecks"),
  agentGrid: document.querySelector("#agentGrid"),
  backupList: document.querySelector("#backupList"),
  buildList: document.querySelector("#buildList"),
  buildSummary: document.querySelector("#buildSummary"),
  saveConfigButton: document.querySelector("#saveConfigButton"),
  uploadLogoButton: document.querySelector("#uploadLogoButton"),
  createBackupButton: document.querySelector("#createBackupButton"),
  buildButton: document.querySelector("#buildButton"),
  refreshButton: document.querySelector("#refreshButton")
};

await boot();

async function boot() {
  bindEvents();
  await refreshAll();
}

function bindEvents() {
  els.createForm.addEventListener("submit", createProject);
  els.configForm.addEventListener("submit", saveConfig);
  els.logoForm.addEventListener("submit", uploadLogo);
  els.createBackupButton.addEventListener("click", createBackup);
  els.buildButton.addEventListener("click", buildPreview);
  els.refreshButton.addEventListener("click", refreshAll);
}

async function refreshAll() {
  const [{ templates }, { projects }] = await Promise.all([api("/api/templates"), api("/api/projects")]);
  state.templates = templates;
  state.projects = projects;
  els.createTemplateId.value = templates[0]?.id || "";
  renderTemplateOptions();
  renderProjects();
  renderTemplates();
  if (state.selectedProject) await openProject(state.selectedProject.id);
  else renderEmptyDetail();
}

async function createProject(event) {
  event.preventDefault();
  const form = new FormData(els.createForm);
  const payload = Object.fromEntries(form.entries());
  payload.pages = form.getAll("pages");

  try {
    const { project } = await api("/api/projects", {
      method: "POST",
      body: payload
    });
    state.projects.unshift(project);
    await openProject(project.id);
    els.createForm.reset();
    els.createTemplateId.value = state.templates[0]?.id || "";
    showNotice("Project created.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function openProject(projectId) {
  const [{ project }, { backups }, { builds }] = await Promise.all([
    api(`/api/projects/${projectId}`),
    api(`/api/projects/${projectId}/backups`),
    api(`/api/projects/${projectId}/builds`)
  ]);
  state.selectedProject = project;
  state.backups = backups;
  state.builds = builds;
  upsertProject(project);
  renderProjects();
  renderDetail();
}

async function saveConfig(event) {
  event.preventDefault();
  if (!state.selectedProject) return;

  const form = new FormData(els.configForm);
  const patch = {
    business: {
      name: text(form, "business.name"),
      tagline: text(form, "business.tagline"),
      industry: text(form, "business.industry"),
      location: text(form, "business.location"),
      email: text(form, "business.email"),
      phone: text(form, "business.phone")
    },
    branding: {
      primaryColor: text(form, "branding.primaryColor"),
      accentColor: text(form, "branding.accentColor"),
      darkMode: form.get("branding.darkMode") === "on"
    },
    template: {
      selected: text(form, "template.selected"),
      animationLevel: text(form, "template.animationLevel")
    },
    pages: form.getAll("pages"),
    seo: {
      title: text(form, "seo.title"),
      description: text(form, "seo.description")
    }
  };

  try {
    const { project } = await api(`/api/projects/${state.selectedProject.id}/config`, {
      method: "PATCH",
      body: patch
    });
    await openProject(project.id);
    showNotice("Config saved and pre-change backup created.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function uploadLogo(event) {
  event.preventDefault();
  if (!state.selectedProject) return;
  const file = new FormData(els.logoForm).get("logo");
  if (!file || !file.size) return showNotice("Choose a PNG or SVG logo first.");
  if (!["image/png", "image/svg+xml"].includes(file.type) || file.size > 1024 * 1024) {
    return showNotice("Logo must be a PNG or SVG file and 1 MB or smaller.");
  }

  const body = new FormData();
  body.append("logo", file);
  try {
    const { project } = await api(`/api/projects/${state.selectedProject.id}/logo`, { method: "POST", rawBody: body });
    await openProject(project.id);
    els.logoForm.reset();
    showNotice("Logo uploaded with validation and backup.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function createBackup() {
  if (!state.selectedProject) return;
  try {
    await api(`/api/projects/${state.selectedProject.id}/backups`, {
      method: "POST",
      body: { reason: "manual-dashboard" }
    });
    await openProject(state.selectedProject.id);
    showNotice("Backup created.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function restoreBackup(backupId) {
  if (!state.selectedProject) return;
  try {
    const result = await api(`/api/projects/${state.selectedProject.id}/rollback/${backupId}`, { method: "POST" });
    await openProject(result.project.id);
    showNotice(`Restored backup ${backupId}.`);
  } catch (error) {
    showNotice(error.message);
  }
}

async function runAgent(agentName) {
  if (!state.selectedProject) return;
  try {
    const { project } = await api(`/api/projects/${state.selectedProject.id}/agents/${agentName}`, { method: "POST" });
    state.selectedProject = project;
    upsertProject(project);
    renderProjects();
    renderDetail();
    showNotice(`${agentName} agent completed.`);
  } catch (error) {
    showNotice(error.message);
  }
}

async function buildPreview() {
  if (!state.selectedProject) return;
  try {
    const { project, build } = await api(`/api/projects/${state.selectedProject.id}/build`, { method: "POST" });
    await openProject(project.id);
    showNotice(`Build ${build.buildId} created.`);
  } catch (error) {
    showNotice(error.message);
  }
}

function renderProjects() {
  els.projectCount.textContent = state.projects.length;
  if (!state.projects.length) {
    els.projectList.innerHTML = `<p class="empty">No projects yet.</p>`;
    return;
  }

  els.projectList.innerHTML = state.projects.map((project) => {
    const latestBuild = project.builds?.[0];
    const agentSummary = Object.values(project.agents || {}).filter((agent) => agent.status === "pass").length;
    return `
      <article class="project-item ${state.selectedProject?.id === project.id ? "active" : ""}">
        <div>
          <strong>${escapeHtml(project.config.business.name)}</strong>
          <p>${escapeHtml(project.config.business.industry || "No industry")} · ${escapeHtml(project.config.template.selected)}</p>
          <p>Updated ${formatDate(project.updatedAt)}</p>
        </div>
        <div class="project-meta">
          <span class="pill">${escapeHtml(latestBuild?.status || "not built")}</span>
          <span class="pill">${agentSummary}/4 agents pass</span>
        </div>
        <button type="button" data-open-project="${project.id}">Open/Edit</button>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-open-project]").forEach((button) => {
    button.addEventListener("click", () => openProject(button.dataset.openProject));
  });
}

function renderDetail() {
  const project = state.selectedProject;
  const config = project.config;
  els.workspaceTitle.textContent = config.business.name;
  els.saveConfigButton.disabled = false;
  els.uploadLogoButton.disabled = false;
  els.createBackupButton.disabled = false;
  els.buildButton.disabled = false;

  setField("business.name", config.business.name);
  setField("business.tagline", config.business.tagline);
  setField("business.industry", config.business.industry);
  setField("business.location", config.business.location);
  setField("business.email", config.business.email);
  setField("business.phone", config.business.phone);
  setField("branding.primaryColor", config.branding.primaryColor || "#176b5b");
  setField("branding.accentColor", config.branding.accentColor || "#d88c4a");
  setField("template.selected", config.template.selected);
  setField("template.animationLevel", config.template.animationLevel || "standard");
  setField("seo.title", config.seo.title);
  setField("seo.description", config.seo.description);
  els.configForm.elements["branding.darkMode"].checked = Boolean(config.branding.darkMode);

  renderPages(config.pages || []);
  renderTemplates(config.template.selected);
  renderAgents(project.agents);
  renderBackups();
  renderBuilds();
}

function renderEmptyDetail() {
  els.workspaceTitle.textContent = "Select or create a project";
  els.saveConfigButton.disabled = true;
  els.uploadLogoButton.disabled = true;
  els.createBackupButton.disabled = true;
  els.buildButton.disabled = true;
  renderPages([]);
  renderAgents();
  els.backupList.innerHTML = `<p class="empty">No project selected.</p>`;
  els.buildList.innerHTML = `<p class="empty">No project selected.</p>`;
  els.buildSummary.innerHTML = `<p class="empty">No build yet.</p>`;
}

function renderTemplateOptions() {
  els.templateSelect.innerHTML = state.templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`).join("");
}

function renderTemplates(selected = state.selectedProject?.config?.template?.selected || state.templates[0]?.id) {
  els.templateGrid.innerHTML = state.templates.map((template) => `
    <article class="template-card ${template.id === selected ? "selected" : ""}">
      <div class="template-preview" aria-hidden="true"></div>
      <h4>${escapeHtml(template.name)}</h4>
      <p><strong>${escapeHtml(template.category)}</strong></p>
      <p>${escapeHtml(template.description || template.previewTone)}</p>
      <p>${escapeHtml(template.bestUseCase || template.recommendedFor)}</p>
      <div class="template-actions">
        <span class="status-badge">${escapeHtml(template.pages.length)} pages</span>
        <button type="button" data-select-template="${template.id}">Select</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-select-template]").forEach((button) => {
    button.addEventListener("click", () => {
      els.templateSelect.value = button.dataset.selectTemplate;
      showNotice("Template selected. Save config to persist it.");
    });
  });
}

function renderPages(selectedPages) {
  const defaults = ["Home", "Services", "About", "Pricing", "Case Studies", "Gallery", "Blog", "FAQ", "Contact"];
  const pages = [...new Set([...defaults, ...selectedPages])];
  els.pageChecks.innerHTML = pages.map((page) => `
    <label><input type="checkbox" name="pages" value="${escapeHtml(page)}" ${selectedPages.includes(page) ? "checked" : ""}> ${escapeHtml(page)}</label>
  `).join("");
}

function renderAgents(agents = null) {
  const source = agents || {
    recon: blankAgent("Recon"),
    security: blankAgent("Security"),
    verify: blankAgent("Verify"),
    backup: blankAgent("Backup")
  };

  els.agentGrid.innerHTML = Object.entries(source).map(([name, agent]) => `
    <article class="agent-card">
      <h4>${escapeHtml(agent.label)}</h4>
      <span class="status-badge ${escapeHtml(agent.status)}">${escapeHtml(agent.status)}</span>
      <p>Last run: ${agent.lastRun ? formatDate(agent.lastRun) : "Never"}</p>
      <p>Blocking: ${agent.blockingIssues?.length || 0} · Warnings: ${agent.warnings?.length || 0} · Recommendations: ${agent.recommendations?.length || 0}</p>
      <div class="agent-actions"><button type="button" data-run-agent="${name}" ${state.selectedProject ? "" : "disabled"}>Run</button></div>
    </article>
  `).join("");

  document.querySelectorAll("[data-run-agent]").forEach((button) => {
    button.addEventListener("click", () => runAgent(button.dataset.runAgent));
  });
}

function renderBackups() {
  if (!state.backups.length) {
    els.backupList.innerHTML = `<p class="empty">No backups yet.</p>`;
    return;
  }

  els.backupList.innerHTML = state.backups.map((backup) => `
    <article class="record-card">
      <h4>${escapeHtml(backup.reason)}</h4>
      <p>${formatDate(backup.createdAt)}</p>
      <p>${escapeHtml(backup.backupId)}</p>
      <div class="record-actions"><button type="button" data-restore-backup="${backup.backupId}">Restore</button></div>
    </article>
  `).join("");

  document.querySelectorAll("[data-restore-backup]").forEach((button) => {
    button.addEventListener("click", () => restoreBackup(button.dataset.restoreBackup));
  });
}

function renderBuilds() {
  const latest = state.builds[0] || state.selectedProject?.builds?.[0];
  els.buildSummary.innerHTML = latest ? `
    <p><strong>Status:</strong> ${escapeHtml(latest.status)}</p>
    <p><strong>Last build ID:</strong> ${escapeHtml(latest.buildId)}</p>
    <p><strong>Preview path:</strong> <a href="${escapeHtml(latest.previewPath)}" target="_blank" rel="noreferrer">${escapeHtml(latest.previewPath)}</a></p>
    <p><strong>Generated files:</strong> ${escapeHtml((latest.generatedFiles || []).join(", ") || "No file list recorded")}</p>
    <p><strong>Log summary:</strong> ${escapeHtml((latest.logs || []).join(" "))}</p>
    <div class="record-actions"><a class="button-link" href="${escapeHtml(latest.previewPath)}" target="_blank" rel="noreferrer">Open Preview</a></div>
  ` : `<p class="empty">No build yet.</p>`;

  els.buildList.innerHTML = state.builds.length ? state.builds.map((build) => `
    <article class="record-card">
      <h4>${escapeHtml(build.status)}</h4>
      <p>${formatDate(build.createdAt)}</p>
      <p>${escapeHtml(build.buildId)}</p>
      <div class="record-actions"><a href="${escapeHtml(build.previewPath)}" target="_blank" rel="noreferrer">Open Preview</a></div>
    </article>
  `).join("") : `<p class="empty">No builds yet.</p>`;
}

function upsertProject(project) {
  const index = state.projects.findIndex((item) => item.id === project.id);
  if (index >= 0) state.projects[index] = project;
  else state.projects.unshift(project);
}

async function api(path, options = {}) {
  const fetchOptions = { method: options.method || "GET" };
  if (options.rawBody) {
    fetchOptions.body = options.rawBody;
  } else if (options.body) {
    fetchOptions.headers = { "content-type": "application/json" };
    fetchOptions.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, fetchOptions);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function setField(name, value) {
  const field = els.configForm.elements[name];
  if (field) field.value = value || "";
}

function text(form, name) {
  return String(form.get(name) || "").trim();
}

function showNotice(message) {
  els.notice.hidden = false;
  els.notice.textContent = message;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => { els.notice.hidden = true; }, 5000);
}

function blankAgent(label) {
  return { label, status: "pending", lastRun: null, blockingIssues: [], warnings: [], recommendations: [] };
}

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
