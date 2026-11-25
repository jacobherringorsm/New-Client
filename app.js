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
const removeClientButton = document.querySelector("#remove-client");
const selectedFileStatus = document.querySelector("#selected-file");
let toastTimer;
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_CLIENT_BYTES = 128 * 1024 * 1024;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) {
    crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return crc >>> 0;
});

async function extractClientHtml(file) {
  if (file.size > MAX_ARCHIVE_BYTES) {
    throw new Error("The ZIP exceeds the 100 MiB compressed size limit.");
  }

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const minimumEocdOffset = Math.max(0, buffer.byteLength - 22 - 0xffff);
  let eocdOffset = -1;

  for (let offset = buffer.byteLength - 22; offset >= minimumEocdOffset; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("The selected file is not a supported ZIP archive.");

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  const commentLength = view.getUint16(eocdOffset + 20, true);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount > 4096 ||
    entryCount === 0xffff ||
    centralOffset === 0xffffffff ||
    centralSize === 0xffffffff ||
    eocdOffset + 22 + commentLength > buffer.byteLength ||
    centralOffset + centralSize > eocdOffset
  ) {
    throw new Error("Multi-disk, ZIP64, or malformed archives are not supported.");
  }

  const decoder = new TextDecoder();
  const htmlEntries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > centralOffset + centralSize || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("The ZIP directory is malformed.");
    }

    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const checksum = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const entryCommentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const entryEnd = cursor + 46 + nameLength + extraLength + entryCommentLength;

    if (entryEnd > centralOffset + centralSize) throw new Error("The ZIP directory is truncated.");
    const name = decoder.decode(new Uint8Array(buffer, cursor + 46, nameLength));
    if (/\.html?$/i.test(name) && !name.startsWith("__MACOSX/")) {
      htmlEntries.push({ name, flags, method, checksum, compressedSize, uncompressedSize, localHeaderOffset });
    }
    cursor = entryEnd;
  }

  if (htmlEntries.length !== 1) {
    throw new Error("The ZIP must contain exactly one HTML client file.");
  }

  const entry = htmlEntries[0];
  if ((entry.flags & 1) !== 0) throw new Error("Encrypted ZIP entries are not supported.");
  if (entry.uncompressedSize > MAX_CLIENT_BYTES) {
    throw new Error("The extracted client exceeds the 128 MiB size limit.");
  }
  if (entry.method !== 0 && entry.method !== 8) {
    throw new Error("The client uses an unsupported ZIP compression method.");
  }
  if (entry.localHeaderOffset + 30 > buffer.byteLength || view.getUint32(entry.localHeaderOffset, true) !== 0x04034b50) {
    throw new Error("The client file header is malformed.");
  }

  const localFlags = view.getUint16(entry.localHeaderOffset + 6, true);
  const localMethod = view.getUint16(entry.localHeaderOffset + 8, true);
  const localNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const localExtraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const localName = decoder.decode(new Uint8Array(buffer, entry.localHeaderOffset + 30, localNameLength));
  const dataOffset = entry.localHeaderOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataOffset + entry.compressedSize;

  if (
    (localFlags & 1) !== 0 ||
    localMethod !== entry.method ||
    localName !== entry.name ||
    dataEnd > buffer.byteLength
  ) {
    throw new Error("The client file header does not match the ZIP directory.");
  }

  const compressedData = new Uint8Array(buffer, dataOffset, entry.compressedSize);
  let clientBytes;
  if (entry.method === 0) {
    clientBytes = compressedData;
  } else {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot extract ZIP files. Choose the extracted HTML file instead.");
    }
    try {
      const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      const reader = stream.getReader();
      const chunks = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_CLIENT_BYTES || totalBytes > entry.uncompressedSize) {
          await reader.cancel();
          throw new Error("The extracted client exceeds its declared size limit.");
        }
        chunks.push(value);
      }
      if (totalBytes !== entry.uncompressedSize) {
        throw new Error("The extracted client size does not match the ZIP directory.");
      }
      clientBytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        clientBytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
    } catch (error) {
      throw new Error(`Could not decompress the client HTML: ${error.message}`);
    }
  }

  if (clientBytes.byteLength !== entry.uncompressedSize || crc32(clientBytes) !== entry.checksum) {
    throw new Error("The extracted client failed its ZIP integrity check.");
  }
  return new Blob([clientBytes], { type: "text/html;charset=utf-8" });
}

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

function markClientInstalled(name, message) {
  launchClientLink.hidden = false;
  launchClientLink.setAttribute("aria-disabled", "false");
  launchClientLink.removeAttribute("tabindex");
  removeClientButton.hidden = false;
  chooseClientButton.textContent = "Choose a different file";
  selectedFileStatus.textContent = message;
}

async function restoreInstalledClient() {
  try {
    const client = await NeonClientStorage.getClient();
    if (client?.blob instanceof Blob) {
      markClientInstalled(
        client.name,
        `${client.name} is installed in this browser. You can launch it without selecting the file again.`,
      );
    }
  } catch (error) {
    console.error("Unable to read the saved client.", error);
    selectedFileStatus.textContent = error instanceof Error ? error.message : "Unable to read the saved client.";
  }
}

clientFileInput.addEventListener("change", async () => {
  const [file] = clientFileInput.files ?? [];
  if (!file) return;

  if (!/\.(?:html?|zip)$/i.test(file.name)) {
    clientFileInput.value = "";
    selectedFileStatus.textContent = "Choose a standalone .html/.htm file or a ZIP containing one.";
    return;
  }

  selectedFileStatus.textContent = `Loading ${file.name} locally…`;
  chooseClientButton.disabled = true;
  try {
    const clientBlob = /\.zip$/i.test(file.name) ? await extractClientHtml(file) : file;
    await NeonClientStorage.saveClient({ name: file.name, blob: clientBlob, installedAt: Date.now() });
    let persistenceGranted = false;
    try {
      persistenceGranted = await NeonClientStorage.requestPersistence();
    } catch (error) {
      console.warn("Persistent browser storage was not granted.", error);
    }
    markClientInstalled(
      file.name,
      persistenceGranted
        ? `${file.name} is installed on this device. You can launch it without selecting the file again.`
        : `${file.name} is saved in this browser, but browser storage may be cleared automatically.`,
    );
  } catch (error) {
    console.error("Unable to load the selected client file.", error);
    selectedFileStatus.textContent = error instanceof Error ? error.message : "Unable to load the selected client file.";
  } finally {
    chooseClientButton.disabled = false;
  }
});

removeClientButton.addEventListener("click", async () => {
  removeClientButton.disabled = true;
  try {
    await NeonClientStorage.removeClient();
    launchClientLink.hidden = true;
    launchClientLink.setAttribute("aria-disabled", "true");
    launchClientLink.setAttribute("tabindex", "-1");
    removeClientButton.hidden = true;
    chooseClientButton.textContent = "Choose client file";
    selectedFileStatus.textContent = "Saved client removed from this browser.";
  } catch (error) {
    console.error("Unable to remove the saved client.", error);
    selectedFileStatus.textContent = error instanceof Error ? error.message : "Unable to remove the saved client.";
  } finally {
    removeClientButton.disabled = false;
  }
});

launchClientLink.addEventListener("click", (event) => {
  if (launchClientLink.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    return;
  }
  showNotice("Opening the saved client and ClickGUI in a new tab.");
});

showPanel("home");
restoreInstalledClient();
