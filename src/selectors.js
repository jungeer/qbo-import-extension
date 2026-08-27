/**
 * QBO 页面元素选择器占位配置。
 * 等你提供真实页面按钮/输入框后，只需改这里即可。
 */
(() => {
  const root = (globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {});

  root.SELECTORS = {
    /** 触发「导入 / Upload / Attach」的按钮 */
    importButton: '[data-qbo-import="import-button"]',
    /** 真正接收文件的 <input type="file"> */
    fileInput: '[data-qbo-import="file-input"]',
    /** 导入完成后的「保存 / Save」按钮 */
    saveButton: '[data-qbo-import="save-button"]',
    /** 保存成功后的成功提示（出现即视为成功） */
    successIndicator: '[data-qbo-import="success"]',
    /** 页面错误提示（出现即抛错） */
    errorIndicator: '[data-qbo-import="error"]',
    /**
     * 币种下拉框（优先原生 <select>）。
     * 若是自定义下拉，可再配 currencyTrigger + currencyOptionUsd。
     */
    currencySelect: '[data-qbo-import="currency-select"]',
    /** 自定义币种下拉的打开按钮（可选） */
    currencyTrigger: '[data-qbo-import="currency-trigger"]',
    /** 自定义下拉中的 USD 选项（可选） */
    currencyOptionUsd: '[data-qbo-import="currency-option-usd"]',
  };

  root.RULES = {
    /** 仅接受 .csv */
    acceptExtensions: [".csv"],
    /** 文件名包含该模式时，导入前先切到 USD */
    usdFilenamePattern: /USD/i,
    /** 写入原生 select 时的 value */
    usdCurrencyValue: "USD",
  };

  root.TIMEOUTS = {
    waitForElement: 15000,
    waitAfterImport: 30000,
    waitAfterSave: 30000,
    betweenFiles: 800,
    afterCurrencyChange: 400,
  };
})();
