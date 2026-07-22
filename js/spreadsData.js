/**
 * spreadsData.js
 * ------------------------------------------------------------
 * Ver.1に初期搭載するスプレッド（カード配置パターン）の定義。
 *
 * スプレッドは「名前・カード枚数・各位置の座標(%)・各位置のラベル」を持つ
 * JSONデータとして表現する。position.x / position.y は
 * スプレッド盤面(.spread-board)に対する相対位置(0〜100の%)。
 * ------------------------------------------------------------
 */

/**
 * 組み込みスプレッドの定義を新規生成する。
 * isBuiltIn: true のスプレッドは削除できない設計にする（spreadsManager.js側で制御）。
 * @returns {Array<Object>}
 */
function createBuiltInSpreads() {
  return [
    {
      id: 'builtin-one-oracle',
      name: 'ワンオラクル',
      isBuiltIn: true,
      positions: [
        { id: 'pos-1', x: 50, y: 50, label: 'メッセージ' },
      ],
    },
    {
      id: 'builtin-three-card',
      name: 'スリーカード',
      isBuiltIn: true,
      positions: [
        { id: 'pos-1', x: 18, y: 50, label: '過去' },
        { id: 'pos-2', x: 50, y: 50, label: '現在' },
        { id: 'pos-3', x: 82, y: 50, label: '未来' },
      ],
    },
    {
      id: 'builtin-pyramid',
      name: 'ピラミッド',
      isBuiltIn: true,
      positions: [
        // 頂点（本質）
        { id: 'pos-1', x: 50, y: 12, label: '本質' },
        // 2段目（内的要因・外的要因）
        { id: 'pos-2', x: 32, y: 42, label: '内的要因' },
        { id: 'pos-3', x: 68, y: 42, label: '外的要因' },
        // 3段目（過去・現在・未来）
        { id: 'pos-4', x: 15, y: 78, label: '過去' },
        { id: 'pos-5', x: 50, y: 78, label: '現在' },
        { id: 'pos-6', x: 85, y: 78, label: '未来' },
      ],
    },
  ];
}

/**
 * アプリ初回起動時、保存済みスプレッドが1つも無ければ組み込みスプレッドを投入する。
 * 既にユーザーがスプレッドを保存している場合は何もしない（上書き防止）。
 */
function ensureBuiltInSpreadsSeeded() {
  const existing = getAllSpreadsList();
  if (existing.length > 0) return;
  createBuiltInSpreads().forEach(spread => saveSpread(spread));
}
