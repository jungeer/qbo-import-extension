/**
 * 逐个文件导入流程：
 * （USD 文件名则先切币种）→ DataTransfer 写入 #csvFileInput → 等解析 → 点 Save → 等完成
 */
(() => {
  const root = (globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {});

  function needsUsdCurrency(fileName, rules) {
    const pattern = rules?.usdFilenamePattern || /USD/i;
    return pattern.test(fileName || "");
  }

  function isAllowedExtension(fileName, rules) {
    const exts = rules?.acceptExtensions;
    if (!exts || !exts.length) return true;
    const lower = String(fileName || "").toLowerCase();
    return exts.some((ext) => lower.endsWith(String(ext).toLowerCase()));
  }

  /** QBO 成功 toast 文案如 "Journal Entry 3422 saved" / "savedClose" */
  function looksLikeSaveSuccess(text) {
    const t = normalizeToastText(text);
    if (!t) return false;
    return /saved/i.test(t) && !/\b(error|failed|unable|invalid)\b/i.test(t);
  }

  function looksLikeError(text) {
    const t = normalizeToastText(text);
    if (!t) return false;
    if (looksLikeSaveSuccess(t)) return false;
    return /\b(error|failed|unable|invalid|something went wrong)\b/i.test(t);
  }

  /** 规范化 toast 文案：去掉 Close 按钮粘连（含 savedClose） */
  function normalizeToastText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/([a-z])Close\b/gi, "$1")
      .replace(/\bClose\b/gi, "")
      .trim();
  }

  function readVisibleMessage(dom, selector) {
    if (!selector) return "";
    const nodes = document.querySelectorAll(selector);
    for (const el of nodes) {
      if (!dom.isVisible(el)) continue;
      const text = normalizeToastText(el.textContent || "");
      if (text) return text;
    }
    return "";
  }

  async function runImportQueue(options) {
    const { files, onFileStatus, onError, onRunningChange, shouldStop } = options;
    const { SELECTORS, TIMEOUTS, RULES, dom, fx } = root;

    let outcome = "idle";
    onRunningChange(true);
    onError(null);
    fx?.start?.(files.length);

    try {
      for (let i = 0; i < files.length; i++) {
        if (shouldStop()) {
          onError("已停止导入");
          outcome = "stopped";
          break;
        }

        const file = files[i];
        onFileStatus(i, "importing");
        fx?.onFileStart?.(file.name, i, files.length);

        try {
          if (!isAllowedExtension(file.name, RULES)) {
            throw new Error(`仅支持 ${RULES.acceptExtensions.join(" / ")} 文件`);
          }
          await importOneFile(file, SELECTORS, TIMEOUTS, RULES, dom, fx);
          onFileStatus(i, "done");
          fx?.onFileDone?.(file.name);
        } catch (err) {
          const message = err?.message || String(err);
          onFileStatus(i, "error", message);
          onError(`文件「${file.name}」导入失败：${message}`);
          fx?.onFileError?.(file.name);
          outcome = "error";
          break;
        }

        if (i < files.length - 1) {
          await dom.sleep(TIMEOUTS.betweenFiles);
        }
      }

      if (outcome === "idle") {
        outcome = files.length > 0 ? "done" : "idle";
      }
    } finally {
      fx?.stop?.(outcome);
      onRunningChange(false);
    }
  }

  async function importOneFile(file, SELECTORS, TIMEOUTS, RULES, dom, fx) {
    // 0) USD 文件名 → 切换币种
    if (needsUsdCurrency(file.name, RULES)) {
      fx?.setStatus?.(`切换币种 USD · ${file.name}`, "run");
      const currencyEl = dom.query(SELECTORS.currencyTrigger) || dom.query(SELECTORS.currencySelect);
      if (currencyEl) await fx?.spotlight?.(currencyEl, "切换币种 → USD");
      await dom.ensureCurrency(SELECTORS, RULES.usdCurrencyValue || "USD", TIMEOUTS.waitForElement);
      await dom.sleep(TIMEOUTS.afterCurrencyChange || 400);
    }

    // 1) 找 file input
    const fileInput = await dom.waitForElement(SELECTORS.fileInput, TIMEOUTS.waitForElement);

    // 2) 可选：点 Import（QBO 默认跳过，避免弹系统文件框）
    if (!RULES.skipImportButtonClick && SELECTORS.importButton) {
      const importBtn = await dom.waitForElement(SELECTORS.importButton, TIMEOUTS.waitForElement);
      await fx?.spotlight?.(importBtn, `点击 Import · ${file.name}`);
      dom.clickElement(importBtn);
    }

    // 3) DataTransfer 写入 CSV
    fx?.setStatus?.(`写入 CSV · ${file.name}`, "run");
    await fx?.spotlight?.(fileInput, "写入 CSV", 360);
    dom.assignFileToInput(fileInput, file);

    // 4) 等待 CSV 解析完成（可保存）
    // 有选择器则等选择器；否则固定等待 waitAfterImport（默认 10s）
    if (SELECTORS.readyToSaveIndicator) {
      fx?.setStatus?.(`等待 CSV 解析 · ${file.name}`, "run");
      await dom.waitForElement(SELECTORS.readyToSaveIndicator, TIMEOUTS.waitAfterImport);
    } else {
      const waitMs = TIMEOUTS.waitAfterImport || 10000;
      fx?.setStatus?.(`等待解析 ${Math.round(waitMs / 1000)}s · ${file.name}`, "run");
      await dom.sleep(waitMs);
    }

    // 5) 点击 Save 并等待完成
    const saveBtn = await dom.waitForElement(SELECTORS.saveButton, TIMEOUTS.waitForElement);
    await fx?.spotlight?.(saveBtn, `点击 Save · ${file.name}`);
    dom.clickElement(saveBtn);

    // 有成功选择器则等选择器；否则固定等待 waitAfterSave（默认 6s）
    if (SELECTORS.saveSuccessIndicator) {
      fx?.setStatus?.(`等待保存完成 · ${file.name}`, "run");
      await dom.waitForOutcome({
        successSelector: SELECTORS.saveSuccessIndicator,
        errorSelector: SELECTORS.errorIndicator || null,
        timeoutMs: TIMEOUTS.waitAfterSave,
        label: "保存",
      });
    } else {
      const waitMs = TIMEOUTS.waitAfterSave || 6000;
      fx?.setStatus?.(`等待保存 ${Math.round(waitMs / 1000)}s · ${file.name}`, "run");
      await dom.sleep(waitMs);

      // QBO 成功 toast 也可能匹配 errorIndicator（role=alert），需按文案区分
      // 注意：文案可能是 "Journal Entry 3428 savedClose"（Close 无空格粘连）
      const toastText = readVisibleMessage(dom, SELECTORS.errorIndicator);
      if (toastText) {
        if (looksLikeSaveSuccess(toastText)) {
          fx?.setStatus?.(`保存成功 · ${toastText}`, "done");
        } else if (looksLikeError(toastText)) {
          throw new Error(toastText);
        }
        // 其它 toast 忽略，避免误报
      }
    }

    fx?.clearSpot?.();
  }

  root.workflow = {
    runImportQueue,
    needsUsdCurrency,
    isAllowedExtension,
    looksLikeSaveSuccess,
  };
})();
