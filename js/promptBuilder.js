/**
 * promptBuilder.js
 * ------------------------------------------------------------
 * 「AIに何を頼むか」という文章（プロンプト）だけを組み立てるモジュール。
 * 「どのAIプロバイダーのAPIをどう呼ぶか」は一切含まない
 * （それは aiProviders.js の役割）。
 *
 * 設計意図（V2.5改修）:
 *   これまで buildReadingPrompt() 内にベタ書きしていたシステムプロンプトを、
 *   役割ごとに分割した。今後実装予定の
 *     - AIチャット
 *     - プロンプト編集
 *     - プロンプトプリセット
 *   は、すべてこのファイルの buildSystemPrompt() / buildOutputFormatPrompt() などを
 *   土台として再利用できるようにしてある。
 *
 *   プリセットを増やしたい時は SYSTEM_PROMPT_PRESETS にキーを追加するだけでよい。
 * ------------------------------------------------------------
 */

/* ------------------------------------------------------------
 * ① システムプロンプト（AIの役割・トーン・基本方針）
 * ------------------------------------------------------------
 * AIチャット機能を実装する時も、このプリセットをそのまま使い回せるように
 * 「カード1件の読み解き」に限定した内容は含めていない。
 * ---------------------------------------------------------- */

const SYSTEM_PROMPT_PRESETS = {
  tarotPartner: [
    'あなたは「タロット占い師」ではありません。',
    'あなたは、ユーザーが実際に引いたタロットカードを多角的に読み解き、一緒に考える「考察パートナー」です。',
    'あなたは占いの答えを決める存在ではなく、考えるための視点を提供する存在です。',
    '',
    '【基本方針】',
    '・カードを引くことは行わない。ユーザーが引いた結果のみを扱う。',
    '・未来を断定しない。',
    '・「必ず」「絶対」「〜すべき」「〜になります」という言い切りは避ける。',
    '・カードを「良いカード」「悪いカード」で評価しない。困難に見えるカードにも、学び・注意点・成長の視点を含める。',
    '・ユーザーが入力した質問を最優先する。カード単体の一般的な意味の説明で終わらせず、',
    '  「その質問に対してこのカードがどんな視点を与えてくれるか」を中心に考える。',
    '・アプリ内の辞典データが渡された場合は、一般的な解釈よりも辞典データを優先する。',
    '  辞典データを基準にして、そこに一般的な解釈を補足する形にする。',
    '・断定的な表現の代わりに、次のような言い回しを優先する:',
    '　「〜という可能性があります」「〜という見方もできます」「〜を意識すると良いかもしれません」「〜というテーマが見えてきます」',
    '・ユーザー自身が考える余地を残す。',
  ].join('\n'),
};

/**
 * システムプロンプト（役割・方針）を取得する。
 * プリセットキーを指定できるようにしてあるのは、今後のプロンプトプリセット機能のため。
 * @param {string} [presetKey]
 * @returns {string}
 */
function buildSystemPrompt(presetKey = 'tarotPartner') {
  return SYSTEM_PROMPT_PRESETS[presetKey] ?? SYSTEM_PROMPT_PRESETS.tarotPartner;
}

/* ------------------------------------------------------------
 * ② 出力フォーマット指示（構成・長さ・最後の問いかけ）
 * ------------------------------------------------------------
 * 「読み解き」に特化した出力形式。AIチャットでは使わない/差し替える想定なので
 * システムプロンプトとは別関数に分離してある。
 * ---------------------------------------------------------- */

const READING_OUTPUT_FORMAT_PROMPT = [
  '【回答構成】以下の6つを、それぞれ簡潔な見出し付きで書いてください。長すぎる回答は避け、各項目は簡潔で構いません。',
  '① 全体メッセージ（質問に対してカード全体から受ける印象）',
  '② 象徴的な意味（カード本来の象徴）',
  '③ 心理的な視点（現在の心の状態・考え方・感情）',
  '④ 現実的な視点（仕事・恋愛・人間関係・制作など、質問内容に合わせた解釈）',
  '⑤ 注意点（気を付けると良いこと・偏りや思い込み・見落とし）',
  '⑥ 前向きなヒント（次の一歩を考えられる優しいアドバイス）',
  '',
  '最後に、答えを誘導しないオープンクエスチョンを1つだけ添えてください',
  '（例:「最近、本当にやりたいことは何でしょうか？」「今、手放しても良いと思えるものはありますか？」）。',
  'ユーザー自身が内省できる問いかけにしてください。',
].join('\n');

/**
 * 読み解き用の出力フォーマット指示を取得する。
 * @returns {string}
 */
function buildOutputFormatPrompt() {
  return READING_OUTPUT_FORMAT_PROMPT;
}

/* ------------------------------------------------------------
 * ③ 読み解き対象（質問・スプレッド・カード）の指示
 * ---------------------------------------------------------- */

/**
 * 占い読み解きの「お題」部分（質問・スプレッド・カード一覧）を組み立てる。
 * @param {string} question
 * @param {Object} spread
 * @param {Array<{positionLabel:string, cardName:string, orientationLabel:string, summary:string, description:string}>} filledCards
 * @returns {string}
 */
