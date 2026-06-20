// ============================================================
//  保育園 衣装管理アプリ — app.js（高速版）
//  画面切り替えはローカルキャッシュのみ使用→即時表示
//  APIコールは登録・更新・削除時のみ
// ============================================================

const App = document.getElementById('app');

const S = {
  costumes:[], photos:[], repertoires:[], usages:[], settings:{},
  gardenOrder:['西新','原','たの津','ちくし野'], myGarden:'西新',
  nav:'costumes', stack:[],
  fStatus:'', fCat:'', fYear:'', fGarden:'',
  curCostume:null, curRep:null,
  loaded:false, listMode:'grid', // 'grid' or 'list'
};
const GARDENS=['西新','原','たの津','ちくし野'];
const CATS=['オールインワン','パンツ','トップス','スカート','頭飾り','その他'];
const CAT_ICON={'オールインワン':'shirt-sport','パンツ':'wash-dry-p','トップス':'shirt','スカート':'diamond','頭飾り':'crown','その他':'dots'};
const CAT_CODE={'オールインワン':'A','パンツ':'P','トップス':'T','スカート':'S','頭飾り':'H','その他':'O'};

// 年度セレクトHTML生成
function yearSelectHTML(id, selectedYear){
  const cur = selectedYear || new Date().getFullYear();
  return `<select id="${id}" style="width:100%;height:38px;border:0.5px solid var(--br2);border-radius:var(--r-sm);padding:0 10px;font-size:14px;font-weight:600;font-family:inherit;background:var(--bg2);color:var(--gr);cursor:pointer;outline:none">
    ${YEARS.map(y=>`<option value="${y}" ${y===cur?'selected':''}>${y}年度</option>`).join('')}
  </select>`;
}

function gBadge(n){const c={'西新':'nishi','原':'hara','たの津':'tano','ちくし野':'chiku'}[n];return n?`<span class="badge badge-${c}">${n}</span>`:'';}
function sBadge(s){const c=s==='現役'?'active':s==='修繕中'?'repair':'retire';return `<span class="badge badge-${c}">${s||''}</span>`;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
// 演目のメイン写真URLを取得
function getRepMainPhotoURL(repId){
  const photos=S.photos.filter(p=>p.演目id===repId&&String(p.削除フラグ)!=='1');
  const main=photos.find(p=>p.種別==='メイン')||photos[0];
  return main?main.URL:'';
}

function orderedGardens(){return [S.myGarden,...S.gardenOrder.filter(g=>g!==S.myGarden)];}

// ============================================================
//  localStorageキャッシュ（2回目以降の起動を高速化）
// ============================================================
const CACHE_KEY='costumeApp_v2';

function saveCache(d){
  try{localStorage.setItem(CACHE_KEY,JSON.stringify({t:Date.now(),...d}));}catch(e){}
}

function loadCache(){
  try{
    const s=localStorage.getItem(CACHE_KEY);
    if(!s)return null;
    const d=JSON.parse(s);
    if(Date.now()-d.t>30*60*1000)return null; // 30分で無効
    return d;
  }catch(e){return null;}
}

function applyData(d){
  S.costumes=(d.costumes||[]).filter(r=>String(r.削除フラグ)!=='1');
  S.photos=(d.photos||[]).filter(r=>String(r.削除フラグ)!=='1');
  S.repertoires=(d.repertoires||[]).filter(r=>String(r.削除フラグ)!=='1');
  S.usages=(d.usages||[]).filter(r=>String(r.削除フラグ)!=='1');
  S.settings=d.settings||{};
  S.myGarden=S.settings.myGarden||'西新';
  S.gardenOrder=(S.settings.gardenOrder||'西新,原,たの津,ちくし野').split(',');
}

// 写真削除マーク共通関数（×押下でマーク、再押下で取消、保存で確定）
// 写真の長押しドラッグ並び替え（メイン入替を含む）
function bindPhotoDelBtns(selector, pendingSet, lblId, root){
  const scope=root||document.getElementById('activeModal')||document;
  scope.querySelectorAll(selector).forEach(btn=>{
    // 既存のonclickを上書き
    btn.onclick=null;
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const pid=btn.dataset.delph||btn.dataset.drp;
      if(!pid){console.warn('pid not found',btn);return;}
      const wrap=btn.closest('div[style]');
      if(pendingSet.has(pid)){
        pendingSet.delete(pid);
        if(wrap)wrap.style.opacity='1';
        btn.style.background='var(--rd)';
        btn.innerHTML='<i class="ti ti-x"></i>';
      }else{
        pendingSet.add(pid);
        if(wrap)wrap.style.opacity='0.3';
        btn.style.background='var(--gd)';
        btn.innerHTML='<i class="ti ti-rotate-clockwise"></i>';
      }
      const lbl=document.getElementById(lblId);
      if(lbl)lbl.textContent=pendingSet.size>0?`${pendingSet.size}件を削除予定（保存で確定）`:'';
    });
  });
}

let toastTimer;
function toast(msg,dur=2500){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';App.appendChild(t);}
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),dur);
}

// ============================================================
//  データ（起動時1回のみ取得、以降はローカル操作）
// ============================================================
async function loadAll(){
  // まずキャッシュから即時表示
  const cache=loadCache();
  if(cache){
    applyData(cache);
    S.loaded=true;
    render(); // キャッシュで即時描画
  }
  // バックグラウンドで最新データを取得
  try{
    const d=await AllAPI.get();
    applyData(d);
    saveCache(d);
    S.loaded=true;
    render(); // 最新データで再描画
  }catch(e){
    console.error(e);
    if(!S.loaded) toast('データ取得失敗。再読み込みしてください');
  }
}

// ローカルキャッシュに衣装を追加
function localAddCostume(costume){S.costumes.unshift(costume);}
function localUpdateCostume(id,obj){const i=S.costumes.findIndex(c=>c.id===id);if(i>=0)Object.assign(S.costumes[i],obj);}
function localDeleteCostume(id){S.costumes=S.costumes.filter(c=>c.id!==id);S.photos=S.photos.filter(p=>p.衣装id!==id);}
function localAddPhoto(photo){S.photos.push(photo);const c=S.costumes.find(x=>x.id===photo.衣装id);if(c){if(photo.種別==='メイン'&&!c.メイン写真URL)c.メイン写真URL=photo.URL;c.写真枚数=(c.写真枚数||0)+1;}}
function localDeletePhoto(id){const ph=S.photos.find(p=>p.id===id);S.photos=S.photos.filter(p=>p.id!==id);if(ph){const c=S.costumes.find(x=>x.id===ph.衣装id);if(c){c.写真枚数=Math.max(0,(c.写真枚数||1)-1);if(c.メイン写真URL===ph.URL){const next=S.photos.find(p=>p.衣装id===ph.衣装id);c.メイン写真URL=next?next.URL:'';}}}if(S.curCostume?.id===ph?.衣装id)S.curCostume.写真=(S.curCostume.写真||[]).filter(p=>p.id!==id);}
function localAddRep(rep){S.repertoires.unshift(rep);}
function localUpdateRep(id,obj){const i=S.repertoires.findIndex(r=>r.id===id);if(i>=0)Object.assign(S.repertoires[i],obj);}
function localDeleteRep(id){S.repertoires=S.repertoires.filter(r=>r.id!==id);S.usages=S.usages.filter(u=>u.演目id!==id);}
function localAddUsage(u){S.usages.push(u);const r=S.repertoires.find(x=>x.id===u.演目id);if(r)r.衣装数=(r.衣装数||0)+1;if(S.curRep?.id===u.演目id){S.usages=S.usages.filter(x=>x.演目id===S.curRep.id);}}
function localDeleteUsage(id){const u=S.usages.find(x=>x.id===id);S.usages=S.usages.filter(x=>x.id!==id);if(u){const r=S.repertoires.find(x=>x.id===u.演目id);if(r)r.衣装数=Math.max(0,(r.衣装数||1)-1);}}

// ============================================================
//  ルーター（HTMLを最小限だけ更新）
// ============================================================
function render(){
  const isSub=S.stack.length>0;
  const page=isSub?S.stack[S.stack.length-1]:S.nav;
  App.innerHTML=shellHTML(page,isSub)+modalsHTML();
  bindShell();
  const body=document.getElementById('pageBody');
  if(page==='costumes') renderCostumes(body);
  else if(page==='repertoires') renderReps(body);
  else if(page==='settings') renderSettings(body);
  else if(page==='costume-detail') renderCostumeDetail(body);
  else if(page==='costume-add') initCostumeAdd(body);
  else if(page==='rep-detail') renderRepDetail(body);
  else if(page==='rep-add') initRepAdd(body);
}

const TITLES={costumes:'<i class="ti ti-hanger"></i> 衣装一覧',repertoires:'<i class="ti ti-theater"></i> 演目一覧',settings:'<i class="ti ti-settings"></i> 設定','costume-detail':'<i class="ti ti-hanger"></i> 衣装詳細','costume-add':'<i class="ti ti-plus"></i> 衣装登録','rep-detail':'<i class="ti ti-theater"></i> 演目詳細','rep-add':'<i class="ti ti-plus"></i> 演目登録'};

function shellHTML(page,isSub){
  const showMenu=['costume-detail','rep-detail'].includes(page);
  const showListToggle=page==='costumes';
  return `
    <div class="hdr">
      ${isSub?'<button class="hdr-back" id="btnBack"><i class="ti ti-arrow-left"></i></button>':''}
      <span class="hdr-title">${TITLES[page]||''}</span>
      ${showListToggle?`<button class="hdr-icon" id="btnToggleList" title="表示切替"><i class="ti ti-${S.listMode==='grid'?'list':'layout-grid'}"></i></button>`:''}
      ${showMenu?'<button class="hdr-icon" id="btnMenu"><i class="ti ti-dots-vertical"></i></button>':''}
    </div>
    <div class="page active" id="pageBody"></div>
    ${!isSub?navHTML():''}
    ${(!isSub&&(page==='costumes'||page==='repertoires'))?'<button class="fab" id="btnFab"><i class="ti ti-plus"></i></button>':''}`;
}

function navHTML(){
  const n=(id,icon,label)=>`<button class="nav-btn ${S.nav===id?'active':''}" data-nav="${id}"><i class="ti ti-${icon}"></i>${label}</button>`;
  return `<div class="bottom-nav">${n('costumes','hanger','衣装一覧')}${n('repertoires','theater','演目一覧')}${n('settings','settings','設定')}</div>`;
}

function bindShell(){
  const back=document.getElementById('btnBack');if(back)back.onclick=goBack;
  const fab=document.getElementById('btnFab');if(fab)fab.onclick=onFab;
  const menu=document.getElementById('btnMenu');if(menu)menu.onclick=toggleMenu;
  const tog=document.getElementById('btnToggleList');if(tog)tog.onclick=()=>{S.listMode=S.listMode==='grid'?'list':'grid';render();};
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{S.nav=b.dataset.nav;S.stack=[];render();});
}

