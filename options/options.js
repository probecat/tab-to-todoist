const DEFAULT_SETTINGS = {
  apiToken: "",
  project: "",
  label: "",
  useQuickAdd: false,
  showContextMenu: true
};
const RESET_CONFIRM_MS = 3000;
const UNSAVED_MESSAGE = "Unsaved changes.";
const HINTS = {
  default: {
    projectPlaceholder: "Project link or ID",
    projectHelp: "Paste the project's link from Todoist, or its ID. Leave blank for Inbox.",
    labelHelp: "Label names, separated by commas. Leave blank for none."
  },
  quickAdd: {
    projectPlaceholder: "e.g., Reading",
    projectHelp: "Exact project name, as typed after # in Quick Add. Leave blank for Inbox.",
    labelHelp: "Existing label names, separated by commas. A label that doesn't exist stays as plain text in the task. Leave blank for none."
  }
};

const form = document.querySelector("#settings-form");
const apiTokenInput = document.querySelector("#api-token");
const projectInput = document.querySelector("#project");
const projectHelp = document.querySelector("#project-help");
const labelHelp = document.querySelector("#label-help");
const labelInput = document.querySelector("#label");
const useQuickAddInput = document.querySelector("#use-quick-add");
const showContextMenuInput = document.querySelector("#show-context-menu");
const clearTokenButton = document.querySelector("#clear-token");
const resetSettingsButton = document.querySelector("#reset-settings");
const toggleTokenVisibilityButton = document.querySelector("#toggle-token-visibility");
const statusText = document.querySelector("#status");
const resetButtonLabel = resetSettingsButton.textContent;
let resetConfirmTimer;
let savedValues;

loadSettings();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const project = projectInput.value.trim();
  projectInput.value = useQuickAddInput.checked ? project : extractProjectId(project);
  labelInput.value = normalizeLabels(labelInput.value);

  const values = readForm();
  await browser.storage.local.set(values);
  savedValues = values;

  showStatus("Saved.", "success");
});

form.addEventListener("input", updateUnsavedNotice);
form.addEventListener("change", updateUnsavedNotice);

clearTokenButton.addEventListener("click", () => {
  apiTokenInput.value = "";
  apiTokenInput.focus();
  updateUnsavedNotice();
});

resetSettingsButton.addEventListener("click", async () => {
  if (!resetConfirmTimer) {
    resetSettingsButton.textContent = "Confirm reset";
    resetConfirmTimer = setTimeout(endResetConfirm, RESET_CONFIRM_MS);
    return;
  }

  endResetConfirm();
  await browser.storage.local.clear();
  await loadSettings();
  setTokenVisible(false);
  showStatus("Settings reset.");
});

toggleTokenVisibilityButton.addEventListener("click", () => {
  setTokenVisible(apiTokenInput.type === "password");
});

useQuickAddInput.addEventListener("change", updateHints);

async function loadSettings() {
  const settings = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));

  apiTokenInput.value = settings.apiToken || "";
  projectInput.value = settings.project || "";
  labelInput.value = settings.label || "";
  useQuickAddInput.checked = Boolean(settings.useQuickAdd);
  showContextMenuInput.checked = settings.showContextMenu !== false;
  updateHints();
  savedValues = readForm();
}

function readForm() {
  return {
    apiToken: apiTokenInput.value.trim(),
    project: projectInput.value.trim(),
    label: labelInput.value.trim(),
    useQuickAdd: useQuickAddInput.checked,
    showContextMenu: showContextMenuInput.checked
  };
}

function updateUnsavedNotice() {
  const unsaved = JSON.stringify(readForm()) !== JSON.stringify(savedValues);
  if (unsaved) {
    setStatus(UNSAVED_MESSAGE, "warning");
  } else if (statusText.textContent === UNSAVED_MESSAGE) {
    setStatus("");
  }
}

function normalizeLabels(value) {
  return value
    .split(",")
    .map((label) => label.trim().replace(/^@/, ""))
    .filter(Boolean)
    .join(", ");
}

function updateHints() {
  const hints = useQuickAddInput.checked ? HINTS.quickAdd : HINTS.default;
  projectInput.placeholder = hints.projectPlaceholder;
  projectHelp.textContent = hints.projectHelp;
  labelHelp.textContent = hints.labelHelp;
}

// Accepts a project URL (.../project/name-ID), "name-ID", or a bare ID.
function extractProjectId(value) {
  const lastSegment = value.split(/[?#]/)[0].split("/").filter(Boolean).pop() || "";
  const id = lastSegment.split("-").pop();
  return id === "inbox" ? "" : id;
}

function setTokenVisible(visible) {
  apiTokenInput.type = visible ? "text" : "password";
  toggleTokenVisibilityButton.textContent = visible ? "Hide" : "Show";
  toggleTokenVisibilityButton.setAttribute("aria-pressed", String(visible));
}

function endResetConfirm() {
  clearTimeout(resetConfirmTimer);
  resetConfirmTimer = undefined;
  resetSettingsButton.textContent = resetButtonLabel;
}

function showStatus(message, tone) {
  setStatus(message, tone);

  setTimeout(() => {
    if (statusText.textContent === message) {
      setStatus("");
    }
  }, 2500);
}

function setStatus(message, tone = "") {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
}
