// ============================================================
//  GAS API クライアント（CORS対応版 - GETのみ使用）
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxIuYCVAfcitFdmX8LVlfnRTeuZo45na31Q8bIwqwgv9QjCNN4yX0KK3ukvX_llsx6W/exec';

async function gasRequest(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);

  // bodyデータもGETパラメーターとして送る
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
    }
  });

  const res  = await fetch(url.toString(), { method: 'GET' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'APIエラー');
  return data.data;
}

// ============================================================
//  衣装
// ============================================================
const CostumeAPI = {
  list  : (filters = {})  => gasRequest('getCostumes', filters),
  get   : (id)            => gasRequest('getCostume', { id }),
  add   : (body)          => gasRequest('addCostume', body),
  update: (body)          => gasRequest('updateCostume', body),
};

// ============================================================
//  写真
// ============================================================
const PhotoAPI = {
  add   : (body) => gasRequest('addPhoto', body),
  delete: (id)   => gasRequest('deletePhoto', { id }),
};

// ============================================================
//  演目
// ============================================================
const RepertoireAPI = {
  list  : (filters = {}) => gasRequest('getRepertoires', filters),
  add   : (body)         => gasRequest('addRepertoire', body),
  update: (body)         => gasRequest('updateRepertoire', body),
  delete: (id)           => gasRequest('deleteRepertoire', { id }),
};

// ============================================================
//  衣装使用履歴（紐づけ）
// ============================================================
const UsageAPI = {
  list  : (filters = {}) => gasRequest('getUsages', filters),
  add   : (body)         => gasRequest('addUsage', body),
  update: (body)         => gasRequest('updateUsage', body),
  delete: (id)           => gasRequest('deleteUsage', { id }),
};

// ============================================================
//  競合チェック
// ============================================================
const ConflictAPI = {
  all      : ()           => gasRequest('checkConflict', {}),
  byCostume: (costumeId)  => gasRequest('checkConflict', { costumeId }),
  byYear   : (year)       => gasRequest('checkConflict', { year }),
};

// ============================================================
//  設定
// ============================================================
const SettingAPI = {
  getAll: ()           => gasRequest('getSetting', {}),
  get   : (key)        => gasRequest('getSetting', { key }),
  set   : (key, value) => gasRequest('setSetting', { key, value }),
};
