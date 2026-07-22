/**
 * aiService.js
 * ------------------------------------------------------------
 * 各ビュー（dictionaryView.js / divinationView.js）から呼ばれる、AI機能の唯一の入口。
 *
 * V2.5でプロンプト構築(promptBuilder.js)とプロバイダー呼び出し(aiProviders.js)を
 * 分離したため、このファイルは「入力データを整えてプロンプトを組み立ててもらい、
 * プロバイダーに送信し、結果を呼び出し元へ返す」というオーケストレーションだけに専念する。
 *
 *   promptBuilder.js … 何を頼むか（プロンプトの文章）
 *   aiProviders.js   … どのAPIをどう呼ぶか（プロバイダー実装）
 *   aiService.js（このファイル）… 上記2つをつなぎ、ビュー側へシンプルな関数を提供する
 * ------------------------------------------------------------
 */

/* ------------------------------------------------------------
 * 応答のJSON抽出（Markdownのコードフェンス等が付いていても解析できるようにする）
 * ---------------------------------------------------------- */

/**
 * AIの応答テキストからJSONオブジェクトを取り出す。
 * ```json ... ``` のようなコードフェンスが付いていても除去して解析する。
 * 解析できない場合はnullを返す（呼び出し側でフォールバック処理をする）。
 * @param {string} rawText
 * @returns {Object|null}
 */
function extractJsonFromResponse(rawText) {
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn('[aiService] AI応答をJSONとして解析できませんでした。', error);
    return null;
  }
}

/* ------------------------------------------------------------
 * ① カードのAI下書き生成
 * ---------------------------------------------------------- */

/**
 * カードのAI下書きを生成する。
 * @param {string} cardId
 * @param {'upright'|'reversed'} orientation
 * @returns {Promise<{prompt:string, body:string, modelName:string, parsed:Object|null}>}
 */
async function generateCardDraft(cardId, orientation) {
  const card = getCardById(cardId);
  const existingOrientationData = getCardDisplayData(cardId)[orientation];
  const prompt = composeCardDraftPrompt(card, orientation, existingOrientationData);

  const result = await sendPromptToProvider(prompt);
  const parsed = extractJsonFromResponse(result.text);

  return {
    prompt,
    body: result.text,
    modelName: result.modelName,
    parsed,
  };
}

/* ------------------------------------------------------------
 * ② 占いのAIリーディング生成
 * ---------------------------------------------------------- */

/**
 * 占いのAIリーディングを生成する。
 * プロンプトの中身はすべて promptBuilder.js の composeReadingPrompt() が組み立てる。
 * @param {string} question
 * @param {Object} spread
 * @param {Array<Object>} filledCards - positionLabel/cardName/orientationLabel/summary/description を持つ配列
 * @param {Array<Object>} [pastReadings] - 参考として渡す過去の占い履歴（任意）
 * @returns {Promise<{prompt:string, body:string, modelName:string}>}
 */
async function generateReadingInterpretation(question, spread, filledCards, pastReadings = []) {
  const prompt = composeReadingPrompt(question, spread, filledCards, pastReadings);
  const result = await sendPromptToProvider(prompt);
  return { prompt, body: result.text, modelName: result.modelName };
}
