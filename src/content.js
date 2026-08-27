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

  /** @type {{ id: string, file: File, status: string, error?: string, needsUsd?: boolean, relativePath?: string }[]} */
  let items = [];
  let running = false;
  let stopRequested = false;
  let folderNote = "";

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

  globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {};
  globalThis.__QBO_IMPORT__.togglePanel = togglePanel;

  if (globalThis.chrome?.runtime?.onMessage?.addListener) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "QBO_IMPORT_TOGGLE_PANEL") {
        togglePanel();
        sendResponse({ ok: true });
      }
      return false;
    });
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

      <nav class="qbo-ih-tabs" role="tablist" aria-label="面板切换">
        <button type="button" class="qbo-ih-tab is-active" role="tab" aria-selected="true" data-action="switch-tab" data-tab="import">
          导入
        </button>
        <button type="button" class="qbo-ih-tab" role="tab" aria-selected="false" data-action="switch-tab" data-tab="config">
          配置
        </button>
      </nav>

      <div class="qbo-ih-tab-panels">
        <div class="qbo-ih-tab-panel is-active" data-tab-panel="import" role="tabpanel">
          <section class="qbo-ih-section">
            <div class="qbo-ih-pick-row">
              <label class="qbo-ih-file-pick">
                <input type="file" multiple accept=".csv,text/csv" hidden data-role="file-input" />
                <span class="qbo-ih-file-pick-btn">选择 CSV 文件</span>
                <span class="qbo-ih-file-pick-hint">可多选单个文件</span>
              </label>
              <label class="qbo-ih-file-pick">
                <input type="file" multiple webkitdirectory directory hidden data-role="folder-input" />
                <span class="qbo-ih-file-pick-btn">选择文件夹</span>
                <span class="qbo-ih-file-pick-hint">自动列出文件夹内全部 CSV</span>
              </label>
            </div>
            <p class="qbo-ih-file-pick-note">仅 CSV；文件名含 USD 会先切换币种再导入</p>
          </section>

          <section class="qbo-ih-section qbo-ih-list-section">
            <div class="qbo-ih-list-head">
              <h2>文件列表</h2>
              <span data-role="count">0</span>
            </div>
            <p class="qbo-ih-folder-note" data-role="folder-note" hidden></p>
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
        </div>

        <div class="qbo-ih-tab-panel" data-tab-panel="config" role="tabpanel" hidden>
          <section class="qbo-ih-section qbo-ih-config-section">
            <p class="qbo-ih-config-intro">
              按真实流程配置：文件名含 USD 时先切 Currency → 写入 CSV（可不点 Import）→ 等待解析 → 点 Save and new → 再导下一个。
              下面每项都是 CSS 选择器或规则；改完点「保存配置」立即生效。
            </p>
            <div class="qbo-ih-config-fields" data-role="config-fields"></div>
            <div class="qbo-ih-config-actions">
              <button type="button" class="qbo-ih-btn qbo-ih-btn-primary" data-action="save-config">保存配置</button>
              <button type="button" class="qbo-ih-btn" data-action="reset-config">恢复默认</button>
            </div>
            <p class="qbo-ih-config-status" data-role="config-status" hidden></p>
          </section>
        </div>
      </div>
    `;

    document.documentElement.appendChild(panel);
    bindPanel(panel);
    render();
    initConfigPanel(panel);
  }

  function bindPanel(panel) {
    const fileInput = panel.querySelector('[data-role="file-input"]');
    const folderInput = panel.querySelector('[data-role="folder-input"]');

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
        folderNote = "";
        setError(null);
        render();
      } else if (action === "remove") {
        if (running) return;
        const id = btn.getAttribute("data-id");
        removeItem(id);
      } else if (action === "switch-tab") {
        switchTab(panel, btn.getAttribute("data-tab"));
      } else if (action === "save-config") {
        saveConfigFromPanel(panel);
      } else if (action === "reset-config") {
        resetConfigFromPanel(panel);
      }
    });

    fileInput.addEventListener("change", () => {
      if (running) return;
      ingestFiles(Array.from(fileInput.files || []), { source: "files" });
      fileInput.value = "";
    });

    folderInput.addEventListener("change", () => {
      if (running) return;
      const allFiles = Array.from(folderInput.files || []);
      ingestFiles(allFiles, { source: "folder" });
      folderInput.value = "";
    });
  }

  /**
   * 统一处理选中的文件 / 文件夹内容：过滤 CSV、排序、写入列表。
   */
  function ingestFiles(allFiles, { source }) {
    const root = globalThis.__QBO_IMPORT__;
    const isCsv = (file) =>
      root?.workflow?.isAllowedExtension
        ? root.workflow.isAllowedExtension(file.name, root.RULES)
        : /\.csv$/i.test(file.name);

    // 文件夹选择会带回子目录内全部文件；按相对路径取叶子文件名过滤
    const csvFiles = allFiles
      .filter((file) => isCsv(file))
      .sort((a, b) => {
        const pa = a.webkitRelativePath || a.name;
        const pb = b.webkitRelativePath || b.name;
        return pa.localeCompare(pb, undefined, { numeric: true, sensitivity: "base" });
      });

    const rejected = allFiles.length - csvFiles.length;
    const folderName =
      source === "folder" && allFiles[0]?.webkitRelativePath
        ? allFiles[0].webkitRelativePath.split("/")[0]
        : "";

    items = csvFiles.map((file, index) => ({
      id: `${file.webkitRelativePath || file.name}-${file.size}-${file.lastModified}-${index}`,
      file,
      relativePath: file.webkitRelativePath || file.name,
      status: "pending",
      needsUsd: root?.workflow?.needsUsdCurrency
        ? root.workflow.needsUsdCurrency(file.name, root.RULES)
        : /USD/i.test(file.name),
    }));

    if (csvFiles.length === 0) {
      folderNote = "";
      setError(
        source === "folder"
          ? `文件夹${folderName ? `「${folderName}」` : ""}内没有找到 CSV 文件`
          : "未选中任何 CSV 文件"
      );
    } else if (source === "folder") {
      folderNote =
        rejected > 0
          ? `已从文件夹${folderName ? `「${folderName}」` : ""}载入 ${csvFiles.length} 个 CSV（忽略 ${rejected} 个其他文件）`
          : `已从文件夹${folderName ? `「${folderName}」` : ""}载入 ${csvFiles.length} 个 CSV`;
      setError(null);
    } else if (rejected > 0) {
      folderNote = "";
      setError(`已忽略 ${rejected} 个非 CSV 文件，仅导入 .csv`);
    } else {
      folderNote = "";
      setError(null);
    }

    render();
  }

  function removeItem(id) {
    if (!id || running) return;
    const target = items.find((item) => item.id === id);
    if (!target) return;
    if (target.status === "importing") return;

    items = items.filter((item) => item.id !== id);
    if (items.length === 0) {
      folderNote = "";
      setError(null);
    }
    render();
  }

  function switchTab(panel, tabName) {
    if (!tabName) return;
    const tabs = panel.querySelectorAll(".qbo-ih-tab");
    const panels = panel.querySelectorAll("[data-tab-panel]");
    tabs.forEach((tab) => {
      const active = tab.getAttribute("data-tab") === tabName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((pane) => {
      const active = pane.getAttribute("data-tab-panel") === tabName;
      pane.classList.toggle("is-active", active);
      pane.hidden = !active;
    });
  }

  function buildConfigFieldsHtml(api, settings) {
    const groups = {};
    api.FIELDS.forEach((field) => {
      if (!groups[field.group]) groups[field.group] = [];
      groups[field.group].push(field);
    });

    return Object.keys(groups)
      .map((group) => {
        const fields = groups[group]
          .map((field) => {
            const value = api.getByPath(settings, field.key);
            if (field.type === "checkbox") {
              return `
              <label class="qbo-ih-config-field qbo-ih-config-check">
                <input type="checkbox" data-config-key="${escapeAttr(field.key)}" ${value ? "checked" : ""} />
                <span>
                  <span class="qbo-ih-config-label">${escapeHtml(field.label)}</span>
                  ${field.hint ? `<span class="qbo-ih-config-hint">${escapeHtml(field.hint)}</span>` : ""}
                </span>
              </label>`;
            }
            return `
              <label class="qbo-ih-config-field">
                <span class="qbo-ih-config-label">${escapeHtml(field.label)}</span>
                <input
                  type="${field.type === "number" ? "number" : "text"}"
                  data-config-key="${escapeAttr(field.key)}"
                  value="${escapeAttr(value == null ? "" : String(value))}"
                  ${field.type === "number" ? 'min="0" step="100"' : ""}
                />
                ${field.hint ? `<span class="qbo-ih-config-hint">${escapeHtml(field.hint)}</span>` : ""}
              </label>`;
          })
          .join("");
        return `<div class="qbo-ih-config-group"><h3>${escapeHtml(group)}</h3>${fields}</div>`;
      })
      .join("");
  }

  async function initConfigPanel(panel) {
    const api = globalThis.__QBO_IMPORT__?.configApi;
    const fieldsRoot = panel.querySelector('[data-role="config-fields"]');
    if (!api || !fieldsRoot) return;

    try {
      const settings = await api.loadAndApply();
      fieldsRoot.innerHTML = buildConfigFieldsHtml(api, settings);
    } catch (err) {
      fieldsRoot.innerHTML = `<p class="qbo-ih-config-hint">配置加载失败：${escapeHtml(err?.message || String(err))}</p>`;
    }
  }

  function readConfigFromPanel(panel) {
    const api = globalThis.__QBO_IMPORT__?.configApi;
    if (!api) throw new Error("配置模块未加载");
    const settings = api.deepClone(api.DEFAULTS);
    panel.querySelectorAll("[data-config-key]").forEach((input) => {
      const key = input.getAttribute("data-config-key");
      if (!key) return;
      if (input.type === "checkbox") {
        api.setByPath(settings, key, !!input.checked);
      } else if (input.type === "number") {
        api.setByPath(settings, key, Number(input.value) || 0);
      } else {
        api.setByPath(settings, key, input.value);
      }
    });
    return settings;
  }

  function setConfigStatus(panel, message, tone = "ok") {
    const el = panel.querySelector('[data-role="config-status"]');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.dataset.tone = tone;
    el.textContent = message;
  }

  async function saveConfigFromPanel(panel) {
    const api = globalThis.__QBO_IMPORT__?.configApi;
    if (!api) return;
    try {
      const settings = readConfigFromPanel(panel);
      await api.saveAndApply(settings);
      setConfigStatus(panel, "配置已保存并生效", "ok");
    } catch (err) {
      setConfigStatus(panel, `保存失败：${err?.message || String(err)}`, "error");
    }
  }

  async function resetConfigFromPanel(panel) {
    const api = globalThis.__QBO_IMPORT__?.configApi;
    if (!api) return;
    try {
      const settings = await api.resetToDefaults();
      const fieldsRoot = panel.querySelector('[data-role="config-fields"]');
      if (fieldsRoot) fieldsRoot.innerHTML = buildConfigFieldsHtml(api, settings);
      setConfigStatus(panel, "已恢复默认配置", "ok");
    } catch (err) {
      setConfigStatus(panel, `恢复失败：${err?.message || String(err)}`, "error");
    }
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
    const noteEl = panel.querySelector('[data-role="folder-note"]');
    const startBtn = panel.querySelector('[data-action="start"]');
    const stopBtn = panel.querySelector('[data-action="stop"]');
    const clearBtn = panel.querySelector('[data-action="clear"]');
    const picks = panel.querySelectorAll(".qbo-ih-file-pick");

    count.textContent = String(items.length);
    empty.hidden = items.length > 0;

    if (folderNote) {
      noteEl.hidden = false;
      noteEl.textContent = folderNote;
    } else {
      noteEl.hidden = true;
      noteEl.textContent = "";
    }

    list.innerHTML = items
      .map((item) => {
        const displayPath =
          item.relativePath && item.relativePath !== item.file.name
            ? item.relativePath
            : item.file.name;
        return `
      <li class="qbo-ih-item qbo-ih-item--${item.status}" data-id="${escapeAttr(item.id)}">
        <div class="qbo-ih-item-main">
          <span class="qbo-ih-item-name" title="${escapeAttr(displayPath)}">${escapeHtml(item.file.name)}</span>
          <div class="qbo-ih-item-tools">
            <span class="qbo-ih-badge">${statusLabel(item.status)}</span>
            <button
              type="button"
              class="qbo-ih-remove-btn"
              data-action="remove"
              data-id="${escapeAttr(item.id)}"
              aria-label="删除 ${escapeAttr(item.file.name)}"
              title="从列表删除"
              ${running || item.status === "importing" ? "disabled" : ""}
            >删除</button>
          </div>
        </div>
        <div class="qbo-ih-item-meta">${formatSize(item.file.size)} · CSV${
          item.relativePath && item.relativePath.includes("/")
            ? ` · ${escapeHtml(item.relativePath)}`
            : ""
        }${item.needsUsd ? ' · <span class="qbo-ih-tag-usd">先切 USD</span>' : ""}${
          item.error ? ` · ${escapeHtml(item.error)}` : ""
        }</div>
      </li>`;
      })
      .join("");

    startBtn.disabled = running || items.length === 0 || items.every((i) => i.status === "done");
    stopBtn.disabled = !running;
    clearBtn.disabled = running || items.length === 0;
    picks.forEach((pick) => {
      pick.classList.toggle("is-disabled", running);
    });
    panel.classList.toggle("is-running", running);
    const fileInput = panel.querySelector('[data-role="file-input"]');
    const folderInput = panel.querySelector('[data-role="folder-input"]');
    if (fileInput) fileInput.disabled = running;
    if (folderInput) folderInput.disabled = running;

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

    // 开始前再应用一次已保存配置
    try {
      await root.configApi?.loadAndApply?.();
    } catch {
      // ignore
    }

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
})();
