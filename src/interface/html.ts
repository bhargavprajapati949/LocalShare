/**
 * HTML Page Template - Interface Layer
 * 
 * Generates the HTML UI for file browsing and host control.
 * Pure function with no side effects; returns HTML string.
 */

/**
 * Render complete homepage HTML
 * @returns HTML document as string
 */
export function renderHomePage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>LAN File Host</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --surface: #ffffff;
        --text: #152132;
        --muted: #607086;
        --accent: #1f6feb;
        --line: #dae2ee;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        font-family: "Segoe UI", "Noto Sans", sans-serif;
        background: radial-gradient(circle at top right, #dbe9ff, var(--bg) 36%);
        color: var(--text);
      }
      .card {
        max-width: 900px;
        margin: 0 auto;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 20px;
        box-shadow: 0 10px 30px rgba(20, 44, 88, 0.08);
      }
      .banner {
        border: 1px solid #ffd59c;
        background: #fff7ea;
        color: #8c4f00;
        border-radius: 10px;
        padding: 10px 12px;
        margin: 10px 0 12px;
      }
      .banner.safe {
        border-color: #bfe6c2;
        background: #ecfff0;
        color: #1f5f28;
      }
      .status-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 12px;
      }
      .status-box {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 12px;
      }
      h1 { margin: 0 0 12px; }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 10px;
        margin: 8px 0 16px;
      }
      input, select, button {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
      }
      button {
        background: var(--accent);
        border-color: var(--accent);
        color: white;
        cursor: pointer;
      }
      button:hover { filter: brightness(0.95); }
      .path {
        font-size: 13px;
        color: var(--muted);
        margin: 0 0 12px;
        word-break: break-all;
      }
      .list {
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
      }
      .item {
        display: grid;
        grid-template-columns: minmax(180px, 1fr) 120px 180px;
        gap: 10px;
        align-items: center;
        border-bottom: 1px solid var(--line);
        padding: 10px 12px;
      }
      .item:last-child { border-bottom: none; }
      .name button,
      .name a {
        color: var(--accent);
        background: none;
        border: none;
        padding: 0;
        font-size: 14px;
        text-decoration: none;
      }
      .muted { color: var(--muted); font-size: 13px; }
      .controls {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 0 0 12px;
      }
      .controls .secondary {
        background: #fff;
        color: var(--text);
        border-color: var(--line);
      }
      .controls .danger {
        background: #be2d2d;
        border-color: #be2d2d;
      }
      .mono {
        font-family: "Menlo", "Consolas", monospace;
      }
      @media (max-width: 740px) {
        body { padding: 12px; }
        .status-grid { grid-template-columns: 1fr; }
        .row { grid-template-columns: 1fr; }
        .item { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <section class="card">
      <h1>LAN File Host</h1>
      <p class="muted">Browse and download files shared by this host.</p>
      <div id="warning" class="banner">Loading host status...</div>
      <div class="status-grid">
        <div class="status-box">
          <strong>Sharing Status</strong>
          <p id="sharingState" class="muted">-</p>
        </div>
        <div class="status-box">
          <strong>Host IPs (LAN)</strong>
          <p id="hostIps" class="muted mono">-</p>
        </div>
      </div>
      <div class="controls">
        <button id="startSharing" class="secondary" hidden>Start Sharing</button>
        <button id="stopSharing" class="danger" hidden>Stop Sharing</button>
        <button id="refreshStatus" class="secondary">Refresh Status</button>
      </div>
      <div class="row">
        <select id="root"></select>
        <input id="pin" placeholder="Session PIN (if required)" />
        <button id="refresh">Refresh</button>
      </div>
      <p id="path" class="path">/</p>
      <div class="list" id="list"></div>
    </section>

    <script>
      const state = {
        root: "",
        path: "",
        pin: "",
        roots: [],
        sharingActive: true,
        canControlHost: false,
        lanUrls: [],
      };

      const listEl = document.getElementById("list");
      const rootEl = document.getElementById("root");
      const pathEl = document.getElementById("path");
      const pinEl = document.getElementById("pin");
      const refreshEl = document.getElementById("refresh");
      const warningEl = document.getElementById("warning");
      const sharingStateEl = document.getElementById("sharingState");
      const hostIpsEl = document.getElementById("hostIps");
      const refreshStatusEl = document.getElementById("refreshStatus");
      const startSharingEl = document.getElementById("startSharing");
      const stopSharingEl = document.getElementById("stopSharing");

      function renderWarning(status) {
        if (status.securityMode === "open-local-network") {
          warningEl.className = "banner";
          warningEl.textContent = "Warning: PIN is disabled. Any device on this local network can access shared files while sharing is active.";
          return;
        }

        warningEl.className = "banner safe";
        warningEl.textContent = "PIN protection is active for file access.";
      }

      function renderHostSummary(status) {
        const stateText = status.sharingActive
          ? "Active (stays active until you stop it)"
          : "Stopped by host";
        sharingStateEl.textContent = stateText + ", last start: " + status.lastStartedAt;

        const ips = (status.lanAddresses || []).length
          ? status.lanAddresses.join("\\n")
          : "No LAN IPv4 address detected";
        hostIpsEl.textContent = ips;

        state.sharingActive = Boolean(status.sharingActive);
        state.canControlHost = Boolean(status.canControlHost);
        state.lanUrls = Array.isArray(status.lanUrls) ? status.lanUrls : [];

        startSharingEl.hidden = !state.canControlHost;
        stopSharingEl.hidden = !state.canControlHost;
      }

      function apiUrl(endpoint, params = {}) {
        const url = new URL(endpoint, window.location.origin);
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null && v !== "") {
            url.searchParams.set(k, String(v));
          }
        }
        return url;
      }

      async function loadStatus() {
        const response = await fetch(apiUrl("/api/status"));
        if (!response.ok) {
          throw new Error("Unable to read server status");
        }
        const status = await response.json();
        state.roots = status.roots;
        state.root = state.root || (status.roots[0] && status.roots[0].id) || "";
        renderWarning(status);
        renderHostSummary(status);

        rootEl.innerHTML = "";
        status.roots.forEach((root) => {
          const option = document.createElement("option");
          option.value = root.id;
          option.textContent = root.name + " (" + root.absPath + ")";
          if (root.id === state.root) {
            option.selected = true;
          }
          rootEl.appendChild(option);
        });
      }

      async function loadDirectory() {
        if (!state.sharingActive) {
          listEl.innerHTML = '<div class="item"><span>Sharing is currently stopped by host. Start sharing to browse files.</span></div>';
          return;
        }

        state.pin = pinEl.value.trim();
        const response = await fetch(apiUrl("/api/list", {
          root: state.root,
          path: state.path,
          pin: state.pin,
        }));

        if (!response.ok) {
          listEl.innerHTML = '<div class="item"><span>Failed to load directory. Check root/path/PIN.</span></div>';
          return;
        }

        const payload = await response.json();
        pathEl.textContent = payload.root.absPath + (payload.path ? "/" + payload.path : "");

        listEl.innerHTML = "";

        const canGoUp = payload.path && payload.path.includes("/")
          ? payload.path.split("/").slice(0, -1).join("/")
          : "";

        if (payload.path) {
          const row = document.createElement("div");
          row.className = "item";
          row.innerHTML = '<div class="name"><button>.. (parent)</button></div><div class="muted"></div><div class="muted"></div>';
          row.querySelector("button").addEventListener("click", () => {
            state.path = canGoUp;
            loadDirectory();
          });
          listEl.appendChild(row);
        }

        payload.entries.forEach((entry) => {
          const row = document.createElement("div");
          row.className = "item";
          const action = entry.isDirectory
            ? '<button data-action="open">' + entry.name + '/</button>'
            : '<a data-action="download" href="#">' + entry.name + '</a>';

          row.innerHTML =
            '<div class="name">' + action + '</div>' +
            '<div class="muted">' + (entry.isDirectory ? "folder" : entry.size + " bytes") + '</div>' +
            '<div class="muted">' + new Date(entry.modifiedAt).toLocaleString() + '</div>';

          const actionEl = row.querySelector("[data-action]");
          actionEl.addEventListener("click", (event) => {
            event.preventDefault();
            if (entry.isDirectory) {
              state.path = entry.relPath;
              loadDirectory();
              return;
            }

            const downloadUrl = apiUrl("/api/download", {
              root: state.root,
              path: entry.relPath,
              pin: state.pin,
            });
            window.location.href = downloadUrl.toString();
          });

          listEl.appendChild(row);
        });
      }

      async function sendHostControl(action) {
        const response = await fetch(apiUrl("/api/host/" + action), {
          method: "POST",
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "Host control action failed" }));
          alert(err.error || "Host control action failed");
          return;
        }

        await loadStatus();
        await loadDirectory();
      }

      rootEl.addEventListener("change", () => {
        state.root = rootEl.value;
        state.path = "";
        loadDirectory();
      });

      refreshEl.addEventListener("click", () => {
        state.path = "";
        loadDirectory();
      });

      refreshStatusEl.addEventListener("click", async () => {
        await loadStatus();
        await loadDirectory();
      });

      startSharingEl.addEventListener("click", async () => {
        await sendHostControl("start");
      });

      stopSharingEl.addEventListener("click", async () => {
        await sendHostControl("stop");
      });

      (async () => {
        await loadStatus();
        await loadDirectory();
      })();
    </script>
  </body>
</html>`;
}
