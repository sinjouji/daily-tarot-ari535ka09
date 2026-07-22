/**
 * spreadRecommendation.js
 * ------------------------------------------------------------
 * 「この質問に合いそうな占い方法を見る」機能を担当する（V3で新規追加）。
 *
 * 設計方針:
 *   - 特定のスプレッド名をコードに直接書いて判定する、というやり方は避ける。
 *     各スプレッドの guide.overview / guide.suitableQuestions というデータを
 *     使って汎用的にスコアリングするため、将来スプレッドが増えても
 *     ガイド情報さえ登録すればそのまま診断対象になる。
 *   - AIによる診断はあくまで「参考」であり、最終的にどの方法で占うかは
 *     常にユーザー自身が選べるUIにする（ボタンで選択するだけで自動決定はしない）。
 * ------------------------------------------------------------
 */

/* ------------------------------------------------------------
 * ルールベースのスコアリング（API不要で動く簡易診断）
 * ---------------------------------------------------------- */

/**
 * 日本語は単語間にスペースが無いため、簡易的に2文字ずつのbigram集合を作り、
 * 文章同士の「近さ」を測る材料にする（形態素解析ライブラリを使わない軽量な方法）。
 * @param {string} text
 * @returns {Set<string>}
 */
function extractBigrams(text) {
  const cleaned = (text || '').replace(/\s+/g, '');
  const grams = new Set();
  for (let i = 0; i < cleaned.length - 1; i++) {
    grams.add(cleaned.slice(i, i + 2));
  }
  return grams;
}

/**
 * 2つの文章のbigram重なり度合いを0〜1のスコアで返す（大きいほど近い）。
 * @param {string} textA
 * @param {string} textB
 * @returns {number}
 */
function bigramOverlapScore(textA, textB) {
  const gramsA = extractBigrams(textA);
  const gramsB = extractBigrams(textB);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  let overlapCount = 0;
  gramsA.forEach(gram => { if (gramsB.has(gram)) overlapCount++; });

  return overlapCount / Math.min(gramsA.size, gramsB.size);
}

/**
 * 1つのスプレッドが、質問文にどれくらい合いそうかをスコアリングする。
 * guide.overview / guide.suitableQuestions のテキストと質問文の近さで判定する。
 * @param {string} question
 * @param {Object} spread
 * @returns {{score:number, matchedText:string}}
 */
function scoreSpreadForQuestion(question, spread) {
  if (!spread.guide) return { score: 0, matchedText: '' };

  const candidateTexts = [spread.guide.overview, ...(spread.guide.suitableQuestions || [])].filter(Boolean);
  let bestScore = 0;
  let matchedText = '';

  candidateTexts.forEach(text => {
    const score = bigramOverlapScore(question, text);
    if (score > bestScore) {
      bestScore = score;
      matchedText = text;
    }
  });

  return { score: bestScore, matchedText };
}

/**
 * 質問文に対して、登録されている全スプレッドを「合いそうな順」に並べる。
 * 質問が空、もしくはどのガイドとも近さが検出できない場合は、
 * 初心者向け度（beginnerLevel）が低い順にフォールバックする。
 * @param {string} question
 * @param {Array<Object>} spreads
 * @returns {Array<{spread:Object, score:number, matchedText:string, fallbackReason?:string}>}
 */
