# Passkey (WebAuthn) 統合実装計画

## 目標

UserOperation送信機能をアップグレードし、実際のPasskey署名を統合する。学習とPoCの観点から、2段階のアプローチを採用する。

## 実装アプローチ

### Phase 1: Alchemy Signer (Managed) 
**目的**: すばやく「Passkeyでトランザクション送信」を実現し、UXを確認する。

- **仕組み**:
  - `AlchemySigner` (`@account-kit/signer`) を使用
  - Passkey認証後、Alchemyのセキュアなサーバー（Turnkey）内で管理されるEOA鍵で署名が行われる
  - `SimpleAccount` (ECDSA) をそのまま利用可能
- **必要なもの**:
  - Alchemy API Key
  - パッケージ: `@account-kit/signer`

### Phase 2: On-chain Passkey (Native)
**目的**: 真のセルフカストディと、最新のP-256プリコンパイル技術を体験する。

- **仕組み**:
  - `navigator.credentials.get()` から署名（r, s）を直接抽出
  - **P-256 (secp256r1)** 対応のスマートアカウント（`WebAuthnAccount`）を使用
  - **RIP-7212 (0x100)** プリコンパイルを使用してガスコストを削減
- **必要なもの**:
  - P-256対応スマートコントラクト
  - カスタム検証ロジック

---

## Phase 1: 実装ステップ

### 1. 準備
- [ ] `@account-kit/signer` のインストール
- [ ] `.env` に `ALCHEMY_API_KEY` を追加

### 2. Signerの実装
- [ ] `AlchemyWeb3AuthSigner` の設定 (src/lib/signer.ts)
- [ ] Passkey作成・認証UIの実装 (frontend/src/App.tsx)
- [ ] `SmartAccountClient` にSignerを接続

### 3. トランザクション送信
- [ ] テストEOA署名を `AlchemySigner` に置き換え
- [ ] 動作確認（Send Transaction）

## Phase 2: 実装ステップ（将来）

### 1. 署名データの抽出
- [ ] WebAuthn rawデータ解析ロジックの実装

### 2. スマートコントラクト
- [ ] `WebAuthnAccount` の実装またはSafeモジュールの利用
- [ ] TenderlyでのP-256プリコンパイル動作確認

### 3. 統合
- [ ] Phase 1のSignerをネイティブ署名ロジックに置換
- [ ] オンチェーン検証の確認
