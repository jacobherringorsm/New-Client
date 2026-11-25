const frame = document.querySelector("#client-frame");
const loadingStatus = document.querySelector("#game-loading");
const clickgui = document.querySelector("#clickgui");
const guiTrigger = document.querySelector("#gui-trigger");
const closeGuiButton = document.querySelector("#close-gui");
const badge = document.querySelector("#game-badge");
const keybindButton = document.querySelector("#keybind-button");
const keybindLabel = document.querySelector("#keybind-label");
const footerKeybind = document.querySelector("#footer-keybind");
const toast = document.querySelector("#game-toast");
const defaultSettings = {
  accent: "cyan",
  showBadge: true,
  compactGui: false,
  reducedMotion: false,
  keybind: "ShiftRight",
};
let settings = { ...defaultSettings };
let waitingForKey = false;
let toastTimer;
let clientObjectUrl;

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function formatKey(code) {
  const knownKeys = {
    ShiftRight: "RIGHT SHIFT",
    ShiftLeft: "LEFT SHIFT",
    ControlRight: "RIGHT CTRL",
    ControlLeft: "LEFT CTRL",
    AltRight: "RIGHT ALT",
    AltLeft: "LEFT ALT",
    Space: "SPACE",
    Escape: "ESC",
  };
  if (knownKeys[code]) return knownKeys[code];
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/([A-Z])/g, " $1").trim().toUpperCase();
}

function applySettings() {
  document.documentElement.dataset.accent = settings.accent;
  document.documentElement.dataset.compactGui = String(settings.compactGui);
  document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
  badge.hidden = !settings.showBadge;
  keybindButton.textContent = formatKey(settings.keybind);
  keybindLabel.textContent = formatKey(settings.keybind);
  footerKeybind.textContent = formatKey(settings.keybind);
  for (const input of document.querySelectorAll("[data-pref]")) {
    input.checked = Boolean(settings[input.dataset.pref]);
  }
  for (const button of document.querySelectorAll("[data-accent]")) {
    const selected = button.dataset.accent === settings.accent;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

async function saveSettings() {
  try {
    await NeonClientStorage.saveSettings(settings);
  } catch (error) {
    console.error("Unable to save ClickGUI settings.", error);
    showToast(error instanceof Error ? error.message : "Unable to save ClickGUI settings.");
  }
}

function setClickguiOpen(open) {
  clickgui.hidden = !open;
  guiTrigger.setAttribute("aria-expanded", String(open));
  if (open) closeGuiButton.focus();
  else guiTrigger.focus();
}

function handleKeydown(event) {
  if (waitingForKey) {
    if (event.code === "Escape") {
      waitingForKey = false;
      keybindButton.textContent = formatKey(settings.keybind);
      return;
    }
    if (!event.code || event.code === "Unidentified") return;
    event.preventDefault();
    event.stopPropagation();
    settings.keybind = event.code;
    waitingForKey = false;
    applySettings();
    saveSettings();
    showToast(`ClickGUI key set to ${formatKey(settings.keybind)}.`);
    return;
  }

  if (event.code === settings.keybind) {
    event.preventDefault();
    event.stopPropagation();
    setClickguiOpen(clickgui.hidden);
  }
}

document.addEventListener("keydown", handleKeydown, true);
frame.addEventListener("load", () => {
  try {
    frame.contentWindow.addEventListener("keydown", handleKeydown, true);
  } catch (error) {
    console.warn("The ClickGUI hotkey could not be attached to the game frame.", error);
  }
});

guiTrigger.addEventListener("click", () => setClickguiOpen(clickgui.hidden));
closeGuiButton.addEventListener("click", () => setClickguiOpen(false));
clickgui.addEventListener("click", (event) => {
  if (event.target === clickgui) setClickguiOpen(false);
});

for (const item of document.querySelectorAll("[data-screen]")) {
  item.addEventListener("click", () => {
    const screenName = item.dataset.screen;
    for (const button of document.querySelectorAll("[data-screen]")) {
      const active = button.dataset.screen === screenName;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    for (const screen of document.querySelectorAll("[data-screen-panel]")) {
      const active = screen.dataset.screenPanel === screenName;
      screen.hidden = !active;
      screen.classList.toggle("is-active", active);
    }
    document.querySelector("#gui-title").textContent = screenName === "interface" ? "Interface" : "Appearance";
  });
}

for (const input of document.querySelectorAll("[data-pref]")) {
  input.addEventListener("change", () => {
    settings[input.dataset.pref] = input.checked;
    applySettings();
    saveSettings();
  });
}

for (const button of document.querySelectorAll("[data-accent]")) {
  button.addEventListener("click", () => {
    settings.accent = button.dataset.accent;
    applySettings();
    saveSettings();
  });
}

keybindButton.addEventListener("click", () => {
  waitingForKey = true;
  keybindButton.textContent = "PRESS A KEY…";
  keybindButton.focus();
});

async function startGame() {
  try {
    const [client, savedSettings] = await Promise.all([
      NeonClientStorage.getClient(),
      NeonClientStorage.getSettings(),
    ]);
    if (!client?.blob) {
      const message = document.createElement("span");
      message.append("No client is installed in this browser. ");
      const link = document.createElement("a");
      link.href = "./";
      link.textContent = "Return to the launcher";
      message.append(link, " to install one.");
      loadingStatus.replaceChildren(message);
      return;
    }

    settings = { ...defaultSettings, ...(savedSettings ?? {}) };
    if (!["cyan", "violet", "amber"].includes(settings.accent)) settings.accent = defaultSettings.accent;
    if (typeof settings.keybind !== "string" || !settings.keybind) settings.keybind = defaultSettings.keybind;
    applySettings();
    clientObjectUrl = URL.createObjectURL(client.blob);
    frame.src = clientObjectUrl;
    frame.hidden = false;
    loadingStatus.hidden = true;
  } catch (error) {
    console.error("Unable to load the installed client.", error);
    loadingStatus.textContent = error instanceof Error ? error.message : "Unable to load the installed client.";
  }
}

window.addEventListener("pagehide", () => {
  if (clientObjectUrl) URL.revokeObjectURL(clientObjectUrl);
});

startGame();
