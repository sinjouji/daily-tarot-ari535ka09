/**
 * dictionaryView.js
 * ------------------------------------------------------------
 * 「辞典」画面を担当する。
 *
 * 画面構成（辞典タブの中でさらに3段階に分岐する）:
 *   1. カード一覧          … #dictionary-list
 *   2. カード詳細          … #dictionary-detail
 *   3. カード編集フォーム  … #dictionary-edit
 *
 * 重要: カード詳細内の「表示データ」と「AI下書き」は別カラムの
 * 別コンポーネントとして描画し、データ的にも画面的にも混ざらないようにする。
 * ------------------------------------------------------------
 */

// 辞典画面内でいま開いているカードID（一覧に戻るまで保持）
let dictionaryOpenCardId = null;

/**
 * 辞典画面が表示される時の入口。一覧 or 指定カードの詳細を出し分ける。
 * @param {{openCardId?: string}} params
 */
function renderDictionaryView(params = {}) {
  if (params.openCardId) {
    openCardDetail(params.openCardId);
  } else if (dictionaryOpenCardId) {
    openCardDetail(dictionaryOpenCardId);
  } else {
    showDictionaryList();
  }
}

/* ------------------------------------------------------------
 * 一覧
 * ---------------------------------------------------------- */

// 辞典一覧の「お気に入りのみ」フィルター状態（画面を離れてもタブ内では保持）
let dictionaryFavoritesOnly = false;

function showDictionaryList() {
  dictionaryOpenCardId = null;
  setDictionarySubview('list');

  const filterBtn = qs('#btn-toggle-favorites-filter');
  filterBtn.classList.toggle('is-active', dictionaryFavoritesOnly);
  filterBtn.onclick = () => {
    dictionaryFavoritesOnly = !dictionaryFavoritesOnly;
    showDictionaryList();
  };

  const listEl = qs('#dictionary-list-grid');
  listEl.innerHTML = '';

  const favoritesMap = getFavoritesMap();
  const cardsToShow = getAllCards().filter(card => !dictionaryFavoritesOnly || favoritesMap[card.id]);

  if (cardsToShow.length === 0) {
    listEl.appendChild(createEl('p', { className: 'ai-draft-empty', text: 'お気に入り登録されたカードがありません。' }));
    return;
  }

  cardsToShow.forEach(card => {
    const displayData = getCardDisplayData(card.id);
    const hasContent = Boolean(displayData.upright.summary || displayData.reversed.summary);
    const isFavorite = Boolean(favoritesMap[card.id]);

    const item = createEl('button', { className: 'card-list-item' });
    if (isFavorite) {
      item.appendChild(createEl('span', { className: 'favorite-star-badge', text: '★' }));
    }
    const medallion = createEl('div', { className: 'card-medallion card-medallion-sm' });
    medallion.appendChild(createEl('span', { className: 'card-medallion-symbol', text: card.symbol }));
    medallion.appendChild(createEl('span', { className: 'card-medallion-number', text: formatCardNumber(card.number) }));
    item.appendChild(medallion);
    item.appendChild(createEl('span', { className: 'card-list-name', text: card.nameJa }));
    if (!hasContent) {
      item.appendChild(createEl('span', { className: 'card-list-badge', text: '未登録' }));
    }
    item.addEventListener('click', () => openCardDetail(card.id));
    listEl.appendChild(item);
  });
}

/* ------------------------------------------------------------
 * 詳細
 * ---------------------------------------------------------- */

function openCardDetail(cardId) {
  dictionaryOpenCardId = cardId;
  setDictionarySubview('detail');

  const card = getCardById(cardId);
  const displayData = getCardDisplayData(cardId);

  qs('#detail-card-name').textContent = card.nameJa;
  qs('#detail-card-number').textContent = `${formatCardNumber(card.number)} / ${card.nameEn}`;
  qs('#detail-card-symbol').textContent = card.symbol;

  renderOrientationBlock('#detail-upright', '正位置', displayData.upright);
  renderOrientationBlock('#detail-reversed', '逆位置', displayData.reversed);
  renderAiDraftArea(cardId);
  syncFavoriteButton(cardId);

  qs('#btn-back-to-list').onclick = () => showDictionaryList();
  qs('#btn-edit-card').onclick = () => openCardEdit(cardId);
  qs('#btn-toggle-favorite').onclick = () => {
    toggleFavoriteCard(cardId);
    syncFavoriteButton(cardId);
  };
}

