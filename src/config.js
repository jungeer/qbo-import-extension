/**
 * 可配置项：默认值、读写 storage、应用到运行时 SELECTORS / RULES / TIMEOUTS。
 */
(() => {
  const root = (globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {});
  const STORAGE_KEY = "qboImportSettings";

  const DEFAULTS = {
    selectors: {
      pageRoot: '[data-testid="txp-accounting-layout"]',
      importButton:
        ".txp-capability-journalImportBtn-NPulq, .txp-capability-journalImportContainer-O4fvl button",
      fileInput: "#csvFileInput, input#csvFileInput, .txp-capability-hiddenInput-weRUg",
      saveButton:
        '[data-testid="txp-save-button"] button.SplitButton-buttonWrapper-e54ef61, [data-testid="txp-save-button"] button:not([aria-haspopup]), [data-testid="txp-save-button"] button',
      saveOnlyButton: '[data-testid="save_button"]',
      readyToSaveIndicator: "",
      saveSuccessIndicator: "",
      errorIndicator: '[role="alert"], .idsTSBanner, [data-testid*="error"]',
      currencyTrigger: '[data-testid="currency-type"]',
      currencyOptionUsd: '[role="listbox"] [role="option"]',
      currencyListbox: '[role="listbox"]',
    },
    rules: {
      acceptExtensions: ".csv",
      usdFilenamePattern: "USD",
      usdCurrencyValue: "USD",
      skipImportButtonClick: true,
    },
    timeouts: {
      waitForElement: 15000,
      waitAfterImport: 10000,
      waitAfterSave: 6000,
      betweenFiles: 1200,
      afterCurrencyChange: 600,
    },
  };

  /** 表单字段元数据：用于面板渲染 */
  const FIELDS = [
    {
      group: "选择器",
      key: "selectors.fileInput",
      label: "文件输入框",
      type: "text",
      hint: "CSV 的 input[type=file]",
    },
    {
      group: "选择器",
      key: "selectors.importButton",
      label: "Import 按钮",
      type: "text",
      hint: "默认可不点，见下方开关",
    },
    {
      group: "选择器",
      key: "selectors.saveButton",
      label: "保存按钮",
      type: "text",
      hint: "当前默认 Save and new",
    },
    {
      group: "选择器",
      key: "selectors.saveOnlyButton",
      label: "仅 Save 按钮",
      type: "text",
    },
    {
      group: "选择器",
      key: "selectors.currencyTrigger",
      label: "币种下拉",
      type: "text",
    },
    {
      group: "选择器",
      key: "selectors.currencyListbox",
      label: "币种列表容器",
      type: "text",
    },
    {
      group: "选择器",
      key: "selectors.currencyOptionUsd",
      label: "币种选项",
      type: "text",
      hint: "打开后匹配含 USD 的 option",
    },
    {
      group: "选择器",
      key: "selectors.readyToSaveIndicator",
      label: "可保存指示器",
      type: "text",
      hint: "留空则固定等待「导入后等待」",
    },
    {
      group: "选择器",
      key: "selectors.saveSuccessIndicator",
      label: "保存成功指示器",
      type: "text",
      hint: "留空则固定等待「保存后等待」",
    },
    {
      group: "选择器",
      key: "selectors.errorIndicator",
      label: "错误提示",
      type: "text",
    },
    {
      group: "选择器",
      key: "selectors.pageRoot",
      label: "页面根节点",
      type: "text",
    },
    {
      group: "规则",
      key: "rules.acceptExtensions",
      label: "允许后缀",
      type: "text",
      hint: "逗号分隔，如 .csv",
    },
    {
      group: "规则",
      key: "rules.usdFilenamePattern",
      label: "USD 文件名关键字",
      type: "text",
      hint: "文件名包含则先切 USD",
    },
    {
      group: "规则",
      key: "rules.usdCurrencyValue",
      label: "目标币种",
      type: "text",
    },
    {
      group: "规则",
      key: "rules.skipImportButtonClick",
      label: "跳过点击 Import",
      type: "checkbox",
      hint: "推荐开启，直接 DataTransfer 写入",
    },
    {
      group: "等待(毫秒)",
      key: "timeouts.waitAfterImport",
      label: "导入后等待",
      type: "number",
      hint: "无「可保存指示器」时使用",
    },
    {
      group: "等待(毫秒)",
      key: "timeouts.waitAfterSave",
      label: "保存后等待",
      type: "number",
      hint: "无「保存成功指示器」时使用",
    },
    {
      group: "等待(毫秒)",
      key: "timeouts.waitForElement",
      label: "找元素超时",
      type: "number",
    },
    {
      group: "等待(毫秒)",
      key: "timeouts.betweenFiles",
      label: "文件间隔",
      type: "number",
    },
    {
      group: "等待(毫秒)",
      key: "timeouts.afterCurrencyChange",
      label: "切币种后等待",
      type: "number",
    },
  ];

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function getByPath(obj, path) {
    return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  function setByPath(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!cur[key] || typeof cur[key] !== "object") cur[key] = {};
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function mergeSettings(saved) {
    const base = deepClone(DEFAULTS);
    if (!saved || typeof saved !== "object") return base;
    for (const section of ["selectors", "rules", "timeouts"]) {
      if (saved[section] && typeof saved[section] === "object") {
        Object.assign(base[section], saved[section]);
      }
    }
    return base;
  }

  function toRuntime(settings) {
    const s = mergeSettings(settings);
    const extRaw = String(s.rules.acceptExtensions || ".csv");
    const acceptExtensions = extRaw
      .split(/[,，\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.startsWith(".") ? x : `.${x}`));

    let usdFilenamePattern;
    try {
      const raw = String(s.rules.usdFilenamePattern || "USD").trim() || "USD";
      // 若用户写成 /USD/i 则直接用；否则当普通关键字
      if (raw.startsWith("/") && raw.lastIndexOf("/") > 0) {
        const last = raw.lastIndexOf("/");
        usdFilenamePattern = new RegExp(raw.slice(1, last), raw.slice(last + 1) || "i");
      } else {
        usdFilenamePattern = new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      }
    } catch {
      usdFilenamePattern = /USD/i;
    }

    return {
      SELECTORS: { ...s.selectors },
      RULES: {
        acceptExtensions,
        usdFilenamePattern,
        usdCurrencyValue: String(s.rules.usdCurrencyValue || "USD"),
        skipImportButtonClick: !!s.rules.skipImportButtonClick,
      },
      TIMEOUTS: {
        waitForElement: Number(s.timeouts.waitForElement) || 15000,
        waitAfterImport: Number(s.timeouts.waitAfterImport) || 10000,
        waitAfterSave: Number(s.timeouts.waitAfterSave) || 6000,
        betweenFiles: Number(s.timeouts.betweenFiles) || 1200,
        afterCurrencyChange: Number(s.timeouts.afterCurrencyChange) || 600,
      },
      settings: s,
    };
  }

  function applySettings(settings) {
    const runtime = toRuntime(settings);
    root.SELECTORS = runtime.SELECTORS;
    root.RULES = runtime.RULES;
    root.TIMEOUTS = runtime.TIMEOUTS;
    root.CONFIG = runtime.settings;
    return runtime.settings;
  }

  function storageGet() {
    return new Promise((resolve) => {
      if (globalThis.chrome?.storage?.local?.get) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          resolve(result?.[STORAGE_KEY] || null);
        });
        return;
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
  }

  function storageSet(value) {
    return new Promise((resolve) => {
      if (globalThis.chrome?.storage?.local?.set) {
        chrome.storage.local.set({ [STORAGE_KEY]: value }, () => resolve(true));
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        resolve(true);
      } catch {
        resolve(false);
      }
    });
  }

  async function loadAndApply() {
    const saved = await storageGet();
    return applySettings(saved);
  }

  async function saveAndApply(settings) {
    const merged = mergeSettings(settings);
    await storageSet(merged);
    applySettings(merged);
    return merged;
  }

  async function resetToDefaults() {
    await storageSet(null);
    // clear key entirely when possible
    if (globalThis.chrome?.storage?.local?.remove) {
      await new Promise((resolve) => chrome.storage.local.remove([STORAGE_KEY], resolve));
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return applySettings(null);
  }

  // 初始化默认到运行时（随后 loadAndApply 会覆盖）
  applySettings(null);

  root.configApi = {
    STORAGE_KEY,
    DEFAULTS,
    FIELDS,
    deepClone,
    getByPath,
    setByPath,
    mergeSettings,
    toRuntime,
    applySettings,
    loadAndApply,
    saveAndApply,
    resetToDefaults,
  };
})();
