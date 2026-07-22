/**
 * divinationView.js
 * ------------------------------------------------------------
 * 「占い」画面を担当する。
 *
 * このアプリはカードを自動で引かない。ユーザーが実際に引いたカードを
 * 「どの位置に・正位置か逆位置か」で記録し、辞典の解釈を並べて見せることで
 * 占いの読み解きを補助するのが役割。
 *
 * 現在の読み解き結果（どの位置に何のカードが置かれているか）は
 * セッション内のメモリ上だけで保持する（将来「表示履歴」機能で永続化する余地あり）。
 * ------------------------------------------------------------
 */

// 現在選択中のスプレッド
let activeSpread = null;
// { [positionId]: { cardId, orientation } } の形で現在の配置結果を保持
let currentReading = {};
// カード選択モーダルでどの位置に結果を入れようとしているか
let pendingPositionId = null;

/**
 * 占い画面が表示される時の入口。常にスプレッド選択から始める。
 */
function renderDivinationView() {
  showSpreadSelector();
}

/* ------------------------------------------------------------
 * スプレッド選択
 * ---------------------------------------------------------- */

function showSpreadSelector() {
  setDivinationSubview('selector');
  const listEl = qs('#divination-spread-list');
  listEl.innerHTML = '';

  getAllSpreadsList().forEach(spread => {
    const card = createEl('button', { className: 'spread-select-card' });
    card.appendChild(createEl('span', { className: 'spread-select-name', text: spread.name }));
    card.appendChild(createEl('span', { className: 'spread-select-count', text: `${spread.positions.length}枚のカードを使用` }));
    card.addEventListener('click', () => startReading(spread));
    listEl.appendChild(card);
  });

  qs('#btn-open-history').onclick = () => openReadingHistory();
}

/**
 * 指定スプレッドで新しい読み解きを開始する（配置結果をリセット）。
 * @param {Object} spread
 */
function startReading(spread) {
  activeSpread = spread;
  currentReading = {};
  setDivinationSubview('board');
  qs('#divination-spread-title').textContent = spread.name;
  qs('#reading-question-input').value = '';
  qs('#ai-reading-result').innerHTML = '';
  renderDivinationBoard();
}

/* ------------------------------------------------------------
 * 盤面表示（各位置をタップ→カード選択モーダル）
 * ---------------------------------------------------------- */

function renderDivinationBoard() {
  const board = qs('#divination-board');
  board.innerHTML = '';

  activeSpread.positions.forEach(position => {
    const slot = createEl('button', { className: 'divination-slot' });
    slot.style.left = `${position.x}%`;
    slot.style.top = `${position.y}%`;

    const result = currentReading[position.id];

    if (result) {
      const card = getCardById(result.cardId);
      slot.classList.add('is-filled');
      if (result.orientation === 'reversed') slot.classList.add('is-reversed');
      slot.appendChild(createEl('span', { className: 'divination-slot-symbol', text: card.symbol }));
      slot.appendChild(createEl('span', { className: 'divination-slot-name', text: card.nameJa }));
    } else {
      slot.appendChild(createEl('span', { className: 'divination-slot-placeholder', text: '＋' }));
    }
    slot.appendChild(createEl('span', { className: 'divination-slot-label', text: position.label }));

    slot.addEventListener('click', () => openCardPicker(position.id));
    board.appendChild(slot);
  });

  renderReadingSummary();

  qs('#btn-restart-reading').onclick = () => {
    currentReading = {};
    qs('#ai-reading-result').innerHTML = '';
    renderDivinationBoard();
  };
  qs('#btn-change-spread').onclick = () => showSpreadSelector();
  qs('#btn-ai-reading').onclick = () => runAiReading();
}

/** 盤面の下に、配置済みカードの解釈をまとめて表示する（占いの読み解き補助の本体） */
function renderReadingSummary() {
  const summaryEl = qs('#divination-summary');
  summaryEl.innerHTML = '';

  const filledPositions = activeSpread.positions.filter(p => currentReading[p.id]);
  if (filledPositions.length === 0) {
    summaryEl.appendChild(createEl('p', { className: 'ai-draft-empty', text: 'カードを配置すると、ここに解釈が表示されます。' }));
    return;
  }

  filledPositions.forEach(position => {
    const result = currentReading[position.id];
    const card = getCardById(result.cardId);
    const displayData = getCardDisplayData(result.cardId);
    const orientationData = displayData[result.orientation];
    const orientationLabel = result.orientation === 'upright' ? '正位置' : '逆位置';

    const block = createEl('div', { className: 'reading-summary-item' });
    block.appendChild(createEl('span', { className: 'reading-summary-position', text: position.label }));
    block.appendChild(createEl('span', { className: 'reading-summary-card', text: `${card.nameJa}（${orientationLabel}）` }));
    block.appendChild(createEl('p', {
      className: `orientation-summary ${orientationData.summary ? '' : 'is-empty'}`,
      text: orientationData.summary || '一言解釈は未登録です。',
    }));
    summaryEl.appendChild(block);
  });
}

/* ------------------------------------------------------------
 * AIリーディング（V2追加）
 * ---------------------------------------------------------- */

