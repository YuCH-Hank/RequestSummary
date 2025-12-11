(() => {
  const {
    state,
    createPoint,
    clamp,
    setBackgroundDataUrl,
    readBlobAsDataUrl,
    applyPointSize,
    getSelectedPoint,
  } = window.App;

  let selectedPointId = null;
  let draggingPointId = null;

  /** 集中 DOM 快取，方便查找。 */
  const dom = {
    imageInput: document.getElementById("imageInput"),
    importInput: document.getElementById("importInput"),
    exportBtn: document.getElementById("exportBtn"),
    exportImageBtn: document.getElementById("exportImageBtn"),
    pasteHintBtn: document.getElementById("pasteHintBtn"),
    backgroundImage: document.getElementById("backgroundImage"),
    pointsLayer: document.getElementById("pointsLayer"),
    imageWrapper: document.getElementById("imageWrapper"),
    pointIdInput: document.getElementById("pointId"),
    flowDirectionSelect: document.getElementById("flowDirection"),
    acidInput: document.getElementById("acid"),
    baseInput: document.getElementById("base"),
    vocInput: document.getElementById("voc"),
    heatInput: document.getElementById("heat"),
    dustInput: document.getElementById("dust"),
    machinesInput: document.getElementById("machines"),
    selectedPointInfo: document.getElementById("selectedPointInfo"),
    deletePointBtn: document.getElementById("deletePointBtn"),
    newEmptyPointBtn: document.getElementById("newEmptyPointBtn"),
    pointsListBody: document.getElementById("pointsListBody"),
    summaryBody: document.getElementById("summaryBody"),
    opacitySlider: document.getElementById("opacitySlider"),
    opacityValue: document.getElementById("opacityValue"),
    pointSizeSlider: document.getElementById("pointSizeSlider"),
    pointSizeValue: document.getElementById("pointSizeValue"),
    pointOpacitySlider: document.getElementById("pointOpacitySlider"),
    pointOpacityValue: document.getElementById("pointOpacityValue"),
    totalsWidget: document.getElementById("totalsWidget"),
  };

  init();

  /** 啟動事件綁定並進行首次渲染。 */
  function init() {
    bindBackgroundInputs();
    bindPasteSupport();
    bindCanvasInteractions();
    bindPointInputs();
    bindDeletionShortcuts();
    bindCreateEmptyPoint();
    bindOpacityControl();
    bindPointSizeControl();
    bindPointOpacityControl();
    bindPersistence();
    dom.pointSizeSlider.value = state.pointSize;
    dom.pointSizeValue.textContent = `${state.pointSize}px`;
    dom.opacityValue.textContent = Math.round(state.opacity * 100) + "%";
    dom.opacitySlider.value = Math.round(state.opacity * 100);
    dom.pointOpacitySlider.value = Math.round(state.pointOpacity * 100);
    dom.pointOpacityValue.textContent = `${Math.round(
      state.pointOpacity * 100
    )}%`;
    applyPointSize();
    renderAll();
  }

  /** 處理檔案載入底圖。 */
  function bindBackgroundInputs() {
    dom.imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      readBlobAsDataUrl(file, (dataUrl) => {
        setBackgroundDataUrl(dataUrl);
        dom.backgroundImage.src = dataUrl;
        dom.backgroundImage.onload = () => {
          state.imageWidth = dom.backgroundImage.naturalWidth;
          state.imageHeight = dom.backgroundImage.naturalHeight;
          renderAll();
        };
      });
    });
  }

  /** 支援剪貼簿貼圖與提示按鈕。 */
  function bindPasteSupport() {
    window.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf("image") === -1) continue;
        const blob = item.getAsFile();
        if (!blob) return;
        readBlobAsDataUrl(blob, (dataUrl) => {
          setBackgroundDataUrl(dataUrl);
          dom.backgroundImage.src = dataUrl;
        });
        e.preventDefault();
        return;
      }
    });

    dom.pasteHintBtn.addEventListener("click", () => {
      alert("請在畫面貼上 (Ctrl+V / Cmd+V) 即可套用剪貼簿影像。");
    });
  }

  /** 畫布互動：新增點位、拖曳移動。 */
  function bindCanvasInteractions() {
    dom.imageWrapper.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (!dom.backgroundImage.src) {
        alert("請先載入底圖再新增點位。");
        return;
      }
      const rect = dom.imageWrapper.getBoundingClientRect();
      const xPercent = (e.clientX - rect.left) / rect.width;
      const yPercent = (e.clientY - rect.top) / rect.height;
      const newPoint = createPoint({
        x: clamp(xPercent, 0, 1),
        y: clamp(yPercent, 0, 1),
      });
      state.points.push(newPoint);
      selectedPointId = newPoint.uid;
      renderAll();
      scrollToPoint(newPoint.uid);
    });

    dom.imageWrapper.addEventListener("mousemove", (e) => {
      if (!draggingPointId) return;
      if (!(e.buttons & 2) && !(e.buttons & 1)) return;
      const p = state.points.find((pt) => pt.uid === draggingPointId);
      if (!p) return;
      const rect = dom.imageWrapper.getBoundingClientRect();
      const xPercent = (e.clientX - rect.left) / rect.width;
      const yPercent = (e.clientY - rect.top) / rect.height;
      p.x = clamp(xPercent, 0, 1);
      p.y = clamp(yPercent, 0, 1);
      renderPoints();
    });

    window.addEventListener("mouseup", (e) => {
      if ((e.button === 2 || e.button === 0) && draggingPointId) {
        draggingPointId = null;
        renderAll();
      }
    });
  }

  /** 綁定點位屬性輸入與選取點位同步。 */
  function bindPointInputs() {
    bindInputToField(dom.pointIdInput, "id");
    bindSelectToField(dom.flowDirectionSelect, "flowDirection");
    bindInputToField(dom.acidInput, "acid");
    bindInputToField(dom.baseInput, "base");
    bindInputToField(dom.vocInput, "voc");
    bindInputToField(dom.heatInput, "heat");
    bindInputToField(dom.dustInput, "dust");
    bindInputToField(dom.machinesInput, "machines");
  }

  /** 刪除點位：按鈕與鍵盤 Delete。 */
  function bindDeletionShortcuts() {
    dom.deletePointBtn.addEventListener("click", () => {
      deleteSelectedPoint(false);
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Delete") {
        deleteSelectedPoint(false);
      }
    });
  }

  /** 於中心新增空白點位。 */
  function bindCreateEmptyPoint() {
    dom.newEmptyPointBtn.addEventListener("click", () => {
      const newPoint = createPoint({ x: 0.5, y: 0.5 });
      state.points.push(newPoint);
      selectedPointId = newPoint.uid;
      renderAll();
      scrollToPoint(newPoint.uid);
    });
  }

  /** 底圖透明度滑桿。 */
  function bindOpacityControl() {
    dom.opacitySlider.addEventListener("input", () => {
      const v = Number(dom.opacitySlider.value) / 100;
      state.opacity = v;
      dom.backgroundImage.style.opacity = v;
      dom.opacityValue.textContent = Math.round(v * 100) + "%";
    });
  }

  /** 點位透明度滑桿。 */
  function bindPointOpacityControl() {
    dom.pointOpacitySlider.addEventListener("input", () => {
      const v = Number(dom.pointOpacitySlider.value) / 100;
      state.pointOpacity = v;
      dom.pointOpacityValue.textContent = `${Math.round(v * 100)}%`;
      renderPoints();
      renderTotalsWidget(renderSummary());
    });
  }

  /** 點位大小滑桿。 */
  function bindPointSizeControl() {
    dom.pointSizeSlider.addEventListener("input", () => {
      const v = Number(dom.pointSizeSlider.value);
      state.pointSize = Number.isNaN(v) ? 22 : v;
      applyPointSize();
      dom.pointSizeValue.textContent = `${state.pointSize}px`;
      renderPoints();
    });
  }

  /** 匯出/匯入 JSON 與匯出 PNG。 */
  function bindPersistence() {
    dom.exportBtn.addEventListener("click", () => {
      if (!state.backgroundDataUrl) {
        if (!confirm("尚未載入底圖，仍要匯出嗎？")) return;
      }
      const data = JSON.stringify(state, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "factory-layout.drawio.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    dom.exportImageBtn.addEventListener("click", () => {
      exportImage();
    });

    dom.importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const loaded = JSON.parse(ev.target.result);
          if (!loaded || !Array.isArray(loaded.points)) {
            throw new Error("檔案格式不正確");
          }
          state.backgroundDataUrl = loaded.backgroundDataUrl || null;
          state.opacity =
            typeof loaded.opacity === "number" ? loaded.opacity : 1;
          state.pointSize =
            typeof loaded.pointSize === "number" ? loaded.pointSize : 22;
          state.pointOpacity =
            typeof loaded.pointOpacity === "number" ? loaded.pointOpacity : 0.5;
          state.totalsPosition = loaded.totalsPosition || { x: 0.02, y: 0.7 };
          state.imageWidth = loaded.imageWidth || null;
          state.imageHeight = loaded.imageHeight || null;
          state.points = loaded.points.map((p) =>
            createPoint({
              uid:
                p.uid || Date.now() + "-" + Math.random().toString(16).slice(2),
              id: p.id || "",
              x: p.x,
              y: p.y,
              flowDirection: p.flowDirection || "row",
              acid: p.acid || 0,
              base: p.base || 0,
              voc: p.voc || 0,
              heat: p.heat || 0,
              dust: p.dust || 0,
              machines: p.machines || 1,
            })
          );
          dom.backgroundImage.src = state.backgroundDataUrl || "";
          dom.backgroundImage.style.opacity = state.opacity;
          dom.backgroundImage.onload = () => {
            state.imageWidth = dom.backgroundImage.naturalWidth;
            state.imageHeight = dom.backgroundImage.naturalHeight;
            renderAll();
          };
          dom.opacitySlider.value = Math.round(state.opacity * 100);
          dom.opacityValue.textContent = Math.round(state.opacity * 100) + "%";
          dom.pointSizeSlider.value = state.pointSize;
          dom.pointSizeValue.textContent = `${state.pointSize}px`;
          dom.pointOpacitySlider.value = Math.round(state.pointOpacity * 100);
          dom.pointOpacityValue.textContent = `${Math.round(
            state.pointOpacity * 100
          )}%`;
          applyPointSize();
          selectedPointId = state.points[0] ? state.points[0].uid : null;
          renderAll();
          alert("匯入完成，可以繼續編輯。");
        } catch (err) {
          console.error(err);
          alert("匯入失敗：檔案格式不符合本工具匯出的 JSON。");
        }
      };
      reader.readAsText(file, "utf-8");
    });
  }

  /** 渲染所有 UI 區域。 */
  function renderAll() {
    const totals = renderSummary();
    renderPoints();
    renderSelectedPointPanel();
    renderPointsList();
    renderTotalsWidget(totals);
  }

  /** 在畫布渲染點位與風量標籤。 */
  function renderPoints() {
    dom.pointsLayer.innerHTML = "";
    state.points.forEach((p, idx) => {
      const x = p.x * 100;
      const y = p.y * 100;
      const pointDiv = document.createElement("div");
      pointDiv.className = "point";
      if (p.uid === selectedPointId) pointDiv.classList.add("selected");
      pointDiv.style.left = x + "%";
      pointDiv.style.top = y + "%";
      pointDiv.style.opacity = state.pointOpacity;
      pointDiv.textContent = p.id || idx + 1;
      pointDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedPointId = p.uid;
        renderAll();
        focusPointIdInput();
      });
      pointDiv.addEventListener("mousedown", (e) => {
        if (e.button === 0 || e.button === 2) {
          e.preventDefault();
          e.stopPropagation();
          draggingPointId = p.uid;
          selectedPointId = p.uid;
          renderSelectedPointPanel();
        }
      });
      pointDiv.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      const labelHtml = buildFlowLabelHtml(p);
      if (labelHtml) {
        const labelDiv = document.createElement("div");
        labelDiv.className = "flow-label";
        if (p.flowDirection === "column") {
          labelDiv.classList.add("flow-label-column");
        }
        labelDiv.style.left = x + "%";
        labelDiv.style.top = y + "%";
        labelDiv.style.opacity = state.pointOpacity;
        labelDiv.innerHTML = labelHtml;
        dom.pointsLayer.appendChild(labelDiv);
      }
      dom.pointsLayer.appendChild(pointDiv);
    });
  }

  /** 組出單一點位的風量標籤 HTML。 */
  function buildFlowLabelHtml(p) {
    const segs = [];
    const machineText = p.machines && p.machines > 1 ? `×${p.machines}` : "";
    if (p.acid) segs.push(renderChip("flow-acid", p.acid, machineText));
    if (p.base) segs.push(renderChip("flow-base", p.base, machineText));
    if (p.voc) segs.push(renderChip("flow-voc", p.voc, machineText));
    if (p.heat) segs.push(renderChip("flow-heat", p.heat, machineText));
    if (p.dust) segs.push(renderChip("flow-dust", p.dust, machineText));
    if (!segs.length) return "";
    if (p.flowDirection === "column") {
      return segs.map((s) => `<div>${s}</div>`).join("");
    }
    return segs.join(" ");
  }

  /**
   * 產生風量色塊文字，必要時帶入乘台數與總量。
   * @param {string} cls 色塊類別。
   * @param {number|string} value 風量值。
   * @param {string} machineText 台數文字。
   * @returns {string} HTML。
   */
  function renderChip(cls, value, machineText) {
    const num = Number(value) || 0;
    const machines = Number(machineText.replace("×", "")) || 1;
    const showTotal = machines > 1;
    const total = showTotal ? num * machines : num;
    return `<span class="flow-chip ${cls}">${num}${
      showTotal ? `×${machines}台=${total}` : ""
    }</span>`;
  }

  /** 渲染選取點位的屬性面板。 */
  function renderSelectedPointPanel() {
    const p = getSelectedPoint(selectedPointId);
    if (!p) {
      dom.selectedPointInfo.textContent = "尚未選取點位";
      dom.pointIdInput.value = "";
      dom.flowDirectionSelect.value = "row";
      dom.acidInput.value = "";
      dom.baseInput.value = "";
      dom.vocInput.value = "";
      dom.heatInput.value = "";
      dom.dustInput.value = "";
      dom.machinesInput.value = "1";
      return;
    }
    const idx = state.points.indexOf(p);
    dom.selectedPointInfo.textContent = `目前編輯第 ${idx + 1} 個點位`;
    dom.pointIdInput.value = p.id;
    dom.flowDirectionSelect.value = p.flowDirection || "row";
    dom.acidInput.value = p.acid || "";
    dom.baseInput.value = p.base || "";
    dom.vocInput.value = p.voc || "";
    dom.heatInput.value = p.heat || "";
    dom.dustInput.value = p.dust || "";
    dom.machinesInput.value = p.machines || 1;
  }

  /** 將輸入框綁定到選取點位的欄位。 */
  function bindInputToField(inputEl, field) {
    inputEl.addEventListener("input", () => {
      const p = getSelectedPoint(selectedPointId);
      if (!p) return;
      if (field === "id") {
        p.id = inputEl.value.trim();
      } else {
        const v =
          inputEl.value === ""
            ? field === "machines"
              ? 1
              : 0
            : Number(inputEl.value);
        p[field] = Number.isNaN(v) ? 0 : v;
      }
      renderAll();
    });
  }

  /** 將下拉選單綁定到選取點位的欄位。 */
  function bindSelectToField(selectEl, field) {
    selectEl.addEventListener("change", () => {
      const p = getSelectedPoint(selectedPointId);
      if (!p) return;
      p[field] = selectEl.value;
      renderAll();
    });
  }

  /** 渲染側邊點位清單以便快速選取。 */
  function renderPointsList() {
    dom.pointsListBody.innerHTML = "";
    state.points.forEach((p, idx) => {
      const tr = document.createElement("tr");
      if (p.uid === selectedPointId) tr.classList.add("active");
      const cells = [
        p.id || idx + 1,
        p.acid || "",
        p.base || "",
        p.voc || "",
        p.heat || "",
        p.dust || "",
        p.machines || 1,
      ];
      cells.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
      });
      tr.addEventListener("click", () => {
        selectedPointId = p.uid;
        renderAll();
        scrollToPoint(p.uid);
        focusPointIdInput();
      });
      dom.pointsListBody.appendChild(tr);
    });
  }

  /** 渲染統計表（可編輯）並回傳總量。 */
  function renderSummary() {
    dom.summaryBody.innerHTML = "";
    let totalAcid = 0;
    let totalBase = 0;
    let totalVoc = 0;
    let totalHeat = 0;
    let totalDust = 0;
    state.points.forEach((p, idx) => {
      const perAcid = Number(p.acid) || 0;
      const perBase = Number(p.base) || 0;
      const perVoc = Number(p.voc) || 0;
      const perHeat = Number(p.heat) || 0;
      const perDust = Number(p.dust) || 0;
      let count = Number(p.machines);
      if (!count || count <= 0) count = 1;
      const sumAcid = perAcid * count;
      const sumBase = perBase * count;
      const sumVoc = perVoc * count;
      const sumHeat = perHeat * count;
      const sumDust = perDust * count;
      totalAcid += sumAcid;
      totalBase += sumBase;
      totalVoc += sumVoc;
      totalHeat += sumHeat;
      totalDust += sumDust;
      const tr = document.createElement("tr");

      const idCell = document.createElement("td");
      idCell.textContent = p.id || idx + 1;
      tr.appendChild(idCell);

      const perFields = ["acid", "base", "voc", "heat", "dust"];
      perFields.forEach((field) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "1";
        input.value = p[field] || "";
        input.dataset.uid = p.uid;
        input.dataset.field = field;
        input.addEventListener("input", () => {
          const value = input.value === "" ? 0 : Number(input.value);
          p[field] = Number.isNaN(value) ? 0 : value;
          const caret = input.selectionStart;
          renderAll();
          restoreSummaryFocus(p.uid, field, caret);
        });
        if (!p[field]) td.classList.add("zero-cell");
        td.appendChild(input);
        tr.appendChild(td);
      });

      const machinesTd = document.createElement("td");
      const machinesInput = document.createElement("input");
      machinesInput.type = "number";
      machinesInput.min = "0";
      machinesInput.step = "1";
      machinesInput.value = p.machines || 1;
      machinesInput.dataset.uid = p.uid;
      machinesInput.dataset.field = "machines";
      machinesInput.addEventListener("input", () => {
        const value =
          machinesInput.value === "" ? 1 : Number(machinesInput.value);
        p.machines = Number.isNaN(value) ? 0 : value;
        const caret = machinesInput.selectionStart;
        renderAll();
        restoreSummaryFocus(p.uid, "machines", caret);
      });
      machinesTd.appendChild(machinesInput);
      tr.appendChild(machinesTd);

      const totalCells = [
        sumAcid || "",
        sumBase || "",
        sumVoc || "",
        sumHeat || "",
        sumDust || "",
      ];
      totalCells.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = c;
        if (!c) td.classList.add("zero-cell");
        tr.appendChild(td);
      });

      dom.summaryBody.appendChild(tr);
    });
    const totalTr = document.createElement("tr");
    const totalCells = [
      "總計",
      "",
      "",
      "",
      "",
      "",
      "",
      totalAcid || "",
      totalBase || "",
      totalVoc || "",
      totalHeat || "",
      totalDust || "",
    ];
    totalCells.forEach((c, i) => {
      const td = document.createElement("td");
      td.textContent = c;
      if (i === 0) {
        td.style.fontWeight = "700";
      }
      if (!c && i !== 0) td.classList.add("zero-cell");
      totalTr.appendChild(td);
    });
    dom.summaryBody.appendChild(totalTr);
    return {
      totalAcid,
      totalBase,
      totalVoc,
      totalHeat,
      totalDust,
    };
  }

  /**
   * 重新渲染後讓統計表的輸入框回到原焦點與游標位置。
   * @param {string} uid 點位 UID。
   * @param {string} field 欄位名稱。
   * @param {number} caret 游標位置。
   */
  function restoreSummaryFocus(uid, field, caret) {
    const selector = `input[data-uid="${uid}"][data-field="${field}"]`;
    const el = dom.summaryBody.querySelector(selector);
    if (el) {
      el.focus();
      if (typeof caret === "number") {
        el.setSelectionRange(caret, caret);
      }
    }
  }

  /** 刪除選取點位（可選確認）。 */
  function deleteSelectedPoint(showConfirm) {
    if (!selectedPointId) return;
    const idx = state.points.findIndex((p) => p.uid === selectedPointId);
    if (idx === -1) return;
    if (showConfirm && !confirm("確定要刪除此點位嗎？")) return;
    state.points.splice(idx, 1);
    selectedPointId = null;
    renderAll();
  }

  /** 選取點位時自動聚焦編號輸入框。 */
  function focusPointIdInput() {
    if (dom.pointIdInput) {
      dom.pointIdInput.focus();
    }
  }

  /** 滾動畫布讓點位入鏡。 */
  function scrollToPoint(uid) {
    const p = state.points.find((pt) => pt.uid === uid);
    if (!p) return;
    const wrapperRect = dom.imageWrapper.getBoundingClientRect();
    const scrollX = p.x * dom.imageWrapper.scrollWidth - wrapperRect.width / 2;
    const scrollY =
      p.y * dom.imageWrapper.scrollHeight - wrapperRect.height / 2;
    dom.imageWrapper.scrollTo({
      left: scrollX,
      top: scrollY,
      behavior: "smooth",
    });
  }

  /** 渲染可拖曳的總量浮窗。 */
  function renderTotalsWidget(totals) {
    if (!dom.totalsWidget) return;
    dom.totalsWidget.innerHTML = `
      <div class="totals-title">總量</div>
      <div class="totals-row"><span class="flow-chip flow-acid">酸</span> ${
        totals.totalAcid || 0
      }</div>
      <div class="totals-row"><span class="flow-chip flow-base">鹼</span> ${
        totals.totalBase || 0
      }</div>
      <div class="totals-row"><span class="flow-chip flow-voc">有機</span> ${
        totals.totalVoc || 0
      }</div>
      <div class="totals-row"><span class="flow-chip flow-heat">熱</span> ${
        totals.totalHeat || 0
      }</div>
      <div class="totals-row"><span class="flow-chip flow-dust">集塵</span> ${
        totals.totalDust || 0
      }</div>
      <div class="totals-note">（灰色代表風量或總量為 0）</div>
    `;
    const { x, y } = state.totalsPosition;
    dom.totalsWidget.style.left = x * 100 + "%";
    dom.totalsWidget.style.top = y * 100 + "%";
  }

  // 總量浮窗拖曳
  (() => {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    if (!dom.totalsWidget) return;
    dom.totalsWidget.addEventListener("mousedown", (e) => {
      dragging = true;
      const rect = dom.totalsWidget.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const wrapperRect = dom.imageWrapper.getBoundingClientRect();
      const newX = clamp(
        (e.clientX - wrapperRect.left - offsetX) / wrapperRect.width,
        0,
        1
      );
      const newY = clamp(
        (e.clientY - wrapperRect.top - offsetY) / wrapperRect.height,
        0,
        1
      );
      state.totalsPosition = { x: newX, y: newY };
      dom.totalsWidget.style.left = newX * 100 + "%";
      dom.totalsWidget.style.top = newY * 100 + "%";
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
    });
  })();

  /** 匯出目前版面為 PNG。 */
  function exportImage() {
    if (!state.backgroundDataUrl || !state.imageWidth || !state.imageHeight) {
      alert("請先載入底圖後再匯出圖檔。");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = state.imageWidth;
    canvas.height = state.imageHeight;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.globalAlpha = state.opacity;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      state.points.forEach((p, idx) => {
        const px = p.x * canvas.width;
        const py = p.y * canvas.height;
        const pointRadius = (state.pointSize / 22) * 11;
        const machineCount = p.machines && p.machines > 1 ? p.machines : 1;

        // 點位圓
        ctx.save();
        ctx.globalAlpha = state.pointOpacity;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, pointRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 點位編號
        ctx.save();
        ctx.fillStyle = "#111";
        ctx.font = `${Math.max(10, pointRadius)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.id || idx + 1, px, py);
        ctx.restore();

        // 風量色塊
        const flows = [
          { field: "acid", color: "#8bc34a" },
          { field: "base", color: "#60a5fa" },
          { field: "voc", color: "#f4b183" },
          { field: "heat", color: "#f9a8d4" },
          { field: "dust", color: "#bfdbfe" },
        ];
        const chipTexts = [];
        flows.forEach(({ field, color }) => {
          const val = Number(p[field]) || 0;
          if (!val) return;
          const total =
            machineCount > 1
              ? `${val}×${machineCount}台=${val * machineCount}`
              : `${val}`;
          chipTexts.push({ text: total, color });
        });
        if (chipTexts.length) {
          const lineHeight = 14;
          const chipPaddingX = 4;
          const chipPaddingY = 2;
          const chipGap = 4;
          const chipHeight = lineHeight + chipPaddingY * 2;
          let startY = py + pointRadius + 8;
          chipTexts.forEach((chip, i) => {
            const textWidth = ctx.measureText(chip.text).width;
            const chipWidth = textWidth + chipPaddingX * 2;
            const drawY =
              p.flowDirection === "column"
                ? startY + i * (chipHeight + chipGap)
                : startY;
            const drawX =
              p.flowDirection === "column"
                ? px - chipWidth / 2
                : px -
                  (chipTexts.length * chipWidth +
                    (chipTexts.length - 1) * chipGap) /
                    2 +
                  i * (chipWidth + chipGap);

            ctx.save();
            ctx.globalAlpha = state.pointOpacity;
            roundRect(ctx, drawX, drawY, chipWidth, chipHeight, 4);
            ctx.fillStyle = chip.color;
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.fillStyle = "#000";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
              chip.text,
              drawX + chipWidth / 2,
              drawY + chipHeight / 2
            );
            ctx.restore();
          });
        }
      });

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "factory-layout.png";
      a.click();
    };
    img.src = state.backgroundDataUrl;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
})();
