(() => {
  const {
    state,
    createPoint,
    clamp,
    setBackgroundDataUrl,
    readBlobAsDataUrl,
    applyPointSize,
    getSelectedPoint,
    createTextBox,
  } = window.App;

  let selectedPointId = null;
  let draggingPointId = null;
  let selectedTextId = null;
  let draggingTextId = null;

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
    summarySortToggle: document.getElementById("summarySortToggle"),
    addTextBoxBtn: document.getElementById("addTextBoxBtn"),
    deleteTextBoxBtn: document.getElementById("deleteTextBoxBtn"),
    textContent: document.getElementById("textContent"),
    textColor: document.getElementById("textColor"),
    textSize: document.getElementById("textSize"),
    textListBody: document.getElementById("textListBody"),
    opacitySlider: document.getElementById("opacitySlider"),
    opacityValue: document.getElementById("opacityValue"),
    pointSizeSlider: document.getElementById("pointSizeSlider"),
    pointSizeValue: document.getElementById("pointSizeValue"),
    pointOpacitySlider: document.getElementById("pointOpacitySlider"),
    pointOpacityValue: document.getElementById("pointOpacityValue"),
    decimalPlacesInput: document.getElementById("decimalPlacesInput"),
    decimalPlacesValue: document.getElementById("decimalPlacesValue"),
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
    bindDecimalPlacesControl();
    bindSummarySortControl();
    bindTextBoxControls();
    bindPersistence();
    dom.pointSizeSlider.value = state.pointSize;
    dom.pointSizeValue.textContent = `${state.pointSize}px`;
    dom.opacityValue.textContent = Math.round(state.opacity * 100) + "%";
    dom.opacitySlider.value = Math.round(state.opacity * 100);
    dom.pointOpacitySlider.value = Math.round(state.pointOpacity * 100);
    dom.pointOpacityValue.textContent = `${Math.round(
      state.pointOpacity * 100
    )}%`;
    if (dom.decimalPlacesInput && dom.decimalPlacesValue) {
      dom.decimalPlacesInput.value = state.decimalPlaces;
      dom.decimalPlacesValue.textContent = `${state.decimalPlaces} 位`;
    }
    if (dom.summarySortToggle) {
      dom.summarySortToggle.checked = !!state.summarySortById;
    }
    dom.backgroundImage.style.opacity = state.opacity;
    applyPointSize();
    renderAll();
  }

  /** 處理檔案載入底圖。 */
  function bindBackgroundInputs() {
    dom.imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      readBlobAsDataUrl(file, (dataUrl) => {
        loadBackgroundFromDataUrl(dataUrl);
      });
    });
  }

  /** 支援剪貼簿貼圖與提示按鈕。 */
  function bindPasteSupport() {
    window.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      const files = e.clipboardData && e.clipboardData.files;
      let handled = false;
      if (items && items.length) {
        for (const item of items) {
          if (!item.type || item.type.indexOf("image") === -1) continue;
          const blob = item.getAsFile();
          if (!blob) continue;
          readBlobAsDataUrl(blob, (dataUrl) => {
            loadBackgroundFromDataUrl(dataUrl);
          });
          handled = true;
          break;
        }
      }
      if (!handled && files && files.length) {
        const file = files[0];
        if (file.type && file.type.indexOf("image") !== -1) {
          readBlobAsDataUrl(file, (dataUrl) => {
            loadBackgroundFromDataUrl(dataUrl);
          });
          handled = true;
        }
      }
      if (handled) {
        e.preventDefault();
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
      const rect = dom.backgroundImage.getBoundingClientRect();
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
      focusPointIdInput();
    });

    dom.imageWrapper.addEventListener("mousemove", (e) => {
      if (!(e.buttons & 2) && !(e.buttons & 1)) return;
      const rect = dom.backgroundImage.getBoundingClientRect();
      const xPercent = (e.clientX - rect.left) / rect.width;
      const yPercent = (e.clientY - rect.top) / rect.height;
      if (draggingPointId) {
        const p = state.points.find((pt) => pt.uid === draggingPointId);
        if (!p) return;
        p.x = clamp(xPercent, 0, 1);
        p.y = clamp(yPercent, 0, 1);
        renderPoints();
      }
      if (draggingTextId) {
        const t = state.textBoxes.find((tb) => tb.uid === draggingTextId);
        if (!t) return;
        t.x = clamp(xPercent, 0, 1);
        t.y = clamp(yPercent, 0, 1);
        renderTextBoxes();
      }
    });

    window.addEventListener("mouseup", (e) => {
      if ((e.button === 2 || e.button === 0) && draggingPointId) {
        draggingPointId = null;
        renderAll();
      }
      if ((e.button === 2 || e.button === 0) && draggingTextId) {
        draggingTextId = null;
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

  /** 小數位數設定。 */
  function bindDecimalPlacesControl() {
    if (!dom.decimalPlacesInput) return;
    dom.decimalPlacesInput.addEventListener("input", () => {
      const v = Number(dom.decimalPlacesInput.value);
      const clamped = Math.max(0, Math.min(3, Math.round(v)));
      state.decimalPlaces = Number.isNaN(clamped) ? 1 : clamped;
      dom.decimalPlacesInput.value = state.decimalPlaces;
      if (dom.decimalPlacesValue) {
        dom.decimalPlacesValue.textContent = `${state.decimalPlaces} 位`;
      }
      renderAll();
    });
  }

  /** 統計表排序選項。 */
  function bindSummarySortControl() {
    if (!dom.summarySortToggle) return;
    dom.summarySortToggle.addEventListener("change", () => {
      state.summarySortById = dom.summarySortToggle.checked;
      renderAll();
    });
  }

  /** 文字方塊相關控制。 */
  function bindTextBoxControls() {
    if (dom.addTextBoxBtn) {
      dom.addTextBoxBtn.addEventListener("click", () => {
        const tb = createTextBox();
        state.textBoxes.push(tb);
        selectedTextId = tb.uid;
        renderAfterFieldChange();
        renderTextBoxPanel();
      });
    }
    if (dom.deleteTextBoxBtn) {
      dom.deleteTextBoxBtn.addEventListener("click", () => {
        if (!selectedTextId) return;
        const idx = state.textBoxes.findIndex((t) => t.uid === selectedTextId);
        if (idx !== -1) {
          state.textBoxes.splice(idx, 1);
          selectedTextId = null;
          renderAfterFieldChange();
          renderTextBoxPanel();
        }
      });
    }
    if (dom.textContent) {
      dom.textContent.addEventListener("input", () => {
        const t = state.textBoxes.find((tb) => tb.uid === selectedTextId);
        if (!t) return;
        t.text = dom.textContent.value;
        renderTextBoxes();
        renderTextList();
      });
    }
    if (dom.textColor) {
      dom.textColor.addEventListener("input", () => {
        const t = state.textBoxes.find((tb) => tb.uid === selectedTextId);
        if (!t) return;
        t.color = dom.textColor.value;
        renderTextBoxes();
        renderTextList();
      });
    }
    if (dom.textSize) {
      dom.textSize.addEventListener("input", () => {
        const t = state.textBoxes.find((tb) => tb.uid === selectedTextId);
        if (!t) return;
        const v = Number(dom.textSize.value);
        t.fontSize = Number.isNaN(v) ? 16 : v;
        renderTextBoxes();
        renderTextList();
      });
    }
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

  /** 匯出/匯入 JSON 與匯出 JPG。 */
  function bindPersistence() {
    dom.exportBtn.addEventListener("click", async () => {
      if (!state.backgroundDataUrl) {
        if (!confirm("尚未載入底圖，仍要匯出嗎？")) return;
      }
      const data = JSON.stringify(state, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const saved = await saveWithPicker(blob, "factory-layout.drawio.json", "application/json");
      if (!saved) {
        downloadFallback(blob, "factory-layout.drawio.json");
      }
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
          state.summarySortById = !!loaded.summarySortById;
          state.decimalPlaces =
            typeof loaded.decimalPlaces === "number"
              ? Math.max(0, Math.min(3, Math.round(loaded.decimalPlaces)))
              : 1;
          state.textBoxes = Array.isArray(loaded.textBoxes)
            ? loaded.textBoxes.map((t) =>
                createTextBox({
                  uid:
                    t.uid || Date.now() + "-" + Math.random().toString(16).slice(2),
                  text: t.text || "",
                  x: typeof t.x === "number" ? t.x : 0.5,
                  y: typeof t.y === "number" ? t.y : 0.5,
                  color: t.color || "#111111",
                  fontSize: t.fontSize || 16,
                })
              )
            : [];
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
    renderTextBoxes();
    renderTextBoxPanel();
    renderTextList();
    renderTotalsWidget(totals);
  }

  /** 更新其他區塊而不重建正在輸入的欄位，避免游標跳動。 */
  function renderAfterFieldChange() {
    const totals = renderSummary();
    renderPoints();
    renderPointsList();
    renderTextBoxes();
    renderTextBoxPanel();
    renderTextList();
    renderTotalsWidget(totals);
  }

  /** 將畫布容器大小調整為影像實際呈現尺寸，避免偏移。 */
  function updateCanvasSizeStyles() {
    const imgRect = dom.backgroundImage.getBoundingClientRect();
    if (!imgRect.width || !imgRect.height) return;
    dom.pointsLayer.style.width = imgRect.width + "px";
    dom.pointsLayer.style.height = imgRect.height + "px";
  }

  /** 依 DataURL 套用底圖並同步尺寸。 */
  function loadBackgroundFromDataUrl(dataUrl) {
    setBackgroundDataUrl(dataUrl);
    dom.backgroundImage.src = dataUrl;
    dom.backgroundImage.style.opacity = state.opacity;
    dom.backgroundImage.onload = () => {
      state.imageWidth = dom.backgroundImage.naturalWidth;
      state.imageHeight = dom.backgroundImage.naturalHeight;
      renderAll();
      updateCanvasSizeStyles();
    };
    // 圖片可能已經在快取，立即更新尺寸以避免偏移
    updateCanvasSizeStyles();
  }

  /** 在畫布渲染點位與風量標籤。 */
  function renderPoints() {
    const imgRect = dom.backgroundImage.getBoundingClientRect();
    const imgWidth = imgRect.width || 1;
    const imgHeight = imgRect.height || 1;
    dom.pointsLayer.style.width = imgWidth + "px";
    dom.pointsLayer.style.height = imgHeight + "px";
    dom.pointsLayer.innerHTML = "";
    state.points.forEach((p, idx) => {
      const xPx = p.x * imgWidth;
      const yPx = p.y * imgHeight;
      const pointDiv = document.createElement("div");
      pointDiv.className = "point";
      if (p.uid === selectedPointId) pointDiv.classList.add("selected");
      pointDiv.style.left = xPx + "px";
      pointDiv.style.top = yPx + "px";
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
        labelDiv.style.left = xPx + "px";
        labelDiv.style.top = yPx + "px";
        labelDiv.style.opacity = state.pointOpacity;
        labelDiv.innerHTML = labelHtml;
        dom.pointsLayer.appendChild(labelDiv);
      }
      dom.pointsLayer.appendChild(pointDiv);
    });
  }

  /** 渲染文字方塊。 */
  function renderTextBoxes() {
    const imgRect = dom.backgroundImage.getBoundingClientRect();
    const imgWidth = imgRect.width || 1;
    const imgHeight = imgRect.height || 1;
    const existing = dom.pointsLayer.querySelectorAll(".text-box");
    existing.forEach((n) => n.remove());
    state.textBoxes.forEach((t, idx) => {
      const xPx = t.x * imgWidth;
      const yPx = t.y * imgHeight;
      const div = document.createElement("div");
      div.className = "text-box";
      if (t.uid === selectedTextId) div.classList.add("selected");
      div.style.left = xPx + "px";
      div.style.top = yPx + "px";
      div.style.color = t.color || "#111";
      div.style.fontSize = `${t.fontSize || 16}px`;
      div.textContent = t.text || `文字${idx + 1}`;
      div.addEventListener("mousedown", (e) => {
        if (e.button === 0 || e.button === 2) {
          e.preventDefault();
          draggingTextId = t.uid;
          selectedTextId = t.uid;
          renderTextBoxPanel();
        }
      });
      div.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedTextId = t.uid;
        renderTextBoxPanel();
        renderTextList();
      });
      dom.pointsLayer.appendChild(div);
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
    const numText = formatOneDecimal(num, false, true);
    const totalText = formatOneDecimal(total, false, true);
    return `<span class="flow-chip ${cls}">${numText}${
      showTotal ? `×${machines}台=${totalText}` : ""
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

  /** 渲染文字方塊編輯面板。 */
  function renderTextBoxPanel() {
    if (!dom.textContent) return;
    const t = state.textBoxes.find((tb) => tb.uid === selectedTextId);
    if (!t) {
      dom.textContent.value = "";
      if (dom.textColor) dom.textColor.value = "#111111";
      if (dom.textSize) dom.textSize.value = "16";
      return;
    }
    dom.textContent.value = t.text || "";
    if (dom.textColor) dom.textColor.value = t.color || "#111111";
    if (dom.textSize) dom.textSize.value = t.fontSize || 16;
  }

  /** 將輸入框綁定到選取點位的欄位。 */
  function bindInputToField(inputEl, field) {
    inputEl.addEventListener("input", () => {
      const p = getSelectedPoint(selectedPointId);
      if (!p) return;
      if (field === "id") {
        p.id = inputEl.value.trim();
      } else {
        p[field] = inputEl.value;
      }
      renderAfterFieldChange();
    });
  }

  /** 將下拉選單綁定到選取點位的欄位。 */
  function bindSelectToField(selectEl, field) {
    selectEl.addEventListener("change", () => {
      const p = getSelectedPoint(selectedPointId);
      if (!p) return;
      p[field] = selectEl.value;
      renderAfterFieldChange();
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

  /** 渲染文字方塊清單。 */
  function renderTextList() {
    if (!dom.textListBody) return;
    dom.textListBody.innerHTML = "";
    state.textBoxes.forEach((t, idx) => {
      const tr = document.createElement("tr");
      if (t.uid === selectedTextId) tr.classList.add("active");
      const cells = [
        idx + 1,
        t.text || "",
        t.color || "",
        t.fontSize || "",
      ];
      cells.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
      });
      tr.addEventListener("click", () => {
        selectedTextId = t.uid;
        renderTextBoxPanel();
        renderTextList();
        renderTextBoxes();
      });
      dom.textListBody.appendChild(tr);
    });
  }

  /** 計算統計表需要的資料，包含每列與總計。 */
  function computeSummaryData() {
    const rows = [];
    const totals = {
      acid: 0,
      base: 0,
      voc: 0,
      heat: 0,
      dust: 0,
    };
    state.points.forEach((p, idx) => {
      const per = {
        acid: Number(p.acid) || 0,
        base: Number(p.base) || 0,
        voc: Number(p.voc) || 0,
        heat: Number(p.heat) || 0,
        dust: Number(p.dust) || 0,
      };
      let machines = Number(p.machines);
      if (!machines || machines <= 0) machines = 1;
      const rowTotals = {
        acid: per.acid * machines,
        base: per.base * machines,
        voc: per.voc * machines,
        heat: per.heat * machines,
        dust: per.dust * machines,
      };
      totals.acid += rowTotals.acid;
      totals.base += rowTotals.base;
      totals.voc += rowTotals.voc;
      totals.heat += rowTotals.heat;
      totals.dust += rowTotals.dust;
      rows.push({
        point: p,
        uid: p.uid,
        label: p.id || idx + 1,
        per,
        machines,
        totals: rowTotals,
      });
    });
    if (state.summarySortById) {
      rows.sort((a, b) => {
        const aKey = getSortKey(a.label);
        const bKey = getSortKey(b.label);
        if (typeof aKey === "number" && typeof bKey === "number") {
          return aKey - bKey;
        }
        const aStr = String(aKey);
        const bStr = String(bKey);
        if (aStr === bStr) return 0;
        return aStr > bStr ? 1 : -1;
      });
    }
    return { rows, totals };
  }

  /** 渲染統計表（可編輯）並回傳總量。 */
  function renderSummary() {
    dom.summaryBody.innerHTML = "";
    const { rows, totals } = computeSummaryData();
    rows.forEach((row) => {
      const p = row.point;
      const tr = document.createElement("tr");

      const idCell = document.createElement("td");
      idCell.textContent = row.label;
      tr.appendChild(idCell);

      const perFields = ["acid", "base", "voc", "heat", "dust"];
      perFields.forEach((field) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.value = p[field] || "";
        input.dataset.uid = p.uid;
        input.dataset.field = field;
        input.addEventListener("input", () => {
          p[field] = input.value;
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
      machinesInput.type = "text";
      machinesInput.inputMode = "decimal";
      machinesInput.value = p.machines || 1;
      machinesInput.dataset.uid = p.uid;
      machinesInput.dataset.field = "machines";
      machinesInput.addEventListener("input", () => {
        p.machines = machinesInput.value;
        const caret = machinesInput.selectionStart;
        renderAll();
        restoreSummaryFocus(p.uid, "machines", caret);
      });
      machinesTd.appendChild(machinesInput);
      tr.appendChild(machinesTd);

      const totalCells = [
        formatOneDecimal(row.totals.acid),
        formatOneDecimal(row.totals.base),
        formatOneDecimal(row.totals.voc),
        formatOneDecimal(row.totals.heat),
        formatOneDecimal(row.totals.dust),
      ];
      totalCells.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = c;
        if (!c || Number(c) === 0) td.classList.add("zero-cell");
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
      formatOneDecimal(totals.acid, false, true),
      formatOneDecimal(totals.base, false, true),
      formatOneDecimal(totals.voc, false, true),
      formatOneDecimal(totals.heat, false, true),
      formatOneDecimal(totals.dust, false, true),
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
      totalAcid: totals.acid,
      totalBase: totals.base,
      totalVoc: totals.voc,
      totalHeat: totals.heat,
      totalDust: totals.dust,
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
      <div class="totals-row"><span class="flow-chip flow-acid">酸</span> ${formatOneDecimal(
        totals.totalAcid,
        false,
        true
      )}</div>
      <div class="totals-row"><span class="flow-chip flow-base">鹼</span> ${formatOneDecimal(
        totals.totalBase,
        false,
        true
      )}</div>
      <div class="totals-row"><span class="flow-chip flow-voc">有機</span> ${formatOneDecimal(
        totals.totalVoc,
        false,
        true
      )}</div>
      <div class="totals-row"><span class="flow-chip flow-heat">熱</span> ${formatOneDecimal(
        totals.totalHeat,
        false,
        true
      )}</div>
      <div class="totals-row"><span class="flow-chip flow-dust">集塵</span> ${formatOneDecimal(
        totals.totalDust,
        false,
        true
      )}</div>
      <div class="totals-note">（灰色代表風量或總量為 0）</div>
    `;
    const { x, y } = state.totalsPosition;
    dom.totalsWidget.style.left = x * 100 + "%";
    dom.totalsWidget.style.top = y * 100 + "%";
  }

  // 總量浮窗拖曳
  (() => {
    const enableTotalsDrag = true;
    if (!enableTotalsDrag) return;
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
      const targetRect = dom.backgroundImage.getBoundingClientRect();
      const newX = clamp(
        (e.clientX - targetRect.left - offsetX) / targetRect.width,
        0,
        1
      );
      const newY = clamp(
        (e.clientY - targetRect.top - offsetY) / targetRect.height,
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

  /** 匯出目前版面為 JPG，並附上畫面總量框。 */
  function exportImage() {
    if (!state.backgroundDataUrl || !state.imageWidth || !state.imageHeight) {
      alert("請先載入底圖後再匯出圖檔。");
      return;
    }
    const summaryData = computeSummaryData();
    const canvas = document.createElement("canvas");
    canvas.width = state.imageWidth;
    canvas.height = state.imageHeight;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      // 背景鋪白，避免 JPG 透明區變黑
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const baseWidth = state.imageWidth;
      const baseHeight = state.imageHeight;

      ctx.save();
      ctx.globalAlpha = state.opacity;
      ctx.drawImage(img, 0, 0, baseWidth, baseHeight);
      ctx.restore();

      const scale = state.pointSize / 22;
      state.points.forEach((p, idx) => {
        const px = p.x * baseWidth;
        const py = p.y * baseHeight;
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
      const baseText = formatOneDecimal(val, false, true);
      const totalValue = val * machineCount;
      const totalText =
        machineCount > 1
          ? `${baseText}×${machineCount}台=${formatOneDecimal(
              totalValue,
              false,
              true
            )}`
          : baseText;
      chipTexts.push({ text: totalText, color });
    });
        if (chipTexts.length) {
          const lineHeight = 14 * scale;
          const chipPaddingX = 4 * scale;
          const chipPaddingY = 2 * scale;
          const chipGap = 4 * scale;
          const chipHeight = lineHeight + chipPaddingY * 2;
          const marginDom = p.flowDirection === "column" ? 16 * scale : 20 * scale;
          let startY =
            p.flowDirection === "column"
              ? py + marginDom
              : py - chipHeight / 2 + marginDom;
          const chipFont = `${Math.max(10, 12 * scale)}px sans-serif`;
          chipTexts.forEach((chip, i) => {
            ctx.font = chipFont;
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
            ctx.font = chipFont;
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

      state.textBoxes.forEach((t) => {
        const tx = t.x * baseWidth;
        const ty = t.y * baseHeight;
        const fontSize = t.fontSize || 16;
        ctx.save();
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lines = String(t.text || "").split(/\n/);
        const lineHeight = fontSize * 1.2;
        const boxWidth = Math.max(
          ...lines.map((ln) => ctx.measureText(ln).width),
          30
        );
        const boxHeight = lines.length * lineHeight + 8;
        const boxX = tx - boxWidth / 2 - 8;
        const boxY = ty - boxHeight / 2;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1;
        roundRect(ctx, boxX, boxY, boxWidth + 16, boxHeight, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = t.color || "#111";
        lines.forEach((ln, i) => {
          ctx.fillText(
            ln,
            tx,
            boxY + 4 + lineHeight / 2 + i * lineHeight
          );
        });
        ctx.restore();
      });

      drawTotalsOverlay(ctx, summaryData.totals, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const saved = await saveWithPicker(blob, "factory-layout.jpg", "image/jpeg");
        if (!saved) {
          downloadFallback(blob, "factory-layout.jpg");
        }
      }, "image/jpeg", 0.92);
    };
    img.src = state.backgroundDataUrl;
  }

  /**
   * 優先使用 File System Access API 讓使用者自選儲存位置，失敗時回傳 false。
   * @param {Blob} blob 匯出內容。
   * @param {string} suggestedName 預設檔名。
   * @param {string} mimeType MIME 類型。
   */
  async function saveWithPicker(blob, suggestedName, mimeType) {
    try {
      if (!window.showSaveFilePicker) return false;
      const ext = suggestedName.includes(".")
        ? suggestedName.slice(suggestedName.lastIndexOf("."))
        : "";
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: suggestedName,
            accept: {
              [mimeType]: ext ? [ext] : [],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      console.warn("saveWithPicker fallback:", err);
      return false;
    }
  }

  /** 下載備援：以隱藏連結觸發瀏覽器預設下載。 */
  function downloadFallback(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function drawTotalsOverlay(ctx, totals, canvasWidth, canvasHeight) {
    const scale = state.pointSize / 22;
    const boxWidth = 180 * scale;
    const lineHeight = 18 * scale;
    const lines = [
      { label: "酸", value: totals.acid, cls: "flow-acid", color: "#8bc34a" },
      { label: "鹼", value: totals.base, cls: "flow-base", color: "#60a5fa" },
      { label: "有機", value: totals.voc, cls: "flow-voc", color: "#f4b183" },
      { label: "熱", value: totals.heat, cls: "flow-heat", color: "#f9a8d4" },
      { label: "集塵", value: totals.dust, cls: "flow-dust", color: "#bfdbfe" },
    ];
    const padding = 10 * scale;
    const headerHeight = 22 * scale;
    const totalHeight = headerHeight + lines.length * lineHeight + padding * 2;
    const posX = state.totalsPosition.x * canvasWidth;
    const posY = state.totalsPosition.y * canvasHeight;
    const boxX = clamp(posX - boxWidth / 2, 0, canvasWidth - boxWidth);
    const boxY = clamp(posY - totalHeight / 2, 0, canvasHeight - totalHeight);

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    roundRect(ctx, boxX, boxY, boxWidth, totalHeight, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#111";
    ctx.font = `${Math.max(10, 13 * scale)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("總量", boxX + padding, boxY + padding + headerHeight / 2);

    ctx.font = `${Math.max(10, 12 * scale)}px sans-serif`;
    lines.forEach((line, idx) => {
      const y = boxY + padding + headerHeight + idx * lineHeight + lineHeight / 2;
      ctx.fillStyle = line.color;
      const chipH = 14 * scale;
      const chipW = 28 * scale;
      ctx.fillRect(boxX + padding, y - chipH / 2, chipW, chipH);
      ctx.fillStyle = "#000";
      ctx.fillText(line.label, boxX + padding + chipW + 6 * scale, y);
      ctx.textAlign = "right";
      ctx.fillText(
        formatOneDecimal(line.value, false, true),
        boxX + boxWidth - padding,
        y
      );
      ctx.textAlign = "left";
    });
    ctx.restore();
  }

  function getSortKey(label) {
    const num = Number(label);
    if (Number.isFinite(num)) return num;
    return String(label || "");
  }

  function formatOneDecimal(value, allowBlankZero = false, alwaysZero = false) {
    const digits =
      typeof state.decimalPlaces === "number" && state.decimalPlaces >= 0
        ? Math.min(3, Math.max(0, Math.round(state.decimalPlaces)))
        : 1;
    const num = Number(value);
    if (!Number.isFinite(num)) return allowBlankZero ? "" : (0).toFixed(digits);
    if (num === 0 && allowBlankZero && !alwaysZero) return "";
    if (digits > 0 && Number.isInteger(num)) return String(num);
    return num.toFixed(digits);
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
