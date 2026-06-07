const state = {
  templates: [],
  projects: [],
  selectedProject: null,
  backups: [],
  builds: [],
  content: null,
  selectedPageKey: null,
  selectedSectionId: null,
  contentDirty: false,
  loading: false
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
  contentDirtyIndicator: document.querySelector("#contentDirtyIndicator"),
  contentError: document.querySelector("#contentError"),
  contentPageSelect: document.querySelector("#contentPageSelect"),
  initializeContentButton: document.querySelector("#initializeContentButton"),
  pageForm: document.querySelector("#pageForm"),
  savePageButton: document.querySelector("#savePageButton"),
  deletePageButton: document.querySelector("#deletePageButton"),
  addPageForm: document.querySelector("#addPageForm"),
  addPageButton: document.querySelector("#addPageButton"),
  sectionSelect: document.querySelector("#sectionSelect"),
  sectionTypeSelect: document.querySelector("#sectionTypeSelect"),
  sectionForm: document.querySelector("#sectionForm"),
  sectionFields: document.querySelector("#sectionFields"),
  advancedJson: document.querySelector(".advanced-json"),
  saveAndBuildSectionButton: document.querySelector("#saveAndBuildSectionButton"),
  buildContentButton: document.querySelector("#buildContentButton"),
  openLatestPreviewButton: document.querySelector("#openLatestPreviewButton"),
  saveSectionButton: document.querySelector("#saveSectionButton"),
  addSectionButton: document.querySelector("#addSectionButton"),
  moveSectionUpButton: document.querySelector("#moveSectionUpButton"),
  moveSectionDownButton: document.querySelector("#moveSectionDownButton"),
  deleteSectionButton: document.querySelector("#deleteSectionButton"),
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
  els.initializeContentButton.addEventListener("click", initializeContent);
  els.contentPageSelect.addEventListener("change", () => {
    if (!confirmDiscardUnsaved()) {
      els.contentPageSelect.value = state.selectedPageKey || "";
      return;
    }
    state.selectedPageKey = els.contentPageSelect.value;
    state.selectedSectionId = null;
    renderContentEditor();
  });
  els.pageForm.addEventListener("submit", savePage);
  els.deletePageButton.addEventListener("click", deletePage);
  els.addPageForm.addEventListener("submit", addPage);
  els.sectionSelect.addEventListener("change", () => {
    if (!confirmDiscardUnsaved()) {
      els.sectionSelect.value = state.selectedSectionId || "";
      return;
    }
    state.selectedSectionId = els.sectionSelect.value;
    renderSectionEditor();
  });
  els.sectionTypeSelect.addEventListener("change", () => {
    if (!confirmDiscardUnsaved()) {
      const section = getSelectedSection();
      els.sectionTypeSelect.value = section?.type || "hero";
      return;
    }
    renderSectionEditorFields({ type: els.sectionTypeSelect.value, content: defaultSectionContent(els.sectionTypeSelect.value) });
    markContentDirty();
  });
  els.pageForm.addEventListener("input", markContentDirty);
  els.sectionForm.addEventListener("input", markContentDirty);
  els.sectionForm.addEventListener("submit", saveSection);
  els.sectionFields.addEventListener("click", handleSectionFieldClick);
  els.saveAndBuildSectionButton.addEventListener("click", saveSectionAndBuild);
  els.buildContentButton.addEventListener("click", buildPreview);
  els.openLatestPreviewButton.addEventListener("click", openLatestPreview);
  els.addSectionButton.addEventListener("click", addSection);
  els.moveSectionUpButton.addEventListener("click", () => moveSection("up"));
  els.moveSectionDownButton.addEventListener("click", () => moveSection("down"));
  els.deleteSectionButton.addEventListener("click", deleteSection);
  els.createBackupButton.addEventListener("click", createBackup);
  els.buildButton.addEventListener("click", buildPreview);
  els.refreshButton.addEventListener("click", refreshAll);
  window.addEventListener("beforeunload", (event) => {
    if (!state.contentDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
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
  const [{ project }, { backups }, { builds }, contentResponse] = await Promise.all([
    api(`/api/projects/${projectId}`),
    api(`/api/projects/${projectId}/backups`),
    api(`/api/projects/${projectId}/builds`),
    api(`/api/projects/${projectId}/content`)
  ]);
  state.selectedProject = project;
  state.backups = backups;
  state.builds = builds;
  state.content = contentResponse.content;
  state.selectedPageKey ||= Object.keys(state.content.pages)[0];
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
    setLoading(true, `${agentName} agent running...`);
    const { project } = await api(`/api/projects/${state.selectedProject.id}/agents/${agentName}`, { method: "POST" });
    state.selectedProject = project;
    upsertProject(project);
    renderProjects();
    renderDetail();
    showNotice(`${agentName} agent completed.`);
  } catch (error) {
    showNotice(error.message);
  } finally {
    setLoading(false);
  }
}

async function buildPreview() {
  if (!state.selectedProject) return;
  if (state.contentDirty && !window.confirm("You have unsaved content changes. Build the last saved content anyway?")) return;
  try {
    setLoading(true, "Building preview...");
    const { project, build } = await api(`/api/projects/${state.selectedProject.id}/build`, { method: "POST" });
    await openProject(project.id);
    showNotice(`Build ${build.buildId} created.`);
  } catch (error) {
    showNotice(error.message);
  } finally {
    setLoading(false);
  }
}

async function saveSectionAndBuild() {
  const saved = await saveSection();
  if (saved) await buildPreview();
}

function openLatestPreview() {
  const latest = state.builds[0] || state.selectedProject?.builds?.[0];
  if (!latest?.previewPath) {
    showNotice("No preview exists yet. Build a preview first.");
    return;
  }
  window.open(latest.previewPath, "_blank", "noreferrer");
}

async function initializeContent() {
  if (!state.selectedProject) return;
  try {
    const { project, content } = await api(`/api/projects/${state.selectedProject.id}/content/initialize`, { method: "POST" });
    state.selectedProject = project;
    state.content = content;
    state.selectedPageKey = "home";
    state.selectedSectionId = null;
    renderContentEditor();
    showNotice("Content initialized from project config.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function addPage(event) {
  event.preventDefault();
  if (!state.selectedProject) return;
  const title = text(new FormData(els.addPageForm), "title");
  if (!title) return showNotice("Add a page title first.");
  try {
    const { content, pageKey } = await api(`/api/projects/${state.selectedProject.id}/content/pages`, {
      method: "POST",
      body: { title }
    });
    state.content = content;
    state.selectedPageKey = pageKey;
    state.selectedSectionId = null;
    els.addPageForm.reset();
    renderContentEditor();
    showNotice("Page added.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function savePage(event) {
  event.preventDefault();
  if (!state.selectedProject || !state.selectedPageKey) return;
  const form = new FormData(els.pageForm);
  try {
    setLoading(true, "Saving page...");
    const { content } = await api(`/api/projects/${state.selectedProject.id}/content/pages/${state.selectedPageKey}`, {
      method: "PATCH",
      body: {
        title: text(form, "page.title"),
        slug: text(form, "page.slug"),
        seo: {
          title: text(form, "page.seo.title"),
          description: text(form, "page.seo.description")
        }
      }
    });
    state.content = content;
    setContentDirty(false);
    renderContentEditor();
    showNotice("Page metadata saved.");
  } catch (error) {
    showNotice(error.message);
  } finally {
    setLoading(false);
  }
}

async function deletePage() {
  if (!state.selectedProject || !state.selectedPageKey) return;
  try {
    const { content } = await api(`/api/projects/${state.selectedProject.id}/content/pages/${state.selectedPageKey}`, { method: "DELETE" });
    state.content = content;
    state.selectedPageKey = Object.keys(content.pages)[0];
    state.selectedSectionId = null;
    renderContentEditor();
    showNotice("Page deleted.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function addSection() {
  if (!state.selectedProject || !state.selectedPageKey) return;
  const type = els.sectionTypeSelect.value || "hero";
  try {
    const { content, section } = await api(`/api/projects/${state.selectedProject.id}/content/pages/${state.selectedPageKey}/sections`, {
      method: "POST",
      body: { type, content: defaultSectionContent(type) }
    });
    state.content = content;
    state.selectedSectionId = section.id;
    renderContentEditor();
    showNotice("Section added.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function saveSection(event) {
  event?.preventDefault();
  if (!state.selectedProject || !state.selectedPageKey || !state.selectedSectionId) return;
  const form = new FormData(els.sectionForm);
  let content;
  try {
    content = collectSectionEditorValues(text(form, "section.type"), els.sectionForm);
  } catch (error) {
    showContentError(error.message);
    return false;
  }
  try {
    setLoading(true, "Saving section...");
    const { content: updated } = await api(`/api/projects/${state.selectedProject.id}/content/pages/${state.selectedPageKey}/sections/${state.selectedSectionId}`, {
      method: "PATCH",
      body: {
        type: text(form, "section.type"),
        enabled: form.get("section.enabled") === "on",
        order: Number(text(form, "section.order")),
        content
      }
    });
    state.content = updated;
    setContentDirty(false);
    clearContentError();
    renderContentEditor();
    showNotice("Section saved.");
    return true;
  } catch (error) {
    showContentError(error.message);
    showNotice(error.message);
    return false;
  } finally {
    setLoading(false);
  }
}

async function moveSection(direction) {
  if (!state.selectedProject || !state.selectedPageKey || !state.selectedSectionId) return;
  try {
    const { content } = await api(`/api/projects/${state.selectedProject.id}/content/pages/${state.selectedPageKey}/sections/${state.selectedSectionId}/move`, {
      method: "POST",
      body: { direction }
    });
    state.content = content;
    renderContentEditor();
    showNotice(`Section moved ${direction}.`);
  } catch (error) {
    showNotice(error.message);
  }
}

async function deleteSection() {
  if (!state.selectedProject || !state.selectedPageKey || !state.selectedSectionId) return;
  try {
    const { content } = await api(`/api/projects/${state.selectedProject.id}/content/pages/${state.selectedPageKey}/sections/${state.selectedSectionId}`, { method: "DELETE" });
    state.content = content;
    state.selectedSectionId = null;
    renderContentEditor();
    showNotice("Section deleted.");
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
    button.addEventListener("click", () => {
      if (!confirmDiscardUnsaved()) return;
      openProject(button.dataset.openProject);
    });
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
  renderContentEditor();
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
  renderContentEditor();
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

function renderContentEditor() {
  const enabled = Boolean(state.selectedProject && state.content);
  [
    els.initializeContentButton,
    els.savePageButton,
    els.deletePageButton,
    els.addPageButton,
    els.saveSectionButton,
    els.addSectionButton,
    els.moveSectionUpButton,
    els.moveSectionDownButton,
    els.deleteSectionButton,
    els.saveAndBuildSectionButton,
    els.buildContentButton,
    els.openLatestPreviewButton
  ].forEach((button) => { button.disabled = !enabled; });

  els.sectionTypeSelect.innerHTML = supportedSectionTypes().map((type) => `<option value="${type}">${type}</option>`).join("");

  if (!enabled) {
    els.contentPageSelect.innerHTML = "";
    els.sectionSelect.innerHTML = "";
    els.pageForm.reset();
    els.sectionForm.reset();
    return;
  }

  const entries = Object.entries(state.content.pages);
  if (!state.selectedPageKey || !state.content.pages[state.selectedPageKey]) state.selectedPageKey = entries[0]?.[0] || null;
  els.contentPageSelect.innerHTML = entries.map(([key, page]) => `<option value="${escapeHtml(key)}" ${key === state.selectedPageKey ? "selected" : ""}>${escapeHtml(page.title)}</option>`).join("");

  const page = state.content.pages[state.selectedPageKey];
  if (!page) return;
  setPageField("page.title", page.title);
  setPageField("page.slug", page.slug);
  setPageField("page.seo.title", page.seo?.title || "");
  setPageField("page.seo.description", page.seo?.description || "");
  els.deletePageButton.disabled = !enabled || state.selectedPageKey === "home" || entries.length <= 1;

  renderSectionEditor();
}

function renderSectionEditor() {
  const page = state.content?.pages?.[state.selectedPageKey];
  const sections = page?.sections || [];
  if (!state.selectedSectionId || !sections.some((section) => section.id === state.selectedSectionId)) {
    state.selectedSectionId = sections[0]?.id || null;
  }

  els.sectionSelect.innerHTML = sections.map((section) => `<option value="${escapeHtml(section.id)}" ${section.id === state.selectedSectionId ? "selected" : ""}>${escapeHtml(section.order)}. ${escapeHtml(section.type)} ${section.enabled ? "" : "(disabled)"}</option>`).join("");

  const section = sections.find((item) => item.id === state.selectedSectionId);
  const hasSection = Boolean(section);
  els.saveSectionButton.disabled = !hasSection;
  els.saveAndBuildSectionButton.disabled = !hasSection;
  els.moveSectionUpButton.disabled = !hasSection;
  els.moveSectionDownButton.disabled = !hasSection;
  els.deleteSectionButton.disabled = !hasSection;
  els.openLatestPreviewButton.disabled = !Boolean((state.builds[0] || state.selectedProject?.builds?.[0])?.previewPath);
  if (!section) {
    els.sectionForm.reset();
    els.sectionFields.innerHTML = `<p class="empty">Add a section to start editing content.</p>`;
    return;
  }

  els.sectionTypeSelect.value = section.type;
  els.sectionForm.elements["section.order"].value = section.order;
  els.sectionForm.elements["section.enabled"].checked = section.enabled;
  els.sectionForm.elements["section.content"].value = JSON.stringify(section.content || {}, null, 2);
  renderSectionEditorFields(section);
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

function setPageField(name, value) {
  const field = els.pageForm.elements[name];
  if (field) field.value = value || "";
}

function renderSectionEditorFields(section) {
  const schema = getSectionEditorSchema(section.type);
  const content = { ...defaultSectionContent(section.type), ...(section.content || {}) };
  els.sectionFields.innerHTML = `
    <div class="section-schema-grid">
      ${schema.fields.map((field) => renderField(field, content[field.name])).join("")}
    </div>
    ${schema.arrays.map((array) => renderArrayEditor(array, content[array.name] || [])).join("")}
  `;
  els.sectionForm.elements["section.content"].value = JSON.stringify(content, null, 2);
  els.sectionFields.querySelectorAll("input, textarea, select").forEach((field) => {
    field.addEventListener("input", () => {
      syncAdvancedJsonFromForm();
      markContentDirty();
    });
    field.addEventListener("change", () => {
      syncAdvancedJsonFromForm();
      markContentDirty();
    });
  });
}

function renderField(field, value) {
  if (field.kind === "textarea") return renderTextarea(field.name, field.label, value || "");
  if (field.kind === "checkbox") return renderCheckbox(field.name, field.label, Boolean(value));
  if (field.kind === "select") return renderSelect(field.name, field.label, field.options, value || field.options[0]);
  return renderTextInput(field.name, field.label, value || "");
}

function renderTextInput(name, label, value = "") {
  return `<label>${escapeHtml(label)} <input data-field="${escapeHtml(name)}" value="${escapeHtml(value)}" /></label>`;
}

function renderTextarea(name, label, value = "") {
  return `<label>${escapeHtml(label)} <textarea data-field="${escapeHtml(name)}" rows="3">${escapeHtml(value)}</textarea></label>`;
}

function renderCheckbox(name, label, checked = false) {
  return `<label class="toggle-row"><input data-field="${escapeHtml(name)}" type="checkbox" ${checked ? "checked" : ""} /> ${escapeHtml(label)}</label>`;
}

function renderSelect(name, label, options, value = "") {
  return `<label>${escapeHtml(label)} <select data-field="${escapeHtml(name)}">${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
}

function renderArrayEditor(array, items) {
  const normalized = Array.isArray(items) ? items : [];
  return `<section class="array-editor" data-array="${escapeHtml(array.name)}">
    <div class="array-editor-heading">
      <h4>${escapeHtml(array.label)}</h4>
      <button type="button" data-array-action="add" data-array="${escapeHtml(array.name)}">Add item</button>
    </div>
    <div class="array-items">
      ${normalized.map((item, index) => renderArrayItem(array, item, index)).join("") || `<p class="empty">No items yet.</p>`}
    </div>
  </section>`;
}

function renderArrayItem(array, item, index) {
  const value = denormalizeArrayItem(array, item);
  return `<article class="array-item" data-array="${escapeHtml(array.name)}" data-index="${index}">
    <div class="array-item-actions">
      <strong>${escapeHtml(array.itemLabel)} ${index + 1}</strong>
      <button type="button" data-array-action="up" data-array="${escapeHtml(array.name)}" data-index="${index}">Up</button>
      <button type="button" data-array-action="down" data-array="${escapeHtml(array.name)}" data-index="${index}">Down</button>
      <button type="button" data-array-action="remove" data-array="${escapeHtml(array.name)}" data-index="${index}">Remove</button>
    </div>
    <div class="form-grid">
      ${array.fields.map((field) => renderArrayField(array.name, index, field, value[field.name])).join("")}
    </div>
  </article>`;
}

function renderArrayField(arrayName, index, field, value) {
  const attr = `data-array-field="${escapeHtml(arrayName)}" data-index="${index}" data-field="${escapeHtml(field.name)}"`;
  if (field.kind === "textarea") return `<label>${escapeHtml(field.label)} <textarea ${attr} rows="3">${escapeHtml(value || "")}</textarea></label>`;
  if (field.kind === "checkbox") return `<label class="toggle-row"><input ${attr} type="checkbox" ${value ? "checked" : ""} /> ${escapeHtml(field.label)}</label>`;
  if (field.kind === "select") return `<label>${escapeHtml(field.label)} <select ${attr}>${field.options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  return `<label>${escapeHtml(field.label)} <input ${attr} value="${escapeHtml(value || "")}" /></label>`;
}

function handleSectionFieldClick(event) {
  const button = event.target.closest("[data-array-action]");
  if (!button) return;
  const arrayName = button.dataset.array;
  const action = button.dataset.arrayAction;
  const index = Number(button.dataset.index);
  const section = getSelectedSection();
  if (!section) return;
  const content = collectSectionEditorValues(els.sectionTypeSelect.value, els.sectionForm, { allowAdvancedJson: false });
  const schema = getSectionEditorSchema(els.sectionTypeSelect.value);
  const array = schema.arrays.find((item) => item.name === arrayName);
  content[arrayName] = Array.isArray(content[arrayName]) ? content[arrayName] : [];
  if (action === "add") content[arrayName] = addArrayItem(content[arrayName], defaultArrayItem(array));
  if (action === "remove") content[arrayName] = removeArrayItem(content[arrayName], index);
  if (action === "up") content[arrayName] = moveArrayItem(content[arrayName], index, -1);
  if (action === "down") content[arrayName] = moveArrayItem(content[arrayName], index, 1);
  renderSectionEditorFields({ type: els.sectionTypeSelect.value, content });
  markContentDirty();
}

function moveArrayItem(items, index, delta) {
  const copy = [...items];
  const target = index + delta;
  if (target < 0 || target >= copy.length) return copy;
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function addArrayItem(items, item) {
  return [...items, item];
}

function removeArrayItem(items, index) {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function collectSectionEditorValues(sectionType, formElement, options = {}) {
  const schema = getSectionEditorSchema(sectionType);
  const content = {};

  for (const field of schema.fields) {
    const input = formElement.querySelector(`[data-field="${field.name}"]:not([data-array-field])`);
    if (!input) continue;
    content[field.name] = readInputValue(input, field);
  }

  for (const array of schema.arrays) {
    const items = [];
    formElement.querySelectorAll(`.array-item[data-array="${array.name}"]`).forEach((itemEl) => {
      const item = {};
      for (const field of array.fields) {
        const input = itemEl.querySelector(`[data-array-field="${array.name}"][data-field="${field.name}"]`);
        if (input) item[field.name] = readInputValue(input, field);
      }
      items.push(normalizeArrayItem(array, item));
    });
    content[array.name] = items;
  }

  if (options.allowAdvancedJson !== false && els.advancedJson?.open) {
    let advanced;
    try {
      advanced = JSON.parse(text(new FormData(formElement), "section.content") || "{}");
    } catch {
      throw new Error("Advanced JSON editor contains invalid JSON.");
    }
    Object.assign(content, advanced);
  }

  validateSectionEditorValues(sectionType, content);
  return content;
}

function readInputValue(input, field) {
  if (field.kind === "checkbox") return Boolean(input.checked);
  return String(input.value || "").trim();
}

function syncAdvancedJsonFromForm() {
  try {
    const content = collectSectionEditorValues(els.sectionTypeSelect.value, els.sectionForm, { allowAdvancedJson: false });
    els.sectionForm.elements["section.content"].value = JSON.stringify(content, null, 2);
    clearContentError();
  } catch (error) {
    showContentError(error.message);
  }
}

function validateSectionEditorValues(sectionType, content) {
  const schema = getSectionEditorSchema(sectionType);
  for (const array of schema.arrays) {
    if (!Array.isArray(content[array.name])) throw new Error(`${array.label} must be an array.`);
  }
  for (const [key, value] of Object.entries(content)) {
    if (/url$/i.test(key) && value && !isValidUrl(value)) throw new Error(`${key} must be an internal path or http/https URL.`);
    if (/email/i.test(key) && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`${key} must be a reasonable email address.`);
  }
  if (sectionType === "quote_request") {
    const allowed = new Set(["text", "email", "phone", "textarea", "select", "checkbox"]);
    for (const field of content.fields || []) {
      if (!allowed.has(field.type)) throw new Error("Quote request field type is not supported.");
      if (typeof field.required !== "boolean") throw new Error("Quote request required values must be booleans.");
    }
  }
}

function isValidUrl(value) {
  return value.startsWith("/") || value.startsWith("#") || /^https?:\/\/[^\s<>"']+$/i.test(value);
}

function getSectionEditorSchema(sectionType) {
  const textField = (name, label) => ({ name, label, kind: "text" });
  const area = (name, label) => ({ name, label, kind: "textarea" });
  const checkbox = (name, label) => ({ name, label, kind: "checkbox" });
  const select = (name, label, options) => ({ name, label, kind: "select", options });
  const schemas = {
    hero: {
      fields: [textField("eyebrow", "Eyebrow"), textField("heading", "Heading"), textField("subheading", "Subheading"), area("body", "Body"), textField("primaryButtonText", "Primary button text"), textField("primaryButtonUrl", "Primary button URL"), textField("secondaryButtonText", "Secondary button text"), textField("secondaryButtonUrl", "Secondary button URL"), textField("imageUrl", "Image URL")],
      arrays: []
    },
    services: {
      fields: [textField("heading", "Heading"), textField("subheading", "Subheading")],
      arrays: [{ name: "items", label: "Service Items", itemLabel: "Service", fields: [textField("title", "Title"), area("description", "Description"), textField("icon", "Icon")] }]
    },
    about: {
      fields: [textField("heading", "Heading"), area("body", "Body")],
      arrays: [{ name: "highlights", label: "Highlights", itemLabel: "Highlight", fields: [textField("text", "Text")] }]
    },
    process: {
      fields: [textField("heading", "Heading")],
      arrays: [{ name: "steps", label: "Steps", itemLabel: "Step", fields: [textField("title", "Title"), area("description", "Description")] }]
    },
    projects: {
      fields: [textField("heading", "Heading")],
      arrays: [{ name: "items", label: "Project Items", itemLabel: "Project", fields: [textField("title", "Title"), area("description", "Description"), textField("imageUrl", "Image URL"), textField("linkUrl", "Link URL")] }]
    },
    gallery: {
      fields: [textField("heading", "Heading")],
      arrays: [{ name: "images", label: "Images", itemLabel: "Image", fields: [textField("imageUrl", "Image URL"), textField("alt", "Alt text")] }]
    },
    testimonials: {
      fields: [textField("heading", "Heading")],
      arrays: [{ name: "items", label: "Testimonials", itemLabel: "Testimonial", fields: [area("quote", "Quote"), textField("name", "Name"), textField("role", "Role")] }]
    },
    faq: {
      fields: [textField("heading", "Heading")],
      arrays: [{ name: "items", label: "FAQ Items", itemLabel: "FAQ", fields: [textField("question", "Question"), area("answer", "Answer")] }]
    },
    contact: {
      fields: [textField("heading", "Heading"), area("body", "Body"), textField("email", "Email"), textField("phone", "Phone"), area("address", "Address")],
      arrays: []
    },
    quote_request: {
      fields: [textField("heading", "Heading"), area("body", "Body")],
      arrays: [{ name: "fields", label: "Form Fields", itemLabel: "Field", fields: [textField("label", "Label"), select("type", "Type", ["text", "email", "phone", "textarea", "select", "checkbox"]), checkbox("required", "Required")] }]
    },
    cta: {
      fields: [textField("heading", "Heading"), area("body", "Body"), textField("buttonText", "Button text"), textField("buttonUrl", "Button URL")],
      arrays: []
    }
  };
  return schemas[sectionType] || schemas.cta;
}

function defaultArrayItem(array) {
  const item = {};
  for (const field of array.fields) {
    item[field.name] = field.kind === "checkbox" ? false : field.kind === "select" ? field.options[0] : "";
  }
  return normalizeArrayItem(array, item);
}

function normalizeArrayItem(array, item) {
  if (array.name === "highlights") return item.text || "";
  if (array.name === "fields") return { label: item.label || "Field", type: item.type || "text", required: Boolean(item.required) };
  return item;
}

function denormalizeArrayItem(array, item) {
  if (array.name === "highlights" && typeof item === "string") return { text: item };
  if (array.name === "fields" && typeof item === "string") return { label: item, type: "text", required: false };
  return item || {};
}

function markContentDirty() {
  setContentDirty(true);
}

function setContentDirty(value) {
  state.contentDirty = Boolean(value);
  els.contentDirtyIndicator.hidden = !state.contentDirty;
}

function confirmDiscardUnsaved() {
  if (!state.contentDirty) return true;
  return window.confirm("You have unsaved content changes. Discard them?");
}

function showContentError(message) {
  els.contentError.hidden = false;
  els.contentError.textContent = message;
}

function clearContentError() {
  els.contentError.hidden = true;
  els.contentError.textContent = "";
}

function setLoading(value, message = "Working...") {
  state.loading = Boolean(value);
  document.querySelectorAll("button").forEach((button) => {
    if (value) {
      button.dataset.wasDisabled = button.disabled ? "true" : "false";
      button.disabled = true;
    } else if (button.dataset.wasDisabled === "false") {
      button.disabled = false;
    }
  });
  if (value) showNotice(message);
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

function supportedSectionTypes() {
  return ["hero", "services", "about", "process", "projects", "gallery", "testimonials", "faq", "contact", "quote_request", "cta"];
}

function defaultSectionContent(type) {
  return {
    hero: {
      eyebrow: "Featured",
      heading: "New hero heading",
      subheading: "A short supporting message.",
      body: "",
      primaryButtonText: "Start",
      primaryButtonUrl: "/contact",
      secondaryButtonText: "Learn more",
      secondaryButtonUrl: "/services",
      imageUrl: ""
    },
    services: { heading: "Services", subheading: "", items: [{ title: "Service", description: "Describe this service.", icon: "" }] },
    about: { heading: "About", body: "Add background and positioning.", highlights: ["Clear positioning"] },
    process: { heading: "Process", steps: [{ title: "Step one", description: "Describe the first step." }] },
    projects: { heading: "Projects", items: [{ title: "Project", description: "Describe this project.", imageUrl: "" }] },
    gallery: { heading: "Gallery", images: [{ imageUrl: "", alt: "" }] },
    testimonials: { heading: "Testimonials", items: [{ quote: "Add a quote.", name: "Client", role: "" }] },
    faq: { heading: "FAQ", items: [{ question: "Question?", answer: "Answer." }] },
    contact: { heading: "Contact", body: "", email: "", phone: "", address: "" },
    quote_request: { heading: "Request a quote", body: "", fields: ["Name", "Email", "Project details"] },
    cta: { heading: "Call to action", body: "", buttonText: "Contact us", buttonUrl: "/contact" }
  }[type] || {};
}
