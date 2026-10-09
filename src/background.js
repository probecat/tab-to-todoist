const PAGE_MENU_ID = "add-page";
const LINK_MENU_ID = "add-link";
const TAB_MENU_ID = "add-tab";
const OPTIONS_MENU_ID = "options";
const TODOIST_TASKS_URL = "https://api.todoist.com/api/v1/tasks";
const TODOIST_QUICK_ADD_URL = "https://api.todoist.com/api/v1/tasks/quick";
const TODOIST_REQUEST_TIMEOUT_MS = 5000;
const BADGE_RESET_MS = 1000;
const SUCCESS_BADGE_COLOR = "#058527";
const ERROR_BADGE_COLOR = "#d70022";

const DEFAULT_ICON_PATHS = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  96: "icons/icon-96.png",
  128: "icons/icon-128.png"
};

const PENDING_ICON_PATHS = {
  16: "icons/icon-pending-16.png",
  32: "icons/icon-pending-32.png",
  48: "icons/icon-pending-48.png",
  96: "icons/icon-pending-96.png",
  128: "icons/icon-pending-128.png"
};

let badgeResetTimer;
let mock;
const mockReady = loadMock();

const DEFAULT_SETTINGS = {
  apiToken: "",
  project: "",
  label: "",
  useQuickAdd: false,
  showContextMenu: true
};

browser.runtime.onInstalled.addListener(async (details) => {
  const settings = await getSettings();

  await browser.contextMenus.removeAll();

  browser.contextMenus.create({
    id: PAGE_MENU_ID,
    title: "Add page to Todoist",
    contexts: ["page"],
    visible: settings.showContextMenu
  });

  browser.contextMenus.create({
    id: LINK_MENU_ID,
    title: "Add link to Todoist",
    contexts: ["link"],
    visible: settings.showContextMenu
  });

  browser.contextMenus.create({
    id: TAB_MENU_ID,
    title: "Add tab to Todoist",
    contexts: ["tab"],
    visible: settings.showContextMenu
  });

  browser.contextMenus.create({
    id: OPTIONS_MENU_ID,
    title: "Preferences",
    contexts: ["action"]
  });

  await mockReady;
  await createMockMenus();

  if (
    ["install", "update"].includes(details.reason) &&
    !(await hasConfiguredApiToken()) &&
    !(await isMockActive())
  ) {
    await browser.runtime.openOptionsPage();
  }
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.showContextMenu) {
    const visible = changes.showContextMenu.newValue !== false;
    browser.contextMenus.update(PAGE_MENU_ID, { visible });
    browser.contextMenus.update(LINK_MENU_ID, { visible });
    browser.contextMenus.update(TAB_MENU_ID, { visible });
  }
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  await mockReady;
  if (await mock?.handleMenuClick(info)) {
    return;
  }

  if (info.menuItemId === OPTIONS_MENU_ID) {
    browser.runtime.openOptionsPage();
    return;
  }

  let target;
  if (info.menuItemId === LINK_MENU_ID) {
    target = { title: info.linkText, url: info.linkUrl };
  } else if (info.menuItemId === PAGE_MENU_ID) {
    target = { title: tab?.title, url: info.pageUrl || tab?.url };
  } else if (info.menuItemId === TAB_MENU_ID) {
    target = { title: tab?.title, url: tab?.url };
  } else {
    return;
  }

  addToTodoist({
    title: getTitle(target.title, target.url),
    url: target.url
  });
});

browser.action.onClicked.addListener((tab) => {
  addToTodoist({
    title: getTitle(tab?.title, tab?.url),
    url: tab?.url
  });
});

async function addToTodoist(site) {
  const settings = await getSettings();

  if (!settings.apiToken && !(await isMockActive())) {
    await browser.runtime.openOptionsPage();
    return;
  }

  if (!isUsableUrl(site.url)) {
    await notify("Todoist", "This page does not have a usable URL.");
    await showResult(false);
    return;
  }

  await showPendingIcon();

  try {
    await createTodoistTask(settings, site);
    await showResult(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add the task.";
    await notify("Todoist error", message);
    await showResult(false);
  }
}

// Temporary installs (about:debugging, web-ext run) use src/mock.js,
// which is left out of builds.
async function loadMock() {
  const self = await browser.management.getSelf();
  if (self.installType === "development") {
    mock = await import("./mock.js").catch((error) => {
      console.error("[mock] failed to load", error);
    });
    await createMockMenus().catch((error) => {
      console.error("[mock] failed to create menus", error);
    });
  }
}

async function isMockActive() {
  await mockReady;
  return Boolean(mock) && (await mock.getScenario()) !== "off";
}

async function createMockMenus() {
  await mock?.createMenus(await mock.getScenario());
}

async function getSettings() {
  const stored = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));

  return {
    apiToken: String(stored.apiToken || "").trim(),
    project: String(stored.project || "").trim(),
    label: String(stored.label || "").trim(),
    useQuickAdd: Boolean(stored.useQuickAdd),
    showContextMenu: stored.showContextMenu !== false
  };
}