function pushPage(p){S.stack.push(p);render();}
function goBack(){S.stack.pop();render();}
function onFab(){if(S.nav==='costumes')pushPage('costume-add');else if(S.nav==='repertoires')pushPage('rep-add');}

// ============================================================
//  3点メニュー
// ============================================================
function toggleMenu(){
  const ex=document.getElementById('menuPop');if(ex){ex.remove();return;}
  const page=S.stack[S.stack.length-1];
  const pop=document.createElement('div');pop.id='menuPop';pop.className='menu-pop';
  if(page==='costume-detail'){
    pop.innerHTML=`<div class="menu-item" id="miEdit"><i class="ti ti-pencil"></i>編集する</div><div class="menu-item danger" id="miDel"><i class="ti ti-trash"></i>この衣装を削除</div>`;
  }else if(page==='rep-detail'){
    pop.innerHTML=`<div class="menu-item" id="miEditR"><i class="ti ti-pencil"></i>編集する</div><div class="menu-item danger" id="miDelR"><i class="ti ti-trash"></i>この演目を削除</div>`;
  }
  App.appendChild(pop);
  setTimeout(()=>document.addEventListener('click',closeMenuOut),10);
  const e1=document.getElementById('miEdit');if(e1)e1.onclick=openEditCostume;
  const d1=document.getElementById('miDel');if(d1)d1.onclick=confirmDeleteCostume;
  const e2=document.getElementById('miEditR');if(e2)e2.onclick=openEditRep;
  const d2=document.getElementById('miDelR');if(d2)d2.onclick=confirmDeleteRep;
}
function closeMenuOut(ev){const p=document.getElementById('menuPop');if(p&&!p.contains(ev.target)&&ev.target.id!=='btnMenu'){p.remove();document.removeEventListener('click',closeMenuOut);}}
function closeMenu(){const p=document.getElementById('menuPop');if(p){p.remove();document.removeEventListener('click',closeMenuOut);}}

// ============================================================
//  衣装一覧（グリッド / リスト切替）
// ============================================================
function renderCostumes(body){
  const statusPills=['','現役','修繕中','廃棄'].map(s=>`<button class="filter-pill ${S.fStatus===s?'on':''}" data-fs="${s}">${s||'すべて'}</button>`).join('');
  const catPills=['',...CATS].map(c=>`<button class="filter-pill ${S.fCat===c?'on':''}" data-fc="${c}">${c||'全カテゴリー'}</button>`).join('');
  body.innerHTML=`<div class="filter-bar">${statusPills}</div><div class="filter-bar">${catPills}</div><div id="cosWrap" style="flex:1;overflow-y:auto"></div>`;
  body.querySelectorAll('[data-fs]').forEach(b=>b.onclick=()=>{S.fStatus=b.dataset.fs;renderCostumes(body);});
  body.querySelectorAll('[data-fc]').forEach(b=>b.onclick=()=>{S.fCat=b.dataset.fc;renderCostumes(body);});

  let list=S.costumes;
  if(S.fStatus)list=list.filter(c=>c.状態===S.fStatus);
  if(S.fCat)list=list.filter(c=>c.カテゴリー===S.fCat);

  const wrap=document.getElementById('cosWrap');
  if(!S.loaded){wrap.innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>読み込み中...</div>';return;}
  if(!list.length){wrap.innerHTML='<div class="empty"><i class="ti ti-hanger"></i><p>衣装がありません</p></div>';return;}

  if(S.listMode==='grid'){
    wrap.innerHTML=`<div class="costume-grid">${list.map(c=>{
      const dot=c.状態==='現役'?'sdot-active':c.状態==='修繕中'?'sdot-repair':'sdot-retire';
      const img=c.メイン写真URL?`<img src="${esc(c.メイン写真URL)}" loading="lazy" alt="" class="grid-photo" data-cid="${c.id}" style="cursor:zoom-in">`:'<i class="ti ti-hanger"></i>';
      const pc=c.写真枚数>1?`<div class="pcount"><i class="ti ti-camera" style="font-size:10px"></i>${c.写真枚数}</div>`:'';
      return `<div class="costume-card" data-id="${c.id}">
        <div class="costume-img"><div class="sdot ${dot}"></div>${img}${pc}</div>
        <div class="costume-meta"><div class="costume-code">${esc(c.衣装ID)}</div><div class="costume-name">${esc(c.衣装名)||'（名称未設定）'}</div><div class="costume-loc"><i class="ti ti-map-pin"></i>${esc(c.保管場所)}</div></div>
      </div>`;
    }).join('')}</div>`;
  }else{
    // リスト表示
    wrap.innerHTML=`<div>${list.map(c=>{
      const dot=c.状態==='現役'?'sdot-active':c.状態==='修繕中'?'sdot-repair':'sdot-retire';
      const img=c.メイン写真URL?`<img src="${esc(c.メイン写真URL)}" loading="lazy" alt="" style="width:100%;height:100%;object-fit:cover">`:'<i class="ti ti-hanger" style="font-size:28px;color:var(--br2)"></i>';
      return `<div class="costume-list-item" data-id="${c.id}">
        <div class="cli-img"><div class="sdot ${dot}" style="top:4px;left:4px"></div>${img}</div>
        <div class="cli-info">
          <div class="costume-code">${esc(c.衣装ID)}</div>
          <div style="font-size:13px;font-weight:500;margin-bottom:3px">${esc(c.衣装名)||'（名称未設定）'}</div>
          <div style="font-size:11px;color:var(--tx2);display:flex;gap:8px;flex-wrap:wrap">
            ${sBadge(c.状態)}
            <span><i class="ti ti-map-pin" style="font-size:11px"></i>${esc(c.保管場所)}</span>
            ${c.写真枚数?`<span><i class="ti ti-camera" style="font-size:11px"></i>${c.写真枚数}枚</span>`:''}
          </div>
          ${c.メモ?`<div style="font-size:11px;color:var(--tx3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.メモ)}</div>`:''}
        </div>
        <i class="ti ti-chevron-right" style="font-size:18px;color:var(--tx3);flex-shrink:0"></i>
      </div>`;
    }).join('')}</div>`;
  }
  wrap.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>openCostumeDetail(el.dataset.id));
  wrap.querySelectorAll('.grid-photo').forEach(img=>{
    img.onclick=(e)=>{
      e.stopPropagation();
      const c=S.costumes.find(x=>x.id===img.dataset.cid);
      const photos=S.photos.filter(p=>p.衣装id===img.dataset.cid);
      if(photos.length)openLightbox(photos,0);
    };
  });
}

// ============================================================
//  衣装詳細（ローカルデータで即時表示、写真はバックグラウンド取得）
// ============================================================
let detailPhotoIdx=0;

function openCostumeDetail(id){
  // ローカルキャッシュで即時表示
  S.curCostume=S.costumes.find(c=>c.id===id)||{id};
  // ローカルから写真も取得
  // メインを先頭、残りは順番順
  const allP=S.photos.filter(p=>p.衣装id===id&&String(p.削除フラグ)!=='1');
  // 種別='メイン' または 順番=1 または 最初の1枚をメイン扱い
  const mainP=allP.find(p=>p.種別==='メイン')||allP.find(p=>String(p.順番)==='1')||allP[0];
  const otherP=allP.filter(p=>p!==mainP).sort((a,b)=>(a.順番||0)-(b.順番||0));
  S.curCostume.写真=mainP?[mainP,...otherP]:otherP;
  S.curCostume.使用履歴=S.usages.filter(u=>u.衣装id===id).sort((a,b)=>(b.年度||0)-(a.年度||0));
  detailPhotoIdx=0;
  pushPage('costume-detail');
}

function renderCostumeDetail(body){
  const c=S.curCostume;if(!c)return;
  const photos=c.写真||[];
  const mainPhoto=photos[detailPhotoIdx];
  body.innerHTML=`
    <div style="flex:1;overflow-y:auto">
      <div class="photo-main" id="photoMain">
        ${mainPhoto?.URL?`<img src="${esc(mainPhoto.URL)}" alt="">`:'<i class="ti ti-hanger"></i>'}
      </div>
      <div class="thumb-row" id="thumbRow"></div>
      <div class="section"><div class="section-title"><i class="ti ti-info-circle"></i>基本情報</div></div>
      <div class="card">
        ${rowHTML('衣装ID',esc(c.衣装ID))}${rowHTML('カテゴリー',esc(c.カテゴリー))}${rowHTML('衣装名',esc(c.衣装名)||'（未設定）')}${rowHTML('個数',c.個数?esc(c.個数)+'着':'')}${rowHTML('製作園',esc(c.製作園))}${rowHTML('メモ',esc(c.メモ))}
      </div>
      <div class="section"><div class="section-title"><i class="ti ti-building-warehouse"></i>保管・状態</div></div>
      <div class="card">${rowHTML('保管場所',esc(c.保管場所))}${rowHTML('移動先',esc(c.移動先)||'（現在地）')}${rowHTML('状態',sBadge(c.状態))}</div>
      <div class="section"><div class="section-title"><i class="ti ti-history"></i>使用履歴</div></div>
      <div class="card" style="padding:0"><div class="timeline" id="histList"></div></div>
      <div style="padding:12px"><button class="btn-primary" id="btnLinkRep"><i class="ti ti-plus"></i>演目に紐づける</button></div>
      <div style="height:20px"></div>
    </div>`;

  // サムネイル
  const tr=document.getElementById('thumbRow');
  tr.innerHTML=photos.map((p,i)=>`
    <div class="thumb-item ${i===detailPhotoIdx?'active':''}" data-idx="${i}">
      ${p.URL?`<img src="${esc(p.URL)}" alt="">`:'<i class="ti ti-photo"></i>'}
    </div>`).join('')+`<button class="thumb-item thumb-add" id="thumbAdd"><i class="ti ti-plus"></i></button>`;
  tr.querySelectorAll('.thumb-item[data-idx]').forEach(t=>t.onclick=()=>{detailPhotoIdx=parseInt(t.dataset.idx);renderCostumeDetail(document.getElementById('pageBody'));});
  // メイン写真タップで拡大
  const mainEl=document.getElementById('photoMain');
  if(mainEl&&photos.length){
    mainEl.style.cursor='zoom-in';
    mainEl.onclick=()=>openLightbox(photos,detailPhotoIdx);
  }
  document.getElementById('thumbAdd').onclick=selectPhotoForDetail;

  // 使用履歴
  const hist=c.使用履歴||[];
  document.getElementById('histList').innerHTML=hist.length?hist.map(h=>`
    <div class="tl-item">
      <span class="tl-year">${esc(h.年度)}</span>
      <div class="tl-info">
        <div class="tl-title">${esc(h.演目名)}</div>
        <div class="tl-sub">${gBadge(h.園)}${h.役柄?`<span>${esc(h.役柄)}</span>`:''}</div>
        ${h.メモ?`<div class="tl-memo"><i class="ti ti-note" style="font-size:11px"></i> ${esc(h.メモ)}</div>`:''}
      </div>
      <button class="hdr-icon" style="color:var(--tx3)" data-eu="${h.id}" data-memo="${esc(h.メモ)}" data-role="${esc(h.役柄)}"><i class="ti ti-pencil"></i></button>
    </div>`).join(''):'<div style="padding:12px;text-align:center;font-size:12px;color:var(--tx3)">使用履歴なし</div>';
  document.getElementById('histList').querySelectorAll('[data-eu]').forEach(b=>b.onclick=()=>openEditUsageFromCostume(b.dataset.eu,b.dataset.role,b.dataset.memo));
  document.getElementById('btnLinkRep').onclick=openLinkRepModal;
}

