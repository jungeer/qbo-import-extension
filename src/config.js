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

  /** 表单字段元数据：文案按「切币种 → 写入 CSV → 等待解析 → Save and new → 下一个」流程编写 */
  const FIELDS = [
    {
      group: "① 页面按钮与输入框",
      key: "selectors.fileInput",
      label: "CSV 文件输入框（隐藏 input）",
      type: "text",
      hint: "Journal Entry 页里真正接收 CSV 的 <input type=\"file\">。插件用 DataTransfer 把文件写进这里，一般是 #csvFileInput。",
    },
    {
      group: "① 页面按钮与输入框",
      key: "selectors.importButton",
      label: "Import 按钮",
      type: "text",
      hint: "页面上的 Import 按钮。开启「跳过点击 Import」时不会点它，避免弹出系统文件选择框；仅在需要模拟人工点 Import 时使用。",
    },
    {
      group: "① 页面按钮与输入框",
      key: "selectors.saveButton",
      label: "Save and new 按钮（当前实际点击）",
      type: "text",
      hint: "保存并新建下一条 Journal Entry。当前流程点这个，方便连续导入下一个 CSV。",
    },
    {
      group: "① 页面按钮与输入框",
      key: "selectors.saveOnlyButton",
      label: "Save 按钮（仅保存）",
      type: "text",
      hint: "底部普通 Save（不新建）。备用选择器；当前流程默认点的是上面的 Save and new。",
    },
    {
      group: "② 币种 Currency",
      key: "selectors.currencyTrigger",
      label: "Currency 下拉框",
      type: "text",
      hint: "页面 Currency 输入框/下拉。文件名含 USD 时，导入前先点开它切换币种。",
    },
    {
      group: "② 币种 Currency",
      key: "selectors.currencyListbox",
      label: "Currency 下拉列表容器",
      type: "text",
      hint: "点开 Currency 后出现的选项列表容器，用来等待列表渲染完成。",
    },
    {
      group: "② 币种 Currency",
      key: "selectors.currencyOptionUsd",
      label: "Currency 选项（匹配 USD）",
      type: "text",
      hint: "列表里的选项节点。插件会在这些选项中找文案包含「目标币种」（默认 USD）的那一项并点击。",
    },
    {
      group: "③ 成功 / 失败状态",
      key: "selectors.readyToSaveIndicator",
      label: "CSV 解析完成（可点 Save）指示器",
      type: "text",
      hint: "写入 CSV 后，页面出现该元素才点 Save and new。留空则固定等待下方「写入 CSV 后等待」。",
    },
    {
      group: "③ 成功 / 失败状态",
      key: "selectors.saveSuccessIndicator",
      label: "Save / Save and new 成功指示器",
      type: "text",
      hint: "保存成功后的提示元素（如 toast）。留空则固定等待下方「点击 Save and new 后等待」。",
    },
    {
      group: "③ 成功 / 失败状态",
      key: "selectors.errorIndicator",
      label: "错误提示",
      type: "text",
      hint: "导入或保存失败时页面上的报错区域。注意：成功 toast（含 saved）不会当成失败。",
    },
    {
      group: "③ 成功 / 失败状态",
      key: "selectors.pageRoot",
      label: "Journal Entry 弹层根节点",
      type: "text",
      hint: "整页 Journal Entry 对话框根元素。可用于判断页面是否还在，一般保持默认即可。",
    },
    {
      group: "④ 导入规则",
      key: "rules.acceptExtensions",
      label: "允许的文件后缀",
      type: "text",
      hint: "只导入这些后缀，多个用逗号分隔。当前业务是 CSV，默认 .csv。",
    },
    {
      group: "④ 导入规则",
      key: "rules.usdFilenamePattern",
      label: "需要切 USD 的文件名关键字",
      type: "text",
      hint: "文件名包含该关键字时，先切 Currency 再导入。默认 USD（不区分大小写）。也可填正则如 /USD/i。",
    },
    {
      group: "④ 导入规则",
      key: "rules.usdCurrencyValue",
      label: "要切换到的币种",
      type: "text",
      hint: "匹配到关键字后，Currency 下拉要选中的币种文案/值，默认 USD。",
    },
    {
      group: "④ 导入规则",
      key: "rules.skipImportButtonClick",
      label: "跳过点击 Import（推荐）",
      type: "checkbox",
      hint: "开启后：不点 Import，直接把 CSV 写入隐藏文件框。避免弹出系统「选择文件」对话框，更适合批量自动化。",
    },
    {
      group: "⑤ 等待时间（毫秒）",
      key: "timeouts.waitAfterImport",
      label: "写入 CSV 后等待",
      type: "number",
      hint: "DataTransfer 写入后，等后端解析的时间，再点 Save and new。没有「解析完成指示器」时生效。默认 10000（约 10 秒）。",
    },
    {
      group: "⑤ 等待时间（毫秒）",
      key: "timeouts.waitAfterSave",
      label: "点击 Save and new 后等待",
      type: "number",
      hint: "点完 Save and new 后，等保存完成再处理下一个文件。没有「保存成功指示器」时生效。默认 6000（约 6 秒）。",
    },
    {
      group: "⑤ 等待时间（毫秒）",
      key: "timeouts.waitForElement",
      label: "查找页面元素超时",
      type: "number",
      hint: "找 Import / Save and new / Currency / 文件框等元素时，最多等这么久。超时会报错停止。",
    },
    {
      group: "⑤ 等待时间（毫秒）",
      key: "timeouts.betweenFiles",
      label: "两个文件之间的间隔",
      type: "number",
      hint: "上一个文件 Save and new 完成后，稍等再开始下一个 CSV，给页面一点恢复时间。",
    },
    {
      group: "⑤ 等待时间（毫秒）",
      key: "timeouts.afterCurrencyChange",
      label: "切换 Currency 后等待",
      type: "number",
      hint: "选完 USD 等币种后短暂等待，再写入 CSV，避免页面还没切完币种。",
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