async function hasConfiguredApiToken() {
  const stored = await browser.storage.local.get("apiToken");
  return Boolean(String(stored.apiToken || "").trim());
}

async function createTodoistTask(settings, site) {
  const response = settings.useQuickAdd
    ? await createQuickAddTask(settings, site)
    : await createPlainTask(settings, site);

  if (response.ok) {
    return;
  }

  throw new Error(await formatTodoistError(response));
}

function createPlainTask(settings, site) {
  const body = {
    content: `[${site.title}](${site.url})`
  };

  if (settings.project) {
    body.project_id = settings.project;
  }

  const labels = parseLabels(settings.label);
  if (labels.length) {
    body.labels = labels;
  }

  return fetchTodoist(TODOIST_TASKS_URL, {
    method: "POST",
    headers: buildTodoistHeaders(settings.apiToken),
    body: JSON.stringify(body)
  });
}

function createQuickAddTask(settings, site) {
  const parts = [`[${site.title}](${site.url})`];

  if (settings.project) {
    parts.push(formatQuickAddProject(settings.project));
  }

  for (const label of parseLabels(settings.label)) {
    parts.push(`@${label}`);
  }

  return fetchTodoist(TODOIST_QUICK_ADD_URL, {
    method: "POST",
    headers: buildTodoistHeaders(settings.apiToken),
    body: JSON.stringify({ text: parts.join(" ") })
  });
}

async function fetchTodoist(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TODOIST_REQUEST_TIMEOUT_MS);

  try {
    const fetchImpl = (await isMockActive()) ? mock.mockFetch : fetch;
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Todoist did not respond. Try again.");
    }

    if (error instanceof TypeError) {
      throw new Error("Could not reach Todoist. Check your connection.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatQuickAddProject(project) {
  if (project.startsWith("/")) {
    return project;
  }

  return `#${project.replace(/^#/, "").replace(/\s+/g, "\\ ")}`;
}

// Comma-separated, with or without a leading @.
function parseLabels(value) {
  return value
    .split(",")
    .map((label) => label.trim().replace(/^@/, ""))
    .filter(Boolean);
}

function buildTodoistHeaders(apiToken) {
  return {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

async function formatTodoistError(response) {
  const { details, argument } = await readTodoistError(response);
  const status = `HTTP ${response.status}`;

  if (response.status === 401 || response.status === 403) {
    return appendDetails("Todoist rejected the API token. Check the token in preferences.", status, details);
  }

  if (argument === "project_id") {
    return appendDetails("Todoist did not accept the project ID. Check it in preferences.", status, details);
  }

  return appendDetails("Todoist could not add the task.", status, details);
}

function appendDetails(message, status, details) {
  const suffix = details ? `${status}: ${details}` : status;
  return `${message} (${suffix})`;
}

async function readTodoistError(response) {
  try {
    const text = await response.text();
    if (!text) {
      return { details: "" };
    }

    try {
      const payload = JSON.parse(text);
      return {
        details: payload.error || payload.error_tag || payload.message || text,
        argument: payload.error_extra?.argument
      };
    } catch (_error) {
      return { details: text };
    }
  } catch (_error) {
    return { details: "" };
  }
}

function getTitle(title, url) {
  const trimmedTitle = String(title || "").trim();
  if (trimmedTitle) {
    return trimmedTitle;
  }

  try {
    return new URL(url).hostname;
  } catch (_error) {
    return "Untitled page";
  }
}

function isUsableUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

async function showResult(ok) {
  clearBadgeResetTimer();
  await Promise.all([
    browser.action.setIcon({ path: DEFAULT_ICON_PATHS }),
    browser.action.setBadgeBackgroundColor({ color: ok ? SUCCESS_BADGE_COLOR : ERROR_BADGE_COLOR }),
    browser.action.setBadgeTextColor({ color: "white" }),
    browser.action.setBadgeText({ text: ok ? "OK" : "!" })
  ]);

  badgeResetTimer = setTimeout(() => {
    browser.action.setBadgeText({ text: "" });
    badgeResetTimer = undefined;
  }, BADGE_RESET_MS);
}

async function showPendingIcon() {
  clearBadgeResetTimer();
  await Promise.all([
    browser.action.setBadgeText({ text: "" }),
    browser.action.setIcon({ path: PENDING_ICON_PATHS })
  ]);
}

function clearBadgeResetTimer() {
  if (badgeResetTimer) {
    clearTimeout(badgeResetTimer);
    badgeResetTimer = undefined;
  }
}

function notify(title, message) {
  return browser.notifications.create({
    type: "basic",
    title,
    message
  });
}