function rowHTML(l,v){return `<div class="row"><span class="row-label">${l}</span><span class="row-value">${v||''}</span></div>`;}

// ============================================================
//  写真アップロード
// ============================================================
function selectPhotoForDetail(){
  const input=document.createElement('input');input.type='file';input.accept='image/*';
  input.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    const photos=S.curCostume.写真||[];
    await doUploadPhoto(file,photos.length===0?'メイン':'アングル',S.curCostume.id,S.curCostume.衣装ID,photos.length+1);
  };
  input.click();
}

function selectPhotoForRep(){
  const input=document.createElement('input');
  input.type='file';input.accept='image/*';
  input.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    const rPhotos=S.curRep.写真||[];
    const 種別=rPhotos.length===0?'メイン':'アングル';
    await doUploadRepPhoto(file,種別,S.curRep.id,rPhotos.length+1);
  };
  input.click();
}

async function doUploadRepPhoto(file,種別,repId,順番){
  toast('写真を処理中...');
  try{
    const base64=await resizeToBase64(file);
    toast('アップロード中...');
    await PhotoAPI.add({
      演目id:repId, 衣装id:'', base64, mimeType:'image/jpeg',
      fileName:'rep_'+repId+'_'+Date.now()+'.jpg',
      種別, アングル名:種別==='アングル'?('アングル'+順番):'', 順番,
    });
    toast('写真を保存しました');
    await refreshRepPhotos(repId);
  }catch(e){toast('アップロード失敗: '+e.message);console.error(e);}
}

async function refreshRepPhotos(repId){
  try{
    const fresh=await RepertoireAPI.get(repId);
    // freshの写真（削除済み除外済み）でS.photosを更新
    const freshPhotos=(fresh.写真||[]).filter(p=>String(p.削除フラグ)!=='1');
    S.curRep.写真=freshPhotos;
    // 既存のrepId分を完全に入れ替え
    S.photos=S.photos.filter(p=>p.演目id!==repId);
    S.photos.push(...freshPhotos);
    const idx=S.repertoires.findIndex(r=>r.id===repId);
    if(idx>=0){
      const m=S.curRep.写真.find(p=>p.種別==='メイン')||S.curRep.写真[0];
      S.repertoires[idx].メイン写真URL=m?m.URL:'';
    }
    saveCache({costumes:S.costumes,photos:S.photos,repertoires:S.repertoires,usages:S.usages,settings:S.settings});
    renderRepDetail(document.getElementById('pageBody'));
  }catch(e){console.error(e);}
}

async function doUploadPhoto(file,種別,costumeId,costumeID,順番){
  toast('写真アップロード中...',10000);
  try{
    const base64=await resizeToBase64(file);
    const res=await PhotoAPI.add({衣装id:costumeId,base64,mimeType:'image/jpeg',fileName:(costumeID||'photo')+'_'+Date.now()+'.jpg',種別,アングル名:種別==='アングル'?('アングル'+順番):'',順番});
    // ローカルに追加
    const newPhoto={id:res.photoId,衣装id:costumeId,URL:res.url,種別,順番};
    localAddPhoto(newPhoto);
    if(S.curCostume?.id===costumeId){
      S.curCostume.写真=[...(S.curCostume.写真||[]),newPhoto];
      detailPhotoIdx=S.curCostume.写真.length-1;
      renderCostumeDetail(document.getElementById('pageBody'));
    }
    toast('写真を保存しました');
  }catch(e){console.error(e);toast('アップロード失敗: '+e.message);}
}

function resizeToBase64(file,maxSize=1280,quality=0.78){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        let w=img.width,h=img.height;
        if(w>maxSize||h>maxSize){if(w>h){h=Math.round(h*maxSize/w);w=maxSize;}else{w=Math.round(w*maxSize/h);h=maxSize;}}
        const cv=document.createElement('canvas');cv.width=w;cv.height=h;
        cv.getContext('2d').drawImage(img,0,0,w,h);
        resolve(cv.toDataURL('image/jpeg',quality).split(',')[1]);
      };
      img.onerror=reject;img.src=e.target.result;
    };
    reader.onerror=reject;reader.readAsDataURL(file);
  });
}

// ============================================================
//  衣装 編集（写真削除含む）
// ============================================================
function openEditCostume(){
  closeMenu();
  const c=S.curCostume;
  const photos=c.写真||[];
  const pendingDelPhotos=new Set();
  window._pendingDelPhotos=pendingDelPhotos;
  const photoSection=photos.length?`
    <div class="field">
      <div class="field-label"><i class="ti ti-photo"></i>写真管理</div>
      <div style="font-size:11px;color:var(--tx3);margin-bottom:6px">×でマーク → 保存で確定 <span id="ecPhotoLbl" style="color:var(--gd);font-weight:700"></span></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px" id="ecPhotos">
        ${photos.map(p=>`
          <div style="position:relative" data-pid="${p.id}">
            <div style="width:72px;height:72px;border-radius:8px;overflow:hidden;border:${p.種別==='メイン'?'2px solid var(--gr)':'0.5px solid var(--br)'};background:var(--bg3);display:flex;align-items:center;justify-content:center;cursor:pointer" data-setmain="${p.id}">
              ${p.URL?`<img src="${esc(p.URL)}" style="width:100%;height:100%;object-fit:cover" alt="">`:'<i class="ti ti-photo" style="font-size:24px;color:var(--br2)"></i>'}
            </div>
            <div style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;background:var(--rd);color:#fff;border-radius:50%;border:2px solid #fff;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2" data-delph="${p.id}">
              <i class="ti ti-x"></i>
            </div>
            <div style="font-size:9px;text-align:center;margin-top:2px;color:${p.種別==='メイン'?'var(--gr)':'var(--tx3)'};font-weight:${p.種別==='メイン'?'700':'400'}">${p.種別==='メイン'?'★メイン':esc(p.種別)}</div>
          </div>`).join('')}
        ${photos.length>1?`<div style="font-size:10px;color:var(--tx3);width:100%;margin-top:2px"><i class="ti ti-info-circle" style="font-size:11px"></i> 写真をタップしてメインに設定</div>`:''}
      </div>
    </div>`:'';

  openModal('衣装を編集',`
    ${photoSection}
    <div class="field"><div class="field-label">衣装名</div><input id="ecName" value="${esc(c.衣装名)}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><div class="field-label">個数</div><input type="number" id="ecCount" value="${esc(c.個数)}"></div>
      <div class="field"><div class="field-label">製作園</div>${selHTML('ecMade',['',...GARDENS],c.製作園)}</div>
    </div>
    <div class="field"><div class="field-label">保管場所</div>${selHTML('ecStorage',[...GARDENS,'原倉庫','たの津倉庫'],c.保管場所)}</div>
    <div class="field"><div class="field-label">移動先</div>${selHTML('ecDest',['',...GARDENS,'原倉庫','たの津倉庫'],c.移動先)}</div>
    <div class="field"><div class="field-label">状態</div>
      <div class="chip-grid-3" id="ecStatus">
        ${['現役','修繕中','廃棄'].map(s=>`<button class="chip ${c.状態===s?'on':''}" data-s="${s}">${s}</button>`).join('')}
      </div>
    </div>
    <div class="field"><div class="field-label">メモ</div><textarea id="ecMemo">${esc(c.メモ)}</textarea></div>
  `,'保存する',saveEditCostume,(ov)=>{
    bindPhotoDelBtns('[data-delph]', pendingDelPhotos, 'ecPhotoLbl', ov);
    // メインに設定イベント（タップ）
    ov.querySelectorAll('[data-setmain]').forEach(el=>{
      el.onclick=async(e)=>{
        e.stopPropagation();
        const pid=el.dataset.setmain;
        const photo=photos.find(p=>p.id===pid);
        if(!photo||photo.種別==='メイン')return;
        try{
          // 既存のメインをアングルに変更し、選択した写真をメインに変更
          const oldMain=photos.find(p=>p.種別==='メイン');
          if(oldMain) await api('updatePhoto',{id:oldMain.id,種別:'アングル'});
          await api('updatePhoto',{id:pid,種別:'メイン',順番:1});
          toast('メイン写真を変更しました');
          // ローカルデータ更新（APIから最新を取得）
          const freshC=await CostumeAPI.get(S.curCostume.id);
          S.curCostume=freshC;
          // S.photosのこの衣装分を最新に入れ替え
          S.photos=S.photos.filter(p=>p.衣装id!==freshC.id);
          S.photos.push(...(freshC.写真||[]));
          // 一覧のメイン写真も更新
          const ci=S.costumes.findIndex(c=>c.id===freshC.id);
          const newMain=freshC.写真.find(p=>p.種別==='メイン')||freshC.写真[0];
          if(ci>=0) S.costumes[ci].メイン写真URL=newMain?newMain.URL:'';
          saveCache({costumes:S.costumes,photos:S.photos,repertoires:S.repertoires,usages:S.usages,settings:S.settings});
          closeModal();
          // detailPhotoIdxを0にリセットしてからre-render
          detailPhotoIdx=0;
          renderCostumeDetail(document.getElementById('pageBody'));
          setTimeout(openEditCostume,50);
        }catch(e2){toast('変更失敗: '+e2.message);}
      };
    });
  });

  let selSt=c.状態;
  document.querySelectorAll('#ecStatus .chip').forEach(b=>{
    b.onclick=()=>{document.querySelectorAll('#ecStatus .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');selSt=b.dataset.s;};
  });
  window._ecSt=()=>selSt;
}

