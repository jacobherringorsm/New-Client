const panels = new Map(
  [...document.querySelectorAll(".panel")].map((panel) => [panel.id.replace("panel-", ""), panel]),
);
const navItems = [...document.querySelectorAll("[data-panel]")];
const pageTitle = document.querySelector("#current-page");
const toast = document.querySelector("#toast");
const fpsPreview = document.querySelector("#fps-preview");
let toastTimer;

function showPanel(name) {
  const panel = panels.get(name);
  if (!panel) return;

  for (const [panelName, item] of panels) {
    const active = panelName === name;
    item.hidden = !active;
    item.classList.toggle("is-visible", active);
  }

  for (const item of navItems) {
    const active = item.dataset.panel === name;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }

  pageTitle.textContent = navItems.find((item) => item.dataset.panel === name)?.textContent.trim() ?? "Overview";
}

function showNotice(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

for (const item of navItems) {
  item.addEventListener("click", () => showPanel(item.dataset.panel));
}

for (const item of document.querySelectorAll("[data-go]")) {
  item.addEventListener("click", () => showPanel(item.dataset.go));
}

for (const item of document.querySelectorAll("[data-accent]")) {
  item.addEventListener("click", () => {
    const accent = item.dataset.accent;
    document.documentElement.dataset.accent = accent;
    for (const option of document.querySelectorAll("[data-accent]")) {
      const selected = option === item;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    }
  });
}

for (const input of document.querySelectorAll("[data-setting]")) {
  input.addEventListener("change", () => {
    if (input.dataset.setting === "compact-hud") {
      document.documentElement.dataset.compact = String(input.checked);
    }
    if (input.dataset.setting === "reduced-motion") {
      document.documentElement.dataset.reducedMotion = String(input.checked);
    }
    if (input.dataset.setting === "fps-counter") {
      fpsPreview.hidden = !input.checked;
    }
  });
}

for (const button of document.querySelectorAll("[data-notice]")) {
  button.addEventListener("click", () => showNotice(button.dataset.notice));
}

showPanel("home");
