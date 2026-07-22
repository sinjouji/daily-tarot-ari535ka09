/**
 * router.js
 * ------------------------------------------------------------
 * ハッシュを使わない、シンプルな画面切り替え専用のルーター。
 * 各ビュー(js/xxxView.js)は「表示された時に呼ばれる関数」を
 * registerViewRenderer() で登録するだけでよい設計にしてある。
 * ------------------------------------------------------------
 */

// ビュー名 → 再描画関数 のレジストリ（各ビューファイルが起動時に登録する）
const viewRenderers = {};

// 現在表示中のビュー名
let currentViewName = 'home';

/**
 * ビューの再描画関数を登録する。
 * @param {string} viewName - 'home' | 'dictionary' | 'divination' | 'spreads' | 'settings'
 * @param {Function} renderFn - そのビューが表示される直前に呼ばれる関数
 */
function registerViewRenderer(viewName, renderFn) {
  viewRenderers[viewName] = renderFn;
}

/**
 * 指定ビューへ切り替える。
 * @param {string} viewName
 * @param {Object} [params] - ビュー側に渡したい追加情報（例: 開くカードID）
 */
function navigateTo(viewName, params = {}) {
  currentViewName = viewName;

  // 全ビューを隠してから対象だけ表示する
  qsa('.view').forEach(section => {
    section.hidden = section.dataset.view !== viewName;
  });

  // ボトムナビの選択状態を更新
  qsa('.nav-item').forEach(button => {
    button.classList.toggle('is-active', button.dataset.view === viewName);
  });

  // 登録済みの描画関数があれば呼び出す
  if (typeof viewRenderers[viewName] === 'function') {
    viewRenderers[viewName](params);
  }

  // 画面遷移のたびにスクロール位置をリセットして自然な操作感にする
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/**
 * ボトムナビゲーションのタップイベントを初期化する。
 */
function initNavigation() {
  qsa('.nav-item').forEach(button => {
    button.addEventListener('click', () => navigateTo(button.dataset.view));
  });
}