async function saveEditCostume(){
  const c=S.curCostume;
  const btn=document.getElementById('mOk');
  setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 保存中...',true);
  const body={id:c.id,衣装名:document.getElementById('ecName').value,個数:document.getElementById('ecCount').value,製作園:document.getElementById('ecMade').value,保管場所:document.getElementById('ecStorage').value,移動先:document.getElementById('ecDest').value,状態:window._ecSt(),メモ:document.getElementById('ecMemo').value};
  try{
    // 削除予定写真を一括処理
    if(window._pendingDelPhotos&&window._pendingDelPhotos.size>0){
      for(const pid of window._pendingDelPhotos){
        await PhotoAPI.delete(pid);
        localDeletePhoto(pid);
      }
      window._pendingDelPhotos=null;
    }
    await CostumeAPI.update(body);
    localUpdateCostume(c.id,body);
    Object.assign(S.curCostume,body);
    setBtn(btn,'<i class="ti ti-circle-check"></i> 保存完了！',false,'var(--gr2)');
    toast('保存しました');
    setTimeout(()=>{closeModal();renderCostumeDetail(document.getElementById('pageBody'));},700);
  }catch(e){setBtn(btn,'<i class="ti ti-device-floppy"></i> 保存する',false);toast('保存失敗: '+e.message);}
}

function confirmDeleteCostume(){
  closeMenu();
  showConfirm('この衣装を削除しますか？\n関連する写真も削除されます。',async()=>{
    try{await CostumeAPI.delete(S.curCostume.id);localDeleteCostume(S.curCostume.id);toast('削除しました');goBack();}
    catch(e){toast('削除失敗: '+e.message);}
  });
}