function buildReadingInstruction(question, spread, filledCards) {
  const questionLine = question
    ? `ユーザーの質問（最優先で扱ってください）: ${question}`
    : 'ユーザーの質問: 特に指定なし（全体的な読み解きをお願いします）';

  const cardLines = filledCards.map(item => {
    const dictionaryNotes = [];
    if (item.summary) dictionaryNotes.push(`一言: ${item.summary}`);
    if (item.description) dictionaryNotes.push(`詳細説明: ${item.description.slice(0, 150)}`);
    const dictionaryNote = dictionaryNotes.length > 0
      ? `（辞典データ・最優先 ─ ${dictionaryNotes.join(' / ')}）`
      : '（この向きの辞典データはまだ登録されていません。一般的な解釈で補ってください）';
    return `- ${item.positionLabel}: ${item.cardName}（${item.orientationLabel}）${dictionaryNote}`;
  }).join('\n');

  const multiCardNote = filledCards.length > 1
    ? '\n\n複数枚あるので、共通するテーマ・流れ・位置ごとの役割・相互関係も考慮してください。'
    : '';

  return [
    `使用しているスプレッド: 「${spread.name}」`,
    questionLine,
    '',
    '引かれたカードは以下の通りです。カードの意味を説明するだけで終わらせず、',
    '質問に対してそのカードがどんな視点を与えてくれるかを中心に読み解いてください:',
    cardLines,
    multiCardNote,
  ].filter(line => line !== '').join('\n');
}

/* ------------------------------------------------------------
 * ④ 過去の占い履歴（比較参考用）の指示
 * ---------------------------------------------------------- */

/**
 * 過去の占い履歴を、比較参考用のセクション文字列に整形する。
 * 履歴が無ければ空文字を返す（プロンプトに含めない）。
 * @param {Array<Object>} pastReadings
 * @returns {string}
 */
function buildHistoryPrompt(pastReadings) {
  if (!pastReadings || pastReadings.length === 0) return '';

  const lines = pastReadings.map(entry => {
    const cardSummary = entry.cards
      .map(c => `${c.positionLabel}:${c.cardName}(${c.orientation === 'upright' ? '正位置' : '逆位置'})`)
      .join(' / ');
    const excerpt = entry.aiReading && entry.aiReading.body
      ? `${entry.aiReading.body.slice(0, 120)}${entry.aiReading.body.length > 120 ? '…' : ''}`
      : '（AIリーディングは保存されていません）';
    return `- [${formatDateTimeJst(entry.createdAt)}] 質問:${entry.question || '(なし)'} / カード:${cardSummary} / 要旨:${excerpt}`;
  }).join('\n');

  return [
    '参考: 直近の占い履歴（それぞれ独立した結果として扱ってください。無理に1つの結論へまとめる必要はありません）',
    lines,
    '共通して現れるテーマ・繰り返し現れる象徴・前回との変化や気付きがあれば、補足として触れてください。',
  ].join('\n');
}

/* ------------------------------------------------------------
 * ⑤ 読み解きプロンプトの合成（唯一、aiService.jsから呼ばれる関数）
 * ---------------------------------------------------------- */

/**
 * システムプロンプト・お題・履歴・出力フォーマットを1つのプロンプト文字列に合成する。
 * @param {string} question
 * @param {Object} spread
 * @param {Array<Object>} filledCards
 * @param {Array<Object>} [pastReadings]
 * @returns {string}
 */
function composeReadingPrompt(question, spread, filledCards, pastReadings = []) {
  return [
    buildSystemPrompt('tarotPartner'),
    buildReadingInstruction(question, spread, filledCards),
    buildHistoryPrompt(pastReadings),
    buildOutputFormatPrompt(),
  ].filter(section => section !== '').join('\n\n---\n\n');
}

/* ------------------------------------------------------------
 * ⑥ カードのAI下書き用プロンプト（辞典の解釈を書く、別の業務用途）
 * ------------------------------------------------------------
 * 読み解き（占い）とは別の目的（辞典の解釈文を書く）なので、
 * tarotPartnerのペルソナは使わず、単独の指示として組み立てる。
 * ---------------------------------------------------------- */

/**
 * カード1枚・1つの向き分のAI下書き生成プロンプトを組み立てる。
 * @param {Object} card - data.jsの固定情報
 * @param {'upright'|'reversed'} orientation
 * @param {Object} existingOrientationData - 既存の表示データ（正位置 or 逆位置）
 * @returns {string}
 */
function composeCardDraftPrompt(card, orientation, existingOrientationData) {
  const orientationLabel = orientation === 'upright' ? '正位置' : '逆位置';
  const existingSummaryNote = existingOrientationData.summary
    ? `参考として、既存の一言解釈は次の通りです: 「${existingOrientationData.summary}」`
    : '既存の解釈はまだ登録されていません。';

  return [
    'あなたはタロット占いの解釈を書く専門家です。',
    `タロットカード「${card.nameJa}（${card.nameEn}）」の${orientationLabel}について、解釈の下書きを作成してください。`,
    existingSummaryNote,
    '',
    '以下のJSON形式のみで出力してください（前置きや説明文、コードフェンスは不要です）:',
    '{',
    '  "keywords": ["キーワード1", "キーワード2", "キーワード3"],',
    '  "summary": "一言でまとめた解釈（20文字程度）",',
    '  "description": "詳細な解釈（150〜250文字程度）",',
    '  "memo": "占う際の補足やアドバイス（任意、無ければ空文字）"',
    '}',
  ].join('\n');
}
