# Passkey (WebAuthn) 統合実装計画

## 目標

現在のテスト署名（EOA秘密鍵）によるUserOperation送信機能を、実際の**Passkey (WebAuthn)** 署名を使用するようにアップグレードする。

## 現状の課題

- 現在の`SimpleAccount`はECDSA (secp256k1) 署名のみサポート
- Passkeyは P-256 (secp256r1) 署名を生成するため、検証に互換性がない
- `signUserOperation`関数は現在ハードコードされたテスト秘密鍵を使用

## 技術的アプローチ

### 1. Passkey署名の抽出

`navigator.credentials.get()` から返される署名データ（AuthenticatorAssertionResponse）から、スマートコントラクトで検証可能な `r` と `s` 値を抽出する。

### 2. スマートアカウントのアップグレード

P-256署名を検証できるスマートアカウント実装に切り替える。

#### 候補: RIP-7212 (P-256 Precompile)

Ethereum Mainnet Fusakaアップグレード（Tenderly Virtual TestNetでも有効な可能性が高い）で導入されたプリコンパイル `0x100` を使用して、ガスコスト効率良くP-256署名を検証する。

**実装方針**:
- **P256Account** コントラクトを作成（または既存ライブラリを利用）
- `validateUserOp` 内で `0x100` プリコンパイルを呼び出して署名を検証

### 3. フロントエンドの更新

`App.tsx` の `signUserOperation` を更新：
1. `navigator.credentials.get()` を呼び出し
2. ユーザーに指紋/顔認証を求める
3. 署名データを整形してUserOperationに格納

## 実装ステップ

### Phase 1: 署名データの準備
- [ ] `WebAuthn` ヘルパー関数の実装（署名データ解析）
- [ ] `r` , `s` , `authenticatorData` , `clientDataJSON` の抽出

### Phase 2: スマートコントラクト
- [ ] P-256検証可能なスマートアカウント（`WebAuthnAccount`）の選定または実装
- [ ] Factoryコントラクトの更新

### Phase 3: 統合とテスト
- [ ] `App.tsx` の `SIMPLE_ACCOUNT_FACTORY` を新しいFactoryに切り替え
- [ ] UserOperation送信とオンチェーン検証のテスト

## 検証計画

1. **Passkey作成**: 新しいPasskeyを登録
2. **UserOperation署名**: Passkeyで署名
3. **オンチェーン実行**: Tenderlyでの実行成功を確認（特に署名検証ガス使用量に注目）
