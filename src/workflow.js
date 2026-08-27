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
    fx?.setStatus?.(`等待 CSV 解析 · ${file.name}`, "run");
    if (SELECTORS.readyToSaveIndicator) {
      await dom.waitForElement(SELECTORS.readyToSaveIndicator, TIMEOUTS.waitAfterImport);
    } else {
      await dom.waitForCsvParsed(TIMEOUTS.waitAfterImport);
    }

    // 5) 点击 Save 并等待完成
    const saveBtn = await dom.waitForElement(SELECTORS.saveButton, TIMEOUTS.waitForElement);
    await fx?.spotlight?.(saveBtn, `点击 Save · ${file.name}`);
    dom.clickElement(saveBtn);
    fx?.setStatus?.(`等待保存完成 · ${file.name}`, "run");

    if (SELECTORS.saveSuccessIndicator) {
      await dom.waitForOutcome({
        successSelector: SELECTORS.saveSuccessIndicator,
        errorSelector: SELECTORS.errorIndicator || null,
        timeoutMs: TIMEOUTS.waitAfterSave,
        label: "保存",
      });
    } else {
      const started = Date.now();
      while (Date.now() - started < TIMEOUTS.waitAfterSave) {
        if (SELECTORS.errorIndicator) {
          const errEl = dom.query(SELECTORS.errorIndicator);
          if (errEl && dom.isVisible(errEl)) {
            const msg = (errEl.textContent || "").trim() || "保存失败（页面报错）";
            throw new Error(msg);
          }
        }
        const layout = dom.query(SELECTORS.pageRoot || '[data-testid="txp-accounting-layout"]');
        if (!layout || !dom.isVisible(layout)) break;
        await dom.sleep(350);
      }
      const layout = dom.query(SELECTORS.pageRoot || '[data-testid="txp-accounting-layout"]');
      if (layout && dom.isVisible(layout)) {
        await dom.waitForSaveComplete(Math.max(5000, TIMEOUTS.waitAfterSave - (Date.now() - started)));
      }
    }

    fx?.clearSpot?.();
  }

  root.workflow = { runImportQueue, needsUsdCurrency, isAllowedExtension };
})();
