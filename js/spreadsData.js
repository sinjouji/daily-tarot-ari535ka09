/**
 * spreadsData.js
 * ------------------------------------------------------------
 * Ver.1に初期搭載するスプレッド（カード配置パターン）の定義。
 *
 * スプレッドは「名前・カード枚数・各位置の座標(%)・各位置のラベル」を持つ
 * JSONデータとして表現する。position.x / position.y は
 * スプレッド盤面(.spread-board)に対する相対位置(0〜100の%)。
 *
 * V3で「占いガイド」情報(guide)を追加した。ガイドは以下を持つ:
 *   beginnerLevel     … 初心者向け度（1〜3の数値、1が最もやさしい）
 *   overview          … 占い方の概要
 *   suitableQuestions … 向いている質問・シーンの例（配列）
 *   steps             … 手順（配列、順番通り）
 *   positionMeanings  … { [positionId]: 意味の説明文 }（固定しすぎず柔軟な書き方にする）
 *   cautions          … 注意点（配列）
 *   tip               … ワンポイントアドバイス
 *
 * カスタムスプレッドにも同じ構造でguideを持たせられるようにしてあるが、
 * Ver.3時点では作成・編集UIは用意していない（今後追加できる構造にしてある）。
 * ------------------------------------------------------------
 */

/** 組み込みスプレッドのガイド情報（IDをキーにした一覧） */
const BUILT_IN_SPREAD_GUIDES = {
  'builtin-one-oracle': {
    beginnerLevel: 1,
    overview: '1枚のカードから、今のあなたに必要なメッセージをシンプルに受け取る占い方です。',
    suitableQuestions: [
      '今日一日のテーマを知りたい',
      '今の自分に必要なメッセージを受け取りたい',
      'シンプルに一言アドバイスが欲しい',
    ],
    steps: [
      '質問（またはテーマ）を決める',
      'カードをシャッフルする',
      '1枚引く',
      'そのカードの意味を確認する',
    ],
    positionMeanings: {
      'pos-1': '今のあなたに向けたメッセージ。質問がある場合は、その質問に対する1つの視点として読み解けます。',
    },
    cautions: [
      '情報が1枚だけなので、込み入った悩みには情報が少ないと感じる場合があります。',
    ],
    tip: '迷った時や、忙しくてじっくり占う時間がない時にもおすすめです。',
  },

  'builtin-three-card': {
    beginnerLevel: 1,
    overview: '3枚のカードを使い、状況の流れ（例: 過去・現在・未来）を整理する占い方です。',
    suitableQuestions: [
      '状況を整理したい',
      '過去・現在・未来の流れを見たい',
      '1枚では少し情報が足りないと感じる時',
      '続けるかどうか迷っている',
    ],
    steps: [
      '質問を具体的に決める',
      'カードをシャッフルする',
      '3枚のカードを引く',
      '左から順番に配置する',
      'それぞれの位置の意味を確認する',
      'カード全体の流れを読み解く',
    ],
    positionMeanings: {
      'pos-1': '過去・背景。ここに至るまでの経緯や、質問の前提になっている要素として読めます。',
      'pos-2': '現在・現状。今の状況や、今意識していることとして読めます。',
      'pos-3': '未来・今後の流れ。このままいくとどうなりそうか、という1つの可能性として読めます。',
    },
    cautions: [
      '位置の意味を固定しすぎると視野が狭くなることがあります。質問内容に応じて柔軟に読み替えてみてください。',
    ],
    tip: '「続ける・やめる」のような二択の質問にも、複数の視点を加えて考えるのに向いています。',
  },

  'builtin-pyramid': {
    beginnerLevel: 2,
    overview: '6枚のカードを使い、悩みの背景や原因を多角的に、少し深く掘り下げる占い方です。',
    suitableQuestions: [
      '悩みの背景や原因を深掘りしたい',
      '複雑な状況を整理したい',
      '内面と外的な状況の両方を見たい',
    ],
    steps: [
      '質問を具体的に決める',
      'カードをシャッフルする',
      '6枚のカードを引く',
      '頂点→2段目→3段目の順に配置する',
      '各位置の意味を確認する',
      '全体のつながりを読み解く',
    ],
    positionMeanings: {
      'pos-1': '本質。この状況の核にありそうなテーマとして読めます。',
      'pos-2': '内的要因。自分自身の考え方や感情に関わる要素として読めます。',
      'pos-3': '外的要因。周囲の状況や他者に関わる要素として読めます。',
      'pos-4': '過去。ここに至るまでの経緯として読めます。',
      'pos-5': '現在。今の状況として読めます。',
      'pos-6': '未来。今後の流れの1つの可能性として読めます。',
    },
    cautions: [
      'カード枚数が多いため、慣れないうちは1枚ずつじっくり確認すると読み解きやすくなります。',
    ],
    tip: '複数の視点を組み合わせて考えたい、少し複雑な悩みに向いています。',
  },
};

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
      guide: BUILT_IN_SPREAD_GUIDES['builtin-one-oracle'],
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
      guide: BUILT_IN_SPREAD_GUIDES['builtin-three-card'],
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
      guide: BUILT_IN_SPREAD_GUIDES['builtin-pyramid'],
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

/**
 * 既存ユーザー（V2以前からのデータ）が持つ組み込みスプレッドに、
 * ガイド情報が無ければ後から補う（V3の互換性維持のためのマイグレーション処理）。
 * ユーザーが編集した名前やカード位置は変更しない。
 */
function ensureBuiltInSpreadGuides() {
  const all = getAllSpreads();
  Object.entries(BUILT_IN_SPREAD_GUIDES).forEach(([id, guide]) => {
    const spread = all[id];
    if (spread && !spread.guide) {
      saveSpread({ ...spread, guide });
    }
  });
}
