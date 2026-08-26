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
  };

  root.TIMEOUTS = {
    waitForElement: 15000,
    waitAfterImport: 30000,
    waitAfterSave: 30000,
    betweenFiles: 800,
  };
})();
