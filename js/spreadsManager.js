/**
 * spreadsManager.js
 * ------------------------------------------------------------
 * 「スプレッド管理」画面を担当する。
 *
 * スプレッドは { id, name, isBuiltIn, positions: [{id, x, y, label}] } という
 * JSON構造で管理する。位置はドラッグで動かせ、ラベルはインライン編集できる。
 * ------------------------------------------------------------
 */

// 編集中のスプレッド（保存前の作業コピー）。nullなら一覧表示中。
let editingSpreadDraft = null;

/**
 * スプレッド管理画面が表示される時の入口。
 */
function renderSpreadsView() {
  editingSpreadDraft = null;
  showSpreadsList();
}

/* ------------------------------------------------------------
 * 一覧
 * ---------------------------------------------------------- */

function showSpreadsList() {
  setSpreadsSubview('list');
  const listEl = qs('#spreads-list');
  listEl.innerHTML = '';

  getAllSpreadsList().forEach(spread => {
    const row = createEl('div', { className: 'spread-list-row' });

    const info = createEl('div', { className: 'spread-list-info' });
    info.appendChild(createEl('span', { className: 'spread-list-name', text: spread.name }));
    info.appendChild(createEl('span', { className: 'spread-list-count', text: `${spread.positions.length}枚` }));
    row.appendChild(info);

    const actions = createEl('div', { className: 'spread-list-actions' });

    if (spread.guide) {
      const guideBtn = createEl('button', { className: 'btn btn-ghost btn-sm', text: 'ガイド' });
      guideBtn.addEventListener('click', () => openSpreadGuideFromSpreadsList(spread));
      actions.appendChild(guideBtn);
    }

    const editBtn = createEl('button', { className: 'btn btn-ghost btn-sm', text: '編集' });
    editBtn.addEventListener('click', () => openSpreadEditor(deepClone(spread)));
    actions.appendChild(editBtn);

    const duplicateBtn = createEl('button', { className: 'btn btn-ghost btn-sm', text: '複製' });
    duplicateBtn.addEventListener('click', () => duplicateSpread(spread));
    actions.appendChild(duplicateBtn);

    if (!spread.isBuiltIn) {
      const deleteBtn = createEl('button', { className: 'btn btn-ghost btn-sm btn-danger', text: '削除' });
      deleteBtn.addEventListener('click', () => {
        if (confirm(`「${spread.name}」を削除しますか？`)) {
          deleteSpread(spread.id);
          showSpreadsList();
        }
      });
      actions.appendChild(deleteBtn);
    }

    row.appendChild(actions);
    listEl.appendChild(row);
  });

  qs('#btn-new-spread').onclick = () => openSpreadEditor(createBlankSpreadDraft());
}

/** 新規作成用の空スプレッド下書きを作る */
function createBlankSpreadDraft() {
  return {
    id: generateId('spread'),
    name: '新しいスプレッド',
    isBuiltIn: false,
    // V3: カスタムスプレッドにもガイド情報を持たせられる構造にしてある（編集UIは今後追加予定）
    guide: null,
    positions: [
      { id: generateId('pos'), x: 50, y: 50, label: '位置1' },
    ],
  };
}

/** 既存スプレッドをIDだけ変えて複製する */
function duplicateSpread(spread) {
  const copy = deepClone(spread);
  copy.id = generateId('spread');
  copy.name = `${spread.name}のコピー`;
  copy.isBuiltIn = false;
  saveSpread(copy);
  showSpreadsList();
}

/* ------------------------------------------------------------
 * 編集（ドラッグで位置移動 / ラベル編集 / 位置の追加・削除）
 * ---------------------------------------------------------- */

