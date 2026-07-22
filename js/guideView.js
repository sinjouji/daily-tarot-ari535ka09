/**
 * guideView.js
 * ------------------------------------------------------------
 * 「占いガイド」画面を担当する（V3で新規追加）。
 *
 * 占い画面(divinationView.js)の4つ目のサブビュー data-subview="guide" を描画する。
 * スプレッド選択画面・占い盤面・スプレッド管理画面のどこから開いても、
 * 元の画面へ正しく戻れるよう、開いた場所(returnTo)を覚えておく。
 * ------------------------------------------------------------
 */

// ガイドを閉じた時にどこへ戻るか（'selector' | 'board' | 'spreadsList'）
let guideReturnTarget = 'selector';

/**
 * 占いガイドを開く。
 * @param {Object} spread
 * @param {'selector'|'board'|'spreadsList'} returnTo
 */
function openSpreadGuide(spread, returnTo) {
  guideReturnTarget = returnTo;
  setDivinationSubview('guide');
  renderSpreadGuide(spread);
}

/**
 * スプレッド管理画面から占いガイドを開く時の入口。
 * スプレッド管理はガイドのサブビューを持たないため、いったん占いタブへ移動してから開く。
 * @param {Object} spread
 */
function openSpreadGuideFromSpreadsList(spread) {
  navigateTo('divination');
  openSpreadGuide(spread, 'spreadsList');
}

/** ガイドを閉じて、開いた場所へ戻る */
function closeSpreadGuide() {
  if (guideReturnTarget === 'board') {
    setDivinationSubview('board');
  } else if (guideReturnTarget === 'spreadsList') {
    navigateTo('spreads');
  } else {
    showSpreadSelector();
  }
}

/**
 * 占いガイドの中身を描画する。
 * @param {Object} spread
 */
function renderSpreadGuide(spread) {
  qs('#guide-spread-name').textContent = spread.name;

  const content = qs('#guide-content');
  content.innerHTML = '';

  const guide = spread.guide;

  content.appendChild(buildGuideMetaRow(spread, guide));

  if (!guide) {
    content.appendChild(createEl('p', {
      className: 'ai-draft-empty',
      text: 'このスプレッドにはまだガイド情報が登録されていません。',
    }));
  } else {
    if (guide.overview) {
      content.appendChild(buildGuideTextSection('概要', [guide.overview]));
    }
    if (guide.suitableQuestions?.length) {
      content.appendChild(buildGuideListSection('こんな時におすすめ', guide.suitableQuestions));
    }
    if (guide.steps?.length) {
      content.appendChild(buildGuideStepsSection(guide.steps));
    }
    content.appendChild(buildGuidePositionsSection(spread, guide.positionMeanings || {}));
    if (guide.cautions?.length) {
      content.appendChild(buildGuideListSection('注意点', guide.cautions));
    }
    if (guide.tip) {
      content.appendChild(buildGuideTextSection('ワンポイント', [guide.tip]));
    }
  }

  qs('#btn-close-guide').onclick = () => closeSpreadGuide();
  qs('#btn-start-from-guide').onclick = () => startReading(spread);
}

/** カード枚数・初心者向け度のタグ行 */
function buildGuideMetaRow(spread, guide) {
  const row = createEl('div', { className: 'guide-meta-row' });
  row.appendChild(createEl('span', { className: 'tag', text: `使用枚数: ${spread.positions.length}枚` }));
  if (guide?.beginnerLevel) {
    row.appendChild(createEl('span', { className: 'tag tag-orientation', text: formatBeginnerLevelLabel(guide.beginnerLevel) }));
  }
  return row;
}

/** 初心者向け度(1〜3)を★表記のラベルに変換する */
function formatBeginnerLevelLabel(level) {
  const labels = { 1: '初心者向け', 2: '中級', 3: '応用' };
  const stars = '★'.repeat(level) + '☆'.repeat(Math.max(0, 3 - level));
  return `${stars} ${labels[level] ?? ''}`.trim();
}

/** 概要・ワンポイントのような「短い文章」セクション */
function buildGuideTextSection(title, paragraphs) {
  const section = createEl('div', { className: 'guide-section' });
  section.appendChild(createEl('h4', { className: 'orientation-label', text: title }));
  paragraphs.forEach(text => section.appendChild(createEl('p', { className: 'orientation-description', text })));
  return section;
}

/** 向いている質問・注意点のような「箇条書き」セクション */
function buildGuideListSection(title, items) {
  const section = createEl('div', { className: 'guide-section' });
  section.appendChild(createEl('h4', { className: 'orientation-label', text: title }));
  const ul = createEl('ul', { className: 'guide-list' });
  items.forEach(item => ul.appendChild(createEl('li', { text: item })));
  section.appendChild(ul);
  return section;
}

/** 手順セクション（番号付き） */
function buildGuideStepsSection(steps) {
  const section = createEl('div', { className: 'guide-section' });
  section.appendChild(createEl('h4', { className: 'orientation-label', text: '手順' }));
  const ol = createEl('ol', { className: 'guide-list guide-steps' });
  steps.forEach(step => ol.appendChild(createEl('li', { text: step })));
  section.appendChild(ol);
  return section;
}

/**
 * 各カード位置の意味セクション。
 * 位置の意味は「固定しすぎず、質問に応じて柔軟に解釈できる」書き方を前提にしている。
 * @param {Object} spread
 * @param {Object} positionMeanings - { [positionId]: 説明文 }
 */
function buildGuidePositionsSection(spread, positionMeanings) {
  const section = createEl('div', { className: 'guide-section' });
  section.appendChild(createEl('h4', { className: 'orientation-label', text: '各位置の意味' }));

  spread.positions.forEach((position, index) => {
    const row = createEl('div', { className: 'guide-position-row' });
    row.appendChild(createEl('span', { className: 'guide-position-index', text: `${index + 1}. ${position.label}` }));
    const meaning = positionMeanings[position.id]
      || '位置の意味はまだ登録されていません。質問内容に応じて自由に解釈してみてください。';
    row.appendChild(createEl('p', { className: 'orientation-description', text: meaning }));
    section.appendChild(row);
  });

  return section;
}
