/**
 * data.js
 * ------------------------------------------------------------
 * 「固定情報」レイヤー。
 *
 * ここに置くのはカードそのものが持つ不変の属性だけ（番号・名前・アルカナ区分・
 * 象徴グリフ）。ユーザーが編集する解釈文（表示データ）や、AIが生成した下書きは
 * 一切含めない。この分離が今後の拡張（小アルカナ追加・多言語対応など）の土台になる。
 *
 * 小アルカナを追加する時は ARCANA_MINOR_SUITS を実装し、
 * getAllCards() がそれも返すように拡張すればよい設計にしてある。
 * ------------------------------------------------------------
 */

// 大アルカナ 22枚の固定マスターデータ
// symbol は装飾用のUnicodeグリフ（画像を使わない方針のための代替表現）
const ARCANA_MAJOR = [
  { id: 'major-00', number: 0,  nameJa: '愚者',       nameEn: 'The Fool',           symbol: '✦' },
  { id: 'major-01', number: 1,  nameJa: '魔術師',     nameEn: 'The Magician',       symbol: '☿' },
  { id: 'major-02', number: 2,  nameJa: '女教皇',     nameEn: 'The High Priestess', symbol: '☾' },
  { id: 'major-03', number: 3,  nameJa: '女帝',       nameEn: 'The Empress',        symbol: '♀' },
  { id: 'major-04', number: 4,  nameJa: '皇帝',       nameEn: 'The Emperor',        symbol: '♂' },
  { id: 'major-05', number: 5,  nameJa: '教皇',       nameEn: 'The Hierophant',     symbol: '⛬' },
  { id: 'major-06', number: 6,  nameJa: '恋人',       nameEn: 'The Lovers',         symbol: '♊' },
  { id: 'major-07', number: 7,  nameJa: '戦車',       nameEn: 'The Chariot',        symbol: '♋' },
  { id: 'major-08', number: 8,  nameJa: '力',         nameEn: 'Strength',           symbol: '♌' },
  { id: 'major-09', number: 9,  nameJa: '隠者',       nameEn: 'The Hermit',         symbol: '♍' },
  { id: 'major-10', number: 10, nameJa: '運命の輪',   nameEn: 'Wheel of Fortune',   symbol: '☉' },
  { id: 'major-11', number: 11, nameJa: '正義',       nameEn: 'Justice',            symbol: '♎' },
  { id: 'major-12', number: 12, nameJa: '吊るされた男', nameEn: 'The Hanged Man',   symbol: '☵' },
  { id: 'major-13', number: 13, nameJa: '死神',       nameEn: 'Death',              symbol: '♏' },
  { id: 'major-14', number: 14, nameJa: '節制',       nameEn: 'Temperance',         symbol: '♐' },
  { id: 'major-15', number: 15, nameJa: '悪魔',       nameEn: 'The Devil',          symbol: '♑' },
  { id: 'major-16', number: 16, nameJa: '塔',         nameEn: 'The Tower',          symbol: '♂' },
  { id: 'major-17', number: 17, nameJa: '星',         nameEn: 'The Star',           symbol: '♒' },
  { id: 'major-18', number: 18, nameJa: '月',         nameEn: 'The Moon',           symbol: '☾' },
  { id: 'major-19', number: 19, nameJa: '太陽',       nameEn: 'The Sun',            symbol: '☉' },
  { id: 'major-20', number: 20, nameJa: '審判',       nameEn: 'Judgement',          symbol: '♃' },
  { id: 'major-21', number: 21, nameJa: '世界',       nameEn: 'The World',          symbol: '♄' },
];

// 将来の小アルカナ追加用プレースホルダー（Ver.1では未使用・空のまま）
// 例: { suit: 'wands', cards: [...] } のような形を想定
const ARCANA_MINOR_SUITS = [];

/**
 * 現時点で利用可能な全カードの固定情報を返す。
 * 小アルカナが実装されたらここに合流させるだけで良い。
 * @returns {Array<Object>}
 */
function getAllCards() {
  const minorCards = ARCANA_MINOR_SUITS.flatMap(suit => suit.cards || []);
  return [...ARCANA_MAJOR, ...minorCards];
}

/**
 * カードIDから固定情報を1件取得する。
 * @param {string} cardId
 * @returns {Object|undefined}
 */
function getCardById(cardId) {
  return getAllCards().find(card => card.id === cardId);
}

/**
 * 番号（0-21のローマ数字表記など）を表示用に整形する。
 * @param {number} number
 * @returns {string}
 */
function formatCardNumber(number) {
  const romanNumerals = [
    '0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI',
  ];
  return romanNumerals[number] ?? String(number);
}
