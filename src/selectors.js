/**
 * 默认选择器 / 规则 / 超时（实际生效值由 config.js 管理，可被面板配置覆盖）。
 */
(() => {
  const root = (globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {});
  // 占位：config.js 会立即为可运行配置
  root.SELECTORS = root.SELECTORS || {};
  root.RULES = root.RULES || {};
  root.TIMEOUTS = root.TIMEOUTS || {};
})();