function openSpreadEditor(draft) {
  editingSpreadDraft = draft;
  setSpreadsSubview('editor');

  qs('#spread-editor-name-input').value = draft.name;
  renderSpreadEditorBoard();
  renderSpreadEditorPositionList();

  qs('#btn-add-position').onclick = () => {
    editingSpreadDraft.positions.push({ id: generateId('pos'), x: 50, y: 50, label: `位置${editingSpreadDraft.positions.length + 1}` });
    renderSpreadEditorBoard();
    renderSpreadEditorPositionList();
  };

  qs('#btn-cancel-spread-edit').onclick = () => showSpreadsList();

  qs('#spread-editor-form').onsubmit = (event) => {
    event.preventDefault();
    editingSpreadDraft.name = qs('#spread-editor-name-input').value.trim() || '無名のスプレッド';
    saveSpread(editingSpreadDraft);
    showSpreadsList();
  };
}

/** 編集盤面（ドラッグ操作の対象）を描画する */
function renderSpreadEditorBoard() {
  const board = qs('#spread-editor-board');
  board.innerHTML = '';

  editingSpreadDraft.positions.forEach(position => {
    const marker = createEl('div', { className: 'position-marker' });
    marker.style.left = `${position.x}%`;
    marker.style.top = `${position.y}%`;
    marker.appendChild(createEl('span', { className: 'position-marker-label', text: position.label }));
    attachDragBehavior(marker, board, position);
    board.appendChild(marker);
  });
}

/**
 * マーカーをドラッグ（マウス/タッチ/ペン全て統一のPointer Eventsで対応）で
 * 動かせるようにする。盤面サイズに対する%で位置を保存するのでレスポンシブでもズレない。
 *
 * 重要: ドラッグ中だけwindowにリスナーを登録し、ドラッグ終了で必ず解除する。
 * 以前の実装はリスナーを解除せずに残し続けていたため、盤面を再描画するたびに
 * 古いリスナーが蓄積し、保存ボタンや画面遷移のタップまで巻き込んで
 * 反応しなくなる不具合が起きていた。
 *
 * @param {HTMLElement} marker
 * @param {HTMLElement} board
 * @param {{id:string, x:number, y:number, label:string}} position
 */
function attachDragBehavior(marker, board, position) {
  const updatePositionFromPointer = (clientX, clientY) => {
    const rect = board.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    // 盤面の外に飛び出さないよう0〜100にクランプ
    position.x = Math.min(100, Math.max(0, rawX));
    position.y = Math.min(100, Math.max(0, rawY));
    marker.style.left = `${position.x}%`;
    marker.style.top = `${position.y}%`;
  };

  const onPointerMove = (event) => {
    updatePositionFromPointer(event.clientX, event.clientY);
  };

  // ドラッグ終了時に呼ぶ後片付け処理。pointerup/pointercancel どちらでも必ず実行する。
  const endDrag = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    renderSpreadEditorPositionList();
  };

  marker.addEventListener('pointerdown', (event) => {
    // iOS Safariでのテキスト選択・長押しコールアウトの誤発動を防ぐ
    event.preventDefault();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  });
}

/** 位置ラベルの一覧編集欄（テキストで位置名を直接編集・削除できる） */
function renderSpreadEditorPositionList() {
  const listEl = qs('#spread-editor-position-list');
  listEl.innerHTML = '';

  editingSpreadDraft.positions.forEach((position, index) => {
    const row = createEl('div', { className: 'position-list-row' });

    const labelInput = createEl('input', {
      className: 'input-text',
      attrs: { type: 'text', value: position.label },
    });
    labelInput.value = position.label;
    labelInput.addEventListener('input', () => {
      position.label = labelInput.value;
      renderSpreadEditorBoard();
    });
    row.appendChild(labelInput);

    // 最低1つは位置が必要なので、1つしかない時は削除ボタンを出さない
    if (editingSpreadDraft.positions.length > 1) {
      const removeBtn = createEl('button', { className: 'btn btn-text btn-danger', text: '削除' });
      removeBtn.addEventListener('click', () => {
        editingSpreadDraft.positions.splice(index, 1);
        renderSpreadEditorBoard();
        renderSpreadEditorPositionList();
      });
      row.appendChild(removeBtn);
    }

    listEl.appendChild(row);
  });
}

function setSpreadsSubview(subview) {
  qsa('.spreads-subview').forEach(el => {
    el.hidden = el.dataset.subview !== subview;
  });
}