/** お気に入りボタンの見た目（★/☆・強調表示）を現在の状態に合わせる */
function syncFavoriteButton(cardId) {
  const button = qs('#btn-toggle-favorite');
  const favorite = isFavoriteCard(cardId);
  button.textContent = favorite ? '★' : '☆';
  button.classList.toggle('is-active', favorite);
}

/**
 * 正位置 or 逆位置の表示データを1ブロック分描画する共通処理。
 * @param {string} containerSelector
 * @param {string} label
 * @param {{keywords:string[], summary:string, description:string, memo:string}} orientationData
 */
function renderOrientationBlock(containerSelector, label, orientationData) {
  const container = qs(containerSelector);
  container.innerHTML = '';
  container.appendChild(createEl('h4', { className: 'orientation-label', text: label }));

  if (orientationData.keywords.length > 0) {
    const row = createEl('div', { className: 'keyword-row' });
    orientationData.keywords.forEach(word => row.appendChild(createEl('span', { className: 'keyword-chip', text: word })));
    container.appendChild(row);
  }

  container.appendChild(createEl('p', {
    className: `orientation-summary ${orientationData.summary ? '' : 'is-empty'}`,
    text: orientationData.summary || '一言解釈は未登録です。',
  }));

  if (orientationData.description) {
    container.appendChild(createEl('p', { className: 'orientation-description', text: orientationData.description }));
  }

  if (orientationData.memo) {
    const memoBlock = createEl('div', { className: 'orientation-memo' });
    memoBlock.appendChild(createEl('span', { className: 'memo-label', text: 'メモ' }));
    memoBlock.appendChild(createEl('p', { text: orientationData.memo }));
    container.appendChild(memoBlock);
  }
}

/* ------------------------------------------------------------
 * 編集フォーム
 * ---------------------------------------------------------- */

function openCardEdit(cardId) {
  setDictionarySubview('edit');
  const card = getCardById(cardId);
  const displayData = getCardDisplayData(cardId);

  qs('#edit-card-name').textContent = `${card.nameJa} の解釈を編集`;

  fillOrientationForm('upright', displayData.upright);
  fillOrientationForm('reversed', displayData.reversed);

  qs('#btn-cancel-edit').onclick = () => openCardDetail(cardId);
  qs('#card-edit-form').onsubmit = (event) => {
    event.preventDefault();
    const updated = {
      upright: readOrientationForm('upright'),
      reversed: readOrientationForm('reversed'),
    };
    saveCardDisplayData(cardId, updated);
    openCardDetail(cardId);
  };
}

/** 編集フォームの各入力欄に既存データを流し込む */
function fillOrientationForm(prefix, orientationData) {
  qs(`#edit-${prefix}-keywords`).value = orientationData.keywords.join('、');
  qs(`#edit-${prefix}-summary`).value = orientationData.summary;
  qs(`#edit-${prefix}-description`).value = orientationData.description;
  qs(`#edit-${prefix}-memo`).value = orientationData.memo;
}

/** 編集フォームから1つの向き分のデータを読み出す */
function readOrientationForm(prefix) {
  const keywordsRaw = qs(`#edit-${prefix}-keywords`).value;
  const keywords = keywordsRaw
    .split(/[、,]/)
    .map(word => word.trim())
    .filter(word => word.length > 0);

  return {
    keywords,
    summary: qs(`#edit-${prefix}-summary`).value.trim(),
    description: qs(`#edit-${prefix}-description`).value.trim(),
    memo: qs(`#edit-${prefix}-memo`).value.trim(),
  };
}

