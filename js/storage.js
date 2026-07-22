/**
 * storage.js
 * ------------------------------------------------------------
 * localStorage へのアクセスを一箇所に集約する層。
 * 他のモジュールは直接 localStorage.getItem/setItem を呼ばず、
 * 必ずこのファイルが提供する関数を経由すること。
 *
 * キー設計（すべて "tarotApp:" 名前空間の下に置く）:
 *   tarotApp:meta        … スキーマバージョンなどアプリ全体のメタ情報
 *   tarotApp:cardDisplay … カードごとの「表示データ」（正位置/逆位置の解釈）
 *   tarotApp:aiDrafts    … カードごとの「AI下書き」履歴（表示データとは完全分離）
 *   tarotApp:dailyCard   … 「今日の一枚」の抽選結果キャッシュ
 *   tarotApp:spreads     … スプレッド（カード配置）定義
 *   tarotApp:settings    … アプリ設定（テーマ等）
 *
 * 今後、AI履歴の詳細化・表示履歴・バージョン管理を追加する時は
 * このファイルにキーとマイグレーション関数を足すだけで済むようにしてある。
 * ------------------------------------------------------------
 */

const STORAGE_NAMESPACE = 'tarotApp';
const CURRENT_SCHEMA_VERSION = 1;

/** 名前空間付きのフルキーを組み立てる */
function storageKey(key) {
  return `${STORAGE_NAMESPACE}:${key}`;
}

/**
 * localStorageから値を読み込み、JSONとして返す。
 * 壊れたデータや未保存の場合はフォールバック値を返す。
 * @param {string} key
 * @param {*} fallback
 */
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[storage] "${key}" の読み込みに失敗しました。初期値を使用します。`, error);
    return fallback;
  }
}

/**
 * 値をJSON文字列にしてlocalStorageへ書き込む。
 * @param {string} key
 * @param {*} value
 */
function writeJson(key, value) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[storage] "${key}" の保存に失敗しました。`, error);
    return false;
  }
}

/* ------------------------------------------------------------
 * メタ情報・初期化
 * ---------------------------------------------------------- */

/** アプリ初回起動時にメタ情報を用意する（スキーマバージョン管理の土台） */
function ensureAppMeta() {
  const meta = readJson('meta', null);
  if (meta) return meta;
  const initialMeta = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
  };
  writeJson('meta', initialMeta);
  return initialMeta;
}

/* ------------------------------------------------------------
 * 表示データ（カードの解釈: キーワード/一言/詳細説明/メモ）
 * ---------------------------------------------------------- */

/** 1カード分の表示データの空テンプレートを返す */
function createEmptyCardDisplay() {
  const emptyOrientation = () => ({ keywords: [], summary: '', description: '', memo: '' });
  return {
    upright: emptyOrientation(),
    reversed: emptyOrientation(),
    updatedAt: null,
  };
}

/** 全カードの表示データを取得する（未保存なら空オブジェクト） */
function getAllCardDisplayData() {
  return readJson('cardDisplay', {});
}

/**
 * 指定カードの表示データを取得する。無ければ空テンプレートを返す。
 * @param {string} cardId
 */
function getCardDisplayData(cardId) {
  const all = getAllCardDisplayData();
  return all[cardId] ?? createEmptyCardDisplay();
}

/**
 * 指定カードの表示データを保存する。
 * @param {string} cardId
 * @param {Object} displayData
 */
function saveCardDisplayData(cardId, displayData) {
  const all = getAllCardDisplayData();
  all[cardId] = { ...displayData, updatedAt: new Date().toISOString() };
  return writeJson('cardDisplay', all);
}

/* ------------------------------------------------------------
 * AI下書き（表示データとは完全に分離した別レイヤー）
 * ---------------------------------------------------------- */

/** 全カードのAI下書き履歴を取得する（未保存ならカード毎に空配列） */
function getAllAiDrafts() {
  return readJson('aiDrafts', {});
}

/**
 * 指定カードのAI下書き履歴（配列）を取得する。
 * 配列にしてあるのは、複数AI対応・AI履歴を実装するため。
 * @param {string} cardId
 * @returns {Array<{id:string, orientation:?string, prompt:?string, body:string, modelName:string, parsed:?Object, createdAt:string}>}
 */
