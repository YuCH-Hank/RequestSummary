(() => {
  /**
   * @typedef {Object} Point
   * @property {string} uid 唯一識別用於對應 DOM。
   * @property {string} id 點位編號顯示用。
   * @property {number} x 正規化 X 座標 (0-1)。
   * @property {number} y 正規化 Y 座標 (0-1)。
   * @property {"row" | "column"} flowDirection 風量標籤排列方式。
   * @property {number} acid 單台酸風量。
   * @property {number} base 單台鹼風量。
   * @property {number} voc 單台有機風量。
   * @property {number} heat 單台熱風量。
   * @property {number} dust 單台集塵風量。
   * @property {number} machines 機台數量。
   */

  /** 供 UI 共用的全域狀態。 */
  const state = {
    backgroundDataUrl: null,
    opacity: 1,
    pointSize: 22,
    pointOpacity: 0.5,
    totalsPosition: { x: 0.02, y: 0.7 },
    imageWidth: null,
    imageHeight: null,
    points: [],
  };

  /**
   * 建立點位並帶入預設值，可接受覆寫。
   * @param {Partial<Point>} overrides 覆寫欄位。
   * @returns {Point} 新的點位物件。
   */
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

  /**
   * 將數值限制在 min 與 max 之間。
   * @param {number} v 輸入值。
   * @param {number} min 最小值。
   * @param {number} max 最大值。
   * @returns {number} 限縮後的數值。
   */
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /**
   * 更新底圖 DataURL 與狀態。
   * @param {string} dataUrl 底圖 DataURL。
   */
  function setBackgroundDataUrl(dataUrl) {
    state.backgroundDataUrl = dataUrl;
  }

  /**
   * 以 FileReader 將 Blob 讀為 DataURL。
   * @param {Blob} blob 檔案或資料片段。
   * @param {(dataUrl: string) => void} cb 完成後回呼。
   */
  function readBlobAsDataUrl(blob, cb) {
    const reader = new FileReader();
    reader.onload = (ev) => cb(ev.target.result);
    reader.readAsDataURL(blob);
  }

  /**
   * 將點位大小套用至 CSS 變數。
   */
  function applyPointSize() {
    document.documentElement.style.setProperty(
      "--point-size",
      `${state.pointSize}px`
    );
  }

  /**
   * 依 UID 取得目前選取的點位。
   * @param {string|null} selectedPointId 點位 UID。
   * @returns {Point | null} 點位或 null。
   */
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
  };
})();