/* ------------------------------------------------------------
 * AI下書きエリア（表示データとは完全に別のデータ・別のUI領域）
 * ---------------------------------------------------------- */

// AI下書き生成時にどちらの向きを対象にするか（画面内でトグルする）
let aiDraftGenerateOrientation = 'upright';

function renderAiDraftArea(cardId) {
  renderAiDraftGenerateControls(cardId);
  renderAiDraftList(cardId);
  renderAiDraftManualForm(cardId);
}

/** 「AI下書き生成」ボタン・向きトグルの配線 */
function renderAiDraftGenerateControls(cardId) {
  const uprightBtn = qs('#ai-generate-upright');
  const reversedBtn = qs('#ai-generate-reversed');
  const generateBtn = qs('#btn-generate-ai-draft');

  const syncToggle = () => {
    uprightBtn.classList.toggle('is-active', aiDraftGenerateOrientation === 'upright');
    reversedBtn.classList.toggle('is-active', aiDraftGenerateOrientation === 'reversed');
  };
  uprightBtn.onclick = () => { aiDraftGenerateOrientation = 'upright'; syncToggle(); };
  reversedBtn.onclick = () => { aiDraftGenerateOrientation = 'reversed'; syncToggle(); };
  syncToggle();

  generateBtn.onclick = async () => {
    generateBtn.disabled = true;
    const originalLabel = generateBtn.textContent;
    generateBtn.textContent = '生成中…';
    try {
      const result = await generateCardDraft(cardId, aiDraftGenerateOrientation);
      addAiDraft(cardId, { ...result, orientation: aiDraftGenerateOrientation });
      renderAiDraftList(cardId);
    } catch (error) {
      console.error('[dictionaryView] AI下書き生成に失敗しました。', error);
      alert(`AI下書きの生成に失敗しました: ${error.message}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = originalLabel;
    }
  };
}

/** AI下書き一覧（各下書きに「反映」操作パネルを付随させる）を描画する */
function renderAiDraftList(cardId) {
  const listEl = qs('#ai-draft-list');
  listEl.innerHTML = '';

  const drafts = getAiDraftsForCard(cardId);

  if (drafts.length === 0) {
    listEl.appendChild(createEl('p', { className: 'ai-draft-empty', text: 'まだAI下書きはありません。' }));
    return;
  }

  drafts.forEach(draft => {
    const item = createEl('div', { className: 'ai-draft-item' });

    const meta = createEl('div', { className: 'ai-draft-meta' });
    const orientationLabel = draft.orientation === 'upright' ? '正位置' : draft.orientation === 'reversed' ? '逆位置' : '向き未指定';
    meta.appendChild(createEl('span', { className: 'ai-draft-model', text: `${draft.modelName} ・ ${orientationLabel}` }));
    meta.appendChild(createEl('span', { className: 'ai-draft-date', text: formatDateTimeJst(draft.createdAt) }));
    item.appendChild(meta);

    item.appendChild(createEl('p', { className: 'ai-draft-body', text: draft.body }));

    const actionsRow = createEl('div', { className: 'ai-draft-actions' });

    const reflectBtn = createEl('button', { className: 'btn btn-ghost btn-sm', text: '表示データへ反映' });
    const reflectPanelContainer = createEl('div', { className: 'reflect-panel-container' });
    reflectBtn.addEventListener('click', () => {
      const isOpen = reflectPanelContainer.childElementCount > 0;
      reflectPanelContainer.innerHTML = '';
      if (!isOpen) {
        reflectPanelContainer.appendChild(buildReflectPanel(cardId, draft));
      }
    });
    actionsRow.appendChild(reflectBtn);

    const deleteBtn = createEl('button', { className: 'btn btn-text btn-danger', text: '削除' });
    deleteBtn.addEventListener('click', () => {
      deleteAiDraft(cardId, draft.id);
      renderAiDraftList(cardId);
    });
    actionsRow.appendChild(deleteBtn);

    item.appendChild(actionsRow);
    item.appendChild(reflectPanelContainer);
    listEl.appendChild(item);
  });
}

/** 既存の手動下書き追加フォーム（V1からの機能）の配線 */
function renderAiDraftManualForm(cardId) {
  const form = qs('#ai-draft-form');
  form.onsubmit = (event) => {
    event.preventDefault();
    const modelName = qs('#ai-draft-model-input').value.trim() || '未設定';
    const body = qs('#ai-draft-body-input').value.trim();
    if (!body) return;
    addAiDraft(cardId, { body, modelName });
    qs('#ai-draft-body-input').value = '';
    renderAiDraftList(cardId);
  };
}

/* ------------------------------------------------------------
 * AI下書きの「表示データへ反映」（V2追加: マージ/上書き/空欄のみ反映 + 簡易差分表示）
 * ---------------------------------------------------------- */

/**
 * 下書きから構造化データ（keywords/summary/description/memo）を取り出す。
 * 生成時にJSON解析済みならそれを使い、失敗していれば本文全体を
 * 詳細説明として扱う安全なフォールバックにする。
 * @param {Object} draft
 */
function resolveDraftParsedData(draft) {
  if (draft.parsed) return draft.parsed;
  const reparsed = extractJsonFromResponse(draft.body);
  if (reparsed) return reparsed;
  return { keywords: [], summary: '', description: draft.body, memo: '' };
}

/**
 * 反映モードに応じて、現在の表示データとAI下書きを合成した結果を返す。
 * @param {Object} currentData - 現在の表示データ（1つの向き分）
 * @param {Object} aiData - AI下書きの構造化データ
 * @param {'merge'|'overwrite'|'fillEmptyOnly'} mode
 */
function computeReflectedOrientationData(currentData, aiData, mode) {
  const result = { ...currentData };

  // キーワード（配列）
  const aiKeywords = aiData.keywords ?? [];
  if (mode === 'overwrite') {
    result.keywords = aiKeywords.length > 0 ? aiKeywords : currentData.keywords;
  } else if (mode === 'fillEmptyOnly') {
    result.keywords = currentData.keywords.length > 0 ? currentData.keywords : aiKeywords;
  } else {
    // マージ: 重複を避けつつ既存に追加する
    const merged = [...currentData.keywords];
    aiKeywords.forEach(word => { if (!merged.includes(word)) merged.push(word); });
    result.keywords = merged;
  }

  // テキスト項目（一言・詳細説明・メモ）
  ['summary', 'description', 'memo'].forEach(field => {
    const currentValue = currentData[field] || '';
    const aiValue = (aiData[field] || '').trim();
    if (!aiValue) { result[field] = currentValue; return; }

    if (mode === 'overwrite') {
      result[field] = aiValue;
    } else if (mode === 'fillEmptyOnly') {
      result[field] = currentValue ? currentValue : aiValue;
    } else {
      // マージ: 既存が空ならAI値、既存があれば両方を残して繋げる
      result[field] = currentValue ? `${currentValue}\n\n【AI下書きより】${aiValue}` : aiValue;
    }
  });

  return result;
}

/**
 * 「表示データへ反映」パネルを組み立てる。モード切替のたびに差分プレビューを再計算する。
 * @param {string} cardId
 * @param {Object} draft
 * @returns {HTMLElement}
 */
function buildReflectPanel(cardId, draft) {
  const panel = createEl('div', { className: 'reflect-panel' });
  const aiData = resolveDraftParsedData(draft);

  // 反映先の向き（下書き生成時に指定した向きを既定値にする）
  let targetOrientation = draft.orientation ?? 'upright';
  let mode = 'merge';

  const orientationToggle = createEl('div', { className: 'orientation-toggle' });
  const uprightBtn = createEl('button', { className: 'btn btn-toggle btn-sm', text: '正位置' });
  const reversedBtn = createEl('button', { className: 'btn btn-toggle btn-sm', text: '逆位置' });
  orientationToggle.appendChild(uprightBtn);
  orientationToggle.appendChild(reversedBtn);

  const modeToggle = createEl('div', { className: 'reflect-mode-toggle' });
  const modeOptions = [
    { value: 'merge', label: 'マージ（既定）' },
    { value: 'overwrite', label: '上書き' },
    { value: 'fillEmptyOnly', label: '空欄のみ反映' },
  ];
  const modeButtons = modeOptions.map(option => {
    const btn = createEl('button', { className: 'btn btn-toggle btn-sm', text: option.label });
    btn.dataset.mode = option.value;
    modeToggle.appendChild(btn);
    return btn;
  });

  const diffContainer = createEl('div', { className: 'reflect-diff' });
  const confirmBtn = createEl('button', { className: 'btn btn-primary btn-sm', text: 'この内容で反映する' });

  /** 現在の向き・モードに応じて差分プレビューを再描画する */
  const renderDiff = () => {
    uprightBtn.classList.toggle('is-active', targetOrientation === 'upright');
    reversedBtn.classList.toggle('is-active', targetOrientation === 'reversed');
    modeButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.mode === mode));

    const currentData = getCardDisplayData(cardId)[targetOrientation];
    const reflected = computeReflectedOrientationData(currentData, aiData, mode);

    diffContainer.innerHTML = '';
    const fieldLabels = { keywords: 'キーワード', summary: '一言', description: '詳細説明', memo: 'メモ' };

    Object.entries(fieldLabels).forEach(([field, label]) => {
      const before = field === 'keywords' ? currentData.keywords.join('、') : (currentData[field] || '');
      const after = field === 'keywords' ? reflected.keywords.join('、') : (reflected[field] || '');
      const row = createEl('div', { className: 'reflect-diff-row' });
      row.appendChild(createEl('span', { className: 'reflect-diff-label', text: label }));
      row.appendChild(createEl('p', { className: 'reflect-diff-before', text: before || '（空欄）' }));
      row.appendChild(createEl('p', { className: `reflect-diff-after ${before !== after ? 'is-changed' : ''}`, text: after || '（空欄）' }));
      diffContainer.appendChild(row);
    });
  };

  uprightBtn.addEventListener('click', () => { targetOrientation = 'upright'; resetConfirmButton(); renderDiff(); });
  reversedBtn.addEventListener('click', () => { targetOrientation = 'reversed'; resetConfirmButton(); renderDiff(); });
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => { mode = btn.dataset.mode; resetConfirmButton(); renderDiff(); });
  });

  function resetConfirmButton() {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'この内容で反映する';
  }

  confirmBtn.addEventListener('click', () => {
    const currentDisplay = getCardDisplayData(cardId);
    const currentData = currentDisplay[targetOrientation];
    const reflected = computeReflectedOrientationData(currentData, aiData, mode);
    const updated = { ...currentDisplay, [targetOrientation]: reflected };
    saveCardDisplayData(cardId, updated);

    // 辞典詳細の表示データ部分を最新化する
    const orientationLabel = targetOrientation === 'upright' ? '正位置' : '逆位置';
    renderOrientationBlock(targetOrientation === 'upright' ? '#detail-upright' : '#detail-reversed', orientationLabel, reflected);

    // 同じ内容で誤って2回反映してしまうのを防ぐため、変更するまでボタンを無効化する
    confirmBtn.disabled = true;
    confirmBtn.textContent = '反映しました';
  });

  panel.appendChild(createEl('p', { className: 'reflect-panel-hint', text: 'どちらの向きへ、どの方法で反映するか選んでください。' }));
  panel.appendChild(orientationToggle);
  panel.appendChild(modeToggle);
  panel.appendChild(diffContainer);
  panel.appendChild(confirmBtn);

  renderDiff();
  return panel;
}

/* ------------------------------------------------------------
 * サブビュー切り替え
 * ---------------------------------------------------------- */

function setDictionarySubview(subview) {
  qsa('.dictionary-subview').forEach(el => {
    el.hidden = el.dataset.subview !== subview;
  });
}