function getAiDraftsForCard(cardId) {
  const all = getAllAiDrafts();
  return all[cardId] ?? [];
}

/**
 * AI下書きを1件追加する。
 *
 * V2で追加したフィールド:
 *   - orientation: 'upright' | 'reversed' … どちらの向き用の下書きか
 *   - prompt: Geminiへ送った実際のプロンプト文
 *   - parsed: AI応答をJSONとして解釈できた場合の構造化データ
 *             { keywords, summary, description, memo }。反映(マージ等)に使う。
 *             解釈できなかった場合はnullのままにする。
 *
 * V1時代の呼び出し（body/modelNameのみ）でも動くよう、
 * 未指定のフィールドは安全な既定値になるようにしてある。
 *
 * @param {string} cardId
 * @param {{orientation?:string, prompt?:string, body:string, modelName:string, parsed?:Object}} draft
 */
function addAiDraft(cardId, draft) {
  const all = getAllAiDrafts();
  const list = all[cardId] ?? [];
  const newEntry = {
    id: generateId('draft'),
    orientation: draft.orientation ?? null,
    prompt: draft.prompt ?? '',
    body: draft.body ?? '',
    modelName: draft.modelName ?? '未設定',
    parsed: draft.parsed ?? null,
    createdAt: new Date().toISOString(),
  };
  all[cardId] = [newEntry, ...list];
  writeJson('aiDrafts', all);
  return newEntry;
}

/**
 * AI下書きを1件削除する。
 * @param {string} cardId
 * @param {string} draftId
 */
function deleteAiDraft(cardId, draftId) {
  const all = getAllAiDrafts();
  const list = all[cardId] ?? [];
  all[cardId] = list.filter(item => item.id !== draftId);
  return writeJson('aiDrafts', all);
}

/* ------------------------------------------------------------
 * 今日の一枚
 * ---------------------------------------------------------- */

/** 保存済みの「今日の一枚」の結果を取得する（無ければnull） */
function getDailyCardRecord() {
  return readJson('dailyCard', null);
}

/**
 * 「今日の一枚」の結果を保存する。
 * @param {{date:string, cardId:string, orientation:'upright'|'reversed', drawnAt:string}} record
 */
function saveDailyCardRecord(record) {
  return writeJson('dailyCard', record);
}

/** 「今日の一枚」をリセットする（設定画面の「今日の一枚リセット」用） */
function resetDailyCardRecord() {
  localStorage.removeItem(storageKey('dailyCard'));
}

/* ------------------------------------------------------------
 * スプレッド管理
 * ---------------------------------------------------------- */

/** 全スプレッド定義を { [id]: spread } の形で取得する */
function getAllSpreads() {
  return readJson('spreads', {});
}

/** 全スプレッドを配列で取得する（一覧表示用） */
function getAllSpreadsList() {
  return Object.values(getAllSpreads());
}

/**
 * スプレッドを1件保存（新規/更新どちらも兼ねる）。
 * @param {Object} spread
 */
function saveSpread(spread) {
  const all = getAllSpreads();
  all[spread.id] = { ...spread, updatedAt: new Date().toISOString() };
  return writeJson('spreads', all);
}

/** スプレッドを1件削除する */
function deleteSpread(spreadId) {
  const all = getAllSpreads();
  delete all[spreadId];
  return writeJson('spreads', all);
}

/* ------------------------------------------------------------
 * 設定
 * ---------------------------------------------------------- */

/** アプリ設定の既定値 */
function createDefaultSettings() {
  return { theme: 'dark' };
}

/** 現在の設定を取得する */
function getSettings() {
  return { ...createDefaultSettings(), ...readJson('settings', {}) };
}

/** 設定を保存する（部分更新） */
function saveSettings(partialSettings) {
  const merged = { ...getSettings(), ...partialSettings };
  writeJson('settings', merged);
  return merged;
}

/* ------------------------------------------------------------
 * お気に入り（V2追加）
 * ---------------------------------------------------------- */

/** お気に入りカードIDの集合を { [cardId]: true } の形で取得する */
function getFavoritesMap() {
  return readJson('favorites', {});
}

/** 指定カードがお気に入りかどうかを返す */
function isFavoriteCard(cardId) {
  return Boolean(getFavoritesMap()[cardId]);
}