function recommendSpreadsByRule(question, spreads) {
  const trimmedQuestion = (question || '').trim();

  const scored = spreads.map(spread => ({ spread, ...scoreSpreadForQuestion(trimmedQuestion, spread) }));
  const hasSignal = trimmedQuestion.length >= 2 && scored.some(item => item.score > 0);

  if (!hasSignal) {
    return [...scored]
      .sort((a, b) => (a.spread.guide?.beginnerLevel ?? 99) - (b.spread.guide?.beginnerLevel ?? 99))
      .map((item, index) => ({
        ...item,
        fallbackReason: index === 0
          ? (trimmedQuestion
            ? 'この質問に近い内容が見つからなかったため、初心者向けの占い方法からご提案しています。'
            : '質問が未入力のため、初心者向けの占い方法からご提案しています。')
          : undefined,
      }));
  }

  return scored.sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------
 * 画面描画（ルールベース診断結果 + AI診断の呼び出し）
 * ---------------------------------------------------------- */

/**
 * 「この質問に合いそうな占い方法を見る」ボタンから呼ばれる、診断結果の描画処理。
 * @param {string} question
 */
function renderSpreadRecommendation(question) {
  const container = qs('#spread-recommendation-result');
  container.innerHTML = '';

  const spreads = getAllSpreadsList();
  const ranked = recommendSpreadsByRule(question, spreads);

  if (ranked.length === 0) {
    container.appendChild(createEl('p', { className: 'ai-draft-empty', text: 'スプレッドが登録されていません。' }));
    return;
  }

  container.appendChild(createEl('span', { className: 'eyebrow', text: 'おすすめの占い方法（簡易診断）' }));

  const [topItem, ...restItems] = ranked;
  container.appendChild(buildRecommendationCard(topItem, true));

  const others = restItems.filter(item => item.spread.guide).slice(0, 2);
  if (others.length > 0) {
    container.appendChild(createEl('p', { className: 'recommendation-subheading', text: '他の候補' }));
    others.forEach(item => container.appendChild(buildRecommendationCard(item, false)));
  }

  // AIによる診断（任意・参考情報として）
  const aiSection = createEl('div', { className: 'ai-recommendation-section' });
  const aiButton = createEl('button', { className: 'btn btn-ghost btn-sm', text: 'AIにも相談する' });
  const aiResultContainer = createEl('div', { className: 'ai-recommendation-result' });
  aiButton.addEventListener('click', () => runAiSpreadRecommendation(question, spreads, aiButton, aiResultContainer));
  aiSection.appendChild(aiButton);
  aiSection.appendChild(aiResultContainer);
  container.appendChild(aiSection);
}

/**
 * 1件の診断結果カードを組み立てる。
 * @param {{spread:Object, score:number, matchedText:string, fallbackReason?:string}} item
 * @param {boolean} isTop
 * @returns {HTMLElement}
 */
function buildRecommendationCard(item, isTop) {
  const { spread } = item;
  const card = createEl('div', { className: `recommendation-card ${isTop ? 'is-top' : ''}` });

  card.appendChild(createEl('span', { className: 'recommendation-badge', text: isTop ? '⭐ おすすめ' : '候補' }));
  card.appendChild(createEl('span', { className: 'recommendation-spread-name', text: spread.name }));
  card.appendChild(createEl('p', { className: 'recommendation-reason', text: buildRuleBasedReasonText(item) }));

  const actions = createEl('div', { className: 'recommendation-actions' });

  const guideBtn = createEl('button', { className: 'btn btn-ghost btn-sm', text: 'ガイドを見る' });
  guideBtn.addEventListener('click', () => openSpreadGuide(spread, 'selector'));
  actions.appendChild(guideBtn);

  const startBtn = createEl('button', { className: 'btn btn-primary btn-sm', text: 'このスプレッドで占う' });
  startBtn.addEventListener('click', () => startReading(spread));
  actions.appendChild(startBtn);

  card.appendChild(actions);
  return card;
}

/** ルールベース診断の理由テキストを組み立てる */
function buildRuleBasedReasonText(item) {
  const { spread, score, matchedText, fallbackReason } = item;
  if (fallbackReason) return fallbackReason;
  if (!spread.guide) return 'このスプレッドにはまだガイド情報が登録されていません。';
  if (score <= 0) return spread.guide.overview || '';
  const tipNote = spread.guide.tip ? `　${spread.guide.tip}` : '';
  return `「${matchedText}」という内容に近いためおすすめです。${tipNote}`;
}

/* ------------------------------------------------------------
 * AIによるおすすめ診断（任意）
 * ---------------------------------------------------------- */

/**
 * 「AIにも相談する」ボタンの処理。あくまで参考情報として表示し、
 * 自動的にスプレッドを決定することはしない。
 * @param {string} question
 * @param {Array<Object>} spreads
 * @param {HTMLElement} button
 * @param {HTMLElement} resultContainer
 */
async function runAiSpreadRecommendation(question, spreads, button, resultContainer) {
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = '相談中…';
  resultContainer.innerHTML = '';

  try {
    const recommendation = await recommendSpreadWithAi(question, spreads);
    renderAiRecommendationResult(recommendation, spreads, resultContainer);
  } catch (error) {
    console.error('[spreadRecommendation] AIによる診断に失敗しました。', error);
    resultContainer.appendChild(createEl('p', { className: 'ai-error-text', text: `AIへの相談に失敗しました: ${error.message}` }));
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

/** AIの診断結果（JSON解析できた場合はカード形式、できなければ本文そのまま）を描画する */
function renderAiRecommendationResult(recommendation, spreads, container) {
  container.innerHTML = '';
  const parsed = recommendation.parsed;

  const heading = createEl('div', { className: 'ai-draft-meta' });
  heading.appendChild(createEl('span', { className: 'eyebrow', text: 'AIの提案（参考）' }));
  heading.appendChild(createEl('span', { className: 'ai-draft-model', text: recommendation.modelName }));
  container.appendChild(heading);

  if (!parsed) {
    // JSON解析できなかった場合は本文をそのまま表示する（フォールバック）
    container.appendChild(createEl('p', { className: 'ai-reading-body', text: recommendation.body }));
    return;
  }

  const findSpread = (spreadId) => spreads.find(s => s.id === spreadId);

  if (parsed.recommendedSpreadId) {
    const recommendedSpread = findSpread(parsed.recommendedSpreadId);
    const card = createEl('div', { className: 'recommendation-card is-top' });
    card.appendChild(createEl('span', { className: 'recommendation-badge', text: '⭐ AIのおすすめ' }));
    card.appendChild(createEl('span', {
      className: 'recommendation-spread-name',
      text: recommendedSpread ? recommendedSpread.name : parsed.recommendedSpreadId,
    }));
    card.appendChild(createEl('p', { className: 'recommendation-reason', text: parsed.reason || '' }));

    if (recommendedSpread) {
      const actions = createEl('div', { className: 'recommendation-actions' });
      const guideBtn = createEl('button', { className: 'btn btn-ghost btn-sm', text: 'ガイドを見る' });
      guideBtn.addEventListener('click', () => openSpreadGuide(recommendedSpread, 'selector'));
      actions.appendChild(guideBtn);
      const startBtn = createEl('button', { className: 'btn btn-primary btn-sm', text: 'このスプレッドで占う' });
      startBtn.addEventListener('click', () => startReading(recommendedSpread));
      actions.appendChild(startBtn);
      card.appendChild(actions);
    }
    container.appendChild(card);
  }

  if (Array.isArray(parsed.alternatives) && parsed.alternatives.length > 0) {
    container.appendChild(createEl('p', { className: 'recommendation-subheading', text: '他の候補' }));
    parsed.alternatives.forEach(alt => {
      const altSpread = findSpread(alt.spreadId);
      const card = createEl('div', { className: 'recommendation-card' });
      card.appendChild(createEl('span', { className: 'recommendation-badge', text: '候補' }));
      card.appendChild(createEl('span', {
        className: 'recommendation-spread-name',
        text: altSpread ? altSpread.name : alt.spreadId,
      }));
      card.appendChild(createEl('p', { className: 'recommendation-reason', text: alt.reason || '' }));
      if (altSpread) {
        const actions = createEl('div', { className: 'recommendation-actions' });
        const guideBtn = createEl('button', { className: 'btn btn-ghost btn-sm', text: 'ガイドを見る' });
        guideBtn.addEventListener('click', () => openSpreadGuide(altSpread, 'selector'));
        actions.appendChild(guideBtn);
        const startBtn = createEl('button', { className: 'btn btn-primary btn-sm', text: 'このスプレッドで占う' });
        startBtn.addEventListener('click', () => startReading(altSpread));
        actions.appendChild(startBtn);
        card.appendChild(actions);
      }
      container.appendChild(card);
    });
  }

  if (parsed.differenceNote) {
    container.appendChild(createEl('p', { className: 'recommendation-difference-note', text: parsed.differenceNote }));
  }
}
