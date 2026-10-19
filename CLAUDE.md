# 保育園 衣装管理アプリ — 開発引き継ぎドキュメント

## プロジェクト概要

4園（西新・原・たの津・ちくし野）のスタッフが使う衣装管理アプリ。
発表会・リハーサル向けの衣装の在庫管理、写真管理、使用表明、日程管理を行う。

- **リポジトリ**: `tanotu0036/costume-app`
- **本番URL**: https://tanotu0036.github.io/costume-app/
- **GAS URL**: https://script.google.com/macros/s/AKfycbycOrtQcmN3JOt9dgF83ynGAk7oq0JozMzfvBPxbkoHn2Yo_uNNujKwyipLIX71BKrH/exec
- **スプレッドシートID**: `1o68KDmvDwJ17cb1ggRY6stGr6PVBk8PSgk5zXLakeM4`

---

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `index.html` | HTML + CSS（スタイル定義すべて含む） |
| `app.js` | フロントエンドロジック（2500行超） |
| `api.js` | GAS APIクライアント（`API_URL`, `api()`, `apiPost()`, `CostumeAPI` 等） |
| `Code.gs` | GASバックエンド（Google Apps Scriptにコピペして使う）※リポジトリには未収録 |

> `index.html` が `api.js` → `app.js` の順にキャッシュバスター付きで読み込む

---

## アーキテクチャ

```
GitHub Pages (index.html + app.js)
        ↕ GET/POST fetch
Google Apps Script (Code.gs) — Web App としてデプロイ
        ↕
Google Sheets（各シート）
```

### スプレッドシートのシート構成

| シート名 | 主な列 |
|---------|--------|
| 衣装マスター | id, 衣装ID, カテゴリー, 衣装名, 個数, 製作園, 保管場所, 移動先, 状態, 対象年齢, メモ, 作成日時, 更新日時, 削除フラグ |
| 写真管理 | id, 衣装id, 演目id, fileId, URL, 種別, アングル名, 順番, 作成日時, 更新日時, 削除フラグ |
| 演目履歴 | id, 演目名, 種別, クラス, 年度, 園, 備考, 作成日時, 更新日時, 削除フラグ |
| 衣装使用履歴 | id, 演目id, 衣装id, 役柄, メモ, 作成日時, 更新日時, 削除フラグ |
| 設定 | キー, 値, 更新日時 |
| 発表会使用表明 | id, 年度, 衣装id, 園, 担当者, 備考, 表明日時, 取消フラグ |
| 職員名マスタ | id, 園, 職員名, 作成日時, 更新日時, 削除フラグ |

---

## app.js の主要構造

### グローバル状態オブジェクト `S`
```js
const S = {
  // データ
  costumes, photos, repertoires, usages,
  declarations, happiouDates, rehearsalDates, staffMap,
  // 端末設定（localStorage）
  gardenOrder,   // 表示順（例: ['西新','原','たの津','ちくし野']）
  myGarden,      // このデバイスの園名
  // ルーティング
  nav,           // 現在のページ名
  stack,         // 戻れるページのスタック
  // 使用予定タブのフィルター状態
  scheduleYear, scheduleGarden, scheduleConflictOnly,
  // その他
  loaded, listMode,
}
```

### 画面ルーティング
- `render()` → `shellHTML()` + 各ページ描画関数
- `pushPage(name)` / `goBack()` でスタック管理
- ページ一覧: `costumes`（衣装一覧）, `repertoires`（演目一覧）, `schedules`（使用予定）, `settings`（設定）, `costume-detail`, `costume-add`, `rep-detail`, `rep-add`

### GAS通信
（いずれも `api.js` に定義）
- `api(action, params)` — GET（データ取得・更新）
- `apiPost(action, body)` — POST（JSON配列含むデータ送信）
- **重要**: JSON配列はGETのURLパラメータで壊れるため、`apiPost` を使う

### データロード
1. 起動時: `loadAll()` → localStorageキャッシュ確認（30分有効）→ 古ければ GAS `getAll` で全取得
2. `saveCache()` でlocalStorageに保存（`rehearsalDates` も必ず含める）

---

## GAS（Code.gs）の主要関数

