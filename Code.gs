// ============================================================
//  保育園 衣装管理アプリ — GAS バックエンド（クリーン版）
// ============================================================

const SHEET_ID = '1o68KDmvDwJ17cb1ggRY6stGr6PVBk8PSgk5zXLakeM4';
const PHOTO_FOLDER_NAME = '保育園衣装管理_写真';

const SH = {
  COSTUME   : '衣装マスター',
  PHOTO     : '写真管理',
  REPERTOIRE: '演目履歴',
  USAGE     : '衣装使用履歴',
  SETTING   : '設定',
  DECLARATION: '発表会使用表明',
  STAFF     : '職員名マスタ',
};

function doGet(e)  { return route(e, (e.parameter || {})); }
function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch(_) {}
  return route(e, body);
}

function route(e, raw) {
  const p = {};
  Object.keys(raw).forEach(k => {
    try { p[k] = JSON.parse(raw[k]); } catch(_) { p[k] = raw[k]; }
  });
  const action = p.action || '';
  try {
    let data;
    switch (action) {
      case 'getCostumes'     : data = getCostumes(p);     break;
      case 'getCostume'      : data = getCostume(p.id);   break;
      case 'addCostume'      : data = addCostume(p);      break;
      case 'updateCostume'   : data = updateCostume(p);   break;
      case 'deleteCostume'   : data = deleteCostume(p);   break;
      case 'getDeletedCostumes': data = getDeletedCostumes(); break;
      case 'restoreCostume'  : data = restoreCostume(p);  break;
      case 'addPhoto'        : data = addPhoto(p);        break;
      case 'updatePhoto'     : data = updatePhoto(p);     break;
      case 'deletePhoto'     : data = deletePhoto(p);     break;
      case 'getRepertoires'  : data = getRepertoires(p);  break;
      case 'getRepertoire'   : data = getRepertoire(p.id); break;
      case 'addRepertoire'   : data = addRepertoire(p);   break;
      case 'updateRepertoire': data = updateRepertoire(p);break;
      case 'deleteRepertoire': data = deleteRepertoire(p);break;
      case 'getUsages'       : data = getUsages(p);       break;
      case 'addUsage'        : data = addUsage(p);        break;
      case 'updateUsage'     : data = updateUsage(p);     break;
      case 'deleteUsage'     : data = deleteUsage(p);     break;
      case 'getSetting'      : data = getSetting(p.key);  break;
      case 'setSetting'      : data = setSetting(p);      break;
      case 'getAll'          : data = getAll(p);          break;
      case 'setup'           : data = setupSheets();      break;
      case 'getDeclarations' : data = getDeclarations(p); break;
      case 'addDeclaration'  : data = addDeclaration(p);  break;
      case 'deleteDeclaration': data = deleteDeclaration(p); break;
      case 'updateDeclaration': data = updateDeclaration(p); break;
      case 'getStaff'        : data = getStaff(p);        break;
      case 'addStaff'        : data = addStaff(p);        break;
      case 'deleteStaff'     : data = deleteStaff(p);     break;
      case 'repairIds'       : data = repairIds();        break;
      default: data = { error: 'unknown action: ' + action };
    }
    return json({ ok: true, data });
  } catch(err) {
    return json({ ok: false, error: err.message });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss()     { return SpreadsheetApp.openById(SHEET_ID); }
function sh(name) { return ss().getSheetByName(name); }

function sheetToObjects(name) {
  const sheet = sh(name);
  const values = sheet.getDataRange().getValues();
  if(values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(r => String(r[0]) !== '')
    .map(r => { const o={}; headers.forEach((h,i)=>o[h]=r[i]); return o; });
}

function appendRow(name, obj) {
  const sheet   = sh(name);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  obj.id       = obj.id || Utilities.getUuid().split('-')[0];
  obj.作成日時  = obj.作成日時 || new Date().toISOString();
  obj.更新日時  = new Date().toISOString();
  sheet.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''));
  return obj.id;
}

function updateRow(name, id, obj) {
  const sheet   = sh(name);
  const values  = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol   = headers.indexOf('id');
  for(let i=1; i<values.length; i++) {
    if(String(values[i][idCol]) === String(id)) {
      obj.更新日時 = new Date().toISOString();
      headers.forEach((h,j)=>{ if(obj[h]!==undefined) sheet.getRange(i+1,j+1).setValue(obj[h]); });
      return true;
    }
  }
  return false;
}

function softDelete(name, id) {
  const sheet   = sh(name);
  const values  = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol   = headers.indexOf('id');
  const delCol  = headers.indexOf('削除フラグ');
  for(let i=1; i<values.length; i++) {
    if(String(values[i][idCol]) === String(id)) {
      sheet.getRange(i+1, delCol+1).setValue('1');
      return true;
    }
  }
  return false;
}

// ============================================================
//  初期一括取得（リハーサル日対応）
// ============================================================
function getAll(p) {
  const spreadsheet = ss();
  function fastSheet(name) {
    const sheet = spreadsheet.getSheetByName(name);
    const values = sheet.getDataRange().getValues();
    if(values.length < 2) return [];
    const headers = values[0];
    return values.slice(1)
      .filter(r => String(r[0])!=='' && String(r[headers.indexOf('削除フラグ')]||'')!=='1')
      .map(r => { const o={}; headers.forEach((h,i)=>o[h]=r[i]); return o; });
  }

  const costumes = fastSheet(SH.COSTUME);
  const photos   = fastSheet(SH.PHOTO);
  const reps     = fastSheet(SH.REPERTOIRE);
  const usages   = fastSheet(SH.USAGE);
  const settings = {};
  fastSheet(SH.SETTING).forEach(r => settings[r['キー']] = r['値']);

  const photoMap={}, repPhotoMap={};
  photos.forEach(ph => {
    if(ph.衣装id){ if(!photoMap[ph.衣装id]) photoMap[ph.衣装id]=[]; photoMap[ph.衣装id].push(ph); }
    if(ph.演目id){ if(!repPhotoMap[ph.演目id]) repPhotoMap[ph.演目id]=[]; repPhotoMap[ph.演目id].push(ph); }
  });
  const usageCountMap={};
  usages.forEach(u=>{ usageCountMap[u.演目id]=(usageCountMap[u.演目id]||0)+1; });

  costumes.forEach(c => {
    const cp=photoMap[c.id]||[];
    const main=cp.find(ph=>ph['種別']==='メイン')||cp[0];
    c.メイン写真URL=main?main.URL:''; c.写真枚数=cp.length;
  });
  reps.forEach(r => {
    r.衣装数=usageCountMap[r.id]||0;
    const rp=repPhotoMap[r.id]||[];
    const rmain=rp.find(ph=>ph['種別']==='メイン')||rp[0];
    r.メイン写真URL=rmain?rmain.URL:'';
  });

  const declarationSheet=spreadsheet.getSheetByName(SH.DECLARATION);
  let declarations=[];
  if(declarationSheet){
    const dvals=declarationSheet.getDataRange().getValues();
    if(dvals.length>=2){
      const dh=dvals[0];
      declarations=dvals.slice(1)
        .filter(r=>String(r[0])!==''&&String(r[dh.indexOf('取消フラグ')]||'')!=='1')
        .map(r=>{const o={}; dh.forEach((h,i)=>o[h]=r[i]); return o;});
    }
  }

  // 発表会日設定
  const happiouDates={};
  ['西新','原','たの津','ちくし野'].forEach(g=>{
    happiouDates[g]=settings['happyouDate_'+g]||'';
  });

  // リハーサル日設定（複数日・JSON配列）
  const rehearsalDates={'西新':[],'原':[],'たの津':[],'ちくし野':[]};
  ['西新','原','たの津','ちくし野'].forEach(g=>{
    const val=settings['rehearsalDates_'+g];
    if(val){ try{ rehearsalDates[g]=JSON.parse(val); }catch(e){} }
  });

  // 職員名マスタ
  const staffMap={'西新':[],'原':[],'たの津':[],'ちくし野':[]};
  const staffSheet=spreadsheet.getSheetByName(SH.STAFF);
  if(staffSheet){
    const svals=staffSheet.getDataRange().getValues();
    if(svals.length>=2){
      const sh2=svals[0];
      svals.slice(1)
        .filter(r=>String(r[0])!==''&&String(r[sh2.indexOf('削除フラグ')]||'')!=='1')
        .forEach(r=>{
          const o={}; sh2.forEach((h,i)=>o[h]=r[i]);
          if(staffMap[o.園]!==undefined) staffMap[o.園].push({id:o.id,職員名:o.職員名});
        });
    }
  }

  return { costumes, photos, repertoires:reps, usages, settings, declarations, happiouDates, rehearsalDates, staffMap };
}

// ============================================================
//  衣装
// ============================================================
const CAT_CODE={'オールインワン':'A','パンツ':'P','トップス':'T','スカート':'S','頭飾り':'H','その他':'O'};

function getCostumes(p){
  let list=sheetToObjects(SH.COSTUME).filter(r=>r.削除フラグ!=='1');
  if(p.status)   list=list.filter(r=>r.状態===p.status);
  if(p.category) list=list.filter(r=>r.カテゴリー===p.category);
  const photos=sheetToObjects(SH.PHOTO).filter(r=>r.削除フラグ!=='1');
  list.forEach(c=>{
    const cp=photos.filter(ph=>ph.衣装id===c.id);
    const main=cp.find(ph=>ph.種別==='メイン')||cp[0];
    c.メイン写真URL=main?main.URL:''; c.写真枚数=cp.length;
  });
  return list;
}

function getCostume(id){
  const c=sheetToObjects(SH.COSTUME).find(r=>r.id===id);
  if(!c) throw new Error('衣装が見つかりません');
  c.写真=sheetToObjects(SH.PHOTO).filter(r=>r.衣装id===id&&r.削除フラグ!=='1').sort((a,b)=>(a.順番||0)-(b.順番||0));
  const usages=sheetToObjects(SH.USAGE).filter(r=>r.衣装id===id&&r.削除フラグ!=='1');
  const reps=sheetToObjects(SH.REPERTOIRE);
  c.使用履歴=usages.map(u=>{const r=reps.find(x=>x.id===u.演目id)||{};return{...u,演目名:r.演目名,園:r.園,年度:r.年度,クラス:r.クラス};}).sort((a,b)=>(b.年度||0)-(a.年度||0));
  return c;
}

function addCostume(p){
  const code=CAT_CODE[p.カテゴリー]||'O';
  const same=sheetToObjects(SH.COSTUME).filter(r=>r.カテゴリー===p.カテゴリー);
  const maxN=same.reduce((m,r)=>Math.max(m,parseInt(String(r.衣装ID||'').slice(1))||0),0);
  p.衣装ID=code+String(maxN+1).padStart(3,'0'); p.削除フラグ='';
  const id=appendRow(SH.COSTUME,p); return{id,衣装ID:p.衣装ID};
}
function updateCostume(p){ updateRow(SH.COSTUME,p.id,p); return{id:p.id}; }
function getDeletedCostumes(){ return sheetToObjects(SH.COSTUME).filter(r=>String(r.削除フラグ)==='1').map(r=>({id:r.id,衣装ID:r.衣装ID,カテゴリー:r.カテゴリー,衣装名:r.衣装名,保管場所:r.保管場所,状態:r.状態})); }
function restoreCostume(p){ updateRow(SH.COSTUME,p.id,{削除フラグ:''}); return{ok:true}; }
function deleteCostume(p){ softDelete(SH.COSTUME,p.id); sheetToObjects(SH.PHOTO).filter(r=>r.衣装id===p.id).forEach(ph=>softDelete(SH.PHOTO,ph.id)); return{ok:true}; }

// ============================================================
//  写真
// ============================================================
function addPhoto(p){
  const folder=getPhotoFolder();
  let b64=p.base64||''; if(b64.indexOf(',')>=0) b64=b64.split(',')[1];
  const blob=Utilities.newBlob(Utilities.base64Decode(b64),p.mimeType||'image/jpeg',p.fileName||('photo_'+Date.now()+'.jpg'));
  const file=folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  const fileId=file.getId();
  const url='https://lh3.googleusercontent.com/d/'+fileId+'=s1280';
  const photoId=appendRow(SH.PHOTO,{衣装id:p.衣装id||'',演目id:p.演目id||'',fileId,URL:url,種別:p.種別||'メイン',アングル名:p.アングル名||'',順番:p.順番||1,削除フラグ:''});
  return{photoId,url,fileId};
}
function updatePhoto(p){ updateRow(SH.PHOTO,p.id,p); return{ok:true}; }
function deletePhoto(p){ const photo=sheetToObjects(SH.PHOTO).find(r=>r.id===p.id); if(photo&&photo.fileId){try{DriveApp.getFileById(photo.fileId).setTrashed(true);}catch(e){}} softDelete(SH.PHOTO,p.id); return{ok:true}; }
function getPhotoFolder(){ const saved=getSetting('photoFolderId'); if(saved){try{return DriveApp.getFolderById(saved);}catch(e){}} const folder=DriveApp.createFolder(PHOTO_FOLDER_NAME); setSetting({key:'photoFolderId',value:folder.getId()}); return folder; }

// ============================================================
//  演目
// ============================================================
function getRepertoire(id){ const r=sheetToObjects(SH.REPERTOIRE).find(x=>x.id===id); if(!r)throw new Error('演目が見つかりません'); r.写真=sheetToObjects(SH.PHOTO).filter(ph=>ph.演目id===id&&ph.削除フラグ!=='1').sort((a,b)=>(a.順番||0)-(b.順番||0)); return r; }
function getRepertoires(p){ let list=sheetToObjects(SH.REPERTOIRE).filter(r=>r.削除フラグ!=='1'); if(p.year)list=list.filter(r=>String(r.年度)===String(p.year)); if(p.garden)list=list.filter(r=>String(r.園||'').indexOf(p.garden)>=0); const usages=sheetToObjects(SH.USAGE).filter(r=>r.削除フラグ!=='1'); list.forEach(r=>r.衣装数=usages.filter(u=>u.演目id===r.id).length); return list.sort((a,b)=>(b.年度||0)-(a.年度||0)); }
function addRepertoire(p){ p.削除フラグ=''; const id=appendRow(SH.REPERTOIRE,p); return{id}; }
function updateRepertoire(p){ updateRow(SH.REPERTOIRE,p.id,p); return{id:p.id}; }
function deleteRepertoire(p){ softDelete(SH.REPERTOIRE,p.id); sheetToObjects(SH.USAGE).filter(r=>r.演目id===p.id).forEach(u=>softDelete(SH.USAGE,u.id)); sheetToObjects(SH.PHOTO).filter(r=>r.演目id===p.id).forEach(ph=>{try{if(ph.fileId)DriveApp.getFileById(ph.fileId).setTrashed(true);}catch(e){} softDelete(SH.PHOTO,ph.id);}); return{ok:true}; }

// ============================================================
//  衣装使用履歴
// ============================================================
function getUsages(p){ let list=sheetToObjects(SH.USAGE).filter(r=>r.削除フラグ!=='1'); if(p.repertoireId)list=list.filter(r=>r.演目id===p.repertoireId); if(p.costumeId)list=list.filter(r=>r.衣装id===p.costumeId); const costumes=sheetToObjects(SH.COSTUME),reps=sheetToObjects(SH.REPERTOIRE),photos=sheetToObjects(SH.PHOTO).filter(r=>r.削除フラグ!=='1'); list.forEach(u=>{const c=costumes.find(x=>x.id===u.衣装id)||{}; u.衣装ID_表示=c.衣装ID||''; u.衣装名=c.衣装名||''; const main=photos.find(ph=>ph.衣装id===u.衣装id&&ph.種別==='メイン')||photos.find(ph=>ph.衣装id===u.衣装id); u.写真URL=main?main.URL:''; const r=reps.find(x=>x.id===u.演目id)||{}; u.演目名=r.演目名||''; u.園=r.園||''; u.年度=r.年度||'';}); return list; }
function addUsage(p){ p.削除フラグ=''; const id=appendRow(SH.USAGE,p); return{id}; }
function updateUsage(p){ updateRow(SH.USAGE,p.id,p); return{id:p.id}; }
function deleteUsage(p){ softDelete(SH.USAGE,p.id); return{ok:true}; }

// ============================================================
//  設定
// ============================================================
function getSetting(key){ const list=sheetToObjects(SH.SETTING); if(key){const r=list.find(x=>x.キー===key); return r?r.値:null;} const o={}; list.forEach(r=>o[r.キー]=r.値); return o; }
function setSetting(p){
  const sheet=sh(SH.SETTING),values=sheet.getDataRange().getValues(),headers=values[0],kCol=headers.indexOf('キー'),vCol=headers.indexOf('値');
  // valueはJSON.parseされている場合があるので、配列・オブジェクトはJSON.stringifyで戻す
  const val=typeof p.value==='string'?p.value:JSON.stringify(p.value);
  for(let i=1;i<values.length;i++){if(values[i][kCol]===p.key){sheet.getRange(i+1,vCol+1).setValue(val);return{ok:true};}}
  sheet.appendRow([p.key,val,new Date().toISOString()]);
  return{ok:true};
}

// ============================================================
//  職員名マスタ
// ============================================================
function getStaff(p){ const list=sheetToObjects(SH.STAFF).filter(r=>String(r.削除フラグ)!=='1'); if(p&&p.園)return list.filter(r=>r.園===p.園).map(r=>r.職員名); const map={'西新':[],'原':[],'たの津':[],'ちくし野':[]}; list.forEach(r=>{if(map[r.園]!==undefined)map[r.園].push(r.職員名);}); return map; }
function addStaff(p){ const existing=sheetToObjects(SH.STAFF).find(r=>r.園===p.園&&r.職員名===p.職員名&&String(r.削除フラグ)!=='1'); if(existing)return{id:existing.id,duplicate:true}; const id=appendRow(SH.STAFF,{園:p.園,職員名:p.職員名,削除フラグ:''}); return{id}; }
function deleteStaff(p){ softDelete(SH.STAFF,p.id); return{ok:true}; }

// ============================================================
//  発表会使用表明
// ============================================================
function getDeclarations(p){ let list=sheetToObjects(SH.DECLARATION).filter(r=>String(r.取消フラグ)!=='1'); if(p&&p.年度)list=list.filter(r=>String(r.年度)===String(p.年度)); return list; }
function addDeclaration(p){ const existing=sheetToObjects(SH.DECLARATION).find(r=>String(r.年度)===String(p.年度)&&r.衣装id===p.衣装id&&r.園===p.園&&String(r.取消フラグ)!=='1'); if(existing)updateRow(SH.DECLARATION,existing.id,{取消フラグ:'1'}); const id=appendRow(SH.DECLARATION,{年度:p.年度,衣装id:p.衣装id,園:p.園,担当者:p.担当者||'',備考:p.備考||'',表明日時:new Date().toISOString(),取消フラグ:''}); return{id}; }
function updateDeclaration(p){ updateRow(SH.DECLARATION,p.id,{担当者:p.担当者}); return{ok:true}; }
function deleteDeclaration(p){ updateRow(SH.DECLARATION,p.id,{取消フラグ:'1'}); return{ok:true}; }

// ============================================================
//  初期セットアップ
// ============================================================
// ============================================================
//  データ修復（壊れたIDを自動修正）
// ============================================================
function repairIds(){
  const ss2=ss();
  const costumeSheet=ss2.getSheetByName(SH.COSTUME);
  const photoSheet=ss2.getSheetByName(SH.PHOTO);

  const costumeValues=costumeSheet.getDataRange().getValues();
  const costumeHeaders=costumeValues[0];
  const idCol=0; // A列

  const details=[];
  let fixed=0;

  for(let i=1;i<costumeValues.length;i++){
    const row=costumeValues[i];
    const id=row[idCol];
    // idが数値または8文字未満の場合は壊れていると判断
    if(typeof id==='number'||String(id).length<6||String(id).match(/^\d+$/)){
      const oldId=String(id);
      // 新しいidを生成（8文字英数字）
      const newId=Utilities.getUuid().replace(/-/g,'').slice(0,8);

      // 衣装マスターのidを更新
      costumeSheet.getRange(i+1,1).setValue(newId);

      // 衣装ID・名前を取得
      const 衣装IDCol=costumeHeaders.indexOf('衣装ID');
      const 衣装名Col=costumeHeaders.indexOf('衣装名');

      // 写真管理シートの衣装idも更新
      const photoValues=photoSheet.getDataRange().getValues();
      const photoHeaders=photoValues[0];
      const photoIdCol=photoHeaders.indexOf('衣装id');
      let photoCount=0;
      for(let j=1;j<photoValues.length;j++){
        const photoId=String(photoValues[j][photoIdCol]);
        if(photoId===oldId){
          photoSheet.getRange(j+1,photoIdCol+1).setValue(newId);
          photoCount++;
        }
      }

      details.push({
        oldId,newId,
        衣装ID:String(row[衣装IDCol]||''),
        衣装名:String(row[衣装名Col]||''),
        photos:photoCount
      });
      fixed++;
    }
  }

  return{fixed,details};
}

function setupSheets(){
  const spreadsheet=ss();
  const schemas=[
    {name:SH.COSTUME,    headers:['id','衣装ID','カテゴリー','衣装名','個数','製作園','保管場所','移動先','状態','対象年齢','メモ','作成日時','更新日時','削除フラグ']},
    {name:SH.PHOTO,      headers:['id','衣装id','演目id','fileId','URL','種別','アングル名','順番','作成日時','更新日時','削除フラグ']},
    {name:SH.REPERTOIRE, headers:['id','演目名','種別','クラス','年度','園','備考','作成日時','更新日時','削除フラグ']},
    {name:SH.USAGE,      headers:['id','演目id','衣装id','役柄','メモ','作成日時','更新日時','削除フラグ']},
    {name:SH.SETTING,    headers:['キー','値','更新日時']},
    {name:SH.DECLARATION,headers:['id','年度','衣装id','園','担当者','備考','表明日時','取消フラグ']},
    {name:SH.STAFF,      headers:['id','園','職員名','作成日時','更新日時','削除フラグ']},
  ];
  schemas.forEach(({name,headers})=>{
    let sheet=spreadsheet.getSheetByName(name);
    if(!sheet)sheet=spreadsheet.insertSheet(name);
    if(sheet.getRange(1,1).getValue()===''){
      sheet.getRange(1,1,1,headers.length).setValues([headers]);
      sheet.getRange(1,1,1,headers.length).setBackground('#1a5c38').setFontColor('#fff').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });
  const settingSheet=spreadsheet.getSheetByName(SH.SETTING);
  const existing=settingSheet.getDataRange().getValues().map(r=>r[0]);
  [['myGarden','西新'],['gardenOrder','西新,原,たの津,ちくし野']].forEach(([k,v])=>{
    if(existing.indexOf(k)<0)settingSheet.appendRow([k,v,new Date().toISOString()]);
  });
  return{ok:true,message:'セットアップ完了'};
}
