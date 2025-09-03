# Staking Subgraph

- schema.graphql: エンティティ定義
- subgraph.template.yaml: ネットワーク別に置換されるテンプレート
- networks.json: コントラクトアドレス/開始ブロック
- src/mappings: イベントハンドラ

## セットアップ

1. networks.json を編集

2. subgraph.yaml 生成

```sh
NETWORK=localhost node scripts/generate-subgraph.js
```

3. codegen / build

```sh
npm run codegen && npm run build
```

4. デプロイ

```sh
# 例: ローカル Graph Node
npm run deploy:local

# 例: 本番
npm run deploy
```

## メモ

- 追加でトラッキングしたいイベント/呼び出しがあれば、mapping と schema を拡張してください。
- 型生成は `generated/` に出力されます。
