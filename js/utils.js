/**
 * utils.js
 * ------------------------------------------------------------
 * どの機能にも依存しない、純粋な共通ヘルパー関数だけを置く。
 * ------------------------------------------------------------
 */

/**
 * JST(日本標準時)基準で「YYYY-MM-DD」形式の今日の日付文字列を返す。
 * 「今日の一枚」が日付をまたいだ時だけ更新されるようにするための基準値。
 * @returns {string}
 */
function getTodayJstString() {
  const now = new Date();
  // UTCのミリ秒に9時間分を足してJSTのDate相当を作る
  const jstMillis = now.getTime() + 9 * 60 * 60 * 1000;
  const jstDate = new Date(jstMillis);
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * JST基準の日時をユーザー表示用に整形する（例: 2026/07/16 21:30）。
 * @param {string|number|Date} value - ISO文字列やDateなど
 * @returns {string}
 */
function formatDateTimeJst(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const jstMillis = date.getTime() + 9 * 60 * 60 * 1000;
  const jst = new Date(jstMillis);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mm = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

/**
 * 文字列シードから決定論的な0〜1の疑似乱数を生成する（簡易ハッシュ方式）。
 * 「今日の一枚」を同じ日なら同じ結果にするために使う。
 * @param {string} seed
 * @returns {number} 0以上1未満の数値
 */
function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // 32bit整数化
  }
  // ハッシュ値を0〜1の範囲に正規化
  const normalized = (hash >>> 0) / 4294967295;
  return normalized;
}

/**
 * 衝突しにくい簡易ユニークIDを発行する（外部ライブラリ不要）。
 * @param {string} prefix
 * @returns {string}
 */
function generateId(prefix = 'id') {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}

/**
 * querySelector の短縮ヘルパー。
 * @param {string} selector
 * @param {ParentNode} [scope]
 */
function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

/**
 * querySelectorAll を配列にして返す短縮ヘルパー。
 * @param {string} selector
 * @param {ParentNode} [scope]
 */
function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

/**
 * 要素を作ってクラス・属性・中身をまとめて設定する軽量ヘルパー。
 * フレームワークを使わず読みやすいDOM生成をするために使う。
 * @param {string} tag
 * @param {Object} [options]
 * @param {string} [options.className]
 * @param {string} [options.text]
 * @param {string} [options.html]
 * @param {Object} [options.attrs]
 * @param {Object} [options.dataset]
 * @returns {HTMLElement}
 */
function createEl(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.text !== undefined) el.textContent = options.text;
  if (options.html !== undefined) el.innerHTML = options.html;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => el.setAttribute(key, value));
  }
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => { el.dataset[key] = value; });
  }
  return el;
}

/**
 * オブジェクトのディープコピーを作る（設定のエクスポート/インポート等で使用）。
 * @param {*} value
 */
function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
