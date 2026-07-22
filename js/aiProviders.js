/**
 * aiProviders.js
 * ------------------------------------------------------------
 * 各AIプロバイダー固有のAPI呼び出しだけを担当するモジュール（V2.5で新規分離）。
 *
 * ここに置くのは「Gemini/Claude/ChatGPTのAPIをどう呼ぶか」という
 * プロバイダー固有の実装だけ。プロンプトの中身（何を頼むか）は
 * promptBuilder.js が担当し、このファイルは一切関知しない。
 *
 * 新しいプロバイダーを追加する手順:
 *   1. callXxx(promptText, aiSettings) を1つ追加する（下のcallGeminiが実装例）
 *   2. PROVIDER_HANDLERS にキーを1行追加する
 *   3. storage.js の createDefaultAiSettings() や設定画面にAPIキー欄を追加する
 * 呼び出し側（aiService.js）は sendPromptToProvider() だけを使うので、
 * プロバイダーが増えてもaiService.js側の変更は不要。
 * ------------------------------------------------------------
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini APIへプロンプトを送信し、応答テキストを取得する。
 * @param {string} promptText
 * @param {{geminiApiKey:string, geminiModel:string}} aiSettings
 * @returns {Promise<{text:string, modelName:string}>}
 */
async function callGemini(promptText, aiSettings) {
  const apiKey = aiSettings.geminiApiKey;
  const model = aiSettings.geminiModel;

  if (!apiKey) {
    throw new Error('Gemini APIキーが設定されていません。設定画面から登録してください。');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Gemini APIエラー（HTTP ${response.status}）: ${errorBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map(part => part.text ?? '')
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Geminiからの応答が空でした。');
  }

  return { text, modelName: model };
}

/*
 * 今後Claude APIを追加する場合はこのような形になる想定（未実装のプレースホルダー）:
 *
 * async function callClaude(promptText, aiSettings) {
 *   if (!aiSettings.claudeApiKey) throw new Error('Claude APIキーが設定されていません。');
 *   const response = await fetch('https://api.anthropic.com/v1/messages', {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'x-api-key': aiSettings.claudeApiKey,
 *       'anthropic-version': '2023-06-01',
 *     },
 *     body: JSON.stringify({
 *       model: aiSettings.claudeModel,
 *       max_tokens: 1000,
 *       messages: [{ role: 'user', content: promptText }],
 *     }),
 *   });
 *   const data = await response.json();
 *   const text = (data.content ?? []).map(block => block.text ?? '').join('\n').trim();
 *   return { text, modelName: aiSettings.claudeModel };
 * }
 *
 * 今後ChatGPT(OpenAI)を追加する場合も同様に callChatGpt() を用意し、
 * PROVIDER_HANDLERS に 'chatgpt': callChatGpt を追加するだけでよい。
 */

/** プロバイダー名 → 呼び出し関数 のレジストリ */
const PROVIDER_HANDLERS = {
  gemini: callGemini,
  // claude: callClaude,   // 追加時にコメントを外す
  // chatgpt: callChatGpt, // 追加時にコメントを外す
};

/**
 * 現在の設定（getAiSettings()）に応じたプロバイダーへプロンプトを送信する。
 * aiService.js から呼ばれる、このファイルの唯一の公開窓口。
 * @param {string} promptText
 * @returns {Promise<{text:string, modelName:string}>}
 */
async function sendPromptToProvider(promptText) {
  const aiSettings = getAiSettings();
  const handler = PROVIDER_HANDLERS[aiSettings.provider];

  if (!handler) {
    throw new Error(`未対応のAIプロバイダーです: ${aiSettings.provider}`);
  }

  return handler(promptText, aiSettings);
}
