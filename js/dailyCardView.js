/**
 * dailyCardView.js
 * ------------------------------------------------------------
 * ホーム画面の「今日の一枚」を担当する。
 *
 * 仕様:
 *   - 大アルカナ22枚から正位置/逆位置込みでランダム抽選
 *   - 同じ日（JST基準）にアプリを開いても結果は変わらない
 *   - 日付が変わったら自動的に再抽選する
 * ------------------------------------------------------------
 */

/**
 * 今日の日付をシードにしてカードと正逆を決定論的に抽選する。
 * 同じ日付なら何度呼んでも同じ結果になる。
 * @param {string} dateString - 'YYYY-MM-DD'
 * @returns {{cardId: string, orientation: 'upright'|'reversed'}}
 */
function drawCardForDate(dateString) {
  const allMajorCards = ARCANA_MAJOR;

  // カード選択用の乱数と、正逆選択用の乱数はシードを変えて独立させる
  const cardRandom = seededRandom(`${dateString}-card`);
  const orientationRandom = seededRandom(`${dateString}-orientation`);

  const cardIndex = Math.floor(cardRandom * allMajorCards.length);
  const orientation = orientationRandom < 0.5 ? 'upright' : 'reversed';

  return { cardId: allMajorCards[cardIndex].id, orientation };
}

/**
 * 今日の一枚を取得する。保存済みで日付が今日と一致すればそれを使い、
 * そうでなければ新しく抽選して保存し直す（＝日付が変わると自動更新）。
 * @returns {Object} dailyCardRecord
 */
function getOrCreateDailyCard() {
  const today = getTodayJstString();
  const existing = getDailyCardRecord();

  if (existing && existing.date === today) {
    return existing;
  }

  const drawn = drawCardForDate(today);
  const newRecord = {
    date: today,
    cardId: drawn.cardId,
    orientation: drawn.orientation,
    drawnAt: new Date().toISOString(),
  };
  saveDailyCardRecord(newRecord);
  return newRecord;
}

/**
 * ホーム画面内の「今日の一枚」カードを描画する。
 */
function renderDailyCardWidget() {
  const container = qs('#daily-card-widget');
  if (!container) return;

  const record = getOrCreateDailyCard();
  const card = getCardById(record.cardId);
  const displayData = getCardDisplayData(record.cardId);
  const orientationData = displayData[record.orientation];
  const orientationLabel = record.orientation === 'upright' ? '正位置' : '逆位置';

  container.innerHTML = '';

  const header = createEl('div', { className: 'daily-card-header' });
  header.appendChild(createEl('span', { className: 'eyebrow', text: '今日の一枚' }));
  header.appendChild(createEl('span', { className: 'daily-card-date', text: record.date }));
  container.appendChild(header);

  const body = createEl('div', { className: 'daily-card-body' });

  const medallion = createEl('div', {
    className: `card-medallion ${record.orientation === 'reversed' ? 'is-reversed' : ''}`,
  });
  medallion.appendChild(createEl('span', { className: 'card-medallion-symbol', text: card.symbol }));
  medallion.appendChild(createEl('span', { className: 'card-medallion-number', text: formatCardNumber(card.number) }));
  body.appendChild(medallion);

  const info = createEl('div', { className: 'daily-card-info' });
  info.appendChild(createEl('h3', { className: 'daily-card-name', text: card.nameJa }));
  info.appendChild(createEl('span', { className: 'tag tag-orientation', text: orientationLabel }));

  if (orientationData.keywords.length > 0) {
    const keywordsRow = createEl('div', { className: 'keyword-row' });
    orientationData.keywords.forEach(word => {
      keywordsRow.appendChild(createEl('span', { className: 'keyword-chip', text: word }));
    });
    info.appendChild(keywordsRow);
  }

  if (orientationData.summary) {
    info.appendChild(createEl('p', { className: 'daily-card-summary', text: orientationData.summary }));
  } else {
    info.appendChild(createEl('p', {
      className: 'daily-card-summary is-empty',
      text: 'この向きの解釈はまだ登録されていません。辞典から編集できます。',
    }));
  }

  body.appendChild(info);
  container.appendChild(body);

  // 辞典の該当カードへ直接飛べるリンクボタン
  const linkButton = createEl('button', { className: 'btn btn-ghost', text: '辞典で詳しく見る' });
  linkButton.addEventListener('click', () => navigateTo('dictionary', { openCardId: card.id }));
  container.appendChild(linkButton);
}

/**
 * ホーム画面が表示されるたびに呼ばれる描画関数。
 */
function renderHomeView() {
  renderDailyCardWidget();
}
