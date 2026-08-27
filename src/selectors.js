/**
 * QBO Journal Entry 页面选择器（来自真实页面 DOM）。
 */
(() => {
  const root = (globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {});

  root.SELECTORS = {
    /** Journal Entry 弹层根节点（保存成功后通常会关闭） */
    pageRoot: '[data-testid="txp-accounting-layout"]',
    /** Import 按钮（QBO 上会触发系统文件框；默认 skipImportButtonClick 时不点） */
    importButton: ".txp-capability-journalImportBtn-NPulq, .txp-capability-journalImportContainer-O4fvl button",
    /** 页面内隐藏的 CSV file input —— DataTransfer 直写目标 */
    fileInput: "#csvFileInput, input#csvFileInput, .txp-capability-hiddenInput-weRUg",
    /** 底部 Save（非 Save and new） */
    saveButton: '[data-testid="save_button"]',
    /** 若要用「Save and new」可改为此选择器 */
    saveAndNewButton: '[data-testid="txp-save-button"] button',
    /**
     * CSV 解析完成、可点保存的选择器。
     * 留空：固定等待 TIMEOUTS.waitAfterImport（默认 10s）。
     */
    readyToSaveIndicator: "",
    /**
     * 保存成功提示选择器。
     * 留空：固定等待 TIMEOUTS.waitAfterSave（默认 6s）。
     * QBO 成功 toast 常见为 role=alert，文案含 "saved"。
     */
    saveSuccessIndicator: "",
    /**
     * 页面错误 toast/banner。
     * 注意：QBO 成功 toast 也可能是 role=alert，workflow 会按文案过滤，避免把 "saved" 当成失败。
     */
    errorIndicator: '[role="alert"], .idsTSBanner, [data-testid*="error"]',
    /** QBO 币种 combobox（非原生 select） */
    currencyTrigger: '[data-testid="currency-type"]',
    /** 下拉打开后 USD 选项（id 动态，用 role=option + 文案匹配更稳） */
    currencyOptionUsd: '[role="listbox"] [role="option"]',
    currencyListbox: '[role="listbox"]',
  };

  root.RULES = {
    acceptExtensions: [".csv"],
    usdFilenamePattern: /USD/i,
    usdCurrencyValue: "USD",
    /** QBO 已有 #csvFileInput，直接 DataTransfer，不点 Import 避免弹系统文件框 */
    skipImportButtonClick: true,
  };

  root.TIMEOUTS = {
    waitForElement: 15000,
    /** 无 readyToSaveIndicator 时：导入后固定等待 */
    waitAfterImport: 10000,
    /** 无 saveSuccessIndicator 时：保存后固定等待 */
    waitAfterSave: 6000,
    betweenFiles: 1200,
    afterCurrencyChange: 600,
  };
})();
