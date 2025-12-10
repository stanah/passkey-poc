# UserOperation Implementation Walkthrough

## 達成状況 🎉

### 完了したマイルストーン ✅

1. **Rundler Bundlerの完全動作**
   - Tenderly Virtual TestNetとの連携に成功
   - `UNSAFE=true` (debug_traceCall skip) と `PROVIDER_RATE_LIMIT_RETRY_ENABLED` で安定稼働
   - CORSとネットワーク設定完了

2. **UserOperationの送信成功** 🚀
   - **UserOp Hash**: 取得成功！
   - `eth_sendUserOperation` が正常に受理された

3. **課題の克服**
   - **Sender Address**: Factoryから計算して解決
   - **UserOp Hash**: `viem/account-abstraction` (v0.7) を使用して解決
   - **署名検証**: `signMessage` (EIP-191) を使用して解決
   - **ガス代**: Tenderly Faucet/Dashboardで解決

4. **UX向上**
   - トランザクション完了（Receipt）の待機ロジックを追加

### 次のステップ: Passkey (WebAuthn) 統合 🔑

現在はテスト用のEOA秘密鍵で署名しているため、これを実際のPasskey署名に置き換える。

#### 計画
1. **Passkey Signerの実装**
   - `navigator.credentials.get()` から署名を取得
   - P-256署名 (r, s値を抽出)
2. **スマートアカウントのアップグレード**
   - `SimpleAccount` (ECDSAのみ) から **P-256対応アカウント** に変更
   - 候補: Safe + WebAuthn Signer モジュール
   - または RIP-7212 (0x100プリコンパイル) を直接使うカスタム検証ロジック

## 技術スタック (現状)

- **Bundler**: Rundler (Self-hosted)
- **Chain**: Tenderly Virtual TestNet (Sepolia fork)
- **SDK**: `viem`, `@aa-sdk/core`
- **Account**: SimpleAccount (ERC-4337 v0.7)
- **Signer**: Test EOA Key (Temporary) -> **Next: WebAuthn**
