/**
 * 逐个文件导入流程：
 * 选文件 → 点导入 → 写入 file input → 等导入成功 → 点保存 → 等保存成功 → 标记完成
 */
(() => {
  const root = (globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {});

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
    const { SELECTORS, TIMEOUTS, dom } = root;

    onRunningChange(true);
    onError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        if (shouldStop()) {
          onError("已停止导入");
          break;
        }

        const file = files[i];
        onFileStatus(i, "importing");

        try {
          await importOneFile(file, SELECTORS, TIMEOUTS, dom);
          onFileStatus(i, "done");
        } catch (err) {
          const message = err?.message || String(err);
          onFileStatus(i, "error", message);
          onError(`文件「${file.name}」导入失败：${message}`);
          // 遇错停止后续，避免误操作页面
          break;
        }

        if (i < files.length - 1) {
          await dom.sleep(TIMEOUTS.betweenFiles);
        }
      }
    } finally {
      onRunningChange(false);
    }
  }

  async function importOneFile(file, SELECTORS, TIMEOUTS, dom) {
    // 1) 点击导入按钮（占位）
    const importBtn = await dom.waitForElement(
      SELECTORS.importButton,
      TIMEOUTS.waitForElement
    );
    dom.clickElement(importBtn);

    // 2) 找到 file input 并写入当前文件（占位）
    const fileInput = await dom.waitForElement(
      SELECTORS.fileInput,
      TIMEOUTS.waitForElement
    );
    dom.assignFileToInput(fileInput, file);

    // 3) 等待导入阶段成功（若页面有成功态；没有配置成功选择器则短暂等待）
    if (SELECTORS.successIndicator && SELECTORS.successIndicator.includes("data-qbo-import")) {
      // 占位阶段：导入后可能还没有 success，先等一小段再点保存
      // 真实选择器到位后，可把「导入成功」与「保存成功」拆成两个指示器
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
        dom.clickElement(saveBtn);
      },
    });
  }

  root.workflow = { runImportQueue };
})();
