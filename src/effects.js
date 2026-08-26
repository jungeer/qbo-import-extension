/**
 * 任务执行期间的页面特效：氛围层、目标聚光、进度浮层、成功/失败反馈。
 */
(() => {
  const root = (globalThis.__QBO_IMPORT__ = globalThis.__QBO_IMPORT__ || {});

  const FX_ROOT_ID = "qbo-import-fx-root";
  const SPOT_CLASS = "qbo-ih-fx-spot";
  const ATTR_RUNNING = "data-qbo-import-running";

  let reducedMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ensureRoot() {
    let el = document.getElementById(FX_ROOT_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = FX_ROOT_ID;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="qbo-ih-fx-veil"></div>
      <div class="qbo-ih-fx-scan"></div>
      <div class="qbo-ih-fx-beacon" data-role="fx-beacon">
        <span class="qbo-ih-fx-beacon-pulse"></span>
        <span class="qbo-ih-fx-beacon-label" data-role="fx-label">准备导入</span>
      </div>
      <div class="qbo-ih-fx-burst" data-role="fx-burst" hidden></div>
    `;
    document.documentElement.appendChild(el);
    return el;
  }

  function start(total) {
    const fx = ensureRoot();
    document.documentElement.setAttribute(ATTR_RUNNING, "1");
    fx.classList.add("is-active");
    setStatus(`开始导入 · 共 ${total} 个文件`, "run");
  }

  function stop(outcome = "idle") {
    clearSpot();
    const fx = document.getElementById(FX_ROOT_ID);
    if (!fx) {
      document.documentElement.removeAttribute(ATTR_RUNNING);
      return;
    }

    if (outcome === "done") {
      flashBurst("done");
      setStatus("全部导入完成", "done");
    } else if (outcome === "error") {
      flashBurst("error");
      setStatus("导入已中断", "error");
    } else if (outcome === "stopped") {
      setStatus("已停止", "idle");
    }

    window.setTimeout(
      () => {
        fx.classList.remove("is-active");
        document.documentElement.removeAttribute(ATTR_RUNNING);
        const label = fx.querySelector('[data-role="fx-label"]');
        if (label) label.textContent = "";
      },
      reducedMotion ? 120 : 900
    );
  }

  function setStatus(text, tone = "run") {
    const fx = ensureRoot();
    const beacon = fx.querySelector('[data-role="fx-beacon"]');
    const label = fx.querySelector('[data-role="fx-label"]');
    if (!beacon || !label) return;
    label.textContent = text;
    beacon.dataset.tone = tone;
    beacon.classList.remove("is-pop");
    // force reflow for pop animation
    void beacon.offsetWidth;
    beacon.classList.add("is-pop");
  }

  function clearSpot() {
    document.querySelectorAll(`.${SPOT_CLASS}`).forEach((node) => node.remove());
  }

  /**
   * 在目标元素上套一层聚光高亮，短暂停留后点击更有“正在操作”的存在感。
   */
  async function spotlight(el, stepLabel, holdMs = 520) {
    if (!el) return;
    clearSpot();

    const rect = el.getBoundingClientRect();
    const spot = document.createElement("div");
    spot.className = SPOT_CLASS;
    spot.style.position = "fixed";
    spot.style.top = `${Math.max(8, rect.top - 8)}px`;
    spot.style.left = `${Math.max(8, rect.left - 8)}px`;
    spot.style.width = `${Math.max(rect.width + 16, 48)}px`;
    spot.style.height = `${Math.max(rect.height + 16, 36)}px`;

    const tip = document.createElement("span");
    tip.className = "qbo-ih-fx-spot-tip";
    tip.textContent = stepLabel || "操作中";
    spot.appendChild(tip);

    document.documentElement.appendChild(spot);
    if (stepLabel) setStatus(stepLabel, "run");

    el.classList.add("qbo-ih-fx-target");
    await sleep(reducedMotion ? 80 : holdMs);
    el.classList.remove("qbo-ih-fx-target");
  }

  function flashBurst(kind) {
    const fx = ensureRoot();
    const burst = fx.querySelector('[data-role="fx-burst"]');
    if (!burst) return;
    burst.hidden = false;
    burst.dataset.kind = kind;
    burst.classList.remove("is-fire");
    void burst.offsetWidth;
    burst.classList.add("is-fire");
    window.setTimeout(() => {
      burst.classList.remove("is-fire");
      burst.hidden = true;
    }, reducedMotion ? 100 : 700);
  }

  function onFileStart(fileName, index, total) {
    setStatus(`正在导入 ${index + 1}/${total} · ${fileName}`, "run");
  }

  function onFileDone(fileName) {
    flashBurst("done");
    setStatus(`已完成 · ${fileName}`, "done");
  }

  function onFileError(fileName) {
    flashBurst("error");
    setStatus(`失败 · ${fileName}`, "error");
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  root.fx = {
    start,
    stop,
    setStatus,
    spotlight,
    clearSpot,
    flashBurst,
    onFileStart,
    onFileDone,
    onFileError,
  };
})();