| 関数 | 概要 |
|------|------|
| `doGet(e)` / `doPost(e)` | エントリーポイント → `route()` に委譲 |
| `getAll(p)` | 衣装・写真・演目・設定・表明・リハーサル日・職員名マスタを一括返却 |
| `addCostume(p)` | 衣装追加（衣装IDを自動採番: カテゴリーコード+3桁連番） |
| `setSetting(p)` | 設定保存（配列はJSON.stringifyして保存） |
| `addDeclaration(p)` | 使用表明追加（同一条件の既存表明は取消後に新規追加） |
| `repairIds()` | 壊れたID（数値化されたもの）をUUIDで修復 |

**デプロイ注意**: コード変更後は必ず「新しいバージョン」で再デプロイ。「既存を上書き」では反映されない。

---

## 主要機能一覧

### 衣装管理
- 衣装一覧（グリッド/リスト切替）、カテゴリー・年齢・状態フィルター
- 衣装詳細: 写真スワイプ / 移動先インライン変更 / 使用表明
- 衣装詳細の表示順序: **保管・状態 → 使用予定 → 基本情報**
- 衣装登録・編集・削除・復活

### 演目管理
- 演目一覧（年度・園別フィルター）
- 演目詳細（使用衣装の紐付け・解除）

### 使用予定タブ（schedules ページ）
- **ヘッダー3行構成**: 保育園 / 発表会日 / リハーサル期間
- 発表会開催日順に列を並び替え（`gardensByHappiouDate()` 関数）
- 衣装×園のマトリクス表示
- **競合アラート3種**: ①衣装競合（複数園が同一衣装使用表明）②発表会日重複③リハーサル日重複
- 「競合のみ表示」フィルター（`S.scheduleConflictOnly`）
- 移動先プルダウン（インライン変更可能）
- 担当者名（使用表明者）表示・編集
- 備考欄（全部使用 / 一部使用+詳細）

### 使用表明フロー
- 「全部使用」「一部使用」選択（一部は備考欄必須表示）
- 職員名マスタからのチップ選択UI
- 直接入力した名前はマスタに自動追加
- 二重タップ防止（ボタン即時disabled化）

### 設定タブ
- マイ園設定・表示順（端末ごとにlocalStorage保存）
- 発表会日設定（園ごと）
- リハーサル日設定: 個別追加 または 範囲指定（最大60日、連続日は「8/25〜8/30」形式に自動まとめ）
- 職員名マスタ管理（GAS経由で全端末共有）
- データ修復ボタン（壊れたIDの自動修正）

---

## デザイン

- **テーマカラー**: セージグリーン(`#6A8F6A`) × テラコッタ(`#D85A30`)
- **背景**: クラフトペーパー(`#F0EDE4`)
- **フォント**: Noto Sans JP
- **レスポンシブ**: 700px以上でPC向けレイアウト（`@media (min-width:700px)`）
- **ちくし野**: 3文字なので `transform: scale(0.75)` で縮小表示

---

## 既知の問題・注意事項

### ブラウザ複数アカウントログイン問題
- GAS Web AppのURLが404になる
- **対処**: シークレットウィンドウで使用

### iOS Safari の罫線問題
- `border-collapse: collapse` + `border` はiOS Safariで罫線が消える
- **対処**: `border-collapse: separate; border-spacing: 0` + セルごとに個別border指定

### JSON配列のGET問題
- URLパラメータのエンコードでJSON配列が壊れる
- **対処**: `apiPost` を使う（POSTでCORSプリフライト回避のためtext/plain送信）

### スプレッドシートのID数値化
- 通信不安定時にidが `2.98E+12` 等の数値として保存される
- **対処**: 設定タブ→「データを修復する」ボタンで自動修正

### リハーサル日の消滅（旧バグ・修正済み）
- 以前は起動時にlocalStorageを強制削除していたためリハーサル日が消えた
- 修正済み: 起動時のキャッシュ強制削除を廃止

---

## デプロイ手順

1. `app.js` / `index.html` を修正
2. GitHubリポジトリ（`tanotu0036/costume-app`）にアップロード
3. GitHub Pagesが自動デプロイ（1〜5分で反映）
4. GAS変更がある場合: `Code.gs` の内容をコピペして「新しいバージョン」で再デプロイ

---

## 開発スタイル・好み

- バニラJS（フレームワークなし）、スタイルはindex.html内のみ
- モバイルファースト（iOS Safari優先）、PC対応は700pxブレークポイント
- UI文言はすべて日本語
- 修正は差分（変更箇所のみ）で提示する
- テスト方法: 本番環境で直接確認