/** お気に入りのON/OFFを切り替える。切り替え後の状態(true/false)を返す */
function toggleFavoriteCard(cardId) {
  const map = getFavoritesMap();
  const next = !map[cardId];
  if (next) {
    map[cardId] = true;
  } else {
    delete map[cardId];
  }
  writeJson('favorites', map);
  return next;
}

/* ------------------------------------------------------------
 * 占い履歴（V2追加）
 * ---------------------------------------------------------- */

/**
 * 占い履歴を1件追加する（新しい順で先頭に積む）。
 * @param {{question:string, spreadId:string, spreadName:string,
 *          cards:Array<{positionId:string, positionLabel:string, cardId:string, cardName:string, orientation:string}>,
 *          aiReading: ?{body:string, modelName:string, prompt:string, createdAt:string}}} entry
 */
function saveReadingHistoryEntry(entry) {
  const list = readJson('readingHistory', []);
  const newEntry = {
    id: generateId('reading'),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  list.unshift(newEntry);
  writeJson('readingHistory', list);
  return newEntry;
}

/** 占い履歴を全件取得する（新しい順） */
function getAllReadingHistory() {
  return readJson('readingHistory', []);
}

/** 占い履歴を1件削除する */
function deleteReadingHistoryEntry(entryId) {
  const list = readJson('readingHistory', []);
  const filtered = list.filter(item => item.id !== entryId);
  return writeJson('readingHistory', filtered);
}

/* ------------------------------------------------------------
 * AI設定（V2追加: Gemini APIキー・使用モデルなど）
 * ------------------------------------------------------------
 * 既存の getSettings()/saveSettings()（テーマ設定用）とは
 * 別キーで管理し、既存コードへの影響をゼロにする。
 * providerで分岐する形にしておくことで、今後Claude APIなど
 * 別プロバイダーを追加しやすくしている。
 * ---------------------------------------------------------- */

/** AI設定の既定値 */
function createDefaultAiSettings() {
  return {
    provider: 'gemini',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash-lite',
  };
}

/** 現在のAI設定を取得する */
function getAiSettings() {
  return { ...createDefaultAiSettings(), ...readJson('aiSettings', {}) };
}

/** AI設定を保存する（部分更新） */
function saveAiSettings(partialSettings) {
  const merged = { ...getAiSettings(), ...partialSettings };
  writeJson('aiSettings', merged);
  return merged;
}

/* ------------------------------------------------------------
 * エクスポート / インポート（設定画面から利用）
 * ---------------------------------------------------------- */

/**
 * アプリの全永続データを1つのJSONオブジェクトにまとめて返す。
 * ファイル保存はUI側（settings.js）で行う。
 *
 * 注意: Gemini APIキーはエクスポートに含めない（他人へファイルを渡す際に
 * キーが漏れるのを防ぐため）。エクスポート先には provider/model 設定のみ含める。
 */
function exportAllData() {
  const aiSettings = getAiSettings();
  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    cardDisplay: getAllCardDisplayData(),
    aiDrafts: getAllAiDrafts(),
    dailyCard: getDailyCardRecord(),
    spreads: getAllSpreads(),
    settings: getSettings(),
    favorites: getFavoritesMap(),
    readingHistory: getAllReadingHistory(),
    aiSettings: { provider: aiSettings.provider, geminiModel: aiSettings.geminiModel },
  };
}

/**
 * エクスポート形式のJSONを読み込んで各ストレージ領域に反映する。
 * 想定外の形式が来ても他のキーを壊さないよう、キーごとに存在チェックする。
 * @param {Object} data
 */
function importAllData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('インポートデータの形式が不正です');
  }
  if (data.cardDisplay) writeJson('cardDisplay', data.cardDisplay);
  if (data.aiDrafts) writeJson('aiDrafts', data.aiDrafts);
  if (data.dailyCard !== undefined) writeJson('dailyCard', data.dailyCard);
  if (data.spreads) writeJson('spreads', data.spreads);
  if (data.settings) writeJson('settings', data.settings);
  if (data.favorites) writeJson('favorites', data.favorites);
  if (data.readingHistory) writeJson('readingHistory', data.readingHistory);
  // APIキーは意図的にインポートしない（エクスポートにも含めていないため通常は無い想定）
  if (data.aiSettings) saveAiSettings({ provider: data.aiSettings.provider, geminiModel: data.aiSettings.geminiModel });
  return true;
}
