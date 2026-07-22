/**
 * historyView.js
 * ------------------------------------------------------------
 * 「占い履歴」画面を担当する（V2で新規追加）。
 *
 * 占い画面(divinationView.js)の3つ目のサブビュー data-subview="history" を
 * 描画する専用ファイル。占い本体のロジックと分けることで見通しを良くしている。
 * ------------------------------------------------------------
 */

/**
 * 占い履歴サブビューを開く。
 */
function openReadingHistory() {
  setDivinationSubview('history');
  renderReadingHistoryList();
  qs('#btn-close-history').onclick = () => showSpreadSelector();
}

/**
 * 占い履歴の一覧を描画する。各行タップでAIリーディング全文の開閉ができる。
 */
function renderReadingHistoryList() {
  const listEl = qs('#reading-history-list');
  listEl.innerHTML = '';

  const history = getAllReadingHistory();

  if (history.length === 0) {
    listEl.appendChild(createEl('p', { className: 'ai-draft-empty', text: 'まだ占い履歴はありません。' }));
    return;
  }

  history.forEach(entry => {
    const row = createEl('div', { className: 'history-item' });

    const header = createEl('button', { className: 'history-item-header' });
    const headerInfo = createEl('div', { className: 'history-item-info' });
    headerInfo.appendChild(createEl('span', { className: 'history-item-date', text: formatDateTimeJst(entry.createdAt) }));
    headerInfo.appendChild(createEl('span', { className: 'history-item-spread', text: entry.spreadName }));
    if (entry.question) {
      headerInfo.appendChild(createEl('span', { className: 'history-item-question', text: `質問: ${entry.question}` }));
    }
    const cardNames = entry.cards.map(c => `${c.positionLabel}:${c.cardName}(${c.orientation === 'upright' ? '正' : '逆'})`).join(' / ');
    headerInfo.appendChild(createEl('span', { className: 'history-item-cards', text: cardNames }));
    header.appendChild(headerInfo);
    row.appendChild(header);

    const detail = createEl('div', { className: 'history-item-detail' });
    detail.hidden = true;
    if (entry.aiReading && entry.aiReading.body) {
      detail.appendChild(createEl('span', { className: 'eyebrow', text: 'AIリーディング' }));
      detail.appendChild(createEl('p', { className: 'ai-reading-body', text: entry.aiReading.body }));
    } else {
      detail.appendChild(createEl('p', { className: 'ai-draft-empty', text: 'AIリーディングは保存されていません。' }));
    }
    const deleteBtn = createEl('button', { className: 'btn btn-text btn-danger', text: 'この履歴を削除' });
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (confirm('この占い履歴を削除しますか？')) {
        deleteReadingHistoryEntry(entry.id);
        renderReadingHistoryList();
      }
    });
    detail.appendChild(deleteBtn);
    row.appendChild(detail);

    header.addEventListener('click', () => {
      detail.hidden = !detail.hidden;
    });

    listEl.appendChild(row);
  });
}
