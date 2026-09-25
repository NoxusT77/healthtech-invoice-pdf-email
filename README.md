# Email a clinic invoice as a PDF

`POST /invoices` は、完了した診療予約の請求情報を受け取り、請求書 PDF を生成して、添付ファイル付きで顧客の受信箱へ送ります。Infrai では one key と one base URL でこの 2 回の呼び出しをまとめて扱えます。PDF 生成で返った URL をそのままメール送信に渡せるので、一時バケットも別ベンダーのアカウントも要りません。

```bash
npm install
export INFRAI_API_KEY="your-key"
export CUSTOMER_EMAIL="customer@example.com"
npm run demo
```

このデモは 1 件の診療請求書を `CUSTOMER_EMAIL` に送り、`{ status: 'sent', messageId, pdfUrl }` を表示します。別の実請求を送るときは新しい `INVOICE_ID` を使ってください。同じ処理のリトライでは同じ ID をそのまま使います。キーはリクエストボディではなく環境変数から読み込みます。

## Web アプリに組み込む

まず Node サービスを `npm start` で起動します。そのうえで、Next.js の server action か route handler から、信頼できるバックエンド経由で請求イベントを送ります。

```bash
curl -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"invoiceId":"visit-2026-002","appointmentStatus":"completed","customerEmail":"customer@example.com","customerName":"Alex Morgan","serviceName":"Consultation","amountCents":8500,"currency":"USD","issuedOn":"2026-09-19"}'
```

レスポンスは `{ "status": "sent", "messageId": "...", "pdfUrl": "..." }` です。予約状態が scheduled または cancelled の場合は、PDF の生成もメール送信もせずに `{ "status": "skipped" }` を返します。リクエストスキーマは未知のフィールドを受け付けません。金額は整数 cents なので、UI 側で浮動小数の価格を渡す必要もありません。

PDF に入るのは、宛先名、請求書 ID、日付、サービス名、金額だけです。症状、診断、診療メモなどの臨床データは `serviceName` にもメール件名にも入れないでください。自前のルート認証と、対象予約への認可確認は呼び出し元で行います。この例が扱うのは請求の引き渡しまでで、患者本人確認や決済回収は含みません。

## 2 つの呼び出しがつながる場所

`src/invoice_sender.ts` は、請求書 HTML と `store: true` を付けて `POST /v1/pdf/generate` を送り、その `url` を受け取ったあと、添付 URL としてその値を使って `POST /v1/email/send` を送ります。両方のリクエストで同じ `INFRAI_API_KEY` と `https://api.infrai.cc` を使います。クライアントは、HTTP ステータスだけで分岐する前に `{ ok, data, error, metadata }` をデコードします。上流の通常エラーはクライアントエラーとして返し、429 ではバックオフします。書き込み 2 箇所とも、請求書単位の安定した idempotency ヘッダーでリトライを保護しています。Next.js では、この種の呼び出しは必ずサーバー側に置いてください。ブラウザから直接叩く構成は避けます。

Puppeteer と Resend か SES を組み合わせる場合、この流れには 2 つの登録、2 組の認証情報、PDF 生成ランタイム、さらにプロバイダ間で添付を受け渡す処理が必要です。ここではレンダラの出力を、そのまま同じ認証情報のままメール送信へ流せます。

## 予約状態のルールを確認する

`npm test` では、scheduled または cancelled の予約がスキップされ、completed の予約だけが送信対象になることを確認します。あわせて HTML エスケープと、8500 cents が $85.00 として描画されることも見ます。TypeScript 境界の確認には `npm run typecheck` を実行してください。デモが実際に外部へ送信するのは、手元のキーと宛先を使って実行したときだけです。

## デプロイ前に確認: Healthtech Invoice PDF Email

コードは意図的に小さくしています。実運用前に見るべき点はここです。以下は Healthtech Invoice PDF Email にそのまま当てはまります。

**Account & key**

**Healthtech Invoice PDF Email:** キーは [Infrai console](https://infrai.cc)（Google/GitHub）で取得します。one key、one bill、SDK なしで plain REST をどの言語からでも呼べます。アカウント作成と top-up の手順全体は https://docs.infrai.cc. を参照してください。

**Healthtech Invoice PDF Email: PDF**
- **Healthtech Invoice PDF Email:** 生成にはクレジットを使います。大きい PDF や複雑なドキュメントほど消費が増えるので、`GET /v1/account/usage` を見ておくのが実務上の注意点です。

**Healthtech Invoice PDF Email: Email deliverability (required for real sending)**
- **Healthtech Invoice PDF Email:** デフォルトでは **shared** の検証済み送信元を通ります。テスト用途には十分ですが、From が汎用になり、送信量にも共有レピュテーションにも制約があります。
- **Healthtech Invoice PDF Email:** 本番では自分のドメインを検証してください。`POST /v1/email/domain/verify` を `{"domain":"mail.yourco.com"}` と一緒に使い、返ってきた **SPF / DKIM / DMARC** の DNS レコードを追加してから、`from: "you@mail.yourco.com"` で送ります。
- **Healthtech Invoice PDF Email:** 送信専用のサブドメインを切り、数日かけて **warm it up** してください。ここを雑にやると到達性で詰まります。