// ============================================================
//  衣装登録
// ============================================================
let acState={cat:'',code:'',status:'現役',photoFile:null};
function initCostumeAdd(body){
  acState={cat:'',code:'',status:'現役',photoFile:null};
  body.innerHTML=`
    <div style="flex:1;overflow-y:auto;padding:10px 12px 80px">
      <div class="field"><div class="field-label"><i class="ti ti-tag"></i>カテゴリー <span class="req">必須</span></div>
        <div class="chip-grid" id="acCat">
          ${CATS.map(c=>`<button class="chip" data-cat="${c}" data-code="${CAT_CODE[c]}"><i class="ti ti-${CAT_ICON[c]}"></i>${c}</button>`).join('')}
        </div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-id-badge-2"></i>衣装ID（自動採番）</div>
        <div style="background:var(--bg3);border:0.5px solid var(--br);border-radius:var(--r-sm);padding:8px 12px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--tx3)">カテゴリー選択後に生成</span>
          <span id="acId" style="font-size:20px;font-weight:700;color:var(--gr)">——</span>
        </div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-forms"></i>衣装名</div><input id="acName" placeholder="例：赤ずきんワンピース"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="field"><div class="field-label"><i class="ti ti-hash"></i>個数 <span class="req">必須</span></div><input type="number" id="acCount" value="1" min="1"></div>
        <div class="field"><div class="field-label"><i class="ti ti-building"></i>製作園</div>${selHTML('acMade',['',...GARDENS],'')}</div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-building-warehouse"></i>保管場所 <span class="req">必須</span></div>${selHTML('acStorage',['',...GARDENS,'原倉庫','たの津倉庫'],'')}</div>
      <div class="field"><div class="field-label"><i class="ti ti-toggle-right"></i>状態 <span class="req">必須</span></div>
        <div class="chip-grid-3" id="acStatus">
          ${['現役','修繕中','廃棄'].map((s,i)=>`<button class="chip ${i===0?'on':''}" data-s="${s}">${s}</button>`).join('')}
        </div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-note"></i>メモ</div><textarea id="acMemo" placeholder="色展開・サイズ・素材など…"></textarea></div>
      <div class="field"><div class="field-label"><i class="ti ti-calendar"></i>初使用年度</div>
        ${yearSelectHTML('acYear', new Date().getFullYear())}
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-photo"></i>写真（後から追加も可）</div>
        <div id="acPhotoPrev" style="display:none;margin-bottom:6px"><img id="acPhotoImg" style="width:100%;border-radius:var(--r);max-height:160px;object-fit:cover"></div>
        <div id="acPhotoBtn" style="background:var(--bg3);border:1px dashed var(--br2);border-radius:var(--r);padding:20px;text-align:center;cursor:pointer;color:var(--tx3)">
          <i class="ti ti-cloud-upload" style="font-size:28px;display:block;margin-bottom:6px"></i>
          <div style="font-size:12px" id="acPhotoLabel">タップして写真を選択</div>
        </div>
      </div>
    </div>
    <div style="padding:10px 12px 14px;border-top:0.5px solid var(--br);background:var(--bg2);flex-shrink:0;display:flex;gap:8px">
      <button class="btn-sub" style="flex:0 0 80px" id="acCancel">キャンセル</button>
      <button class="btn-primary" id="acSubmit"><i class="ti ti-device-floppy"></i>登録する</button>
    </div>`;

  body.querySelectorAll('#acCat .chip').forEach(b=>b.onclick=()=>{
    body.querySelectorAll('#acCat .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    acState.cat=b.dataset.cat;acState.code=b.dataset.code;
    const maxN=S.costumes.filter(c=>c.カテゴリー===acState.cat).reduce((m,c)=>Math.max(m,parseInt(String(c.衣装ID||'').slice(1))||0),0);
    document.getElementById('acId').textContent=acState.code+String(maxN+1).padStart(3,'0');
  });
  body.querySelectorAll('#acStatus .chip').forEach(b=>b.onclick=()=>{body.querySelectorAll('#acStatus .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');acState.status=b.dataset.s;});
  document.getElementById('acPhotoBtn').onclick=()=>{
    const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
    inp.onchange=e=>{const f=e.target.files[0];if(!f)return;acState.photoFile=f;const r=new FileReader();r.onload=ev=>{document.getElementById('acPhotoImg').src=ev.target.result;document.getElementById('acPhotoPrev').style.display='block';document.getElementById('acPhotoLabel').textContent=f.name;};r.readAsDataURL(f);};
    inp.click();
  };
  document.getElementById('acCancel').onclick=goBack;
  document.getElementById('acSubmit').onclick=submitCostume;
}

async function submitCostume(){
  if(!acState.cat){toast('カテゴリーを選択してください');return;}
  if(!document.getElementById('acStorage').value){toast('保管場所を選択してください');return;}
  const btn=document.getElementById('acSubmit');
  setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 登録中...',true);
  try{
    const res=await CostumeAPI.add({カテゴリー:acState.cat,衣装名:document.getElementById('acName').value,個数:document.getElementById('acCount').value,製作園:document.getElementById('acMade').value,保管場所:document.getElementById('acStorage').value,状態:acState.status,メモ:document.getElementById('acMemo').value});
    // ローカルに追加
    const newC={id:res.id,衣装ID:res.衣装ID,カテゴリー:acState.cat,衣装名:document.getElementById('acName').value,個数:document.getElementById('acCount').value,保管場所:document.getElementById('acStorage').value,状態:acState.status,メモ:document.getElementById('acMemo').value,メイン写真URL:'',写真枚数:0};
    if(acState.photoFile){
      setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 写真保存中...',true);
      const base64=await resizeToBase64(acState.photoFile);
      const pr=await PhotoAPI.add({衣装id:res.id,base64,mimeType:'image/jpeg',fileName:res.衣装ID+'_'+Date.now()+'.jpg',種別:'メイン',順番:1});
      newC.メイン写真URL=pr.url;newC.写真枚数=1;
    }
    localAddCostume(newC);
    saveCache({costumes:S.costumes,photos:S.photos,repertoires:S.repertoires,usages:S.usages,settings:S.settings});
    setBtn(btn,'<i class="ti ti-circle-check"></i> 登録完了！',false,'var(--gr2)');
    toast(res.衣装ID+' を登録しました');
    setTimeout(goBack,700);
  }catch(e){setBtn(btn,'<i class="ti ti-device-floppy"></i> 登録する',false);toast('登録失敗: '+e.message);}
}

// ============================================================
//  演目一覧
// ============================================================
function renderReps(body){
  const years=[...new Set(S.repertoires.map(r=>r.年度))].sort((a,b)=>b-a);
  const yearPills=['',...years].map(y=>`<button class="filter-pill ${String(S.fYear)===String(y)?'on':''}" data-fy="${y}">${y?y+'年度':'全年度'}</button>`).join('');
  const gardenPills=['',...GARDENS].map(g=>`<button class="filter-pill ${S.fGarden===g?'on':''}" data-fg="${g}">${g||'全園'}</button>`).join('');
  body.innerHTML=`<div class="filter-bar">${yearPills}</div><div class="filter-bar">${gardenPills}</div><div id="repWrap" style="flex:1;overflow-y:auto"></div>`;
  body.querySelectorAll('[data-fy]').forEach(b=>b.onclick=()=>{S.fYear=b.dataset.fy;renderReps(body);});
  body.querySelectorAll('[data-fg]').forEach(b=>b.onclick=()=>{S.fGarden=b.dataset.fg;renderReps(body);});

  let list=S.repertoires;
  if(S.fYear)list=list.filter(r=>String(r.年度)===String(S.fYear));
  if(S.fGarden)list=list.filter(r=>String(r.園||'').indexOf(S.fGarden)>=0);

  const wrap=document.getElementById('repWrap');
  if(!S.loaded){wrap.innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>読み込み中...</div>';return;}
  if(!list.length){wrap.innerHTML='<div class="empty"><i class="ti ti-theater"></i><p>演目がありません</p></div>';return;}

  const groups={};list.forEach(r=>{const y=r.年度||'不明';(groups[y]=groups[y]||[]).push(r);});
  const order=orderedGardens();
  wrap.innerHTML=Object.keys(groups).sort((a,b)=>b-a).map(year=>`
    <div>
      <div class="rep-year-hdr"><i class="ti ti-calendar"></i>${year}年度</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:8px 12px">
        ${groups[year].sort((a,b)=>order.indexOf(a.園)-order.indexOf(b.園)).map(r=>{
          const repImgURL=getRepMainPhotoURL(r.id);
          const gc={'西新':'nishi','原':'hara','たの津':'tano','ちくし野':'chiku'}[r.園]||'nishi';
          const icon=r.種別==='劇・劇遊び'?'masks-theater':'music';
          return `<div class="costume-card" data-id="${r.id}">
            <div class="costume-img">
              ${repImgURL
                ? `<img src="${esc(repImgURL)}" loading="lazy" alt="" style="width:100%;height:100%;object-fit:cover">`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--gr-l)"><i class="ti ti-${icon}" style="font-size:40px;color:var(--gr)"></i></div>`
              }
            </div>
            <div class="costume-meta">
              <div style="margin-bottom:3px">${gBadge(r.園)}</div>
              <div class="costume-name">${esc(r.演目名)}</div>
              <div class="costume-loc"><i class="ti ti-hanger"></i>衣装 ${r.衣装数||0}件${r.クラス?' · '+esc(r.クラス):''}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
  wrap.querySelectorAll('.costume-card[data-id]').forEach(it=>it.onclick=()=>openRepDetail(it.dataset.id));
}

// ============================================================
//  演目詳細（ローカルデータで即時表示）
// ============================================================
function openRepDetail(id){
  S.curRep=S.repertoires.find(r=>r.id===id)||{id};
  // 削除済み（削除フラグ='1'）を除外してメインを先頭に
  const repAllPhotos=S.photos.filter(p=>p.演目id===id&&String(p.削除フラグ)!=='1');
  const repMain=repAllPhotos.find(p=>p.種別==='メイン');
  const repOthers=repAllPhotos.filter(p=>p.種別!=='メイン').sort((a,b)=>(a.順番||0)-(b.順番||0));
  S.curRep.写真=repMain?[repMain,...repOthers]:repOthers;
  // ローカルからusagesを取得（衣装情報も付与）
  const repUsages=S.usages.filter(u=>u.演目id===id);
  repUsages.forEach(u=>{
    const c=S.costumes.find(x=>x.id===u.衣装id)||{};
    u.衣装ID_表示=c.衣装ID||'';u.衣装名=c.衣装名||'';u.写真URL=c.メイン写真URL||'';
  });
  S.curRepUsages=repUsages;
  pushPage('rep-detail');
}

function renderRepDetail(body){
  const r=S.curRep;if(!r)return;
  const usages=S.curRepUsages||[];
  const repPhotos=r.写真||[];
  const repMain=repPhotos[0];
  body.innerHTML=`
    <div style="flex:1;overflow-y:auto">
      ${repMain?`
        <div class="photo-main" id="repPhotoMain" style="cursor:zoom-in">
          <img src="${esc(repMain.URL)}" alt="">
        </div>
        <div class="thumb-row" id="repThumbRow">
          ${repPhotos.map((p,i)=>`<div class="thumb-item ${i===0?'active':''}" data-ridx="${i}">
            <img src="${esc(p.URL)}" alt="">
          </div>`).join('')}
          <button class="thumb-item thumb-add" id="repAddPhoto"><i class="ti ti-plus"></i></button>
        </div>`
      :`<div style="padding:8px 12px 0">
          <button class="btn-primary" id="repAddPhoto" style="height:36px;font-size:12px;width:auto;padding:0 16px">
            <i class="ti ti-camera-plus"></i>写真を追加
          </button>
        </div>`}
      <div style="padding:12px 14px;border-bottom:0.5px solid var(--br);background:var(--bg2)">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div class="rep-icon-wrap" style="width:44px;height:44px"><i class="ti ti-${r.種別==='劇・劇遊び'?'masks-theater':'music'}" style="font-size:22px"></i></div>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:700">${esc(r.演目名)}</div>
            <div style="font-size:12px;color:var(--tx2);margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">${gBadge(r.園)}<span>${esc(r.年度)}年度</span>${r.クラス?`<span>${esc(r.クラス)}</span>`:''}</div>
            ${r.備考?`<div style="font-size:11px;color:var(--tx2);margin-top:4px">${esc(r.備考)}</div>`:''}
          </div>
        </div>
      </div>
      <div style="padding:8px 12px;border-bottom:0.5px solid var(--br);background:var(--bg2)">
        <button class="btn-primary" style="height:38px;font-size:13px" id="btnLC"><i class="ti ti-plus"></i>衣装を紐づける</button>
      </div>
      <div class="section"><div class="section-title"><i class="ti ti-hanger"></i>使用衣装</div></div>
      <div class="card" style="padding:0" id="usageList"></div>
      <div style="height:20px"></div>
    </div>`;

  const ul=document.getElementById('usageList');
  ul.innerHTML=usages.length?`<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:10px 12px">${usages.map(u=>{
    const dot=S.costumes.find(c=>c.id===u.衣装id)?.状態==='修繕中'?'sdot-repair':S.costumes.find(c=>c.id===u.衣装id)?.状態==='廃棄'?'sdot-retire':'sdot-active';
    return `<div class="costume-card" data-eu="${u.id}" data-memo="${esc(u.メモ)}" data-role="${esc(u.役柄)}">
      <div class="costume-img">
        <div class="sdot ${dot}"></div>
        ${u.写真URL?`<img src="${esc(u.写真URL)}" loading="lazy" alt="" class="usage-photo" data-cid="${u.衣装id}" style="cursor:zoom-in">`:'<i class="ti ti-hanger"></i>'}
        <div style="position:absolute;top:5px;right:5px;display:flex;gap:4px">
          <button class="icon-sm" data-eu="${u.id}" data-memo="${esc(u.メモ)}" data-role="${esc(u.役柄)}"><i class="ti ti-pencil"></i></button>
          <button class="icon-sm danger" data-du="${u.id}"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      <div class="costume-meta">
        <div class="costume-code">${esc(u.衣装ID_表示)}</div>
        <div class="costume-name">${esc(u.衣装名)||'（名称未設定）'}</div>
        ${u.役柄?`<div style="font-size:10px;color:var(--tx2);display:flex;align-items:center;gap:3px"><i class="ti ti-user" style="font-size:10px"></i>${esc(u.役柄)}</div>`:''}
        ${u.メモ?`<div class="tl-memo" style="margin-top:3px;font-size:10px"><i class="ti ti-note" style="font-size:10px"></i> ${esc(u.メモ)}</div>`:''}
      </div>
    </div>`;
  }).join('')}</div>`:'<div class="empty" style="padding:20px"><i class="ti ti-hanger" style="font-size:28px;margin-bottom:6px"></i><p>衣装未登録</p></div>';

  document.getElementById('btnLC').onclick=openLinkCostumeModal;

  // 演目写真イベント
  let repPhotoIdx=0;
  const repMainEl=document.getElementById('repPhotoMain');
  if(repMainEl){
    repMainEl.onclick=()=>openLightbox(repPhotos,repPhotoIdx);
    document.querySelectorAll('[data-ridx]').forEach(t=>{
      t.onclick=()=>{
        repPhotoIdx=parseInt(t.dataset.ridx);
        document.querySelectorAll('[data-ridx]').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        repMainEl.querySelector('img').src=repPhotos[repPhotoIdx].URL;
      };
    });
  }
  const repAddEl=document.getElementById('repAddPhoto');
  if(repAddEl) repAddEl.onclick=()=>selectPhotoForRep();
  ul.querySelectorAll('.icon-sm[data-eu]').forEach(b=>{b.onclick=(e)=>{e.stopPropagation();openEditUsage(b.dataset.eu,b.dataset.role,b.dataset.memo);};});
  ul.querySelectorAll('.icon-sm[data-du]').forEach(b=>{b.onclick=(e)=>{e.stopPropagation();confirmDeleteUsage(b.dataset.du);};});
  ul.querySelectorAll('.usage-photo').forEach(img=>{
    img.onclick=(e)=>{
      e.stopPropagation();
      const photos=S.photos.filter(p=>p.衣装id===img.dataset.cid);
      if(photos.length)openLightbox(photos,0);
    };
  });
}

// ============================================================
//  演目 編集・削除
// ============================================================
function openEditRep(){
  closeMenu();const r=S.curRep;
  const repPhotos=r.写真||[];
  const pendingDelRepPhotos=new Set();
  const repPhotoSection=repPhotos.length?`
    <div class="field">
      <div class="field-label"><i class="ti ti-photo"></i>写真管理</div>
      <div style="font-size:11px;color:var(--tx3);margin-bottom:6px">×でマーク → 保存で確定 <span id="erPhotoLbl" style="color:var(--gd);font-weight:700"></span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${repPhotos.map(p=>`
          <div style="position:relative" data-pid="${p.id}">
            <div style="width:72px;height:72px;border-radius:8px;overflow:hidden;border:${p.種別==='メイン'?'2px solid var(--gr)':'0.5px solid var(--br)'};background:var(--bg3);display:flex;align-items:center;justify-content:center;cursor:pointer" data-setrep="${p.id}">
              ${p.URL?`<img src="${esc(p.URL)}" style="width:100%;height:100%;object-fit:cover" alt="">`:'<i class="ti ti-photo" style="font-size:24px;color:var(--br2)"></i>'}
            </div>
            <div data-drp="${p.id}" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;background:var(--rd);color:#fff;border-radius:50%;border:2px solid #fff;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2">
              <i class="ti ti-x"></i>
            </div>
            <div style="font-size:9px;text-align:center;margin-top:2px;color:${p.種別==='メイン'?'var(--gr)':'var(--tx3)'};font-weight:${p.種別==='メイン'?'700':'400'}">${p.種別==='メイン'?'★メイン':esc(p.種別)}</div>
          </div>`).join('')}
        ${repPhotos.length>1?'<div style="font-size:10px;color:var(--tx3);width:100%;margin-top:2px">写真をタップしてメインに設定</div>':''}
      </div>
    </div>`:'';
  openModal('演目を編集',`
    ${repPhotoSection}
    <div class="field"><div class="field-label">演目名</div><input id="erName" value="${esc(r.演目名)}"></div>
    <div class="field"><div class="field-label">クラス</div><input id="erClass" value="${esc(r.クラス)}"></div>
    <div class="field"><div class="field-label">備考</div><textarea id="erMemo">${esc(r.備考)}</textarea></div>
  `,'保存する',async()=>{
    const btn=document.getElementById('mOk');
    setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 保存中...',true);
    const body={id:r.id,演目名:document.getElementById('erName').value,クラス:document.getElementById('erClass').value,備考:document.getElementById('erMemo').value};
    try{
      // 削除予定写真を一括処理
      if(pendingDelRepPhotos.size>0){
        for(const pid of pendingDelRepPhotos){
          await PhotoAPI.delete(pid);
          S.curRep.写真=(S.curRep.写真||[]).filter(p=>p.id!==pid);
          S.photos=S.photos.filter(p=>p.id!==pid);
        }
      }
      await RepertoireAPI.update(body);localUpdateRep(r.id,body);Object.assign(S.curRep,body);
      saveCache({costumes:S.costumes,photos:S.photos,repertoires:S.repertoires,usages:S.usages,settings:S.settings});
      setBtn(btn,'<i class="ti ti-circle-check"></i> 保存完了！',false,'var(--gr2)');
      toast('保存しました');
      setTimeout(()=>{closeModal();renderRepDetail(document.getElementById('pageBody'));},700);
    }catch(e){setBtn(btn,'<i class="ti ti-device-floppy"></i> 保存する',false);toast('保存失敗: '+e.message);}
  },(ov)=>{
    bindPhotoDelBtns('[data-drp]', pendingDelRepPhotos, 'erPhotoLbl', ov);
    // メインに設定イベント（タップ）
    ov.querySelectorAll('[data-setrep]').forEach(el=>{
      el.onclick=async(e)=>{
        e.stopPropagation();
        const pid=el.dataset.setrep;
        const photo=repPhotos.find(p=>p.id===pid);
        if(!photo||photo.種別==='メイン')return;
        try{
          const oldMain=repPhotos.find(p=>p.種別==='メイン');
          if(oldMain) await api('updatePhoto',{id:oldMain.id,種別:'アングル'});
          await api('updatePhoto',{id:pid,種別:'メイン',順番:1});
          toast('メイン写真を変更しました');
          await refreshRepPhotos(r.id);
          closeModal();
          setTimeout(openEditRep,50);
        }catch(e2){toast('変更失敗: '+e2.message);}
      };
    });
  });
}

function confirmDeleteRep(){
  closeMenu();
  showConfirm('この演目を削除しますか？\n衣装の紐づけも削除されます。',async()=>{
    try{await RepertoireAPI.delete(S.curRep.id);localDeleteRep(S.curRep.id);toast('削除しました');goBack();}
    catch(e){toast('削除失敗: '+e.message);}
  });
}

// ============================================================
//  演目登録
// ============================================================
let arState={type:'劇・劇遊び',gardens:[]};
let drumIdx=0;
function initRepAdd(body){
  arState={type:'劇・劇遊び',gardens:[],photoFile:null};
  body.innerHTML=`
    <div style="flex:1;overflow-y:auto;padding:10px 12px 80px">
      <div class="field"><div class="field-label"><i class="ti ti-music"></i>演目名 <span class="req">必須</span></div><input id="arName" placeholder="例：【1歳児】劇遊び（どんないろがすき）"></div>
      <div class="field"><div class="field-label"><i class="ti ti-category"></i>種別</div>
        <div class="chip-grid-3" id="arType">
          ${[['劇・劇遊び','masks-theater'],['遊戯・ダンス','music'],['その他','dots']].map(([t,ic],i)=>`<button class="chip ${i===0?'on':''}" data-t="${t}"><i class="ti ti-${ic}"></i>${t}</button>`).join('')}
        </div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-users"></i>クラス</div><input id="arClass" placeholder="例：1歳児、うみ組"></div>
      <div class="field"><div class="field-label"><i class="ti ti-calendar"></i>年度 <span class="req">必須</span></div>
        ${yearSelectHTML('arYearSel', new Date().getFullYear())}
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-building"></i>実施園 <span class="req">必須</span></div>
        <div class="chip-grid" id="arGarden">${GARDENS.map(g=>`<button class="chip" data-g="${g}"><i class="ti ti-circle"></i>${g}</button>`).join('')}</div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-note"></i>備考</div><textarea id="arMemo"></textarea></div>
      <div class="field"><div class="field-label"><i class="ti ti-photo"></i>写真（後から追加も可）</div>
        <div id="arPhotoPrev" style="display:none;margin-bottom:6px"><img id="arPhotoImg" style="width:100%;border-radius:var(--r);max-height:160px;object-fit:cover"></div>
        <div id="arPhotoBtn" style="background:var(--bg3);border:1px dashed var(--br2);border-radius:var(--r);padding:16px;text-align:center;cursor:pointer;color:var(--tx3)">
          <i class="ti ti-cloud-upload" style="font-size:24px;display:block;margin-bottom:4px"></i>
          <div style="font-size:12px" id="arPhotoLabel">タップして写真を選択</div>
        </div>
      </div>
    </div>
    <div style="padding:10px 12px 14px;border-top:0.5px solid var(--br);background:var(--bg2);flex-shrink:0;display:flex;gap:8px">
      <button class="btn-sub" style="flex:0 0 80px" id="arCancel">キャンセル</button>
      <button class="btn-primary" id="arSubmit"><i class="ti ti-device-floppy"></i>登録する</button>
    </div>`;

  // 写真選択
  arState.photoFile=null;
  document.getElementById('arPhotoBtn').onclick=()=>{
    const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
    inp.onchange=e=>{const f=e.target.files[0];if(!f)return;arState.photoFile=f;
      const rd=new FileReader();rd.onload=ev=>{document.getElementById('arPhotoImg').src=ev.target.result;document.getElementById('arPhotoPrev').style.display='block';document.getElementById('arPhotoLabel').textContent=f.name;};rd.readAsDataURL(f);};
    inp.click();
  };

  body.querySelectorAll('#arType .chip').forEach(b=>b.onclick=()=>{body.querySelectorAll('#arType .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');arState.type=b.dataset.t;});
  body.querySelectorAll('#arGarden .chip').forEach(b=>b.onclick=()=>{b.classList.toggle('on');const g=b.dataset.g,ic=b.querySelector('i');if(b.classList.contains('on')){arState.gardens.push(g);ic.className='ti ti-circle-check';}else{arState.gardens=arState.gardens.filter(x=>x!==g);ic.className='ti ti-circle';}});
  document.getElementById('arCancel').onclick=goBack;
  document.getElementById('arSubmit').onclick=submitRep;
  // drumIdxはsubmit時にarYearSelから直接取得するため初期化不要
}

async function submitRep(){
  if(!document.getElementById('arName').value){toast('演目名を入力してください');return;}
  if(!arState.gardens.length){toast('実施園を選択してください');return;}
  const btn=document.getElementById('arSubmit');
  setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 登録中...',true);
  try{
    const res=await RepertoireAPI.add({演目名:document.getElementById('arName').value,種別:arState.type,クラス:document.getElementById('arClass').value,年度:parseInt(document.getElementById('arYearSel')?.value||new Date().getFullYear()),園:arState.gardens.join('・'),備考:document.getElementById('arMemo').value});
    // 写真があればアップロード
    if(arState.photoFile){
      setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 写真保存中...',true);
      try{
        const base64=await resizeToBase64(arState.photoFile);
        await PhotoAPI.add({演目id:res.id,衣装id:'',base64,mimeType:'image/jpeg',fileName:'rep_'+res.id+'_'+Date.now()+'.jpg',種別:'メイン',順番:1});
      }catch(pe){console.warn('写真アップロード失敗:',pe);}
    }
    const newR={id:res.id,演目名:document.getElementById('arName').value,種別:arState.type,クラス:document.getElementById('arClass').value,年度:parseInt(document.getElementById('arYearSel')?.value||new Date().getFullYear()),園:arState.gardens.join('・'),備考:document.getElementById('arMemo').value,衣装数:0};
    localAddRep(newR);
    setBtn(btn,'<i class="ti ti-circle-check"></i> 登録完了！',false,'var(--gr2)');
    toast('演目を登録しました');
    setTimeout(goBack,700);
  }catch(e){setBtn(btn,'<i class="ti ti-device-floppy"></i> 登録する',false);toast('登録失敗: '+e.message);}
}

// ドラムロール
const YEARS=[];for(let y=2018;y<=2048;y++)YEARS.push(y);
function initDrum(){
  drumIdx=YEARS.indexOf(new Date().getFullYear());if(drumIdx<0)drumIdx=0;
  const dl=document.getElementById('arDL');if(!dl)return;
  // セレクトボックスのイベント
  setTimeout(()=>{
    const sel=document.getElementById('arYearSel');
    if(sel) sel.onchange=e=>{drumIdx=YEARS.indexOf(parseInt(e.target.value));};
  },0);
}

// ============================================================
//  紐づけモーダル（演目→衣装）
// ============================================================
function openLinkCostumeModal(){
  const checked=new Set();
  openModal('衣装を選んで追加',`
    <div style="position:relative;margin-bottom:8px">
      <i class="ti ti-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:16px;color:var(--tx3)"></i>
      <input id="lcS" placeholder="衣装IDや名称で絞り込み…" style="width:100%;height:34px;border:0.5px solid var(--br2);border-radius:17px;padding:0 12px 0 34px;font-size:13px;background:var(--bg3);font-family:inherit;outline:none">
    </div>
    <div class="sel-list" id="lcList" style="max-height:220px"></div>
    <div class="sel-bar"><span id="lcCnt">0件選択中</span><span style="font-size:10px;opacity:.8">タップで選択</span></div>
    <div class="field" style="margin-top:10px;margin-bottom:0"><div class="field-label"><i class="ti ti-note"></i>この演目での使い方メモ</div><textarea id="lcMemo" placeholder="役柄・使用色・注意事項など" style="height:60px"></textarea></div>
  `,'紐づける',async()=>{
    if(!checked.size){toast('衣装を選択してください');return;}
    const btn=document.getElementById('mOk');
    setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 処理中...',true);
    const memo=document.getElementById('lcMemo').value;
    try{
      for(const cid of checked){
        const res=await UsageAPI.add({演目id:S.curRep.id,衣装id:cid,メモ:memo});
        const c=S.costumes.find(x=>x.id===cid)||{};
        const u={id:res.id,演目id:S.curRep.id,衣装id:cid,メモ:memo,衣装ID_表示:c.衣装ID||'',衣装名:c.衣装名||'',写真URL:c.メイン写真URL||''};
        S.usages.push(u);
        if(!S.curRepUsages)S.curRepUsages=[];
        S.curRepUsages.push(u);
        localAddUsage(u);
      }
      toast(checked.size+'件を紐づけました');closeModal();
      renderRepDetail(document.getElementById('pageBody'));
    }catch(e){setBtn(btn,'<i class="ti ti-link"></i> 紐づける',false);toast('失敗: '+e.message);}
  });
  const renderL=(q='')=>{
    const list=S.costumes.filter(c=>c.状態==='現役'&&`${c.衣装ID}${c.衣装名}`.toLowerCase().includes(q.toLowerCase()));
    document.getElementById('lcList').innerHTML=list.map(c=>`
      <div class="sel-item ${checked.has(c.id)?'checked':''}" data-id="${c.id}">
        <div class="sel-check"><i class="ti ti-check"></i></div>
        <div class="sel-thumb">${c.メイン写真URL?`<img src="${esc(c.メイン写真URL)}" alt="">`:'<i class="ti ti-hanger"></i>'}</div>
        <div style="flex:1;min-width:0"><div style="font-size:10px;color:var(--tx3)">${esc(c.衣装ID)}</div><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.衣装名)||'（名称未設定）'}</div><div style="font-size:10px;color:var(--tx2)"><i class="ti ti-map-pin" style="font-size:10px"></i> ${esc(c.保管場所)}</div></div>
      </div>`).join('')||'<div style="padding:16px;text-align:center;font-size:12px;color:var(--tx3)">該当なし</div>';
    document.querySelectorAll('#lcList .sel-item').forEach(it=>it.onclick=()=>{const id=it.dataset.id;if(checked.has(id)){checked.delete(id);it.classList.remove('checked');}else{checked.add(id);it.classList.add('checked');}document.getElementById('lcCnt').textContent=checked.size+'件選択中';});
  };
  renderL();document.getElementById('lcS').oninput=e=>renderL(e.target.value);
}

// ============================================================
//  紐づけモーダル（衣装→演目）
// ============================================================
function openLinkRepModal(){
  const checked=new Set();
  openModal('演目を選んで紐づける',`
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <select id="lrY" style="flex:1;height:32px;font-size:12px;border:0.5px solid var(--br2);border-radius:var(--r-sm);font-family:inherit;background:var(--bg3)"><option value="">全年度</option></select>
      <select id="lrG" style="flex:1;height:32px;font-size:12px;border:0.5px solid var(--br2);border-radius:var(--r-sm);font-family:inherit;background:var(--bg3)"><option value="">全園</option>${GARDENS.map(g=>`<option>${g}</option>`).join('')}</select>
    </div>
    <div class="sel-list" id="lrList" style="max-height:220px"></div>
    <div class="sel-bar"><span id="lrCnt">0件選択中</span><span style="font-size:10px;opacity:.8">タップで選択</span></div>
    <div class="field" style="margin-top:10px;margin-bottom:0"><div class="field-label"><i class="ti ti-note"></i>この衣装の使い方メモ</div><textarea id="lrMemo" placeholder="役柄・使用色・注意事項など" style="height:60px"></textarea></div>
  `,'紐づける',async()=>{
    if(!checked.size){toast('演目を選択してください');return;}
    const btn=document.getElementById('mOk');
    setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 処理中...',true);
    const memo=document.getElementById('lrMemo').value;
    try{
      for(const rid of checked){
        const res=await UsageAPI.add({演目id:rid,衣装id:S.curCostume.id,メモ:memo});
        const r=S.repertoires.find(x=>x.id===rid)||{};
        const u={id:res.id,演目id:rid,衣装id:S.curCostume.id,メモ:memo,演目名:r.演目名||'',園:r.園||'',年度:r.年度||'',役柄:''};
        S.usages.push(u);
        if(!S.curCostume.使用履歴)S.curCostume.使用履歴=[];
        S.curCostume.使用履歴.unshift(u);
        localAddUsage(u);
      }
      toast(checked.size+'件を紐づけました');closeModal();
      renderCostumeDetail(document.getElementById('pageBody'));
    }catch(e){setBtn(btn,'<i class="ti ti-link"></i> 紐づける',false);toast('失敗: '+e.message);}
  });
  const years=[...new Set(S.repertoires.map(r=>r.年度))].sort((a,b)=>b-a);
  const ys=document.getElementById('lrY');years.forEach(y=>{const o=document.createElement('option');o.value=y;o.textContent=y+'年度';ys.appendChild(o);});
  const renderL=()=>{
    const yv=document.getElementById('lrY').value,gv=document.getElementById('lrG').value;
    let list=S.repertoires;if(yv)list=list.filter(r=>String(r.年度)===String(yv));if(gv)list=list.filter(r=>String(r.園||'').indexOf(gv)>=0);
    document.getElementById('lrList').innerHTML=list.map(r=>`
      <div class="sel-item ${checked.has(r.id)?'checked':''}" data-id="${r.id}">
        <div class="sel-check"><i class="ti ti-check"></i></div>
        <div style="flex:1;min-width:0"><div style="font-size:10px;display:flex;gap:4px;align-items:center">${gBadge(r.園)}<span style="color:var(--tx3)">${esc(r.年度)}年度</span></div><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${esc(r.演目名)}</div></div>
      </div>`).join('')||'<div style="padding:16px;text-align:center;font-size:12px;color:var(--tx3)">該当なし</div>';
    document.querySelectorAll('#lrList .sel-item').forEach(it=>it.onclick=()=>{const id=it.dataset.id;if(checked.has(id)){checked.delete(id);it.classList.remove('checked');}else{checked.add(id);it.classList.add('checked');}document.getElementById('lrCnt').textContent=checked.size+'件選択中';});
  };
  renderL();document.getElementById('lrY').onchange=renderL;document.getElementById('lrG').onchange=renderL;
}

// ============================================================
//  メモ・役柄編集
// ============================================================
function openEditUsage(uid,role,memo){
  openModal('衣装の使い方を編集',`
    <div class="field"><div class="field-label"><i class="ti ti-user"></i>役柄</div><input id="euR" value="${esc(role)}" placeholder="例：うさぎ"></div>
    <div class="field" style="margin-bottom:0"><div class="field-label"><i class="ti ti-note"></i>メモ</div><textarea id="euM" style="height:80px">${esc(memo)}</textarea></div>
  `,'保存する',async()=>{
    const btn=document.getElementById('mOk');
    setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 保存中...',true);
    try{
      const newRole=document.getElementById('euR').value,newMemo=document.getElementById('euM').value;
      await UsageAPI.update({id:uid,役柄:newRole,メモ:newMemo});
      // ローカル更新
      const u=S.usages.find(x=>x.id===uid);if(u){u.役柄=newRole;u.メモ=newMemo;}
      if(S.curRepUsages){const cu=S.curRepUsages.find(x=>x.id===uid);if(cu){cu.役柄=newRole;cu.メモ=newMemo;}}
      if(S.curCostume?.使用履歴){const ch=S.curCostume.使用履歴.find(x=>x.id===uid);if(ch){ch.役柄=newRole;ch.メモ=newMemo;}}
      setBtn(btn,'<i class="ti ti-circle-check"></i> 保存完了！',false,'var(--gr2)');
      toast('保存しました');
      setTimeout(()=>{closeModal();renderRepDetail(document.getElementById('pageBody'));},700);
    }catch(e){setBtn(btn,'<i class="ti ti-device-floppy"></i> 保存する',false);toast('保存失敗: '+e.message);}
  });
}

function openEditUsageFromCostume(uid,role,memo){
  openModal('衣装の使い方を編集',`
    <div class="field"><div class="field-label"><i class="ti ti-user"></i>役柄</div><input id="euR" value="${esc(role)}" placeholder="例：うさぎ"></div>
    <div class="field" style="margin-bottom:0"><div class="field-label"><i class="ti ti-note"></i>メモ</div><textarea id="euM" style="height:80px">${esc(memo)}</textarea></div>
  `,'保存する',async()=>{
    const btn=document.getElementById('mOk');
    setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 保存中...',true);
    try{
      const newRole=document.getElementById('euR').value,newMemo=document.getElementById('euM').value;
      await UsageAPI.update({id:uid,役柄:newRole,メモ:newMemo});
      const u=S.usages.find(x=>x.id===uid);if(u){u.役柄=newRole;u.メモ=newMemo;}
      if(S.curCostume?.使用履歴){const ch=S.curCostume.使用履歴.find(x=>x.id===uid);if(ch){ch.役柄=newRole;ch.メモ=newMemo;}}
      setBtn(btn,'<i class="ti ti-circle-check"></i> 保存完了！',false,'var(--gr2)');
      toast('保存しました');
      setTimeout(()=>{closeModal();renderCostumeDetail(document.getElementById('pageBody'));},700);
    }catch(e){setBtn(btn,'<i class="ti ti-device-floppy"></i> 保存する',false);toast('保存失敗: '+e.message);}
  });
}

function confirmDeleteUsage(uid){
  showConfirm('この紐づけを解除しますか？',async()=>{
    try{
      await UsageAPI.delete(uid);localDeleteUsage(uid);
      if(S.curRepUsages)S.curRepUsages=S.curRepUsages.filter(u=>u.id!==uid);
      toast('解除しました');renderRepDetail(document.getElementById('pageBody'));
    }catch(e){toast('失敗: '+e.message);}
  });
}

// ============================================================
//  設定
// ============================================================
function renderSettings(body){
  body.innerHTML=`
    <div style="flex:1;overflow-y:auto;padding-bottom:20px">
      <div class="section"><div class="section-title"><i class="ti ti-building"></i>マイ園設定</div></div>
      <div class="card" style="padding:10px 12px"><div class="chip-grid" id="mgChips">${GARDENS.map(g=>`<button class="chip ${S.myGarden===g?'on':''}" data-g="${g}">${g}</button>`).join('')}</div></div>
      <div class="section"><div class="section-title"><i class="ti ti-arrows-sort"></i>園の表示順</div></div>
      <div style="font-size:11px;color:var(--tx3);padding:0 12px 6px">マイ園が自動で先頭になります</div>
      <div style="padding:0 12px" id="orderList"></div>
      <div style="padding:12px"><button class="btn-primary" id="btnSaveS"><i class="ti ti-device-floppy"></i>設定を保存</button></div>

      <div class="section"><div class="section-title"><i class="ti ti-printer"></i>衣装ID ラベル印刷</div></div>
      <div class="card" style="padding:12px">
        <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">ジップロックに入れる衣装ID紙をA4横向きで印刷します</div>
        <button class="btn-primary" id="btnOpenLabelPrint" style="background:var(--gr)"><i class="ti ti-printer"></i>ラベルを作成</button>
      </div>
    </div>`;
  const renderOrder=()=>{const order=orderedGardens();document.getElementById('orderList').innerHTML=order.map((g,i)=>`<div class="order-item ${i===0?'mine':''}"><span class="drag-handle"><i class="ti ti-grip-vertical"></i></span><span style="min-width:20px;font-size:11px;color:var(--tx3)">${i+1}</span><span>${g}</span>${i===0?'<span class="badge badge-active" style="margin-left:4px">マイ園</span>':''}</div>`).join('');};
  renderOrder();
  body.querySelectorAll('#mgChips .chip').forEach(b=>b.onclick=()=>{body.querySelectorAll('#mgChips .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');S.myGarden=b.dataset.g;renderOrder();});
  document.getElementById('btnOpenLabelPrint').onclick=openLabelPrintModal;
  document.getElementById('btnSaveS').onclick=async()=>{
    const btn=document.getElementById('btnSaveS');
    setBtn(btn,'<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 保存中...',true);
    try{await SettingAPI.set('myGarden',S.myGarden);await SettingAPI.set('gardenOrder',S.gardenOrder.join(','));setBtn(btn,'<i class="ti ti-circle-check"></i> 保存完了！',false,'var(--gr2)');toast('設定を保存しました');setTimeout(()=>setBtn(btn,'<i class="ti ti-device-floppy"></i> 設定を保存',false,''),2000);}
    catch(e){setBtn(btn,'<i class="ti ti-device-floppy"></i> 設定を保存',false);toast('保存失敗: '+e.message);}
  };
}


// ============================================================
//  衣装IDラベル印刷
// ============================================================
const CAT_INITIALS=[
  {label:'オールインワン (A)',code:'A'},
  {label:'パンツ (P)',code:'P'},
  {label:'トップス (T)',code:'T'},
  {label:'スカート (S)',code:'S'},
  {label:'頭飾り (H)',code:'H'},
  {label:'その他 (O)',code:'O'},
];

function openLabelPrintModal(){
  openModal('衣装IDラベル印刷',`
    <div class="field">
      <div class="field-label"><i class="ti ti-tag"></i>イニシャル（カテゴリー）</div>
      <select id="lpCode" style="width:100%;height:38px;border:0.5px solid var(--br2);border-radius:var(--r-sm);padding:0 10px;font-size:14px;font-family:inherit;background:var(--bg2)">
        ${CAT_INITIALS.map(c=>`<option value="${c.code}">${c.label}</option>`).join('')}
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><div class="field-label">開始番号</div><input type="number" id="lpFrom" value="1" min="1"></div>
      <div class="field"><div class="field-label">終了番号</div><input type="number" id="lpTo" value="10" min="1"></div>
    </div>
    <div style="font-size:11px;color:var(--tx3);margin-top:4px"><i class="ti ti-info-circle" style="font-size:12px"></i> A4横向き・4枚/ページ（切り取り線付き）で印刷されます</div>
  `,'プレビューを開く',()=>{
    const code=document.getElementById('lpCode').value;
    const from=parseInt(document.getElementById('lpFrom').value)||1;
    const to=parseInt(document.getElementById('lpTo').value)||1;
    const digits=3;
    if(to<from){toast('終了番号は開始番号以上にしてください');return;}
    if(to-from>199){toast('一度に印刷できるのは200件までです');return;}
    closeModal();
    openLabelPreview(code,from,to,digits);
  });
}

function openLabelPreview(code,from,to,digits){
  const ids=[];
  for(let n=from;n<=to;n++) ids.push(code+String(n).padStart(digits,'0'));

  const ov=document.createElement('div');
  ov.id='labelPreview';
  ov.style.cssText='position:fixed;inset:0;background:#fff;z-index:300;display:flex;flex-direction:column';
  ov.innerHTML=`
    <div class="hdr no-print" style="flex-shrink:0">
      <button class="hdr-back" id="lpClose"><i class="ti ti-arrow-left"></i></button>
      <span class="hdr-title">ラベル印刷プレビュー（${ids.length}枚）</span>
      <button class="hdr-icon" id="lpPrintBtn"><i class="ti ti-printer"></i></button>
    </div>
    <div style="flex:1;overflow-y:auto;background:#e8e8e8;padding:16px" id="lpPages"></div>
  `;
  document.body.appendChild(ov);

  // A4横向け、4枚/ページ（2列×2行）でレイアウト
  const PER_PAGE=4;
  const pages=[];
  for(let i=0;i<ids.length;i+=PER_PAGE) pages.push(ids.slice(i,i+PER_PAGE));

  document.getElementById('lpPages').innerHTML=pages.map(pageIds=>`
    <div class="label-page" style="width:297mm;height:210mm;background:#fff;margin:0 auto 16px;box-shadow:0 1px 6px rgba(0,0,0,.25);display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr);position:relative">
      ${pageIds.map((id,i)=>`
        <div style="display:flex;align-items:center;justify-content:center;border-right:${(i%2===0)?'1px dashed #aaa':'none'};border-bottom:${(i<2)?'1px dashed #aaa':'none'}">
          <span style="font-size:96px;font-family:'Noto Sans JP',sans-serif;color:#111;letter-spacing:.02em">${id}</span>
        </div>`).join('')}
      ${Array.from({length:PER_PAGE-pageIds.length}).map(()=>'<div></div>').join('')}
    </div>`).join('');

  document.getElementById('lpClose').onclick=()=>ov.remove();
  document.getElementById('lpPrintBtn').onclick=()=>window.print();
}

// ============================================================
//  写真ライトボックス（拡大表示）
// ============================================================
function openLightbox(photos, startIdx=0){
  let idx=startIdx;
  const ov=document.createElement('div');
  ov.id='lightbox';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:none';

  const render=()=>{
    const p=photos[idx];
    ov.innerHTML=`
      <div style="position:absolute;top:0;left:0;right:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;z-index:1">
        <span style="color:rgba(255,255,255,.7);font-size:13px">${idx+1} / ${photos.length}</span>
        <button id="lbClose" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center"><i class="ti ti-x"></i></button>
      </div>
      <img src="${esc(p.URL||p)}" style="max-width:100%;max-height:calc(100dvh - 120px);object-fit:contain;border-radius:4px;user-select:none" draggable="false" id="lbImg">
      <div style="display:flex;gap:10px;margin-top:12px;align-items:center">
        <button id="lbPrev" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:38px;height:38px;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;${idx===0?'opacity:.3':''}" ${idx===0?'disabled':''}><i class="ti ti-chevron-left"></i></button>
        <div style="display:flex;gap:6px">
          ${photos.map((_,i)=>`<div style="width:7px;height:7px;border-radius:50%;background:${i===idx?'#fff':'rgba(255,255,255,.4)'}"></div>`).join('')}
        </div>
        <button id="lbNext" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:38px;height:38px;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;${idx===photos.length-1?'opacity:.3':''}" ${idx===photos.length-1?'disabled':''}><i class="ti ti-chevron-right"></i></button>
      </div>
      ${p.種別?`<div style="color:rgba(255,255,255,.5);font-size:11px;margin-top:6px">${esc(p.種別)}${p.アングル名?' · '+esc(p.アングル名):''}</div>`:''}
    `;
    document.getElementById('lbClose').onclick=()=>ov.remove();
    const prev=document.getElementById('lbPrev');
    const next=document.getElementById('lbNext');
    if(prev) prev.onclick=()=>{if(idx>0){idx--;render();}};
    if(next) next.onclick=()=>{if(idx<photos.length-1){idx++;render();}};
  };

  // スワイプ＋ピンチズーム対応
  let tx=0,ty=0,pinching=false,startDist=0,curScale=1;

  function getDist(t){return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);}

  ov.addEventListener('touchstart',e=>{
    if(e.touches.length===2){
      pinching=true;startDist=getDist(e.touches);
    }else if(e.touches.length===1){
      tx=e.touches[0].clientX;ty=e.touches[0].clientY;
    }
  },{passive:true});

  ov.addEventListener('touchmove',e=>{
    if(pinching&&e.touches.length===2){
      const d=getDist(e.touches);
      const scale=Math.max(0.5,Math.min(4,curScale*(d/startDist)));
      const img=document.getElementById('lbImg');
      if(img)img.style.transform=`scale(${scale})`;
    }
  },{passive:true});

  ov.addEventListener('touchend',e=>{
    if(pinching){
      if(e.touches.length<2){
        pinching=false;
        const img=document.getElementById('lbImg');
        if(img){
          const m=img.style.transform.match(/scale\(([\d.]+)\)/);
          curScale=m?parseFloat(m[1]):1;
          // 1未満なら戻す
          if(curScale<1){curScale=1;img.style.transform='scale(1)';}
        }
      }
      return;
    }
    if(curScale>1.1)return; // ズーム中はスワイプ無効
    const dx=e.changedTouches[0].clientX-tx;
    const dy=e.changedTouches[0].clientY-ty;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
      if(dx<0&&idx<photos.length-1){idx++;curScale=1;render();}
      else if(dx>0&&idx>0){idx--;curScale=1;render();}
    }
    if(Math.abs(dy)>80&&Math.abs(dy)>Math.abs(dx)&&curScale<=1.1)ov.remove();
  },{passive:true});

  // ダブルタップでズームトグル
  let lastTap=0;
  ov.addEventListener('click',e=>{
    const now=Date.now();
    if(now-lastTap<300){
      const img=document.getElementById('lbImg');
      if(img){
        if(curScale>1.1){curScale=1;img.style.transform='scale(1)';}
        else{curScale=2.5;img.style.transform='scale(2.5)';}
      }
      e.stopPropagation();
    }
    lastTap=now;
  });

  // 背景タップで閉じる（ズーム中は無効）
  ov.addEventListener('click',e=>{if(e.target===ov&&curScale<=1.1)ov.remove();});

  // キーボード
  const keyHandler=e=>{
    if(e.key==='ArrowLeft'&&idx>0){idx--;render();}
    else if(e.key==='ArrowRight'&&idx<photos.length-1){idx++;render();}
    else if(e.key==='Escape')ov.remove();
  };
  document.addEventListener('keydown',keyHandler);
  ov.addEventListener('remove',()=>document.removeEventListener('keydown',keyHandler));

  document.body.appendChild(ov);
  render();
}
// ============================================================
//  モーダル共通
// ============================================================
function modalsHTML(){return '<div id="modalRoot"></div>';}
function openModal(title,bodyHTML,okLabel,onOk,afterRender){
  const ov=document.createElement('div');ov.className='modal-overlay';ov.id='activeModal';
  ov.innerHTML=`<div class="modal"><div class="modal-hdr"><span class="modal-title">${title}</span><button class="modal-close" id="mClose"><i class="ti ti-x"></i></button></div><div class="modal-body">${bodyHTML}</div><div class="modal-footer"><button class="btn-cancel" id="mCancel">キャンセル</button><button class="btn-ok" id="mOk"><i class="ti ti-check"></i>${okLabel}</button></div></div>`;
  App.appendChild(ov);
  document.getElementById('mClose').onclick=closeModal;
  document.getElementById('mCancel').onclick=closeModal;
  document.getElementById('mOk').onclick=onOk;
  if(afterRender) afterRender(ov); // モーダル要素を引数で渡す
}
function closeModal(){const m=document.getElementById('activeModal');if(m)m.remove();}
function showConfirm(msg,onYes){
  const ov=document.createElement('div');ov.className='modal-overlay';ov.id='activeModal';
  ov.innerHTML=`<div class="modal" style="border-radius:14px;max-width:300px;margin:auto"><div class="modal-body" style="padding:20px 18px;text-align:center;white-space:pre-line;font-size:14px">${esc(msg)}</div><div class="modal-footer" style="border-top:none;padding-top:0"><button class="btn-cancel" style="flex:1" id="cNo">キャンセル</button><button class="btn-ok" style="background:var(--rd)" id="cYes">OK</button></div></div>`;
  App.appendChild(ov);
  document.getElementById('cNo').onclick=closeModal;
  document.getElementById('cYes').onclick=()=>{closeModal();onYes();};
}

function setBtn(btn,html,disabled,bg=''){btn.disabled=disabled;btn.innerHTML=html;btn.style.background=bg;}
function selHTML(id,opts,val){return `<select id="${id}">${opts.map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select>`;}

// リスト表示用CSS追加
const listStyle=document.createElement('style');
listStyle.textContent=`
.costume-list-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:0.5px solid var(--br);cursor:pointer;background:var(--bg2)}
.costume-list-item:active{background:var(--bg3)}
.cli-img{width:72px;height:72px;border-radius:8px;background:var(--bg3);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;flex-shrink:0}
.cli-info{flex:1;min-width:0}
`;
document.head.appendChild(listStyle);

async function refreshAll(){
  try{
    const d=await AllAPI.get();
    applyData(d);
    saveCache(d);
  }catch(e){console.error(e);}
}

// ============================================================
//  起動
// ============================================================
(async()=>{
  render(); // ローディング画面を即時表示
  await loadAll(); // loadAll内でキャッシュ→render→API→renderを管理
})();
