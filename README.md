# On-Chain Passkey PoC

WebAuthn Passkey を使用した ERC-4337 スマートアカウントの PoC 実装。
現在 **Phase 1 (Managed Signer)** が完了し、Rundler + Tenderly 環境で動作しています。

## 現在のステータス

- **Phase 1: Alchemy Signer Integration** ✅ (Completed)
- **Phase 2: On-chain Native Passkey** 🚧 (Planned)

## アーキテクチャ (Phase 1)

```
[前端: React + viem] <---> [Alchemy Signer (WebAuthn)]
         |
         v
[Bundler: Rundler (Rust)] <---> [Network: Tenderly Virtual TestNet]
```

## クイックスタート

### 前提条件
- Node.js 18+
- pnpm
- Docker & Docker Compose
- Tenderly Virtual TestNet アカウント

### セットアップ

1. **インストール**
   ```bash
   pnpm install
   ```

2. **環境変数 (.env)**
   `.env.example` をコピーして設定。
   - `BUNDLER_PRIVATE_KEY`: 任意のプライベートキーを設定（およびそのアドレスに入金すること）

3. **Bundler起動**
   ```bash
   pnpm bundler:build
   pnpm bundler:start
   ```

4. **アプリ起動**
   ```bash
   pnpm dev
   ```

## 技術スタック
- **Frontend**: React 19, TypeScript, Vite
- **Web3**: viem, @aa-sdk/core, permissionless
- **Signer**: Alchemy Signer (@account-kit/signer)
- **Backend (Bundler)**: Rundler (Alchemy)
- **Chain**: Tenderly Virtual TestNet (Sepolia Fork)
