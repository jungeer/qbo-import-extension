/**
 * 注入右侧操作面板：选文件、列表状态、开始/停止导入、错误展示。
 */
(() => {
  if (globalThis.__QBO_IMPORT_PANEL_BOOTSTRAPPED__) {
    return;
  }
  globalThis.__QBO_IMPORT_PANEL_BOOTSTRAPPED__ = true;

  const PANEL_ID = "qbo-import-helper-panel";
  const STYLE_ID = "qbo-import-helper-style";
  const HOST_ATTR = "data-qbo-import-helper";

  /** @type {{ id: string, file: File, status: string, error?: string }[]} */
  let items = [];
  let running = false;
  let stopRequested = false;

  if (globalThis.chrome?.runtime?.onMessage?.addListener) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "QBO_IMPORT_TOGGLE_PANEL") {
        togglePanel();
        sendResponse({ ok: true });
      }
      return false;
    });
  }

  function togglePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      existing.remove();
      document.documentElement.removeAttribute(HOST_ATTR);
      document.getElementById("qbo-import-fx-root")?.remove();
      document.documentElement.removeAttribute("data-qbo-import-running");
      document.querySelectorAll(".qbo-ih-fx-spot").forEach((node) => node.remove());
      return;
    }
    mountPanel();
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("src/panel.css");
    document.documentElement.appendChild(link);
  }

  function mountPanel() {
    ensureStyles();
    document.documentElement.setAttribute(HOST_ATTR, "open");

    const panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.setAttribute("role", "complementary");
    panel.setAttribute("aria-label", "QBO 批量导入助手");
    panel.innerHTML = `
      <header class="qbo-ih-header">
        <div class="qbo-ih-brand">
          <span class="qbo-ih-mark" aria-hidden="true"></span>
          <div>
            <h1 class="qbo-ih-title">QBO 导入助手</h1>
            <p class="qbo-ih-sub">逐个导入 · 保存后继续</p>
          </div>
        </div>
        <button type="button" class="qbo-ih-icon-btn" data-action="close" aria-label="关闭">×</button>
      </header>

      <section class="qbo-ih-section">
        <label class="qbo-ih-file-pick">
          <input type="file" multiple accept=".csv,text/csv" hidden data-role="file-input" />
          <span class="qbo-ih-file-pick-btn">选择 CSV 文件</span>
          <span class="qbo-ih-file-pick-hint">仅 CSV；文件名含 USD 会先切换币种再导入</span>
        </label>
      </section>

      <section class="qbo-ih-section qbo-ih-list-section">
        <div class="qbo-ih-list-head">
          <h2>文件列表</h2>
          <span data-role="count">0</span>
        </div>
        <ul class="qbo-ih-list" data-role="list"></ul>
        <p class="qbo-ih-empty" data-role="empty">尚未选择文件</p>
      </section>

      <section class="qbo-ih-section">
        <div class="qbo-ih-actions">
          <button type="button" class="qbo-ih-btn qbo-ih-btn-primary" data-action="start" disabled>
            开始导入
          </button>
          <button type="button" class="qbo-ih-btn" data-action="stop" disabled>
            停止
          </button>
          <button type="button" class="qbo-ih-btn" data-action="clear" disabled>
            清空
          </button>
        </div>
      </section>

      <section class="qbo-ih-section qbo-ih-error-section" data-role="error-wrap" hidden>
        <h2>错误信息</h2>
        <p class="qbo-ih-error" data-role="error"></p>
      </section>

      <footer class="qbo-ih-footer">
        <p>页面按钮选择器仍为占位，配置见 <code>src/selectors.js</code></p>
      </footer>
    `;

    document.documentElement.appendChild(panel);
    bindPanel(panel);
    render();
  }

  function bindPanel(panel) {
    const fileInput = panel.querySelector('[data-role="file-input"]');

    panel.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "close") {
        panel.remove();
        document.documentElement.removeAttribute(HOST_ATTR);
      } else if (action === "start") {
        startImport();
      } else if (action === "stop") {
        stopRequested = true;
      } else if (action === "clear") {
        if (running) return;
        items = [];
        setError(null);
        render();
      }
    });

    fileInput.addEventListener("change", () => {
      if (running) return;
      const root = globalThis.__QBO_IMPORT__;
      const allFiles = Array.from(fileInput.files || []);
      const allowed = allFiles.filter((file) =>
        root?.workflow?.isAllowedExtension
          ? root.workflow.isAllowedExtension(file.name, root.RULES)
          : /\.csv$/i.test(file.name)
      );
      const rejected = allFiles.length - allowed.length;

      items = allowed.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        status: "pending",
        needsUsd: root?.workflow?.needsUsdCurrency
          ? root.workflow.needsUsdCurrency(file.name, root.RULES)
          : /USD/i.test(file.name),
      }));

      if (rejected > 0) {
        setError(`已忽略 ${rejected} 个非 CSV 文件，仅导入 .csv`);
      } else {
        setError(null);
      }
      fileInput.value = "";
      render();
    });
  }

  function statusLabel(status) {
    switch (status) {
      case "pending":
        return "待导入";
      case "importing":
        return "导入中";
      case "done":
        return "已完成";
      case "error":
        return "失败";
      default:
        return status;
    }
  }

  function render() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const list = panel.querySelector('[data-role="list"]');
    const empty = panel.querySelector('[data-role="empty"]');
    const count = panel.querySelector('[data-role="count"]');
    const startBtn = panel.querySelector('[data-action="start"]');
    const stopBtn = panel.querySelector('[data-action="stop"]');
    const clearBtn = panel.querySelector('[data-action="clear"]');
    const pick = panel.querySelector(".qbo-ih-file-pick");

    count.textContent = String(items.length);
    empty.hidden = items.length > 0;
    list.innerHTML = items
      .map(
        (item) => `
      <li class="qbo-ih-item qbo-ih-item--${item.status}" data-id="${escapeAttr(item.id)}">
        <div class="qbo-ih-item-main">
          <span class="qbo-ih-item-name" title="${escapeAttr(item.file.name)}">${escapeHtml(item.file.name)}</span>
          <span class="qbo-ih-badge">${statusLabel(item.status)}</span>
        </div>
        <div class="qbo-ih-item-meta">${formatSize(item.file.size)} · CSV${
          item.needsUsd ? ' · <span class="qbo-ih-tag-usd">先切 USD</span>' : ""
        }${item.error ? ` · ${escapeHtml(item.error)}` : ""}</div>
      </li>`
      )
      .join("");

    startBtn.disabled = running || items.length === 0 || items.every((i) => i.status === "done");
    stopBtn.disabled = !running;
    clearBtn.disabled = running || items.length === 0;
    pick.classList.toggle("is-disabled", running);
    panel.classList.toggle("is-running", running);
    panel.querySelector('[data-role="file-input"]').disabled = running;

    const active = panel.querySelector(".qbo-ih-item--importing");
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function setError(message) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const wrap = panel.querySelector('[data-role="error-wrap"]');
    const el = panel.querySelector('[data-role="error"]');
    if (message) {
      wrap.hidden = false;
      el.textContent = message;
    } else {
      wrap.hidden = true;
      el.textContent = "";
    }
  }

  async function startImport() {
    const root = globalThis.__QBO_IMPORT__;
    if (!root?.workflow) {
      setError("工作流脚本未加载，请刷新页面后重试。");
      return;
    }
    if (running || items.length === 0) return;

    stopRequested = false;
    // 仅处理未完成项；失败项可手动清空后重选
    const pendingIndexes = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === "pending" || item.status === "error");

    if (pendingIndexes.length === 0) return;

    // 重置失败项为 pending
    pendingIndexes.forEach(({ index }) => {
      items[index].status = "pending";
      delete items[index].error;
    });
    render();

    const files = pendingIndexes.map(({ item }) => item.file);
    const indexMap = pendingIndexes.map(({ index }) => index);

    await root.workflow.runImportQueue({
      files,
      shouldStop: () => stopRequested,
      onRunningChange: (value) => {
        running = value;
        render();
      },
      onError: setError,
      onFileStatus: (queueIndex, status, error) => {
        const realIndex = indexMap[queueIndex];
        if (realIndex == null) return;
        items[realIndex].status = status;
        if (error) items[realIndex].error = error;
        else delete items[realIndex].error;
        render();
      },
    });

    const allDone = items.length > 0 && items.every((i) => i.status === "done");
    if (allDone) setError(null);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  // 允许页面已打开时直接调用（例如 demo）
  globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {};
  globalThis.__QBO_IMPORT__.togglePanel = togglePanel;
})();
