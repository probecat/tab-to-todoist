// Development-only stand-in for the Todoist API. Not included in builds.

const MENU_PREFIX = "mock-";
const PARENT_MENU_ID = "mock";
const STORAGE_KEY = "mockScenario";

const SCENARIOS = {
  off: { title: "Off (real Todoist API)" },
  success: { title: "Success", delayMs: 500, status: 200, body: { id: "mock-task" } },
  slow: { title: "Success after 3 s", delayMs: 3000, status: 200, body: { id: "mock-task" } },
  invalidToken: {
    title: "Invalid token (401)",
    delayMs: 500,
    status: 401,
    body: { error: "Unauthorized", error_code: 477, error_tag: "UNAUTHORIZED", http_code: 401 }
  },
  invalidProject: {
    title: "Invalid project ID (400)",
    delayMs: 500,
    status: 400,
    body: {
      error: "Invalid argument value",
      error_code: 20,
      error_extra: { argument: "project_id", expected: "Value error, Non-base32 digit found" },
      error_tag: "INVALID_ARGUMENT_VALUE",
      http_code: 400
    }
  },
  serverError: { title: "Server error (500), empty body", delayMs: 500, status: 500, body: null },
  timeout: { title: "No response (timeout)", hang: true },
  offline: { title: "Offline", delayMs: 200, networkError: true }
};

const DEFAULT_SCENARIO = "success";

export async function createMenus(selected = DEFAULT_SCENARIO) {
  await browser.contextMenus.remove(PARENT_MENU_ID).catch(() => {});

  browser.contextMenus.create({
    id: PARENT_MENU_ID,
    title: "Mock API",
    contexts: ["action"]
  });

  for (const [key, scenario] of Object.entries(SCENARIOS)) {
    browser.contextMenus.create({
      id: MENU_PREFIX + key,
      parentId: PARENT_MENU_ID,
      title: scenario.title,
      type: "radio",
      checked: key === selected,
      contexts: ["action"]
    });
  }
}

export async function getScenario() {
  const stored = await browser.storage.session.get(STORAGE_KEY);
  return stored[STORAGE_KEY] in SCENARIOS ? stored[STORAGE_KEY] : DEFAULT_SCENARIO;
}

// Returns true if the click was a mock menu item.
export async function handleMenuClick(info) {
  const id = String(info.menuItemId);
  if (!id.startsWith(MENU_PREFIX)) {
    return false;
  }

  await browser.storage.session.set({ [STORAGE_KEY]: id.slice(MENU_PREFIX.length) });
  return true;
}

export async function mockFetch(url, options = {}) {
  const key = await getScenario();
  const scenario = SCENARIOS[key];

  console.info("[mock]", key, options.method, url, JSON.parse(options.body || "null"));

  await wait(scenario.hang ? Infinity : scenario.delayMs, options.signal);

  if (scenario.networkError) {
    throw new TypeError("NetworkError when attempting to fetch resource.");
  }

  const body = scenario.body === null ? null : JSON.stringify(scenario.body);
  return new Response(body, {
    status: scenario.status,
    headers: { "Content-Type": "application/json" }
  });
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeoutId = Number.isFinite(ms) ? setTimeout(resolve, ms) : undefined;

    signal?.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    });
  });
}