/**
 * 現在配置済みのカードを、AIへの送信・履歴保存の両方で使える共通形式に整形する。
 * @returns {Array<{positionId:string, positionLabel:string, cardId:string, cardName:string,
 *                   orientation:string, orientationLabel:string, summary:string, description:string}>}
 */
function collectFilledCardsForReading() {
  return activeSpread.positions
    .filter(position => currentReading[position.id])
    .map(position => {
      const result = currentReading[position.id];
      const card = getCardById(result.cardId);
      const orientationData = getCardDisplayData(result.cardId)[result.orientation];
      return {
        positionId: position.id,
        positionLabel: position.label,
        cardId: card.id,
        cardName: card.nameJa,
        orientation: result.orientation,
        orientationLabel: result.orientation === 'upright' ? '正位置' : '逆位置',
        summary: orientationData.summary,
        description: orientationData.description,
      };
    });
}

/**
 * 「AIで読み解く」ボタンの処理。Geminiへ質問・スプレッド・カード情報・登録済み
 * 表示データを送信し、結果を画面表示した上で占い履歴として保存する。
 */
async function runAiReading() {
  const filledCards = collectFilledCardsForReading();
  if (filledCards.length === 0) {
    alert('カードを1枚以上配置してから読み解いてください。');
    return;
  }

  const question = qs('#reading-question-input').value.trim();
  const button = qs('#btn-ai-reading');
  const resultEl = qs('#ai-reading-result');

  button.disabled = true;
  button.textContent = '読み解き中…';
  resultEl.innerHTML = '';

  try {
    // 直近の占い履歴を「独立した参考情報」として渡す（比較・変化の考察に使えるように）
    const recentHistory = getAllReadingHistory().slice(0, 3);
    const reading = await generateReadingInterpretation(question, activeSpread, filledCards, recentHistory);
    renderAiReadingResult(reading);

    // 占い履歴として保存
    saveReadingHistoryEntry({
      question,
      spreadId: activeSpread.id,
      spreadName: activeSpread.name,
      cards: filledCards.map(item => ({
        positionId: item.positionId,
        positionLabel: item.positionLabel,
        cardId: item.cardId,
        cardName: item.cardName,
        orientation: item.orientation,
      })),
      aiReading: { body: reading.body, modelName: reading.modelName, prompt: reading.prompt, createdAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[divinationView] AIリーディングに失敗しました。', error);
    resultEl.appendChild(createEl('p', { className: 'ai-error-text', text: `読み解きに失敗しました: ${error.message}` }));
  } finally {
    button.disabled = false;
    button.textContent = 'AIで読み解く';
  }
}

/** AIリーディング結果を画面に描画する */
function renderAiReadingResult(reading) {
  const resultEl = qs('#ai-reading-result');
  resultEl.innerHTML = '';

  const block = createEl('div', { className: 'ai-reading-block' });
  const meta = createEl('div', { className: 'ai-draft-meta' });
  meta.appendChild(createEl('span', { className: 'eyebrow', text: 'AIリーディング' }));
  meta.appendChild(createEl('span', { className: 'ai-draft-model', text: reading.modelName }));
  block.appendChild(meta);
  block.appendChild(createEl('p', { className: 'ai-reading-body', text: reading.body }));
  resultEl.appendChild(block);
}



/* ------------------------------------------------------------
 * カード選択モーダル
 * ---------------------------------------------------------- */

function openCardPicker(positionId) {
  pendingPositionId = positionId;
  const modal = qs('#card-picker-modal');
  modal.hidden = false;

  const gridEl = qs('#card-picker-grid');
  gridEl.innerHTML = '';

  // 正位置/逆位置の切り替えトグル（デフォルトは正位置）
  let selectedOrientation = 'upright';
  const uprightBtn = qs('#picker-orientation-upright');
  const reversedBtn = qs('#picker-orientation-reversed');

  const applyOrientationToggle = () => {
    uprightBtn.classList.toggle('is-active', selectedOrientation === 'upright');
    reversedBtn.classList.toggle('is-active', selectedOrientation === 'reversed');
  };
  uprightBtn.onclick = () => { selectedOrientation = 'upright'; applyOrientationToggle(); };
  reversedBtn.onclick = () => { selectedOrientation = 'reversed'; applyOrientationToggle(); };
  applyOrientationToggle();

  getAllCards().forEach(card => {
    const item = createEl('button', { className: 'card-list-item card-picker-item' });
    const medallion = createEl('div', { className: 'card-medallion card-medallion-sm' });
    medallion.appendChild(createEl('span', { className: 'card-medallion-symbol', text: card.symbol }));
    medallion.appendChild(createEl('span', { className: 'card-medallion-number', text: formatCardNumber(card.number) }));
    item.appendChild(medallion);
    item.appendChild(createEl('span', { className: 'card-list-name', text: card.nameJa }));

    item.addEventListener('click', () => {
      currentReading[pendingPositionId] = { cardId: card.id, orientation: selectedOrientation };
      closeCardPicker();
      renderDivinationBoard();
    });
    gridEl.appendChild(item);
  });

  qs('#btn-close-card-picker').onclick = () => closeCardPicker();
}

function closeCardPicker() {
  qs('#card-picker-modal').hidden = true;
  pendingPositionId = null;
}

function setDivinationSubview(subview) {
  qsa('.divination-subview').forEach(el => {
    el.hidden = el.dataset.subview !== subview;
  });
}
