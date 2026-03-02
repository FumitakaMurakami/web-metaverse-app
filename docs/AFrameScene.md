# AFrameScene.tsx ソース解説

`src/components/metaverse/AFrameScene.tsx`

メタバース空間の3Dシーン・UI・ネットワーク同期・音声通話・オブジェクト設置・物理エンジンを担うメインコンポーネント。

---

## 目次

1. [全体構成](#1-全体構成)
2. [Props とインターフェース](#2-props-とインターフェース)
3. [定数定義](#3-定数定義)
4. [State 管理](#4-state-管理)
5. [コールバック関数](#5-コールバック関数)
6. [useEffect（副作用）](#6-useeffect副作用)
7. [A-Frame カスタムコンポーネント](#7-a-frame-カスタムコンポーネント)
8. [3D シーンの構築](#8-3d-シーンの構築)
9. [NAF 接続とスキーマ登録](#9-naf-接続とスキーマ登録)
10. [JSX（UI レイヤー）](#10-jsxui-レイヤー)
11. [処理フロー図](#11-処理フロー図)
12. [物理エンジン（Physics）](#12-物理エンジンphysics)
13. [ネットワーク同期](#13-ネットワーク同期)

---

## 1. 全体構成

```
AFrameScene.tsx
├── 定数（AVATAR_COLORS, SIZE_MAP）
├── React コンポーネント
│   ├── State 宣言（設定、音声、オブジェクト設置、物理エンジン）
│   ├── コールバック関数（音声操作、設置操作）
│   ├── useEffect 群
│   │   ├── アバター設定反映
│   │   ├── Ref ミラー同期（displayName, avatarColor, physicsEnabled, clickableEnabled）
│   │   ├── Three.js プレビュー描画
│   │   ├── プレビューレンダラー破棄
│   │   ├── 設置モードイベント管理（+ 物理 / クリック判定 / ネットワーク broadcast）
│   │   └── メイン初期化（A-Frame/NAF/シーン構築/物理エンジン/ネットワークハンドラ）
│   └── JSX（UI オーバーレイ + シーンコンテナ）

PhysicsWorld.ts（ヘルパークラス）
├── cannon-es ラッパー
├── addBody / removeBody / applyImpulse / step / getBodyState / destroy
└── createGround
```

ファイル冒頭で `"use client"` を宣言し、クライアントサイドでのみ動作する。A-Frame と Networked-A-Frame はブラウザ専用ライブラリのため、動的インポート（`await import("aframe")`）で読み込む。

---

## 2. Props とインターフェース

```typescript
interface AFrameSceneProps {
  roomCode: string;      // NAF のルーム識別子
  nafServerUrl: string;  // シグナリングサーバーの URL
  userName?: string;     // ログインユーザーの表示名
}
```

親コンポーネント（`/metaverse/[sessionId]/page.tsx`）から渡される。`roomCode` は NAF の `networked-scene` の `room` パラメータに使われる。

---

## 3. 定数定義

### AVATAR_COLORS（L12-25）

12色のプリセットカラー配列。アバター設定パネルとオブジェクト設置ダイアログの両方で使用。

### SIZE_MAP（L27-31）

オブジェクト設置機能で使うサイズ定義。形状（box / sphere / cylinder）ごとに small / medium / large の3段階。

```typescript
const SIZE_MAP = {
  small:  { box: { w: 0.3, h: 0.3, d: 0.3 }, sphere: { r: 0.15 }, cylinder: { r: 0.15, h: 0.3 } },
  medium: { box: { w: 0.7, h: 0.7, d: 0.7 }, sphere: { r: 0.35 }, cylinder: { r: 0.25, h: 0.7 } },
  large:  { box: { w: 1.2, h: 1.2, d: 1.2 }, sphere: { r: 0.6  }, cylinder: { r: 0.4,  h: 1.2 } },
};
```

---

## 4. State 管理

### 基本状態

| State | 型 | 用途 |
|---|---|---|
| `ready` | `boolean` | シーン初期化完了フラグ。ローディング表示の制御に使用 |
| `userCount` | `number` | 接続中のユーザー数（2秒間隔でポーリング） |

### アバター設定

| State | 型 | 用途 |
|---|---|---|
| `settingsOpen` | `boolean` | 設定パネルの開閉 |
| `displayName` | `string` | プレイヤーの表示名 |
| `avatarColor` | `string` | アバターのカラーコード |

`displayNameRef` / `avatarColorRef` は A-Frame の `init()` クロージャ内からアクセスするための Ref ミラー。React の State は A-Frame のライフサイクルからは直接参照できないため、Ref 経由で最新値を取得する。

### 音声チャット

| State | 型 | 用途 |
|---|---|---|
| `voiceJoined` | `boolean` | 音声チャット参加済みか |
| `isMicMuted` | `boolean` | マイクミュート状態 |
| `isAudioMuted` | `boolean` | スピーカーミュート状態 |

`voiceChatRef` で `VoiceChat` クラスのインスタンスを保持。

### オブジェクト設置

| State | 型 | 用途 |
|---|---|---|
| `itemDialogOpen` | `boolean` | 設置ダイアログの開閉 |
| `placementMode` | `boolean` | 設置モード中かどうか |
| `objectShape` | `'box' \| 'sphere' \| 'cylinder'` | 選択中の形状 |
| `objectColor` | `string` | 選択中のカラー |
| `objectSize` | `'small' \| 'medium' \| 'large'` | 選択中のサイズ |

| Ref | 用途 |
|---|---|
| `previewCanvasRef` | プレビュー用 Canvas 要素 |
| `previewRendererRef` | Three.js WebGLRenderer インスタンス |
| `previewAnimFrameRef` | requestAnimationFrame の ID（クリーンアップ用） |
| `placedObjectCountRef` | 設置済みオブジェクト数（ID 生成用カウンタ） |

### 物理エンジン・クリック判定

| State | 型 | 用途 |
|---|---|---|
| `physicsEnabled` | `boolean` | 物理エンジンオプションの ON/OFF |
| `clickableEnabled` | `boolean` | クリック判定オプションの ON/OFF（physicsEnabled 依存） |

| Ref | 用途 |
|---|---|
| `physicsEnabledRef` | A-Frame クロージャ内からアクセスする Ref ミラー |
| `clickableEnabledRef` | A-Frame クロージャ内からアクセスする Ref ミラー |
| `physicsWorldRef` | `PhysicsWorld` クラスインスタンス（cannon-es ラッパー） |

---

## 5. コールバック関数

### applyAvatarSettings（L80-94）

`displayName` / `avatarColor` の変更をライブシーンの `#rig` エンティティに反映する。`player-info` コンポーネントの属性を更新し、NAF 経由で他プレイヤーにも同期される。

### handleJoinVoice（L104-117）

`VoiceChat.enable()` を呼びマイクアクセスを要求。成功で `voiceJoined = true`、失敗でアラート表示。

### handleMicToggle / handleAudioToggle（L120-133）

マイク・スピーカーのミュートトグル。`VoiceChat` クラスのメソッドを呼び、返り値で State を更新。

### handleStartPlacement（L136-165）

「設置」ボタン押下時の処理:

1. ダイアログを閉じる
2. `window.__placementModeActive = true` を設定（fps-controls のポインターロック再取得を無効化）
3. Canvas にポインターロックを要求（カメラ操作を可能にする）
4. A-Frame シーンに `object-placer` コンポーネントを設定

---

## 6. useEffect（副作用）

### アバター設定の反映（L97-101）

`displayName` / `avatarColor` が変化したとき、`applyAvatarSettings` を呼び出す。

### Three.js プレビュー描画（L168-233）

依存: `itemDialogOpen`, `objectShape`, `objectColor`, `objectSize`

ダイアログが開いている間、プレビュー Canvas に Three.js でオブジェクトを描画する。

- `WebGLRenderer` を Canvas に紐づけて生成
- `PerspectiveCamera` を斜め上から配置（3/4 ビュー）
- `AmbientLight` + `DirectionalLight` でライティング
- `SIZE_MAP` に基づいて `BoxGeometry` / `SphereGeometry` / `CylinderGeometry` を生成
- `MeshStandardMaterial` で選択色を適用
- `GridHelper` で空間感を演出
- `requestAnimationFrame` ループで Y 軸自動回転
- クリーンアップで `cancelAnimationFrame` と geometry / material の `dispose()`

### プレビューレンダラー破棄（L236-241）

ダイアログが閉じたとき、`WebGLRenderer` を `dispose()` してメモリ解放。

### 設置モードのイベント管理（L244-313）

依存: `placementMode`, `objectShape`, `objectColor`, `objectSize`

`placementMode` が `true` の間:

- **Canvas click**: ゴーストオブジェクトの現在位置に実体オブジェクトを生成・配置
- **ESC キー**: 設置モードをキャンセル
- 100ms の `setTimeout` で、「設置」ボタンのクリックが即座に設置トリガーとなることを防止
- クリーンアップでイベントリスナーを除去

### メイン初期化 useEffect（L315-841）

依存: `roomCode`, `nafServerUrl`, `userName`

コンポーネントの中核。以下を順に実行:

1. A-Frame / Networked-A-Frame の動的インポート
2. カスタム Socket.IO アダプタの登録
3. カスタム A-Frame コンポーネントの登録（7 種類）
4. シーン HTML の構築（`innerHTML` で挿入）
5. シーンロード完了後に NAF スキーマ登録と接続
6. VoiceChat の初期化
7. ユーザー数のポーリング開始
8. クリーンアップ関数の登録

---

## 7. A-Frame カスタムコンポーネント

メイン useEffect 内で `aframe.registerComponent()` により登録される。

### fps-controls（L343-463）

FPS（一人称視点）の操作を統合したコンポーネント。

| 機能 | 実装 |
|---|---|
| マウスルック | Pointer Lock API + `mousemove` イベント。yaw（水平回転）と pitch（垂直回転）を管理 |
| 移動 | WASD / 矢印キーで yaw 方向を基準に前後左右移動 |
| ポインターロック | Canvas クリックで取得。**設置モード中は `window.__placementModeActive` フラグで無効化** |
| tick 処理 | 毎フレーム: rig に yaw 回転適用 → camera に pitch 回転適用 → キー入力で位置更新 → head に pitch 同期（NAF 経由で他プレイヤーに見える） |

pitch は ±89度にクランプ。speed と sensitivity はスキーマでカスタマイズ可能。

### canvas-nametag（L467-527）

日本語/CJK 文字対応の名前タグ。

- 512x128 の `<canvas>` に 2D Context で描画
- 角丸の半透明黒背景 + 白文字
- フォント: `Hiragino Sans` / `Noto Sans JP`
- `CanvasTexture` → `PlaneGeometry` + `MeshBasicMaterial`（両面描画、深度テスト無効）
- `update()` で名前変更時に再描画

### billboard（L530-541）

名前タグを常にカメラの方向に向ける。毎フレーム `lookAt(cameraWorldPosition)` を実行。

### hide-local-avatar（L545-563）

ローカルプレイヤーのアバター（頭・体・名前タグ）をファーストパーソン視点で非表示にする。NAF がテンプレートを適用するのを待ってから `visible = false` を設定。一度非表示にしたら `this._hidden = true` で tick 処理をスキップ。

### player-info（L567-591）

アバターの名前と色を管理。

- `schema`: `name`（string）、`color`（color）
- `applyInfo()`: 名前タグの `canvas-nametag` テキスト更新、頭と体のマテリアルカラー更新
- NAF の同期対象コンポーネントに指定されているため、変更が他プレイヤーに伝播する

### object-placer（L594-658）

オブジェクト設置時のゴースト（プレビュー用半透明オブジェクト）を管理。

| ライフサイクル | 処理 |
|---|---|
| `init` | ゴースト要素の参照と Three.js ベクトルを初期化 |
| `update` | 既存のゴーストを削除し、`active` が true なら新しいゴースト `<a-{shape}>` を生成。`opacity: 0.5; transparent: true` で半透明 |
| `tick` | カメラの位置 + 視線方向 × distance（デフォルト 3m）にゴーストを移動 |
| `remove` | ゴースト要素をシーンから削除 |

### physics-world（A-Frame System）

物理シミュレーションを管理するシステム。cannon-es の `World` を毎フレームステップし、`physics-body` を持つ全エンティティの位置・回転を同期する。

| ライフサイクル | 処理 |
|---|---|
| `init` | `this.physicsWorld = null`（後から `PhysicsWorld` インスタンスが代入される） |
| `tick` | `physicsWorld.step(dt)` → 全 `[physics-body]` エンティティの `syncFromPhysics()` を呼出 |

### physics-body

個々のエンティティに物理ボディを付与するコンポーネント。

| スキーマ | デフォルト | 説明 |
|---|---|---|
| `type` | `"dynamic"` | `dynamic`（動的）or `static`（静的） |
| `shape` | `"box"` | 物理形状（box / sphere / cylinder） |
| `size` | `"medium"` | サイズ（small / medium / large） |
| `objectId` | `""` | PhysicsWorld 内でのボディ識別子 |

| ライフサイクル | 処理 |
|---|---|
| `init` | `PhysicsWorld.addBody()` で cannon-es ボディを生成 |
| `syncFromPhysics` | 物理ボディの位置・クォータニオンを A-Frame エンティティの `object3D` に反映 |
| `remove` | `PhysicsWorld.removeBody()` でボディを破棄 |

### clickable-object

エンティティをレイキャストの対象としてマーク。`init` で `.clickable` CSS クラスを付与、`remove` で除去。`launch-raycaster` がこのクラスを持つエンティティを検出する。

| スキーマ | デフォルト | 説明 |
|---|---|---|
| `objectId` | `""` | PhysicsWorld 内でのボディ識別子 |

### launch-raycaster

カメラに取り付けるコンポーネント。クリック時にレイキャストで `.clickable` エンティティを検出し、カメラ方向へインパルスを与える。

| 処理 | 詳細 |
|---|---|
| レイキャスト | 画面中央（0,0）から `THREE.Raycaster` で `.clickable` メッシュに対して判定 |
| インパルス | カメラ方向 × 10 + 上方バイアス（+3）で `PhysicsWorld.applyImpulse()` |
| ネットワーク | `adapter.broadcastData("object-launched", ...)` で他ユーザーに同期 |
| 視覚フィードバック | 白い画面フラッシュ（100ms フェードアウト） |
| ガード条件 | ポインターロック中のみ動作。設置モード中は無効 |

---

## 8. 3D シーンの構築

`innerHTML` で以下の A-Frame シーンを生成（L665-745）:

```
<a-scene>
  ├── <a-assets>
  │   └── <template id="avatar-template">   ... アバターテンプレート
  │
  ├── 環境
  │   ├── <a-plane>     ... 緑色の地面（30x30）
  │   ├── <a-sky>       ... 水色の空
  │   ├── <a-light>     ... アンビエント + ディレクショナル
  │   └── 環境オブジェクト
  │       ├── <a-box>       ... 青いボックス
  │       ├── <a-cylinder>  ... 黄色いシリンダー
  │       └── <a-sphere>    ... 赤い球体
  │
  └── <a-entity id="rig">   ... プレイヤーリグ
      ├── fps-controls       ... FPS 操作
      ├── hide-local-avatar  ... ローカルアバター非表示
      └── <a-entity id="player-camera" camera>
```

### networked-scene の設定

| パラメータ | 値 | 説明 |
|---|---|---|
| serverURL | `nafServerUrl` | Socket.IO シグナリングサーバー |
| adapter | `custom-socketio` | カスタム Socket.IO アダプタを使用 |
| room | `roomCode` | セッション固有のルーム名 |
| connectOnLoad | `false` | スキーマ登録後に手動接続 |
| audio | `false` | NAF 組み込み音声は不使用（独自 WebRTC 実装） |

### アバターテンプレート

```
<a-entity class="avatar" player-info="...">
  <a-sphere class="head">          ... 頭（球）
  <a-entity class="body">          ... 体（シリンダー）
  <a-entity class="name-tag">      ... 名前タグ（canvas-nametag + billboard）
```

---

## 9. NAF 接続とスキーマ登録

シーンの `loaded` イベント後に実行（L750-806）:

1. **スキーマ登録**: `NAF.schemas.add()` でアバターテンプレートの同期コンポーネントを定義
   - `position` — rig の位置
   - `rotation` — rig の回転（yaw）
   - `.head` の `rotation` — 頭の回転（pitch）
   - `player-info` — 名前とカラー

2. **networked コンポーネント設定**: `#rig` に `networked` 属性を付与。`attachTemplateToLocal: true` でローカルプレイヤーにもテンプレートを適用

3. **手動接続**: `sceneComp.connect()` でシグナリングサーバーに接続

4. **VoiceChat 初期化**: NAF アダプタの Socket.IO インスタンスと clientId を VoiceChat に渡す。アダプタ準備完了まで 500ms 間隔でリトライ

---

## 10. JSX（UI レイヤー）

シーンの上に React の絶対配置要素を重ねる構成。

```
<div class="relative w-full h-full">
  ├── ローディングスピナー（ready = false 時）
  ├── 接続人数バッジ（右上）
  ├── コントロールバー（左上）
  │   ├── 歯車アイコン → アバター設定パネル
  │   ├── 音声アイコン群 → ヘッドフォン / マイク / スピーカー
  │   └── キューブアイコン → オブジェクト設置ダイアログ
  ├── 設置モードオーバーレイ（placementMode 時）
  │   ├── クロスヘア（画面中央）
  │   └── 操作ガイド（画面下部: "クリックで設置 | ESCでキャンセル"）
  ├── オブジェクト設置ダイアログ（itemDialogOpen 時）
  │   ├── 左列: 形状 / カラー / サイズ セレクター
  │   ├── 左列: オプション（物理エンジン / クリック判定チェックボックス）
  │   ├── 右列: Three.js 3D プレビュー（自動回転）
  │   └── 「設置」ボタン
  ├── アバター設定パネル（settingsOpen 時、左からスライドイン）
  │   ├── 表示名入力
  │   ├── カラーパレット + カスタムカラー
  │   └── プレビュー
  ├── 設定パネル背景オーバーレイ（クリックで閉じる）
  └── <div ref={sceneRef}> ... A-Frame シーンコンテナ
```

### z-index の階層

| z-index | 要素 |
|---|---|
| z-50 | オブジェクト設置ダイアログ |
| z-40 | ダイアログ背景オーバーレイ |
| z-30 | コントロールバー / 設定パネル / 設置モードUI |
| z-20 | 接続人数バッジ / 設定パネル背景 |
| z-10 | ローディングスピナー |

---

## 11. 処理フロー図

### シーン初期化フロー

```
コンポーネントマウント
  │
  ├─ ローディング表示
  │
  ▼
useEffect(init)
  │
  ├─ import("aframe")
  ├─ import("networked-aframe")
  ├─ import("./SocketIoAdapter")
  │
  ├─ NAF.adapters.register("custom-socketio", SocketIoAdapter)
  │
  ├─ A-Frame カスタムコンポーネント登録 ×7
  │
  ├─ innerHTML でシーン HTML を構築
  │
  ├─ a-scene "loaded" イベント待ち
  │   │
  │   ├─ NAF スキーマ登録
  │   ├─ #rig に networked 属性設定
  │   ├─ sceneComp.connect() で NAF 接続
  │   └─ VoiceChat 初期化（リトライ付き）
  │
  ├─ setInterval(checkUserCount, 2000)
  │
  └─ setReady(true) → ローディング非表示
```

### オブジェクト設置フロー

```
キューブアイコン クリック
  │
  ├─ ポインターロック解除
  ├─ 設定パネル閉じる
  └─ itemDialogOpen = true
      │
      ▼
  ダイアログ表示
  ├─ 形状 / カラー / サイズ を選択
  ├─ Three.js プレビュー（リアルタイム反映）
  │
  └─「設置」ボタン クリック
      │
      ├─ ダイアログ閉じる
      ├─ window.__placementModeActive = true
      ├─ ポインターロック解除
      ├─ a-scene に object-placer コンポーネント設定
      └─ placementMode = true
          │
          ▼
      設置モード
      ├─ ゴーストオブジェクト（半透明）がカメラ前方3mに追従
      ├─ クロスヘア + 操作ガイド表示
      │
      ├─ [Canvas クリック]
      │   ├─ ゴースト位置に実体 <a-{shape}> を生成
      │   └─ 設置モード終了
      │
      └─ [ESC キー]
          └─ 設置モード終了（キャンセル）
              ├─ object-placer 除去（ゴースト削除）
              ├─ window.__placementModeActive = false
              └─ placementMode = false
```

### fps-controls と設置モードの共存

```
通常時:
  Canvas クリック → requestPointerLock() → マウスルック有効

設置モード時:
  window.__placementModeActive = true
  Canvas に requestPointerLock() → マウスでカメラ操作可能
  Canvas クリック → fps-controls の onClick は早期リターン
                  → 設置モードの click ハンドラが処理
  ※ WASD 移動・マウスルックは引き続き有効（場所探しのため）

設置完了 / キャンセル後:
  window.__placementModeActive = false
  Canvas クリック → 通常通り requestPointerLock()
```

---

## 12. 物理エンジン（Physics）

### 概要

cannon-es ベースの物理シミュレーション。オブジェクト設置ダイアログの「物理エンジン」チェックボックスで有効化。

### PhysicsWorld.ts

`src/components/metaverse/PhysicsWorld.ts` — cannon-es のラッパークラス。

```
PhysicsWorld
├── constructor(CANNON) — World 生成（重力 -9.82、NaiveBroadphase、GSSolver×10）
├── createGround() — y=0 に無限平面（mass=0）を追加
├── addBody(id, opts) — 形状・サイズ・位置からボディを生成（SIZE_MAP / MASS_MAP 使用）
├── applyImpulse(id, impulse) — wakeUp + Vec3 インパルス適用
├── step(dt) — world.step(1/60, dt, 3)
├── getBodyState(id) — position, quaternion を返す
├── removeBody(id) — World から除去
└── destroy() — 全ボディを除去
```

| サイズ | 質量 |
|---|---|
| small | 1 |
| medium | 5 |
| large | 15 |

### 初期化フロー

```
onSceneLoaded
  │
  ├─ initPhysics()
  │   ├─ import("cannon-es")
  │   ├─ new PhysicsWorld(CANNON)
  │   ├─ pw.createGround()
  │   ├─ physicsWorldRef.current = pw
  │   └─ systems["physics-world"].physicsWorld = pw
  │
  └─ physics-world system の tick() でシミュレーション駆動
```

### オブジェクト設置 + 物理

```
設置ダイアログ
  ├─ [✓] 物理エンジン → physicsEnabled = true
  ├─ [✓] クリック判定 → clickableEnabled = true（物理エンジン依存）
  │
  └─「設置」→ Canvas クリック
      │
      ├─ <a-{shape}> 生成
      ├─ physics-body="type:dynamic; shape:...; size:...; objectId:..." 設定
      ├─ clickable-object="objectId:..." 設定
      └─ broadcastData("object-placed", { ...data, physics: true, clickable: true })
```

### クリック → 飛ばす フロー

```
ポインターロック中に Canvas クリック
  │
  ├─ launch-raycaster が画面中央からレイキャスト
  ├─ .clickable メッシュと交差判定
  │
  ├─ ヒットした場合:
  │   ├─ カメラ方向 × 10 + 上方 +3 のインパルスを計算
  │   ├─ PhysicsWorld.applyImpulse(objectId, impulse)（ローカル適用）
  │   ├─ broadcastData("object-launched", { objectId, impulse })
  │   └─ 白い画面フラッシュ（視覚フィードバック）
  │
  └─ ミスした場合: 何もしない
```

---

## 13. ネットワーク同期

### データタイプ

Socket.IO の `broadcastData` / `send` イベントで以下のカスタムデータタイプを使用:

| dataType | 送信タイミング | データ |
|---|---|---|
| `object-placed` | オブジェクト設置時 | `{ objectId, shape, color, size, position, physics, clickable }` |
| `object-launched` | クリックでオブジェクトを飛ばした時 | `{ objectId, impulse: {x,y,z} }` |

### オブジェクトID

`${clientId}-obj-${counter}` 形式。`clientId` は NAF アダプタが割り当てるクライアント固有 ID。複数ユーザー間でも一意性が保証される。

### 受信処理

```
adapter.socket.on("send", (senderId, dataType, data) => {
  │
  ├─ dataType === "object-placed"
  │   ├─ 重複チェック（同じ objectId が既に存在すればスキップ）
  │   ├─ <a-{shape}> 生成 + 属性設定
  │   ├─ data.physics === true → physics-body 設定
  │   ├─ data.clickable === true → clickable-object 設定
  │   └─ シーンに追加
  │
  └─ dataType === "object-launched"
      └─ PhysicsWorld.applyImpulse(objectId, impulse)
})
```

### サーバー側

`naf-server/index.js` は汎用的な `send` / `broadcast` リレーを行うため、サーバー側の変更は不要。カスタムデータタイプは全てクライアント間で直接処理される。
