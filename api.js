// ============================================================
//  GAS API クライアント
//  GitHub Pages のフロントからこのファイルを読み込んで使う
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxXgsF-WpNvqmKIuF24eaGPVdVby1K22Gne2caEIf2aNjAmSrC1jXyD4g-A3bTQdOLz/exec';

async function gasRequest(action, params = {}, body = null) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const options = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) }
    : { method: 'GET' };

  const res  = await fetch(url.toString(), options);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'APIエラー');
  return data.data;
}

// ============================================================
//  衣装
// ============================================================
const CostumeAPI = {
  // 一覧取得 { status?, category?, storage? }
  list: (filters = {}) => gasRequest('getCostumes', filters),

  // 詳細取得（写真・使用履歴込み）
  get: (id) => gasRequest('getCostume', { id }),

  // 新規登録
  add: (body) => gasRequest('addCostume', {}, body),

  // 更新
  update: (body) => gasRequest('updateCostume', {}, body),
};

// ============================================================
//  写真
// ============================================================
const PhotoAPI = {
  // 追加 { 衣装id, URL, 種別, アングル名, 順番 }
  add: (body) => gasRequest('addPhoto', {}, body),

  // 削除
  delete: (id) => gasRequest('deletePhoto', {}, { id }),
};

// ============================================================
//  演目
// ============================================================
const RepertoireAPI = {
  // 一覧取得 { year?, garden? }
  list: (filters = {}) => gasRequest('getRepertoires', filters),

  // 新規登録
  add: (body) => gasRequest('addRepertoire', {}, body),

  // 更新
  update: (body) => gasRequest('updateRepertoire', {}, body),

  // 削除
  delete: (id) => gasRequest('deleteRepertoire', {}, { id }),
};

// ============================================================
//  衣装使用履歴（紐づけ）
// ============================================================
const UsageAPI = {
  // 一覧取得 { repertoireId?, costumeId? }
  list: (filters = {}) => gasRequest('getUsages', filters),

  // 追加 { 演目id, 衣装id, 役柄, メモ }
  add: (body) => gasRequest('addUsage', {}, body),

  // 更新
  update: (body) => gasRequest('updateUsage', {}, body),

  // 削除
  delete: (id) => gasRequest('deleteUsage', {}, { id }),
};

// ============================================================
//  競合チェック
// ============================================================
const ConflictAPI = {
  // 全競合取得
  all: () => gasRequest('checkConflict', {}),

  // 特定衣装の競合
  byCostume: (costumeId) => gasRequest('checkConflict', { costumeId }),

  // 特定年度の競合
  byYear: (year) => gasRequest('checkConflict', { year }),
};

// ============================================================
//  設定
// ============================================================
const SettingAPI = {
  // 全設定取得
  getAll: () => gasRequest('getSetting', {}),

  // 個別取得
  get: (key) => gasRequest('getSetting', { key }),

  // 保存 { key, value }
  set: (key, value) => gasRequest('setSetting', {}, { key, value }),
};

// 使用例:
// const costumes = await CostumeAPI.list({ status: '現役' });
// const detail   = await CostumeAPI.get('abc12345');
// await CostumeAPI.add({ カテゴリー:'オールインワン', 個数:7, 保管場所:'たの津', 状態:'現役' });
// const conflicts = await ConflictAPI.byYear(2025);
