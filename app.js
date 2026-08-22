/**
 * app.js — CI Docker Dashboard
 * Giao tiếp với Flask API: /, /health, /version
 */

// ── Config ────────────────────────────────────────────────
// Tự detect: nếu mở qua Flask (/ui) thì dùng cùng origin, nếu mở file:// thì dùng localhost:8000
const BASE_URL = window.location.protocol === "file:"
  ? "http://localhost:8081"
  : window.location.origin;

// ── State ─────────────────────────────────────────────────
const state = {
  total: 0,
  ok: 0,
  fail: 0,
  latencies: [],
  polling: false,
  pollInterval: null,
  POLL_MS: 10000, // 10 giây
};

// ── DOM Helpers ───────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function setHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

// ── Toast Notifications ───────────────────────────────────
function showToast(message, type = "info", duration = 3000) {
  const container = $("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = type === "success" ? "✔" : type === "error" ? "✖" : "ℹ";
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
    <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hiding");
    toast.addEventListener("animationend", () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }, duration);
}

// ── JSON Syntax Highlight ─────────────────────────────────
function highlightJSON(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-bool";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

// ── Request Log ────────────────────────────────────────────
function addLog(method, path, statusCode, ms, ok) {
  const time = new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const logList = $("log-list");
  const logEmpty = $("log-empty");
  if (logEmpty) logEmpty.classList.add("hidden");

  const li = document.createElement("li");
  li.className = `log-item ${ok ? "ok" : "fail"}`;
  li.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-method">${method}</span>
    <span class="log-path">${path}</span>
    <span class="log-status ${ok ? "ok" : "fail"}">${statusCode}</span>
    <span class="log-ms">${ms}ms</span>
  `;

  // Prepend (newest on top)
  logList.insertBefore(li, logList.firstChild);

  // Trim to 50 entries
  while (logList.children.length > 50) {
    logList.removeChild(logList.lastChild);
  }
}

// ── Stats ─────────────────────────────────────────────────
function updateStats(ok, ms) {
  state.total++;
  if (ok) state.ok++; else state.fail++;
  state.latencies.push(ms);
  if (state.latencies.length > 200) state.latencies.shift();

  const avg = Math.round(
    state.latencies.reduce((a, b) => a + b, 0) / state.latencies.length
  );

  setText("stat-total", state.total);
  setText("stat-ok", state.ok);
  setText("stat-fail", state.fail);
  setText("stat-avg-latency", `${avg}ms`);
}

// ── Indicator helpers ─────────────────────────────────────
function setIndicator(prefix, ok) {
  const dot = $(`${prefix}-indicator`)?.querySelector(".indicator-dot");
  if (!dot) return;
  dot.className = `indicator-dot ${ok ? "ok" : "fail"}`;
}

function setResponseBox(id, content, ok, isHTML = false) {
  const box = $(id);
  if (!box) return;
  box.className = `response-box json-view ${ok ? "ok" : "fail"}`;
  if (isHTML) {
    box.innerHTML = content;
  } else {
    box.textContent = content;
  }
}

function setLatency(id, ms) {
  const el = $(id);
  if (el) el.textContent = `${ms}ms`;
}

function setButtonLoading(id, loading) {
  const btn = $(id);
  if (!btn) return;
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
}

// ── Header Badge ──────────────────────────────────────────
function updateHeaderBadge(ok) {
  const badge = $("header-badge");
  const text = $("header-status-text");
  if (!badge || !text) return;
  badge.className = `status-badge ${ok ? "online" : "offline"}`;
  text.textContent = ok ? "Online" : "Offline";
}

// ── Fetch Helpers ─────────────────────────────────────────
async function apiFetch(path) {
  const url = `${BASE_URL}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    const ms = Math.round(performance.now() - start);
    const contentType = res.headers.get("content-type") || "";
    let body;
    if (contentType.includes("application/json")) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    return { ok: res.ok, status: res.status, body, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    return { ok: false, status: "ERR", body: err.message, ms };
  }
}

// ── API Calls ─────────────────────────────────────────────

/** GET / */
async function fetchHome() {
  setButtonLoading("btn-home", true);
  const { ok, status, body, ms } = await apiFetch("/");
  setButtonLoading("btn-home", false);

  setResponseBox("home-response", typeof body === "string" ? body : JSON.stringify(body), ok, false);
  setIndicator("home", ok);
  setLatency("home-latency", ms);
  addLog("GET", "/", status, ms, ok);
  updateStats(ok, ms);
  if (ok) updateHeaderBadge(true);
}

/** GET /health */
async function fetchHealth() {
  setButtonLoading("btn-health", true);
  const { ok, status, body, ms } = await apiFetch("/health");
  setButtonLoading("btn-health", false);

  if (ok && typeof body === "object") {
    // Show JSON with syntax highlighting
    const box = $("health-response");
    box.className = "response-box json-view ok";
    box.innerHTML = highlightJSON(body);

    // Show pills for each key-value
    const pills = $("health-pills");
    if (pills) {
      pills.innerHTML = Object.entries(body)
        .map(([k, v]) => `<span class="health-pill">✔ ${k}: ${v}</span>`)
        .join("");
    }

    // Update Uptime
    if (body.uptime) {
      const uptimeBadge = $("uptime-badge");
      if (uptimeBadge) uptimeBadge.classList.remove("hidden");
      setText("uptime-text", body.uptime);
    }
  } else {
    setResponseBox("health-response", typeof body === "string" ? body : JSON.stringify(body), ok, false);
    setHTML("health-pills", "");
  }

  setIndicator("health", ok);
  setLatency("health-latency", ms);
  addLog("GET", "/health", status, ms, ok);
  updateStats(ok, ms);
  if (ok) updateHeaderBadge(true);
}

/** GET /version */
async function fetchVersion() {
  setButtonLoading("btn-version", true);
  const { ok, status, body, ms } = await apiFetch("/version");
  setButtonLoading("btn-version", false);

  if (ok && typeof body === "object") {
    const box = $("version-response");
    box.className = "response-box json-view ok";
    box.innerHTML = highlightJSON(body);

    // Big version display
    const wrap = $("version-badge-wrap");
    if (wrap && body.version !== undefined) {
      wrap.innerHTML = `<span class="version-big">v${body.version}</span>`;
      // Update footer too
      setText("footer-version", body.version);
    }
  } else {
    setResponseBox("version-response", typeof body === "string" ? body : JSON.stringify(body), ok, false);
    setHTML("version-badge-wrap", "");
  }

  setIndicator("version", ok);
  setLatency("version-latency", ms);
  addLog("GET", "/version", status, ms, ok);
  updateStats(ok, ms);
  if (ok) updateHeaderBadge(true);
}

// ── Ping All ──────────────────────────────────────────────
async function pingAll() {
  await Promise.all([fetchHome(), fetchHealth(), fetchVersion()]);
}

// ── Clear Log ─────────────────────────────────────────────
function clearLog() {
  const list = $("log-list");
  const empty = $("log-empty");
  if (list) {
    // Fade out effect
    Array.from(list.children).forEach(child => {
      child.style.transition = "opacity 0.2s";
      child.style.opacity = "0";
    });
    setTimeout(() => {
      list.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
    }, 200);
  }
  showToast("Đã xóa nhật ký request", "success");
}

// ── Auto Polling ──────────────────────────────────────────
function togglePolling() {
  state.polling = !state.polling;
  const btn = $("btn-poll");
  const icon = $("poll-icon");

  if (state.polling) {
    btn?.classList.add("active");
    if (icon) icon.textContent = "⏹";
    pingAll(); // immediate ping
    state.pollInterval = setInterval(pingAll, state.POLL_MS);
    showToast("Đã bật Auto Refresh (10s)", "info");
  } else {
    btn?.classList.remove("active");
    if (icon) icon.textContent = "⏱";
    clearInterval(state.pollInterval);
    showToast("Đã tắt Auto Refresh", "info");
  }
}

// ── Footer Clock ──────────────────────────────────────────
function startClock() {
  function tick() {
    setText(
      "footer-time",
      new Date().toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "medium",
      })
    );
  }
  tick();
  setInterval(tick, 1000);
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  startClock();
  // Auto ping on load to check connectivity
  pingAll();
});
