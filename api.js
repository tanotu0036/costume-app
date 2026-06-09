// ============================================================
//  GAS API クライアント（クリーン版）
//  GET  … データ取得・更新
//  POST … 写真アップロード（text/plainでCORSプリフライト回避）
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbwWUiYD6_C95ds8MHZcz7jQcqO-J6cAxtfW3nIfe5Oc1I1B3u4B-Ong4rqYusFqmMYZ/exec';

// 軽量リクエスト（GET）
async function api(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => {
    if(v !== undefined && v !== null) {
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
    }
  });
  const res = await fetch(url.toString(), { method: 'GET' });
  const data = await res.json();
  if(!data.ok) throw new Error(data.error || 'APIエラー');
  return data.data;
}

// 写真アップロード（POST text/plain：プリフライトなしでCORS回避）
async function apiPost(action, body = {}) {
  const res = await fetch(API_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body   : JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if(!data.ok) throw new Error(data.error || 'APIエラー');
  return data.data;
}

const CostumeAPI = {
  get    : (id)      => api('getCostume', { id }),
  add    : (body)    => api('addCostume', body),
  update : (body)    => api('updateCostume', body),
  delete : (id)      => api('deleteCostume', { id }),
};
const PhotoAPI = {
  add    : (body)    => apiPost('addPhoto', body), // 写真はPOST
  delete : (id)      => api('deletePhoto', { id }),
};
const RepertoireAPI = {
  add    : (body)    => api('addRepertoire', body),
  update : (body)    => api('updateRepertoire', body),
  delete : (id)      => api('deleteRepertoire', { id }),
};
const UsageAPI = {
  list   : (f = {})  => api('getUsages', f),
  add    : (body)    => api('addUsage', body),
  update : (body)    => api('updateUsage', body),
  delete : (id)      => api('deleteUsage', { id }),
};
const SettingAPI = {
  set    : (key, value) => api('setSetting', { key, value }),
};
const AllAPI = {
  get    : ()        => api('getAll'),
};
