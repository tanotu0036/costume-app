// ============================================================
//  保育園 衣装管理アプリ — app.js
// ============================================================

const App = document.getElementById('app');

// 状態
const S = {
  costumes:[], photos:[], repertoires:[], usages:[], settings:{},
  gardenOrder:['西新','原','たの津','ちくし野'],
  myGarden:'西新',
  nav:'costumes',
  stack:[],
  fStatus:'', fCat:'', fYear:'', fGarden:'',
  curCostume:null, curRep:null,
  loaded:false,
};

const GARDENS = ['西新','原','たの津','ちくし野'];
const CATS = ['オールインワン','パンツ','トップス','スカート','頭飾り','その他'];
const CAT_ICON = {'オールインワン':'shirt-sport','パンツ':'wash-dry-p','トップス':'shirt','スカート':'diamond','頭飾り':'crown','その他':'dots'};

function gBadge(name){
  const c={'西新':'nishi','原':'hara','たの津':'tano','ちくし野':'chiku'}[name];
  return name?`<span class="badge badge-${c}">${name}</span>`:'';
}
function statusBadge(s){
  const c=s==='現役'?'active':s==='修繕中'?'repair':'retire';
  return `<span class="badge badge-${c}">${s||''}</span>`;
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

let toastTimer;
function toast(msg){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';App.appendChild(t);}
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2500);
}

// ============================================================
//  データ読み込み
// ============================================================
async function loadAll(){
  try{
    const d=await AllAPI.get();
    S.costumes=d.costumes||[];
    S.photos=d.photos||[];
    S.repertoires=d.repertoires||[];
    S.usages=d.usages||[];
    S.settings=d.settings||{};
    S.myGarden=S.settings.myGarden||'西新';
    S.gardenOrder=(S.settings.gardenOrder||'西新,原,たの津,ちくし野').split(',');
    S.loaded=true;
  }catch(e){
    console.error(e);
    toast('データ取得に失敗しました');
  }
}

// 園の表示順（マイ園を先頭に）
function orderedGardens(){
  const rest=S.gardenOrder.filter(g=>g!==S.myGarden);
  return [S.myGarden,...rest];
}

// ============================================================
//  ルーター
// ============================================================
function render(){
  const isSub=S.stack.length>0;
  const page=isSub?S.stack[S.stack.length-1]:S.nav;
  App.innerHTML=shellHTML(page,isSub)+modalsHTML();
  bindShell();
  if(page==='costumes') renderCostumes();
  if(page==='repertoires') renderReps();
  if(page==='settings') renderSettings();
  if(page==='costume-detail') renderCostumeDetail();
  if(page==='costume-add') initCostumeAdd();
  if(page==='rep-detail') renderRepDetail();
  if(page==='rep-add') initRepAdd();
}

const TITLES={
  costumes:'<i class="ti ti-hanger"></i> 衣装一覧',
  repertoires:'<i class="ti ti-theater"></i> 演目一覧',
  settings:'<i class="ti ti-settings"></i> 設定',
  'costume-detail':'<i class="ti ti-hanger"></i> 衣装詳細',
  'costume-add':'<i class="ti ti-plus"></i> 衣装登録',
  'rep-detail':'<i class="ti ti-theater"></i> 演目詳細',
  'rep-add':'<i class="ti ti-plus"></i> 演目登録',
};

function shellHTML(page,isSub){
  const showMenu=['costume-detail','rep-detail'].includes(page);
  return `
    <div class="hdr">
      ${isSub?'<button class="hdr-back" id="btnBack"><i class="ti ti-arrow-left"></i></button>':''}
      <span class="hdr-title">${TITLES[page]||''}</span>
      ${showMenu?'<button class="hdr-icon" id="btnMenu"><i class="ti ti-dots-vertical"></i></button>':''}
    </div>
    <div class="page active" id="pageBody"></div>
    ${!isSub?navHTML():''}
    ${(!isSub&&(page==='costumes'||page==='repertoires'))?'<button class="fab" id="btnFab"><i class="ti ti-plus"></i></button>':''}
  `;
}

function navHTML(){
  const n=(id,icon,label)=>`<button class="nav-btn ${S.nav===id?'active':''}" data-nav="${id}"><i class="ti ti-${icon}"></i>${label}</button>`;
  return `<div class="bottom-nav">
    ${n('costumes','hanger','衣装一覧')}
    ${n('repertoires','theater','演目一覧')}
    ${n('settings','settings','設定')}
  </div>`;
}

function bindShell(){
  const back=document.getElementById('btnBack');
  if(back) back.onclick=goBack;
  const fab=document.getElementById('btnFab');
  if(fab) fab.onclick=onFab;
  const menu=document.getElementById('btnMenu');
  if(menu) menu.onclick=toggleMenu;
  document.querySelectorAll('[data-nav]').forEach(b=>{
    b.onclick=()=>{S.nav=b.dataset.nav;S.stack=[];render();};
  });
}

function pushPage(p){S.stack.push(p);render();}
function goBack(){S.stack.pop();render();}
function onFab(){
  if(S.nav==='costumes') pushPage('costume-add');
  if(S.nav==='repertoires') pushPage('rep-add');
}

// ============================================================
//  3点メニュー
// ============================================================
function toggleMenu(){
  const existing=document.getElementById('menuPop');
  if(existing){existing.remove();return;}
  const page=S.stack[S.stack.length-1];
  const pop=document.createElement('div');
  pop.id='menuPop';pop.className='menu-pop';
  if(page==='costume-detail'){
    pop.innerHTML=`
      <div class="menu-item" id="miEdit"><i class="ti ti-pencil"></i>編集する</div>
      <div class="menu-item danger" id="miDelete"><i class="ti ti-trash"></i>この衣装を削除</div>`;
  }else if(page==='rep-detail'){
    pop.innerHTML=`
      <div class="menu-item" id="miEditRep"><i class="ti ti-pencil"></i>編集する</div>
      <div class="menu-item danger" id="miDeleteRep"><i class="ti ti-trash"></i>この演目を削除</div>`;
  }
  App.appendChild(pop);
  setTimeout(()=>{
    document.addEventListener('click',closeMenuOutside);
  },10);
  const e1=document.getElementById('miEdit'); if(e1) e1.onclick=openEditCostume;
  const d1=document.getElementById('miDelete'); if(d1) d1.onclick=confirmDeleteCostume;
  const e2=document.getElementById('miEditRep'); if(e2) e2.onclick=openEditRep;
  const d2=document.getElementById('miDeleteRep'); if(d2) d2.onclick=confirmDeleteRep;
}
function closeMenuOutside(ev){
  const pop=document.getElementById('menuPop');
  if(pop && !pop.contains(ev.target) && ev.target.id!=='btnMenu'){
    pop.remove();
    document.removeEventListener('click',closeMenuOutside);
  }
}
function closeMenu(){const p=document.getElementById('menuPop');if(p)p.remove();}

