/**
 * settingsView.js
 * ------------------------------------------------------------
 * 「設定」画面を担当する。
 *   - テーマ切替（夜/紙）
 *   - 今日の一枚リセット
 *   - データエクスポート（JSONファイルダウンロード）
 *   - データインポート（JSONファイル読み込み）
 * ------------------------------------------------------------
 */

/**
 * 設定画面が表示される時の入口。
 */
function renderSettingsView() {
  const settings = getSettings();
  applyTheme(settings.theme);
  syncThemeButtons(settings.theme);

  qs('#theme-dark-btn').onclick = () => {
    saveSettings({ theme: 'dark' });
    applyTheme('dark');
    syncThemeButtons('dark');
  };
  qs('#theme-light-btn').onclick = () => {
    saveSettings({ theme: 'light' });
    applyTheme('light');
    syncThemeButtons('light');
  };

  // --- AI設定（V2追加） ---
  const aiSettings = getAiSettings();
  qs('#ai-settings-api-key').value = aiSettings.geminiApiKey;
  qs('#ai-settings-model').value = aiSettings.geminiModel;
  qs('#ai-settings-form').onsubmit = (event) => {
    event.preventDefault();
    saveAiSettings({
      geminiApiKey: qs('#ai-settings-api-key').value.trim(),
      geminiModel: qs('#ai-settings-model').value,
    });
    alert('AI設定を保存しました。');
  };

  qs('#btn-reset-daily-card').onclick = () => {
    if (confirm('「今日の一枚」をリセットして、もう一度引き直せるようにしますか？')) {
      resetDailyCardRecord();
      alert('リセットしました。ホーム画面を開くと新しい一枚が抽選されます。');
    }
  };

  qs('#btn-export-data').onclick = exportDataToFile;
  qs('#import-file-input').onchange = handleImportFileSelected;
}

/** body要素にテーマクラスを反映する */
function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  document.body.classList.toggle('theme-dark', theme !== 'light');
}

/** テーマ切替ボタンの選択状態表示を更新する */
function syncThemeButtons(theme) {
  qs('#theme-dark-btn').classList.toggle('is-active', theme !== 'light');
  qs('#theme-light-btn').classList.toggle('is-active', theme === 'light');
}

/** 全データをJSONファイルとしてダウンロードする */
function exportDataToFile() {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `tarot-app-backup-${getTodayJstString()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** ファイル選択後、JSONを読み込んでインポートする */
function handleImportFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      importAllData(data);
      alert('データを読み込みました。アプリを再読み込みします。');
      window.location.reload();
    } catch (error) {
      console.error('[settings] インポートに失敗しました。', error);
      alert('ファイルの読み込みに失敗しました。正しいバックアップファイルか確認してください。');
    }
  };
  reader.readAsText(file);

  // 同じファイルを連続選択してもchangeイベントが発火するようリセット
  event.target.value = '';
}
