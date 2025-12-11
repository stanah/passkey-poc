# ローカル開発環境セットアップガイド

ERC-4337 Account Abstraction + Paymaster ガススポンサーシップの PoC をローカルで動かすための手順書。

## 前提条件

- Node.js v18+
- pnpm
- Docker & Docker Compose
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, cast, anvil)

---

## 1. リポジトリのセットアップ

```bash
# クローン & 依存関係インストール
git clone <repo-url>
cd passkey-poc
pnpm install
```

## 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して以下を設定：

| 変数 | 説明 | 例 |
|------|------|-----|
| `ANVIL_FORK_URL` | フォーク元の RPC URL | `https://rpc.minato.soneium.org/` |
| `BUNDLER_PRIVATE_KEY` | Rundler Builder の秘密鍵 | 任意の秘密鍵 |
| `VITE_ALCHEMY_API_KEY` | Alchemy API キー | Account Kit 認証用 |
| `VITE_USE_LOCAL` | ローカルモード有効化 | `true` |
| `VITE_LOCAL_RPC_URL` | Anvil URL | `http://127.0.0.1:8545` |
| `VITE_LOCAL_BUNDLER_URL` | Rundler URL | `http://127.0.0.1:3000` |

## 3. Rundler Docker イメージ

公式イメージを使用：
```yaml
# docker-compose.yml で設定済み
image: alchemyplatform/rundler:latest
```

> [!TIP]
> ローカルでビルドする場合：
> ```bash
> git clone https://github.com/alchemyplatform/rundler.git
> cd rundler && git submodule update --init --recursive
> docker buildx build . -t rundler
> ```
> その場合は `docker-compose.yml` の `image:` を `rundler` に変更。

## 4. Docker コンテナの起動

```bash
./scripts/up.sh
```

起動確認：
```bash
docker compose ps
# anvil と rundler が Up であること

# Anvil 接続確認
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545
```

## 5. Builder アカウントへの送金

Rundler がバンドルを送信するには Builder アカウントに ETH が必要。

```bash
# Builder アドレスを確認
cast wallet address --private-key <BUNDLER_PRIVATE_KEY>

# Anvil テストアカウントから送金
cast send <BUILDER_ADDRESS> \
  --value 10ether \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --rpc-url http://127.0.0.1:8545
```

## 6. Paymaster コントラクトのデプロイ

```bash
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
forge script script/DeployPaymaster.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

出力された `VITE_PAYMASTER_ADDRESS` を `.env` に追加：
```bash
VITE_PAYMASTER_ADDRESS=0x...
```

## 7. フロントエンドの起動

```bash
pnpm dev
```

ブラウザで http://localhost:5173 を開く。

## 8. テスト手順

1. **ログイン** - Passkey または Email で認証
2. **Send 0 ETH** ボタンをクリック
3. コンソールで確認:
   - `✅ Paymaster configured: 0x...`
   - `Bundle sent successfully`
   - `Transaction mined!`

---

## よくある問題

### `Max bundle fee is zero, skipping bundle`
→ Builder アカウントに ETH がない。ステップ 5 を実行。

### `ERR_CONNECTION_RESET` (Anvil 接続エラー)
→ Docker の Anvil が `0.0.0.0` でリッスンしていない。`docker compose restart` を実行。

### `precheck failed: sender balance and deposit together is 0`
→ Paymaster がデプロイされていないか、`.env` に設定されていない。ステップ 6 を実行。

### Docker 再起動後にエラー
→ Anvil の状態がリセットされるので、Paymaster の再デプロイが必要。

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (Vite + React)                                          │
│  ├─ Account Kit Auth (Alchemy) - Passkey/Email ログイン          │
│  └─ localClient.ts - split transport + Paymaster middleware     │
└────────────────────────┬────────────────────────────────────────┘
                         │ eth_sendUserOperation
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Rundler (Local Bundler)  :3000                                   │
│  └─ UserOperation をバンドルして EntryPoint に送信              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Anvil (Local Chain Fork)  :8545                                  │
│  ├─ EntryPoint v0.7: 0x0000000071727De22E5E9d8BAf0edAc6f37da032 │
│  ├─ VerifyingPaymaster: 0x46b142DD1E924FAb...                   │
│  └─ LightAccount Factory: 0x0000000000400cd...                  │
└─────────────────────────────────────────────────────────────────┘
```
