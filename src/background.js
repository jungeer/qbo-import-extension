/**
 * 点击扩展图标 → 向当前标签页按顺序注入脚本并切换右侧操作面板。
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        "src/selectors.js",
        "src/dom.js",
        "src/workflow.js",
        "src/content.js",
      ],
    });

    await chrome.tabs.sendMessage(tab.id, { type: "QBO_IMPORT_TOGGLE_PANEL" });
  } catch (err) {
    console.error("[QBO Import] failed to toggle panel:", err);
  }
});
