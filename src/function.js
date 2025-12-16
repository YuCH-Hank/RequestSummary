(() => {
  /**
   * @typedef {Object} Point
   * @property {string} uid ?��?識別?�於對�? DOM??   * @property {string} id 點�?編�?顯示?��?   * @property {number} x �????X 座�? (0-1)??   * @property {number} y �????Y 座�? (0-1)??   * @property {"row" | "column"} flowDirection 風�?標籤?��??��???   * @property {number} acid ?�台?�風?��?   * @property {number} base ?�台鹼風?��?   * @property {number} voc ?�台?��?風�???   * @property {number} heat ?�台?�風?��?   * @property {number} dust ?�台?�塵風�???   * @property {number} machines 機台?��???   */

  /** �?UI ?�用?�全?��??��?*/
  const state = {
    backgroundDataUrl: null,
    opacity: 0.7,
    pointSize: 22,
    pointOpacity: 0.9,
    totalsPosition: { x: 0.02, y: 0.7 },
    decimalPlaces: 1,
    summarySortById: false,
    imageWidth: null,
    imageHeight: null,
    points: [],
    textBoxes: [],
  };

  /**
   * 建�?點�?並帶?��?設值�??�接?��?寫�?   * @param {Partial<Point>} overrides 覆寫欄�???   * @returns {Point} ?��?點�??�件??   */
  function createPoint(overrides = {}) {
    return {
      uid: Date.now() + "-" + Math.random().toString(16).slice(2),
      id: "",
      x: 0,
      y: 0,
      flowDirection: "row",
      acid: 0,
      base: 0,
      voc: 0,
      heat: 0,
      dust: 0,
      machines: 1,
      ...overrides,
    };
  }

  function createTextBox(overrides = {}) {
    return {
      uid: Date.now() + "-" + Math.random().toString(16).slice(2),
      text: "文字",
      x: 0.5,
      y: 0.5,
      color: "#111111",
      fontSize: 16,
      ...overrides,
    };
  }

  /**
   * 將數?��??�在 min ??max 之�???   * @param {number} v 輸入?��?   * @param {number} min ?�小值�?   * @param {number} max ?�大值�?   * @returns {number} ?�縮後�??�值�?   */
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /**
   * ?�新底�? DataURL ?��??��?   * @param {string} dataUrl 底�? DataURL??   */
  function setBackgroundDataUrl(dataUrl) {
    state.backgroundDataUrl = dataUrl;
  }

  /**
   * �?FileReader �?Blob 讀??DataURL??   * @param {Blob} blob 檔�??��??��?段�?   * @param {(dataUrl: string) => void} cb 完�?後�??��?   */
  function readBlobAsDataUrl(blob, cb) {
    const reader = new FileReader();
    reader.onload = (ev) => cb(ev.target.result);
    reader.readAsDataURL(blob);
  }

  /**
   * 將�?位大小�??�至 CSS 變數??   */
  function applyPointSize() {
    document.documentElement.style.setProperty(
      "--point-size",
      `${state.pointSize}px`
    );
    document.documentElement.style.setProperty(
      "--flow-scale",
      `${state.pointSize / 22}`
    );
    document.documentElement.style.setProperty(
      "--ui-scale",
      "1"
    );
    document.documentElement.style.setProperty(
      "--totals-scale",
      `${state.pointSize / 22}`
    );
  }

  /**
   * �?UID ?��??��??��??��?位�?   * @param {string|null} selectedPointId 點�? UID??   * @returns {Point | null} 點�???null??   */
  function getSelectedPoint(selectedPointId) {
    return state.points.find((p) => p.uid === selectedPointId) || null;
  }

  window.App = {
    state,
    createPoint,
    clamp,
    setBackgroundDataUrl,
    readBlobAsDataUrl,
    applyPointSize,
    getSelectedPoint,
    createTextBox,
  };
})();
