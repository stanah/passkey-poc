# On-Chain Passkey PoC

WebAuthn Passkey を使用した ERC-4337 スマートアカウントのセルフホスト環境での PoC 実装。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + viem)                                    │
│  - WebAuthn Passkey登録/認証                                 │
│  - スマートアカウント操作                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  viem + @aa-sdk/core + permissionless                       │
│  - WebAuthn P-256署名                                        │
│  - UserOperation作成                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Self-Hosted Bundler                                        │
│  - UserOperation処理                                         │
│  - EntryPoint v0.7対応                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Hardhat Node (Sepolia Fork)                               │
│  - EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032  │
│  - ERC-4337インフラ（フォークから取得）                         │
└─────────────────────────────────────────────────────────────┘
```

## クイックスタート

### 1. 依存関係のインストール

```bash
cd passkey-poc
pnpm install
```

### 2. ローカルノードの起動

```bash
# Terminal 1: Hardhat node (Sepolia fork)
pnpm node
```

### 3. セルフホストBundlerの起動

```bash
# Terminal 2: ERC-4337 Bundler
pnpm bundler
```

### 4. フロントエンドの起動

```bash
# Terminal 3: Vite dev server
pnpm dev
```

ブラウザで http://localhost:5174 を開く

## 主要コンポーネント

### WebAuthn Passkey Signer (`src/lib/webauthnSigner.ts`)

- P-256曲線を使用したWebAuthn credential作成
- Passkey署名によるメッセージ署名
- DER形式からr/s値へのP-256署名パース

### Smart Account Client (`src/lib/smartAccountClient.ts`)

- viem + permissionlessを使用したスマートアカウント操作
- Bundlerクライアント設定
- EntryPointとの連携

### Self-Hosted Bundler (`scripts/setup-bundler.ts`)

- ERC-4337 JSON-RPC APIの実装
- `eth_sendUserOperation`
- `eth_estimateUserOperationGas`
- `eth_supportedEntryPoints`
- モックPaymaster（テスト用）

## 設定

### 環境変数 (`.env`)

```env
# RPC URLs
SEPOLIA_RPC_URL=https://rpc.sepolia.org
LOCAL_RPC_URL=http://127.0.0.1:8545
LOCAL_BUNDLER_URL=http://127.0.0.1:4337

# Contract Addresses
ENTRYPOINT_V07=0x0000000071727De22E5E9d8BAf0edAc6f37da032

# Test Account (Hardhat default #0)
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## 技術スタック

- **Frontend**: React 19, TypeScript, Vite
- **Web3**: viem, @aa-sdk/core, permissionless
- **Local EVM**: Hardhat Network (Sepolia fork)
- **Bundler**: カスタム実装 (本番では Alto/Rundler 推奨)
- **Smart Account**: ERC-4337 v0.7

## Passkey フロー

### 1. Passkey登録

```typescript
// WebAuthn credential作成
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: randomBytes,
    rp: { name: "Passkey PoC", id: "localhost" },
    user: { id, name, displayName },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
    },
  },
});

// P-256公開鍵を抽出
const publicKey = extractP256PublicKey(credential.response.getPublicKey());
```

### 2. メッセージ署名

```typescript
// WebAuthnで署名
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: messageHash,
    allowCredentials: [{ type: "public-key", id: credentialId }],
  },
});

// DER署名からr/sを抽出
const { r, s } = parseP256Signature(assertion.response.signature);
```

### 3. UserOperation署名

```typescript
// スマートアカウントのUserOperationハッシュを署名
const userOpHash = await entryPoint.getUserOpHash(userOp);
const signature = await signWithPasskey(credential, userOpHash);
```

## 本番環境への移行

### Bundlerの選択

セルフホスト環境での本番運用には以下のBundlerを推奨:

1. **[Alto](https://github.com/pimlicolabs/alto)** (Pimlico) - TypeScript
2. **[Rundler](https://github.com/alchemyplatform/rundler)** (Alchemy) - Rust
3. **[Stackup Bundler](https://github.com/stackup-wallet/stackup-bundler)** - Go

### On-Chain P-256検証

WebAuthn署名のオンチェーン検証には以下が必要:

1. **RIP-7212プリコンパイル**: 一部のL2（Base, Optimism等）で利用可能
2. **Solidity実装**: FCL-WebAuthn, Safe WebAuthn Signer
3. **EIP-7212対応コントラクト**: P-256署名検証

## 参考リンク

- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [Alchemy AA-SDK](https://github.com/alchemyplatform/aa-sdk)
- [Pimlico Alto Bundler](https://github.com/pimlicolabs/alto)
- [Safe WebAuthn Signer](https://docs.safe.global/sdk/signers/passkeys)

## ライセンス

ISC
