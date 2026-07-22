/**
 * main.js
 * ------------------------------------------------------------
 * アプリのエントリーポイント。
 * DOMContentLoaded後に、初期データ準備 → ビュー登録 → 初期画面表示 の順で行う。
 * ------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. ストレージの初期化（メタ情報の用意、組み込みスプレッドの投入）
  ensureAppMeta();
  ensureBuiltInSpreadsSeeded();
  ensureBuiltInSpreadGuides(); // V3: 既存ユーザーの組み込みスプレッドにガイド情報を補う

  // 2. 保存済みテーマを最初に適用（画面のちらつき防止）
  applyTheme(getSettings().theme);

  // 3. 各ビューの描画関数をルーターへ登録
  registerViewRenderer('home', renderHomeView);
  registerViewRenderer('dictionary', renderDictionaryView);
  registerViewRenderer('divination', renderDivinationView);
  registerViewRenderer('spreads', renderSpreadsView);
  registerViewRenderer('settings', renderSettingsView);

  // 4. ナビゲーションを有効化し、ホーム画面から開始
  initNavigation();
  initQuestionCarrySync(); // V3: スプレッド選択画面⇔占い盤面の質問入力を同期させる
  navigateTo('home');
});
