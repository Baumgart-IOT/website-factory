const state = {
  templates: [],
  projects: [],
  selectedProject: null,
  selectedTemplateId: null
};

const elements = {
  form: document.querySelector("#projectForm"),
  templateGrid: document.querySelector("#templateGrid"),
  projectList: document.querySelector("#projectList"),
  projectCount: document.querySelector("#projectCount"),
  selectedProject: document.querySelector("#selectedProject"),
  selectedProjectMeta: document.querySelector("#selectedProjectMeta"),
  workspaceTitle: document.querySelector("#workspaceTitle"),
  templateId: document.querySelector("#templateId"),
  logoForm: document.querySelector("#logoForm"),
  buildButton: document.querySelector("#buildButton"),
  buildResult: document.querySelector("#buildResult"),
  agentGrid: document.querySelector("#agentGrid"),
  notice: document.querySelector("#notice"),
  newProjectButton: document.querySelector("#newProjectButton")
};

await boot();

async function boot() {
  const [templates, projects] = await Promise.all([
    api("/api/templates"),
    api("/api/projects")
  ]);
  state.templates = templates.templates;
  state.projects = projects.projects;
  state.selectedTemplateId = state.templates[0]?.id || null;
  elements.templateId.value = state.selectedTemplateId || "";

  bindEvents();
  renderTemplates();
  renderProjects();
  renderAgents();
}

function bindEvents() {
  elements.form.addEventListener("submit", createProject);
  elements.logoForm.addEventListener("submit", uploadLogo);
  elements.buildButton.addEventListener("click", buildMockPreview);
  elements.newProjectButton.addEventListener("click", () => {
    state.selectedProject = null;
    elements.form.reset();
    elements.templateId.value = state.selectedTemplateId || "";
    renderSelectedProject();
    elements.form.querySelector("input[name='name']").focus();
  });
}

async function createProject(event) {
  event.preventDefault();
  const form = new FormData(elements.form);
  const pages = form.getAll("pages");
  const payload = Object.fromEntries(form.entries());
  payload.pages = pages;

  try {
    const response = await api("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.projects.unshift(response.project);
    state.selectedProject = response.project;
    showNotice("Project configuration saved as JSON.");
    renderProjects();
    renderSelectedProject();
  } catch (error) {
    showNotice(error.message);
  }
}

async function uploadLogo(event) {
  event.preventDefault();
  if (!state.selectedProject) return;

  const input = elements.logoForm.querySelector("input[type='file']");
  const file = input.files[0];
  if (!file) return;

  const allowed = ["image/png", "image/svg+xml"];
  if (!allowed.includes(file.type) || file.size > 1024 * 1024) {
    showNotice("Logo must be a PNG or SVG file and 1 MB or smaller.");
    return;
  }

  const body = new FormData();
  body.append("logo", file);

  try {
    const response = await api(`/api/projects/${state.selectedProject.id}/logo`, {
      method: "POST",
      body
    });
    updateProject(response.project);
    input.value = "";
    showNotice("Logo validated and attached to the project.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function buildMockPreview() {
  if (!state.selectedProject) return;

  try {
    const response = await api(`/api/projects/${state.selectedProject.id}/build`, { method: "POST" });
    updateProject(response.project);
    elements.buildResult.innerHTML = `<span>${escapeHtml(response.build.status)}</span> ${escapeHtml(response.build.previewUrl)}`;
    showNotice("Mock preview result created.");
  } catch (error) {
    showNotice(error.message);
  }
}

function renderTemplates() {
  elements.templateGrid.innerHTML = state.templates.map((template) => `
    <article class="template-card ${template.id === state.selectedTemplateId ? "selected" : ""}" data-template-id="${template.id}" tabindex="0">
      <h4>${escapeHtml(template.name)}</h4>
      <p>${escapeHtml(template.previewTone)}</p>
      <div class="template-meta">
        <span>${escapeHtml(template.category)}</span>
        <span>${escapeHtml(template.pages.length)} pages</span>
      </div>
      <p>${escapeHtml(template.recommendedFor)}</p>
    </article>
  `).join("");

  elements.templateGrid.querySelectorAll(".template-card").forEach((card) => {
    card.addEventListener("click", () => selectTemplate(card.dataset.templateId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectTemplate(card.dataset.templateId);
    });
  });
}

function selectTemplate(templateId) {
  state.selectedTemplateId = templateId;
  elements.templateId.value = templateId;
  renderTemplates();
}

function renderProjects() {
  elements.projectCount.textContent = state.projects.length;
  elements.projectList.innerHTML = state.projects.map((project) => `
    <button class="project-item ${state.selectedProject?.id === project.id ? "active" : ""}" data-project-id="${project.id}" type="button">
      <strong>${escapeHtml(project.site.name)}</strong>
      <span>${escapeHtml(project.site.templateName)} · ${escapeHtml(project.site.slug)}</span>
    </button>
  `).join("");

  elements.projectList.querySelectorAll(".project-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedProject = state.projects.find((project) => project.id === button.dataset.projectId);
      renderProjects();
      renderSelectedProject();
    });
  });
}

function renderSelectedProject() {
  const project = state.selectedProject;
  elements.buildButton.disabled = !project;
  elements.logoForm.hidden = !project;
  elements.buildResult.textContent = "";

  if (!project) {
    elements.workspaceTitle.textContent = "Create a website project";
    elements.selectedProjectMeta.textContent = "No project selected.";
    elements.selectedProject.className = "empty-state";
    elements.selectedProject.textContent = "Create or select a project to view its saved JSON configuration.";
    renderAgents();
    return;
  }

  elements.workspaceTitle.textContent = project.site.name;
  elements.selectedProjectMeta.textContent = `${project.site.industry} · ${project.site.templateName}`;
  elements.selectedProject.className = "json-view";
  elements.selectedProject.textContent = JSON.stringify(project, null, 2);
  renderAgents(project.agents);
}

function renderAgents(agents = null) {
  const source = agents || {
    recon: { label: "Recon", status: "pending", detail: "No project selected." },
    security: { label: "Security", status: "pending", detail: "No project selected." },
    verify: { label: "Verify", status: "pending", detail: "No project selected." },
    backup: { label: "Backup", status: "pending", detail: "No project selected." }
  };

  elements.agentGrid.innerHTML = Object.entries(source).map(([key, agent]) => `
    <article class="agent-card">
      <h4>${escapeHtml(agent.label)}</h4>
      <span class="agent-status">${escapeHtml(agent.status)}</span>
      <p>${escapeHtml(agent.detail)}</p>
    </article>
  `).join("");

  document.querySelectorAll("[data-agent]").forEach((item) => {
    const agent = source[item.dataset.agent];
    item.textContent = `${agent.label}: ${agent.status}`;
  });
}

function updateProject(project) {
  const index = state.projects.findIndex((item) => item.id === project.id);
  if (index >= 0) state.projects[index] = project;
  state.selectedProject = project;
  renderProjects();
  renderSelectedProject();
}

async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function showNotice(message) {
  elements.notice.hidden = false;
  elements.notice.textContent = message;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    elements.notice.hidden = true;
  }, 4500);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
