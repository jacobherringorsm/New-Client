const panels = new Map(
  [...document.querySelectorAll(".panel")].map((panel) => [panel.id.replace("panel-", ""), panel]),
);
const navItems = [...document.querySelectorAll("[data-panel]")];
const pageTitle = document.querySelector("#current-page");
const toast = document.querySelector("#toast");
const fpsPreview = document.querySelector("#fps-preview");
const clientFileInput = document.querySelector("#client-file");
const chooseClientButton = document.querySelector("#choose-client");
const launchClientLink = document.querySelector("#launch-client");
const selectedFileStatus = document.querySelector("#selected-file");
let toastTimer;
let clientObjectUrl;

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

chooseClientButton.addEventListener("click", () => clientFileInput.click());

clientFileInput.addEventListener("change", () => {
  const [file] = clientFileInput.files ?? [];
  if (!file) return;

  if (!/\.html?$/i.test(file.name)) {
    clientFileInput.value = "";
    selectedFileStatus.textContent = "Choose a standalone .html or .htm client file.";
    return;
  }

  if (clientObjectUrl) URL.revokeObjectURL(clientObjectUrl);
  clientObjectUrl = URL.createObjectURL(file);
  launchClientLink.href = clientObjectUrl;
  launchClientLink.hidden = false;
  launchClientLink.setAttribute("aria-disabled", "false");
  launchClientLink.removeAttribute("tabindex");
  chooseClientButton.textContent = "Choose a different file";
  selectedFileStatus.textContent = `${file.name} is ready. Launch it in a new tab.`;
});

launchClientLink.addEventListener("click", (event) => {
  if (launchClientLink.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    return;
  }
  showNotice("The selected client is opening in a separate tab.");
});

window.addEventListener("pagehide", () => {
  if (clientObjectUrl) URL.revokeObjectURL(clientObjectUrl);
});

showPanel("home");
