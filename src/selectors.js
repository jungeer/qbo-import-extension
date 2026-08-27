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
     * CSV 解析完成、可点保存的参考：借贷合计不再为 0.00。
     * 留空则走 waitForCsvParsed() 内置逻辑。
     */
    readyToSaveIndicator: "",
    /** 保存成功：弹层关闭。留空则走 waitForSaveComplete() 内置逻辑。 */
    saveSuccessIndicator: "",
    /** 页面错误 toast/banner（待你补充具体选择器） */
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
    waitAfterImport: 60000,
    waitAfterSave: 45000,
    betweenFiles: 1200,
    afterCurrencyChange: 600,
  };
})();
