/**
 * 点击扩展图标 → 注入脚本/样式 → 打开右侧操作面板。
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  const tabId = tab.id;
  const restricted =
    !tab.url ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("edge://") ||
    tab.url.startsWith("about:");

  if (restricted) {
    console.error("[QBO Import] 当前页面不允许注入:", tab.url);
    return;
  }

  const scriptFiles = [
    "src/selectors.js",
    "src/dom.js",
    "src/effects.js",
    "src/workflow.js",
    "src/content.js",
  ];

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: scriptFiles,
    });

    // 用 insertCSS 注入样式，避免 web_accessible_resources 域名限制导致面板无样式
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["src/panel.css"],
      });
    } catch (cssErr) {
      console.warn("[QBO Import] insertCSS failed:", cssErr);
    }

    // 直接调用 toggle，比 sendMessage 更稳（避免首次注入竞态）
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const toggle = globalThis.__QBO_IMPORT__?.togglePanel;
        if (typeof toggle !== "function") {
          return { ok: false, reason: "togglePanel 未就绪，请刷新页面后重试" };
        }
        toggle();
        return { ok: true };
      },
    });

    if (!result?.ok) {
      throw new Error(result?.reason || "面板未能打开");
    }
  } catch (err) {
    console.error("[QBO Import] failed to toggle panel:", err, tab.url);

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (message) => {
          window.alert(`QBO 导入助手未能在此页面打开：\n${message}`);
        },
        args: [err?.message || String(err)],
      });
    } catch {
      // 页面完全不可注入时忽略
    }
  }
});
