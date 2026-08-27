/**
 * DOM 辅助：等待元素、点击、写入文件、轮询成功/失败。
 */
(() => {
  const root = (globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {});

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function query(selector, parent = document) {
    return parent.querySelector(selector);
  }

  async function waitForElement(selector, timeoutMs) {
    const existing = query(selector);
    if (existing) return existing;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`等待元素超时: ${selector}`));
      }, timeoutMs);

      const observer = new MutationObserver(() => {
        const el = query(selector);
        if (el) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  function clickElement(el) {
    if (!el) throw new Error("点击失败：目标元素不存在");
    el.scrollIntoView({ block: "center", inline: "nearest" });
    // 只用一次原生 click，避免 dual-fire 导致页面逻辑执行两遍
    if (typeof el.click === "function") {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
  }

  /**
   * 设置原生 <select> 的值并触发 change/input。
   */
  function setSelectValue(selectEl, value) {
    if (!selectEl || selectEl.tagName !== "SELECT") {
      throw new Error("currencySelect 不是有效的 <select>");
    }
    const matched = Array.from(selectEl.options).find(
      (opt) => opt.value === value || opt.textContent.trim() === value
    );
    if (!matched) {
      throw new Error(`币种下拉中找不到选项: ${value}`);
    }
    selectEl.value = matched.value;
    selectEl.dispatchEvent(new Event("input", { bubbles: true }));
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * 切换币种：优先原生 select；否则点开自定义下拉再点 USD 选项。
   */
  async function ensureCurrency(selectors, value, timeoutMs) {
    if (selectors.currencySelect) {
      const selectEl = await waitForElement(selectors.currencySelect, timeoutMs);
      if (selectEl.tagName === "SELECT") {
        if (selectEl.value === value) return "already";
        setSelectValue(selectEl, value);
        return "select";
      }
    }

    if (selectors.currencyTrigger && selectors.currencyOptionUsd) {
      const trigger = await waitForElement(selectors.currencyTrigger, timeoutMs);
      clickElement(trigger);
      const option = await waitForElement(selectors.currencyOptionUsd, timeoutMs);
      clickElement(option);
      return "custom";
    }

    throw new Error("未配置可用的币种选择器（currencySelect 或 currencyTrigger + currencyOptionUsd）");
  }

  /**
   * 把本地 File 写入页面上的 file input。
   * 使用 DataTransfer，兼容多数站点对 change 事件的监听。
   */
  function assignFileToInput(input, file) {
    if (!input || input.tagName !== "INPUT" || input.type !== "file") {
      throw new Error("fileInput 不是有效的 <input type=\"file\">");
    }

    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * 先记录成功态基线，再执行 action，然后轮询等待「新的」成功或错误。
   * 这样可避免按钮点击已同步改完 DOM 后，把新成功误当成初始态而永远等不到。
   */
  async function waitForOutcome({
    successSelector,
    errorSelector,
    timeoutMs,
    label,
    action,
  }) {
    const initialSuccess = successSelector ? query(successSelector) : null;
    const initialVisible = !!(initialSuccess && isVisible(initialSuccess));
    const initialText = initialVisible
      ? (initialSuccess.textContent || "").trim()
      : null;
    let sawHidden = !initialVisible;

    if (typeof action === "function") {
      await action();
    }

    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      if (errorSelector) {
        const errEl = query(errorSelector);
        if (errEl && isVisible(errEl)) {
          const msg =
            (errEl.textContent || "").trim() || `${label}失败（页面报错）`;
          throw new Error(msg);
        }
      }

      if (successSelector) {
        const okEl = query(successSelector);
        const visible = !!(okEl && isVisible(okEl));
        if (!visible) {
          sawHidden = true;
        } else {
          const text = (okEl.textContent || "").trim();
          const isFresh =
            sawHidden || text !== initialText || initialText === null;
          if (isFresh) return okEl;
        }
      }

      await sleep(250);
    }

    throw new Error(`${label}超时（${timeoutMs}ms）`);
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  root.dom = {
    sleep,
    query,
    waitForElement,
    clickElement,
    setSelectValue,
    ensureCurrency,
    assignFileToInput,
    waitForOutcome,
    isVisible,
  };
})();
