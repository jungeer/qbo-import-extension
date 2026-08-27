/**
 * 逐个文件导入流程：
 * （USD 文件名则先切币种）→ 点导入 → DataTransfer 写入 → 点保存 → 标记完成
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

  /**
   * @param {object} options
   * @param {File[]} options.files
   * @param {(index: number, status: string, error?: string) => void} options.onFileStatus
   * @param {(message: string | null) => void} options.onError
   * @param {(running: boolean) => void} options.onRunningChange
   * @param {() => boolean} options.shouldStop
   */
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
        const allDone = files.length > 0;
        outcome = allDone ? "done" : "idle";
      }
    } finally {
      fx?.stop?.(outcome);
      onRunningChange(false);
    }
  }

  async function importOneFile(file, SELECTORS, TIMEOUTS, RULES, dom, fx) {
    // 0) 文件名含 USD → 先切换币种下拉为 USD
    if (needsUsdCurrency(file.name, RULES)) {
      fx?.setStatus?.(`切换币种 USD · ${file.name}`, "run");
      const currencyEl =
        dom.query(SELECTORS.currencySelect) ||
        dom.query(SELECTORS.currencyTrigger);
      if (currencyEl) {
        await fx?.spotlight?.(currencyEl, "切换币种 → USD");
      }
      await dom.ensureCurrency(
        SELECTORS,
        RULES.usdCurrencyValue || "USD",
        TIMEOUTS.waitForElement
      );
      await dom.sleep(TIMEOUTS.afterCurrencyChange || 400);
    }

    // 1) 点击导入按钮（占位）
    const importBtn = await dom.waitForElement(
      SELECTORS.importButton,
      TIMEOUTS.waitForElement
    );
    await fx?.spotlight?.(importBtn, `点击导入 · ${file.name}`);
    dom.clickElement(importBtn);

    // 2) 找到 file input 并写入当前文件（占位）
    const fileInput = await dom.waitForElement(
      SELECTORS.fileInput,
      TIMEOUTS.waitForElement
    );
    fx?.setStatus?.(`写入文件 · ${file.name}`, "run");
    await fx?.spotlight?.(fileInput, "写入 CSV", 360);
    dom.assignFileToInput(fileInput, file);

    // 3) 等待导入阶段成功（若页面有成功态；没有配置成功选择器则短暂等待）
    if (SELECTORS.successIndicator && SELECTORS.successIndicator.includes("data-qbo-import")) {
      // 占位阶段：导入后可能还没有 success，先等一小段再点保存
      // 真实选择器到位后，可把「可保存」与「保存成功」拆成两个指示器
      await dom.sleep(600);
    }

    // 4) 点击保存，并等待保存成功 / 捕获页面错误（占位）
    await dom.waitForOutcome({
      successSelector: SELECTORS.successIndicator,
      errorSelector: SELECTORS.errorIndicator,
      timeoutMs: TIMEOUTS.waitAfterSave,
      label: "保存",
      action: async () => {
        const saveBtn = await dom.waitForElement(
          SELECTORS.saveButton,
          TIMEOUTS.waitForElement
        );
        await fx?.spotlight?.(saveBtn, `点击保存 · ${file.name}`);
        dom.clickElement(saveBtn);
        fx?.setStatus?.(`等待保存结果 · ${file.name}`, "run");
      },
    });

    fx?.clearSpot?.();
  }

  root.workflow = { runImportQueue, needsUsdCurrency, isAllowedExtension };
})();