// ============================================================
//  衣装一覧
// ============================================================
function renderCostumes(){
  const body=document.getElementById('pageBody');
  const statusPills=['','現役','修繕中','廃棄'].map(s=>
    `<button class="filter-pill ${S.fStatus===s?'on':''}" data-fstatus="${s}">${s||'すべて'}</button>`).join('');
  const catPills=['',...CATS].map(c=>
    `<button class="filter-pill ${S.fCat===c?'on':''}" data-fcat="${c}">${c||'全カテゴリー'}</button>`).join('');

  body.innerHTML=`
    <div class="filter-bar">${statusPills}</div>
    <div class="filter-bar">${catPills}</div>
    <div id="costumeGridWrap" style="flex:1;overflow-y:auto"></div>`;

  body.querySelectorAll('[data-fstatus]').forEach(b=>b.onclick=()=>{S.fStatus=b.dataset.fstatus;renderCostumes();});
  body.querySelectorAll('[data-fcat]').forEach(b=>b.onclick=()=>{S.fCat=b.dataset.fcat;renderCostumes();});

  let list=S.costumes;
  if(S.fStatus) list=list.filter(c=>c.状態===S.fStatus);
  if(S.fCat) list=list.filter(c=>c.カテゴリー===S.fCat);

  const wrap=document.getElementById('costumeGridWrap');
  if(!S.loaded){wrap.innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>読み込み中...</div>';return;}
  if(!list.length){wrap.innerHTML='<div class="empty"><i class="ti ti-hanger"></i><p>衣装がありません</p></div>';return;}

  wrap.innerHTML=`<div class="costume-grid">${list.map(c=>{
    const dot=c.状態==='現役'?'sdot-active':c.状態==='修繕中'?'sdot-repair':'sdot-retire';
    const img=c.メイン写真URL?`<img src="${esc(c.メイン写真URL)}" loading="lazy" alt="">`:'<i class="ti ti-hanger"></i>';
    const pc=c.写真枚数>1?`<div class="pcount"><i class="ti ti-camera" style="font-size:10px"></i>${c.写真枚数}</div>`:'';
    return `<div class="costume-card" data-id="${c.id}">
      <div class="costume-img"><div class="sdot ${dot}"></div>${img}${pc}</div>
      <div class="costume-meta">
        <div class="costume-code">${esc(c.衣装ID)}</div>
        <div class="costume-name">${esc(c.衣装名)||'（名称未設定）'}</div>
        <div class="costume-loc"><i class="ti ti-map-pin"></i>${esc(c.保管場所)}</div>
      </div>
    </div>`;
  }).join('')}</div>`;
  wrap.querySelectorAll('.costume-card').forEach(card=>{
    card.onclick=()=>openCostumeDetail(card.dataset.id);
  });
}

// ============================================================
//  衣装詳細
// ============================================================
async function openCostumeDetail(id){
  S.curCostume=S.costumes.find(c=>c.id===id)||{id};
  pushPage('costume-detail');
  try{
    S.curCostume=await CostumeAPI.get(id);
    renderCostumeDetail();
  }catch(e){console.error(e);}
}

let detailPhotoIdx=0;
function renderCostumeDetail(){
  const c=S.curCostume;if(!c)return;
  const body=document.getElementById('pageBody');
  const photos=c.写真||[];
  detailPhotoIdx=Math.min(detailPhotoIdx,Math.max(0,photos.length-1));
  const mainPhoto=photos[detailPhotoIdx];

  body.innerHTML=`
    <div style="flex:1;overflow-y:auto">
      <div class="photo-main" id="photoMain">
        ${mainPhoto?`<img src="${esc(mainPhoto.URL)}" alt="">`:'<i class="ti ti-hanger"></i>'}
      </div>
      <div class="thumb-row" id="thumbRow"></div>

      <div class="section"><div class="section-title"><i class="ti ti-info-circle"></i>基本情報</div></div>
      <div class="card">
        ${rowHTML('衣装ID',esc(c.衣装ID))}
        ${rowHTML('カテゴリー',esc(c.カテゴリー))}
        ${rowHTML('衣装名',esc(c.衣装名)||'（未設定）')}
        ${rowHTML('個数',c.個数?esc(c.個数)+'着':'')}
        ${rowHTML('製作園',esc(c.製作園))}
        ${rowHTML('メモ',esc(c.メモ))}
      </div>

      <div class="section"><div class="section-title"><i class="ti ti-building-warehouse"></i>保管・状態</div></div>
      <div class="card">
        ${rowHTML('保管場所',esc(c.保管場所))}
        ${rowHTML('移動先',esc(c.移動先)||'（現在地）')}
        ${rowHTML('状態',statusBadge(c.状態))}
      </div>

      <div class="section"><div class="section-title"><i class="ti ti-history"></i>使用履歴</div></div>
      <div class="card" style="padding:0"><div class="timeline" id="histList"></div></div>

      <div style="padding:12px">
        <button class="btn-primary" id="btnLinkRep"><i class="ti ti-plus"></i>演目に紐づける</button>
      </div>
      <div style="height:20px"></div>
    </div>`;

  // サムネイル
  const tr=document.getElementById('thumbRow');
  tr.innerHTML=photos.map((p,i)=>`
    <div class="thumb-item ${i===detailPhotoIdx?'active':''}" data-idx="${i}">
      ${p.URL?`<img src="${esc(p.URL)}" alt="">`:'<i class="ti ti-photo"></i>'}
      <div class="thumb-del" data-del="${p.id}"><i class="ti ti-x"></i></div>
    </div>`).join('')+`<button class="thumb-item thumb-add" id="thumbAdd"><i class="ti ti-plus"></i></button>`;

  tr.querySelectorAll('.thumb-item[data-idx]').forEach(t=>{
    t.onclick=(e)=>{
      if(e.target.closest('[data-del]'))return;
      detailPhotoIdx=parseInt(t.dataset.idx);renderCostumeDetail();
    };
  });
  tr.querySelectorAll('[data-del]').forEach(d=>{
    d.onclick=(e)=>{e.stopPropagation();confirmDeletePhoto(d.dataset.del);};
  });
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
      <button class="hdr-icon" style="color:var(--tx3)" data-editusage="${h.id}" data-memo="${esc(h.メモ)}"><i class="ti ti-pencil"></i></button>
    </div>`).join(''):'<div style="padding:12px;text-align:center;font-size:12px;color:var(--tx3)">使用履歴なし</div>';

  document.getElementById('histList').querySelectorAll('[data-editusage]').forEach(b=>{
    b.onclick=()=>openEditMemo(b.dataset.editusage,b.dataset.memo);
  });
  document.getElementById('btnLinkRep').onclick=openLinkRepModal;
}

function rowHTML(label,value){
  return `<div class="row"><span class="row-label">${label}</span><span class="row-value">${value||''}</span></div>`;
}

// ============================================================
//  写真アップロード（POST一括送信）
// ============================================================
function selectPhotoForDetail(){
  const input=document.createElement('input');
  input.type='file';input.accept='image/*';
  input.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    const photos=S.curCostume.写真||[];
    const 種別=photos.length===0?'メイン':'アングル';
    await doUploadPhoto(file,種別,S.curCostume.id,S.curCostume.衣装ID,photos.length+1);
  };
  input.click();
}

async function doUploadPhoto(file,種別,costumeId,costumeID,順番){
  toast('写真を処理中...');
  try{
    const base64=await resizeToBase64(file);
    toast('アップロード中...');
    await PhotoAPI.add({
      衣装id:costumeId, base64, mimeType:'image/jpeg',
      fileName:(costumeID||'photo')+'_'+Date.now()+'.jpg',
      種別, アングル名:種別==='アングル'?('アングル'+順番):'', 順番,
    });
    toast('写真を保存しました');
    // 詳細を再取得
    if(S.curCostume&&S.curCostume.id===costumeId){
      S.curCostume=await CostumeAPI.get(costumeId);
      renderCostumeDetail();
    }
    // 一覧データも更新
    refreshCostumeInList(costumeId);
  }catch(e){
    console.error(e);
    toast('アップロード失敗: '+e.message);
  }
}

async function refreshCostumeInList(id){
  try{
    const fresh=await CostumeAPI.get(id);
    const idx=S.costumes.findIndex(c=>c.id===id);
    if(idx>=0){
      const photos=fresh.写真||[];
      const main=photos.find(p=>p.種別==='メイン')||photos[0];
      S.costumes[idx].メイン写真URL=main?main.URL:'';
      S.costumes[idx].写真枚数=photos.length;
    }
  }catch(e){}
}

// 画像をリサイズしてBase64で返す
function resizeToBase64(file,maxSize=1280,quality=0.78){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        let w=img.width,h=img.height;
        if(w>maxSize||h>maxSize){
          if(w>h){h=Math.round(h*maxSize/w);w=maxSize;}
          else{w=Math.round(w*maxSize/h);h=maxSize;}
        }
        const cv=document.createElement('canvas');
        cv.width=w;cv.height=h;
        cv.getContext('2d').drawImage(img,0,0,w,h);
        resolve(cv.toDataURL('image/jpeg',quality).split(',')[1]);
      };
      img.onerror=reject;img.src=e.target.result;
    };
    reader.onerror=reject;reader.readAsDataURL(file);
  });
}

function confirmDeletePhoto(photoId){
  showConfirm('この写真を削除しますか？',async()=>{
    try{
      await PhotoAPI.delete(photoId);
      toast('写真を削除しました');
      S.curCostume=await CostumeAPI.get(S.curCostume.id);
      detailPhotoIdx=0;
      renderCostumeDetail();
      refreshCostumeInList(S.curCostume.id);
    }catch(e){toast('削除失敗: '+e.message);}
  });
}

// ============================================================
//  衣装 編集・削除
// ============================================================
function openEditCostume(){
  closeMenu();
  const c=S.curCostume;
  openModal('衣装を編集','costume-edit',`
    <div class="field"><div class="field-label">衣装名</div><input id="ecName" value="${esc(c.衣装名)}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><div class="field-label">個数</div><input type="number" id="ecCount" value="${esc(c.個数)}"></div>
      <div class="field"><div class="field-label">製作園</div>${selectHTML('ecMade',GARDENS,c.製作園)}</div>
    </div>
    <div class="field"><div class="field-label">保管場所</div>${selectHTML('ecStorage',[...GARDENS,'原倉庫','たの津倉庫'],c.保管場所)}</div>
    <div class="field"><div class="field-label">移動先</div>${selectHTML('ecDest',['',...GARDENS,'原倉庫','たの津倉庫'],c.移動先)}</div>
    <div class="field"><div class="field-label">状態</div>
      <div class="chip-grid-3" id="ecStatus">
        ${['現役','修繕中','廃棄'].map(s=>`<button class="chip ${c.状態===s?'on':''}" data-status="${s}">${s}</button>`).join('')}
      </div>
    </div>
    <div class="field"><div class="field-label">メモ</div><textarea id="ecMemo">${esc(c.メモ)}</textarea></div>
  `,'保存',saveEditCostume);

  let selStatus=c.状態;
  document.querySelectorAll('#ecStatus .chip').forEach(b=>{
    b.onclick=()=>{document.querySelectorAll('#ecStatus .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');selStatus=b.dataset.status;};
  });
  window._ecStatus=()=>selStatus;
}

async function saveEditCostume(){
  const c=S.curCostume;
  const body={
    id:c.id,
    衣装名:document.getElementById('ecName').value,
    個数:document.getElementById('ecCount').value,
    製作園:document.getElementById('ecMade').value,
    保管場所:document.getElementById('ecStorage').value,
    移動先:document.getElementById('ecDest').value,
    状態:window._ecStatus(),
    メモ:document.getElementById('ecMemo').value,
  };
  try{
    await CostumeAPI.update(body);
    Object.assign(S.curCostume,body);
    const idx=S.costumes.findIndex(x=>x.id===c.id);
    if(idx>=0)Object.assign(S.costumes[idx],body);
    closeModal();
    toast('保存しました');
    renderCostumeDetail();
  }catch(e){toast('保存失敗: '+e.message);}
}

function confirmDeleteCostume(){
  closeMenu();
  showConfirm('この衣装を削除しますか？\n関連する写真も削除されます。',async()=>{
    try{
      await CostumeAPI.delete(S.curCostume.id);
      S.costumes=S.costumes.filter(c=>c.id!==S.curCostume.id);
      toast('削除しました');
      goBack();
    }catch(e){toast('削除失敗: '+e.message);}
  });
}

// ============================================================
//  衣装登録
// ============================================================
let acState={cat:'',code:'',status:'現役',photoFile:null};
function initCostumeAdd(){
  acState={cat:'',code:'',status:'現役',photoFile:null};
  const body=document.getElementById('pageBody');
  body.innerHTML=`
    <div style="flex:1;overflow-y:auto;padding:10px 12px 80px">
      <div class="field"><div class="field-label"><i class="ti ti-tag"></i>カテゴリー <span class="req">必須</span></div>
        <div class="chip-grid" id="acCat">
          ${CATS.map(c=>`<button class="chip" data-cat="${c}" data-code="${CAT_CODE_F(c)}"><i class="ti ti-${CAT_ICON[c]}"></i>${c}</button>`).join('')}
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
        <div class="field"><div class="field-label"><i class="ti ti-building"></i>製作園</div>${selectHTML('acMade',['',...GARDENS],'')}</div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-building-warehouse"></i>保管場所 <span class="req">必須</span></div>${selectHTML('acStorage',['',...GARDENS,'原倉庫','たの津倉庫'],'')}</div>
      <div class="field"><div class="field-label"><i class="ti ti-toggle-right"></i>状態 <span class="req">必須</span></div>
        <div class="chip-grid-3" id="acStatus">
          ${['現役','修繕中','廃棄'].map((s,i)=>`<button class="chip ${i===0?'on':''}" data-status="${s}">${s}</button>`).join('')}
        </div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-note"></i>メモ</div><textarea id="acMemo" placeholder="色展開・サイズ・素材など…"></textarea></div>
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

  body.querySelectorAll('#acCat .chip').forEach(b=>{
    b.onclick=()=>{
      body.querySelectorAll('#acCat .chip').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      acState.cat=b.dataset.cat;acState.code=b.dataset.code;
      const same=S.costumes.filter(c=>c.カテゴリー===acState.cat);
      const maxN=same.reduce((m,c)=>Math.max(m,parseInt(String(c.衣装ID||'').slice(1))||0),0);
      document.getElementById('acId').textContent=acState.code+String(maxN+1).padStart(3,'0');
    };
  });
  body.querySelectorAll('#acStatus .chip').forEach(b=>{
    b.onclick=()=>{body.querySelectorAll('#acStatus .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');acState.status=b.dataset.status;};
  });
  document.getElementById('acPhotoBtn').onclick=()=>{
    const input=document.createElement('input');
    input.type='file';input.accept='image/*';
    input.onchange=e=>{
      const f=e.target.files[0];if(!f)return;
      acState.photoFile=f;
      const r=new FileReader();
      r.onload=ev=>{
        document.getElementById('acPhotoImg').src=ev.target.result;
        document.getElementById('acPhotoPrev').style.display='block';
        document.getElementById('acPhotoLabel').textContent=f.name;
      };
      r.readAsDataURL(f);
    };
    input.click();
  };
  document.getElementById('acCancel').onclick=goBack;
  document.getElementById('acSubmit').onclick=submitCostume;
}

function CAT_CODE_F(c){return {'オールインワン':'A','パンツ':'P','トップス':'T','スカート':'S','頭飾り':'H','その他':'O'}[c];}

async function submitCostume(){
  if(!acState.cat){toast('カテゴリーを選択してください');return;}
  if(!document.getElementById('acStorage').value){toast('保管場所を選択してください');return;}
  const btn=document.getElementById('acSubmit');
  btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 登録中...';
  try{
    const res=await CostumeAPI.add({
      カテゴリー:acState.cat,
      衣装名:document.getElementById('acName').value,
      個数:document.getElementById('acCount').value,
      製作園:document.getElementById('acMade').value,
      保管場所:document.getElementById('acStorage').value,
      状態:acState.status,
      メモ:document.getElementById('acMemo').value,
    });
    // 写真があればアップロード
    if(acState.photoFile){
      btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 写真保存中...';
      const base64=await resizeToBase64(acState.photoFile);
      await PhotoAPI.add({
        衣装id:res.id,base64,mimeType:'image/jpeg',
        fileName:res.衣装ID+'_'+Date.now()+'.jpg',種別:'メイン',順番:1,
      });
    }
    btn.innerHTML='<i class="ti ti-circle-check"></i> 登録完了！';btn.style.background='var(--gr2)';
    toast(res.衣装ID+' を登録しました');
    await loadAll();
    setTimeout(goBack,700);
  }catch(e){
    btn.disabled=false;btn.innerHTML='<i class="ti ti-device-floppy"></i> 登録する';btn.style.background='';
    toast('登録失敗: '+e.message);
  }
}

// ============================================================
//  演目一覧
// ============================================================
function renderReps(){
  const body=document.getElementById('pageBody');
  const years=[...new Set(S.repertoires.map(r=>r.年度))].sort((a,b)=>b-a);
  const yearPills=['',...years].map(y=>
    `<button class="filter-pill ${String(S.fYear)===String(y)?'on':''}" data-fyear="${y}">${y?y+'年度':'全年度'}</button>`).join('');
  const gardenPills=['',...GARDENS].map(g=>
    `<button class="filter-pill ${S.fGarden===g?'on':''}" data-fgarden="${g}">${g||'全園'}</button>`).join('');

  body.innerHTML=`
    <div class="filter-bar">${yearPills}</div>
    <div class="filter-bar">${gardenPills}</div>
    <div id="repListWrap" style="flex:1;overflow-y:auto"></div>`;

  body.querySelectorAll('[data-fyear]').forEach(b=>b.onclick=()=>{S.fYear=b.dataset.fyear;renderReps();});
  body.querySelectorAll('[data-fgarden]').forEach(b=>b.onclick=()=>{S.fGarden=b.dataset.fgarden;renderReps();});

  let list=S.repertoires;
  if(S.fYear) list=list.filter(r=>String(r.年度)===String(S.fYear));
  if(S.fGarden) list=list.filter(r=>String(r.園||'').indexOf(S.fGarden)>=0);

  const wrap=document.getElementById('repListWrap');
  if(!S.loaded){wrap.innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>読み込み中...</div>';return;}
  if(!list.length){wrap.innerHTML='<div class="empty"><i class="ti ti-theater"></i><p>演目がありません</p></div>';return;}

  const groups={};
  list.forEach(r=>{const y=r.年度||'不明';(groups[y]=groups[y]||[]).push(r);});
  const order=orderedGardens();
  wrap.innerHTML=Object.keys(groups).sort((a,b)=>b-a).map(year=>`
    <div>
      <div class="rep-year-hdr"><i class="ti ti-calendar"></i>${year}年度</div>
      ${groups[year].sort((a,b)=>order.indexOf(a.園)-order.indexOf(b.園)).map(r=>{
        const icon=r.種別==='劇・劇遊び'?'masks-theater':'music';
        return `<div class="rep-item" data-id="${r.id}">
          <div class="rep-icon-wrap"><i class="ti ti-${icon}"></i></div>
          <div class="rep-info">
            <div class="rep-name">${esc(r.演目名)}</div>
            <div class="rep-sub">${gBadge(r.園)}${r.クラス?`<span>${esc(r.クラス)}</span>`:''}</div>
            <div class="rep-count"><i class="ti ti-hanger" style="font-size:11px"></i>衣装 ${r.衣装数||0}件</div>
          </div>
          <i class="ti ti-chevron-right" style="font-size:18px;color:var(--tx3)"></i>
        </div>`;
      }).join('')}
    </div>`).join('');
  wrap.querySelectorAll('.rep-item').forEach(it=>it.onclick=()=>openRepDetail(it.dataset.id));
}

// ============================================================
//  演目詳細
// ============================================================
async function openRepDetail(id){
  S.curRep=S.repertoires.find(r=>r.id===id)||{id};
  pushPage('rep-detail');
  try{
    S.usages=await UsageAPI.list({repertoireId:id});
  }catch(e){S.usages=[];}
  renderRepDetail();
}

function renderRepDetail(){
  const r=S.curRep;if(!r)return;
  const body=document.getElementById('pageBody');
  const icon=r.種別==='劇・劇遊び'?'masks-theater':'music';
  const usages=S.usages||[];

  body.innerHTML=`
    <div style="flex:1;overflow-y:auto">
      <div style="padding:12px 14px;border-bottom:0.5px solid var(--br);background:var(--bg2)">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div class="rep-icon-wrap" style="width:44px;height:44px"><i class="ti ti-${icon}" style="font-size:22px"></i></div>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:700">${esc(r.演目名)}</div>
            <div style="font-size:12px;color:var(--tx2);margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              ${gBadge(r.園)}<span>${esc(r.年度)}年度</span>${r.クラス?`<span>${esc(r.クラス)}</span>`:''}
            </div>
            ${r.備考?`<div style="font-size:11px;color:var(--tx2);margin-top:4px">${esc(r.備考)}</div>`:''}
          </div>
        </div>
      </div>
      <div style="padding:8px 12px;border-bottom:0.5px solid var(--br);background:var(--bg2)">
        <button class="btn-primary" style="height:38px;font-size:13px" id="btnLinkCostume"><i class="ti ti-plus"></i>衣装を紐づける</button>
      </div>
      <div class="section"><div class="section-title"><i class="ti ti-hanger"></i>使用衣装</div></div>
      <div class="card" style="padding:0" id="usageList"></div>
      <div style="height:20px"></div>
    </div>`;

  const ul=document.getElementById('usageList');
  ul.innerHTML=usages.length?usages.map(u=>`
    <div class="tl-item" style="padding:9px 12px">
      <div class="sel-thumb">${u.写真URL?`<img src="${esc(u.写真URL)}" alt="">`:'<i class="ti ti-hanger"></i>'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500">${esc(u.衣装ID_表示)} ${esc(u.衣装名)}</div>
        ${u.役柄?`<div style="font-size:11px;color:var(--tx2);margin-top:1px"><i class="ti ti-user" style="font-size:11px"></i> ${esc(u.役柄)}</div>`:''}
        ${u.メモ?`<div class="tl-memo" style="margin-top:4px"><i class="ti ti-note" style="font-size:11px"></i> ${esc(u.メモ)}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="hdr-icon" style="color:var(--tx3)" data-editusage="${u.id}" data-memo="${esc(u.メモ)}" data-role="${esc(u.役柄)}"><i class="ti ti-pencil"></i></button>
        <button class="hdr-icon" style="color:var(--tx3)" data-delusage="${u.id}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join(''):'<div class="empty" style="padding:20px"><i class="ti ti-hanger" style="font-size:28px;margin-bottom:6px"></i><p>衣装未登録</p></div>';

  document.getElementById('btnLinkCostume').onclick=openLinkCostumeModal;
  ul.querySelectorAll('[data-editusage]').forEach(b=>b.onclick=()=>openEditUsage(b.dataset.editusage,b.dataset.role,b.dataset.memo));
  ul.querySelectorAll('[data-delusage]').forEach(b=>b.onclick=()=>confirmDeleteUsage(b.dataset.delusage));
}

// ============================================================
//  演目 編集・削除
// ============================================================
function openEditRep(){
  closeMenu();
  const r=S.curRep;
  openModal('演目を編集','rep-edit',`
    <div class="field"><div class="field-label">演目名</div><input id="erName" value="${esc(r.演目名)}"></div>
    <div class="field"><div class="field-label">クラス</div><input id="erClass" value="${esc(r.クラス)}"></div>
    <div class="field"><div class="field-label">備考</div><textarea id="erMemo">${esc(r.備考)}</textarea></div>
  `,'保存',async()=>{
    const body={id:r.id,演目名:document.getElementById('erName').value,クラス:document.getElementById('erClass').value,備考:document.getElementById('erMemo').value};
    try{
      await RepertoireAPI.update(body);
      Object.assign(S.curRep,body);
      const idx=S.repertoires.findIndex(x=>x.id===r.id);
      if(idx>=0)Object.assign(S.repertoires[idx],body);
      closeModal();toast('保存しました');renderRepDetail();
    }catch(e){toast('保存失敗: '+e.message);}
  });
}

function confirmDeleteRep(){
  closeMenu();
  showConfirm('この演目を削除しますか？\n衣装の紐づけも削除されます。',async()=>{
    try{
      await RepertoireAPI.delete(S.curRep.id);
      S.repertoires=S.repertoires.filter(r=>r.id!==S.curRep.id);
      toast('削除しました');goBack();
    }catch(e){toast('削除失敗: '+e.message);}
  });
}

// ============================================================
//  演目登録
// ============================================================
let arState={type:'劇・劇遊び',gardens:[]};
let drumIdx=0;
function initRepAdd(){
  arState={type:'劇・劇遊び',gardens:[]};
  const body=document.getElementById('pageBody');
  body.innerHTML=`
    <div style="flex:1;overflow-y:auto;padding:10px 12px 80px">
      <div class="field"><div class="field-label"><i class="ti ti-music"></i>演目名 <span class="req">必須</span></div><input id="arName" placeholder="例：【1歳児】劇遊び（どんないろがすき）"></div>
      <div class="field"><div class="field-label"><i class="ti ti-category"></i>種別</div>
        <div class="chip-grid-3" id="arType">
          ${[['劇・劇遊び','masks-theater'],['遊戯・ダンス','music'],['その他','dots']].map(([t,ic],i)=>`<button class="chip ${i===0?'on':''}" data-type="${t}"><i class="ti ti-${ic}"></i>${t}</button>`).join('')}
        </div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-users"></i>クラス</div><input id="arClass" placeholder="例：1歳児、うみ組"></div>
      <div class="field"><div class="field-label"><i class="ti ti-calendar"></i>年度 <span class="req">必須</span></div>
        <div class="drum-field">
          <span class="drum-val" id="arYearVal"></span>
          <div class="drum-wrap" id="arDrum"><div class="drum-hl"></div><div class="drum-ft"></div><div class="drum-fb"></div><div class="drum-list" id="arDrumList"></div></div>
        </div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-building"></i>実施園 <span class="req">必須</span></div>
        <div class="chip-grid" id="arGarden">
          ${GARDENS.map(g=>`<button class="chip" data-garden="${g}"><i class="ti ti-circle"></i>${g}</button>`).join('')}
        </div>
      </div>
      <div class="field"><div class="field-label"><i class="ti ti-note"></i>備考</div><textarea id="arMemo" placeholder="衣装の準備状況や特記事項など…"></textarea></div>
    </div>
    <div style="padding:10px 12px 14px;border-top:0.5px solid var(--br);background:var(--bg2);flex-shrink:0;display:flex;gap:8px">
      <button class="btn-sub" style="flex:0 0 80px" id="arCancel">キャンセル</button>
      <button class="btn-primary" id="arSubmit"><i class="ti ti-device-floppy"></i>登録する</button>
    </div>`;

  body.querySelectorAll('#arType .chip').forEach(b=>b.onclick=()=>{body.querySelectorAll('#arType .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');arState.type=b.dataset.type;});
  body.querySelectorAll('#arGarden .chip').forEach(b=>{
    b.onclick=()=>{
      b.classList.toggle('on');
      const g=b.dataset.garden;const ic=b.querySelector('i');
      if(b.classList.contains('on')){arState.gardens.push(g);ic.className='ti ti-circle-check';}
      else{arState.gardens=arState.gardens.filter(x=>x!==g);ic.className='ti ti-circle';}
    };
  });
  document.getElementById('arCancel').onclick=goBack;
  document.getElementById('arSubmit').onclick=submitRep;
  initDrum();
}

async function submitRep(){
  if(!document.getElementById('arName').value){toast('演目名を入力してください');return;}
  if(!arState.gardens.length){toast('実施園を選択してください');return;}
  const btn=document.getElementById('arSubmit');
  btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> 登録中...';
  try{
    await RepertoireAPI.add({
      演目名:document.getElementById('arName').value,
      種別:arState.type,
      クラス:document.getElementById('arClass').value,
      年度:YEARS[drumIdx],
      園:arState.gardens.join('・'),
      備考:document.getElementById('arMemo').value,
    });
    btn.innerHTML='<i class="ti ti-circle-check"></i> 登録完了！';btn.style.background='var(--gr2)';
    toast('演目を登録しました');
    await loadAll();
    setTimeout(goBack,700);
  }catch(e){
    btn.disabled=false;btn.innerHTML='<i class="ti ti-device-floppy"></i> 登録する';btn.style.background='';
    toast('登録失敗: '+e.message);
  }
}

// ドラムロール
const YEARS=[];for(let y=2018;y<=2048;y++)YEARS.push(y);
let drumDrag=false,drumSY=0,drumSO=0,drumCO=0;const IH=32;
function initDrum(){
  drumIdx=YEARS.indexOf(new Date().getFullYear());
  if(drumIdx<0)drumIdx=YEARS.length-1;
  const dl=document.getElementById('arDrumList');
  const pad=document.createElement('div');pad.style.height=IH+'px';
  dl.innerHTML='';dl.appendChild(pad.cloneNode());
  YEARS.forEach((y,i)=>{const d=document.createElement('div');d.className='drum-item'+(i===drumIdx?' sel':'');d.textContent=y+'年度';dl.appendChild(d);});
  dl.appendChild(pad.cloneNode());
  applyDrum(getDrumOff(drumIdx),false);updateDrum();
  const dw=document.getElementById('arDrum');
  dw.addEventListener('mousedown',e=>{drumDrag=true;drumSY=e.clientY;drumSO=drumCO;});
  dw.addEventListener('touchstart',e=>{drumDrag=true;drumSY=e.touches[0].clientY;drumSO=drumCO;},{passive:true});
  window.addEventListener('mousemove',drumMove);
  window.addEventListener('touchmove',drumMoveT,{passive:true});
  window.addEventListener('mouseup',drumUp);
  window.addEventListener('touchend',drumUp);
  dw.addEventListener('wheel',e=>{e.preventDefault();drumIdx=Math.max(0,Math.min(YEARS.length-1,drumIdx+(e.deltaY>0?1:-1)));applyDrum(getDrumOff(drumIdx),true);updateDrum();},{passive:false});
}
function getDrumOff(i){return -(i*IH);}
function applyDrum(off,anim){const dl=document.getElementById('arDrumList');if(!dl)return;dl.style.transition=anim?'transform .18s':'none';dl.style.transform=`translateY(${off}px)`;drumCO=off;}
function drumMove(e){if(!drumDrag)return;applyDrum(Math.max(getDrumOff(YEARS.length-1),Math.min(0,drumSO+(e.clientY-drumSY))),false);}
function drumMoveT(e){if(!drumDrag)return;applyDrum(Math.max(getDrumOff(YEARS.length-1),Math.min(0,drumSO+(e.touches[0].clientY-drumSY))),false);}
function drumUp(){if(!drumDrag)return;drumDrag=false;drumIdx=Math.max(0,Math.min(YEARS.length-1,Math.round(-drumCO/IH)));applyDrum(getDrumOff(drumIdx),true);updateDrum();}
function updateDrum(){const dl=document.getElementById('arDrumList');if(!dl)return;dl.querySelectorAll('.drum-item').forEach((el,i)=>el.classList.toggle('sel',i===drumIdx+1));const v=document.getElementById('arYearVal');if(v)v.textContent=YEARS[drumIdx]+'年度';}

// ============================================================
//  紐づけモーダル（演目詳細→衣装選択）
// ============================================================
function openLinkCostumeModal(){
  const checked=new Set();
  openModalRaw('衣装を選んで追加',`
    <div style="position:relative;margin-bottom:8px">
      <input id="lcSearch" placeholder="衣装IDや名称で絞り込み…" style="width:100%;height:34px;border:0.5px solid var(--br2);border-radius:17px;padding:0 12px;font-size:13px;background:var(--bg3);font-family:inherit;outline:none">
    </div>
    <div class="sel-list" id="lcList"></div>
    <div class="sel-bar"><span id="lcCount">0件選択中</span><span style="font-size:10px;opacity:.8">タップで選択</span></div>
    <div class="field" style="margin-top:10px;margin-bottom:0"><div class="field-label"><i class="ti ti-note"></i>この演目での使い方メモ</div><textarea id="lcMemo" placeholder="役柄・使用色・注意事項など" style="height:60px"></textarea></div>
  `,'紐づける',async()=>{
    if(!checked.size){toast('衣装を選択してください');return;}
    const memo=document.getElementById('lcMemo').value;
    try{
      for(const cid of checked){
        await UsageAPI.add({演目id:S.curRep.id,衣装id:cid,メモ:memo});
      }
      toast(checked.size+'件を紐づけました');
      closeModal();
      S.usages=await UsageAPI.list({repertoireId:S.curRep.id});
      const idx=S.repertoires.findIndex(r=>r.id===S.curRep.id);
      if(idx>=0)S.repertoires[idx].衣装数=S.usages.length;
      renderRepDetail();
    }catch(e){toast('紐づけ失敗: '+e.message);}
  });

  const renderList=(q='')=>{
    const list=S.costumes.filter(c=>c.状態==='現役'&&(`${c.衣装ID}${c.衣装名}`.toLowerCase().includes(q.toLowerCase())));
    document.getElementById('lcList').innerHTML=list.map(c=>`
      <div class="sel-item ${checked.has(c.id)?'checked':''}" data-id="${c.id}">
        <div class="sel-check"><i class="ti ti-check"></i></div>
        <div class="sel-thumb">${c.メイン写真URL?`<img src="${esc(c.メイン写真URL)}" alt="">`:'<i class="ti ti-hanger"></i>'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--tx3)">${esc(c.衣装ID)}</div>
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.衣装名)||'（名称未設定）'}</div>
          <div style="font-size:10px;color:var(--tx2)"><i class="ti ti-map-pin" style="font-size:10px"></i> ${esc(c.保管場所)}</div>
        </div>
      </div>`).join('')||'<div style="padding:16px;text-align:center;font-size:12px;color:var(--tx3)">該当なし</div>';
    document.querySelectorAll('#lcList .sel-item').forEach(it=>{
      it.onclick=()=>{
        const id=it.dataset.id;
        if(checked.has(id)){checked.delete(id);it.classList.remove('checked');}
        else{checked.add(id);it.classList.add('checked');}
        document.getElementById('lcCount').textContent=checked.size+'件選択中';
      };
    });
  };
  renderList();
  document.getElementById('lcSearch').oninput=e=>renderList(e.target.value);
}

// ============================================================
//  紐づけモーダル（衣装詳細→演目選択）
// ============================================================
function openLinkRepModal(){
  const checked=new Set();
  openModalRaw('演目を選んで紐づける',`
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <select id="lrYear" style="flex:1;height:32px;font-size:12px;border:0.5px solid var(--br2);border-radius:var(--r-sm);font-family:inherit;background:var(--bg3)"><option value="">全年度</option></select>
      <select id="lrGarden" style="flex:1;height:32px;font-size:12px;border:0.5px solid var(--br2);border-radius:var(--r-sm);font-family:inherit;background:var(--bg3)">
        <option value="">全園</option>${GARDENS.map(g=>`<option>${g}</option>`).join('')}
      </select>
    </div>
    <div class="sel-list" id="lrList"></div>
    <div class="sel-bar"><span id="lrCount">0件選択中</span><span style="font-size:10px;opacity:.8">タップで選択</span></div>
    <div class="field" style="margin-top:10px;margin-bottom:0"><div class="field-label"><i class="ti ti-note"></i>この衣装の使い方メモ</div><textarea id="lrMemo" placeholder="役柄・使用色・注意事項など" style="height:60px"></textarea></div>
  `,'紐づける',async()=>{
    if(!checked.size){toast('演目を選択してください');return;}
    const memo=document.getElementById('lrMemo').value;
    try{
      for(const rid of checked){
        await UsageAPI.add({演目id:rid,衣装id:S.curCostume.id,メモ:memo});
      }
      toast(checked.size+'件を紐づけました');
      closeModal();
      S.curCostume=await CostumeAPI.get(S.curCostume.id);
      renderCostumeDetail();
    }catch(e){toast('紐づけ失敗: '+e.message);}
  });

  const years=[...new Set(S.repertoires.map(r=>r.年度))].sort((a,b)=>b-a);
  const ySel=document.getElementById('lrYear');
  years.forEach(y=>{const o=document.createElement('option');o.value=y;o.textContent=y+'年度';ySel.appendChild(o);});

  const renderList=()=>{
    const yv=document.getElementById('lrYear').value;
    const gv=document.getElementById('lrGarden').value;
    let list=S.repertoires;
    if(yv)list=list.filter(r=>String(r.年度)===String(yv));
    if(gv)list=list.filter(r=>String(r.園||'').indexOf(gv)>=0);
    document.getElementById('lrList').innerHTML=list.map(r=>`
      <div class="sel-item ${checked.has(r.id)?'checked':''}" data-id="${r.id}">
        <div class="sel-check"><i class="ti ti-check"></i></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;display:flex;gap:4px;align-items:center">${gBadge(r.園)}<span style="color:var(--tx3)">${esc(r.年度)}年度</span></div>
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${esc(r.演目名)}</div>
        </div>
      </div>`).join('')||'<div style="padding:16px;text-align:center;font-size:12px;color:var(--tx3)">該当なし</div>';
    document.querySelectorAll('#lrList .sel-item').forEach(it=>{
      it.onclick=()=>{
        const id=it.dataset.id;
        if(checked.has(id)){checked.delete(id);it.classList.remove('checked');}
        else{checked.add(id);it.classList.add('checked');}
        document.getElementById('lrCount').textContent=checked.size+'件選択中';
      };
    });
  };
  renderList();
  document.getElementById('lrYear').onchange=renderList;
  document.getElementById('lrGarden').onchange=renderList;
}

// ============================================================
//  メモ・役柄編集
// ============================================================
function openEditMemo(usageId,memo){
  openModal('メモを編集','edit-memo',`
    <div class="field" style="margin-bottom:0"><div class="field-label"><i class="ti ti-note"></i>使い方メモ</div><textarea id="emInput" style="height:100px">${esc(memo)}</textarea></div>
  `,'保存',async()=>{
    try{
      await UsageAPI.update({id:usageId,メモ:document.getElementById('emInput').value});
      closeModal();toast('保存しました');
      if(S.curCostume){S.curCostume=await CostumeAPI.get(S.curCostume.id);renderCostumeDetail();}
    }catch(e){toast('保存失敗: '+e.message);}
  });
}

function openEditUsage(usageId,role,memo){
  openModal('衣装の使い方を編集','edit-usage',`
    <div class="field"><div class="field-label"><i class="ti ti-user"></i>役柄</div><input id="euRole" value="${esc(role)}" placeholder="例：うさぎ"></div>
    <div class="field" style="margin-bottom:0"><div class="field-label"><i class="ti ti-note"></i>メモ</div><textarea id="euMemo" style="height:80px">${esc(memo)}</textarea></div>
  `,'保存',async()=>{
    try{
      await UsageAPI.update({id:usageId,役柄:document.getElementById('euRole').value,メモ:document.getElementById('euMemo').value});
      closeModal();toast('保存しました');
      S.usages=await UsageAPI.list({repertoireId:S.curRep.id});
      renderRepDetail();
    }catch(e){toast('保存失敗: '+e.message);}
  });
}

function confirmDeleteUsage(usageId){
  showConfirm('この紐づけを解除しますか？',async()=>{
    try{
      await UsageAPI.delete(usageId);
      S.usages=S.usages.filter(u=>u.id!==usageId);
      const idx=S.repertoires.findIndex(r=>r.id===S.curRep.id);
      if(idx>=0)S.repertoires[idx].衣装数=S.usages.length;
      toast('解除しました');renderRepDetail();
    }catch(e){toast('失敗: '+e.message);}
  });
}

// ============================================================
//  設定
// ============================================================
function renderSettings(){
  const body=document.getElementById('pageBody');
  body.innerHTML=`
    <div style="flex:1;overflow-y:auto;padding-bottom:20px">
      <div class="section"><div class="section-title"><i class="ti ti-building"></i>マイ園設定</div></div>
      <div class="card" style="padding:10px 12px">
        <div class="chip-grid" id="myGarden">
          ${GARDENS.map(g=>`<button class="chip ${S.myGarden===g?'on':''}" data-garden="${g}">${g}</button>`).join('')}
        </div>
      </div>
      <div class="section"><div class="section-title"><i class="ti ti-arrows-sort"></i>園の表示順</div></div>
      <div style="font-size:11px;color:var(--tx3);padding:0 12px 6px">マイ園が自動で先頭になります</div>
      <div style="padding:0 12px" id="orderList"></div>
      <div style="padding:12px"><button class="btn-primary" id="btnSaveSettings"><i class="ti ti-device-floppy"></i>設定を保存</button></div>
    </div>`;

  const renderOrder=()=>{
    const order=orderedGardens();
    document.getElementById('orderList').innerHTML=order.map((g,i)=>`
      <div class="order-item ${i===0?'mine':''}">
        <span class="drag-handle"><i class="ti ti-grip-vertical"></i></span>
        <span style="min-width:20px;font-size:11px;color:var(--tx3)">${i+1}</span>
        <span>${g}</span>
        ${i===0?'<span class="badge badge-active" style="margin-left:4px">マイ園</span>':''}
      </div>`).join('');
  };
  renderOrder();

  body.querySelectorAll('#myGarden .chip').forEach(b=>{
    b.onclick=()=>{
      body.querySelectorAll('#myGarden .chip').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');S.myGarden=b.dataset.garden;renderOrder();
    };
  });
  document.getElementById('btnSaveSettings').onclick=async()=>{
    try{
      await SettingAPI.set('myGarden',S.myGarden);
      await SettingAPI.set('gardenOrder',S.gardenOrder.join(','));
      toast('設定を保存しました');
    }catch(e){toast('保存失敗: '+e.message);}
  };
}

// ============================================================
//  モーダル共通
// ============================================================
function modalsHTML(){return '<div id="modalRoot"></div>';}

function openModal(title,id,bodyHTML,okLabel,onOk){
  openModalRaw(title,bodyHTML,okLabel,onOk);
}
function openModalRaw(title,bodyHTML,okLabel,onOk){
  const root=document.getElementById('modalRoot')||App;
  const ov=document.createElement('div');
  ov.className='modal-overlay';ov.id='activeModal';
  ov.innerHTML=`
    <div class="modal">
      <div class="modal-hdr"><span class="modal-title">${title}</span><button class="modal-close" id="mClose"><i class="ti ti-x"></i></button></div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-footer"><button class="btn-cancel" id="mCancel">キャンセル</button><button class="btn-ok" id="mOk"><i class="ti ti-check"></i>${okLabel}</button></div>
    </div>`;
  App.appendChild(ov);
  document.getElementById('mClose').onclick=closeModal;
  document.getElementById('mCancel').onclick=closeModal;
  document.getElementById('mOk').onclick=onOk;
}
function closeModal(){const m=document.getElementById('activeModal');if(m)m.remove();}

function showConfirm(msg,onYes){
  const ov=document.createElement('div');
  ov.className='modal-overlay';ov.id='activeModal';
  ov.innerHTML=`
    <div class="modal" style="border-radius:14px;max-width:300px;margin:auto">
      <div class="modal-body" style="padding:20px 18px;text-align:center;white-space:pre-line;font-size:14px">${esc(msg)}</div>
      <div class="modal-footer" style="border-top:none;padding-top:0"><button class="btn-cancel" style="flex:1" id="cNo">キャンセル</button><button class="btn-ok" style="background:var(--rd)" id="cYes">OK</button></div>
    </div>`;
  App.appendChild(ov);
  document.getElementById('cNo').onclick=closeModal;
  document.getElementById('cYes').onclick=()=>{closeModal();onYes();};
}

function selectHTML(id,options,value){
  return `<select id="${id}">${options.map(o=>`<option ${o===value?'selected':''}>${o}</option>`).join('')}</select>`;
}

// ============================================================
//  起動
// ============================================================
(async function(){
  render(); // ローディング表示
  await loadAll();
  render();
})();
