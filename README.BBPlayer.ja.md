> これは、BBMusica の元になったプロジェクト **BBPlayer** の README を、日本語に訳したものです（参考用）。
> 原文: <https://github.com/bbplayer-app/BBPlayer>（Roitium さん、MIT ライセンス）
> BBMusica の説明は、[README.md](./README.md) を見てください。
> 画像と相対リンクは、すべて元のリポジトリを指しています。寄付の案内も、BBPlayer の作者への寄付で、BBMusica とは関係ありません。

---

<div align="center">
<img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/apps/mobile/assets/images/icon_large.png" alt="logo" width="50" />
<h1>BBPlayer</h1>

React Native で作った、ローカル優先の Bilibili 音声プレーヤーです。軽くて心地よい聴き心地で、重くて遅い Bilibili の公式アプリから離れられます。

[![GitHub Release](https://img.shields.io/github/v/release/yanyao2333/bbplayer?style=flat-square)](https://github.com/bbplayer-app/bbplayer/releases)
![React Native](https://img.shields.io/badge/React%20Native-20232A?style=flat-square&logo=react&logoColor=sky)
[![Website](https://img.shields.io/badge/Website-bbplayer.roitium.com-blue?style=flat-square)](https://bbplayer.roitium.com)

</div>

---

**[公式サイトで、くわしい説明と使い方を見る ➔](https://bbplayer.roitium.com)**

## 画面のプレビュー

<table>
  <tr>
    <th align="center" width="50%">ホーム</th>
    <th align="center" width="50%">ライブラリ</th>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/assets/screenshots/home.jpg" alt="ホーム：検索の入口、最近の検索、下の再生バー" width="280" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/assets/screenshots/library.jpg" alt="ライブラリ：プレイリスト、お気に入り、コレクション、分割P動画の分類" width="280" /></td>
  </tr>
  <tr>
    <td align="center">検索の入口 · 最近の検索 · すぐ再生</td>
    <td align="center">ローカルのプレイリスト · B站のお気に入り · コレクションの管理</td>
  </tr>
  <tr>
    <th align="center">マイページ</th>
    <th align="center">検索結果</th>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/assets/screenshots/profile.jpg" alt="マイページ：アカウント管理、累計の再生時間、再生記録のヒートマップ" width="280" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/assets/screenshots/search.jpg" alt="検索結果：関連する投稿者と動画の一覧" width="280" /></td>
  </tr>
  <tr>
    <td align="center">アカウント管理 · 再生の統計 · 履歴のヒートマップ</td>
    <td align="center">音楽を見つける · 投稿者を探す · すぐ再生</td>
  </tr>
  <tr>
    <th align="center">音楽の再生</th>
    <th align="center">逐字歌詞</th>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/assets/screenshots/music-player.jpg" alt="音楽プレーヤー：カバーの色を取った背景、レコード型のカバー、波形のシークバー" width="280" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/assets/screenshots/lyrics.jpg" alt="逐字歌詞：日本語の歌詞を進行に合わせて強調し、中国語の翻訳を並べて表示" width="280" /></td>
  </tr>
  <tr>
    <td align="center">カバーの色を取った背景 · 波形のシークバー</td>
    <td align="center">1文字ずつ強調 · 翻訳の並べ表示 · 自動で追従</td>
  </tr>
  <tr>
    <th align="center">ポッドキャストモード</th>
    <th align="center">字幕の閲覧と検索</th>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/assets/screenshots/podcast-player.jpg" alt="ポッドキャストのプレーヤー：字幕のプレビュー、前後へのジャンプ、倍速、スリープタイマー" width="280" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/assets/screenshots/podcast-search.gif" alt="ポッドキャストの字幕検索のデモ：「数据」を検索し、キーワードを強調して、一致した箇所を切り替える" width="280" /></td>
  </tr>
  <tr>
    <td align="center">倍速再生 · スリープタイマー · 前後へのジャンプ</td>
    <td align="center">全文の閲覧 · キーワード検索 · 結果の位置へ移動</td>
  </tr>
</table>

<p align="center"><sub>上は、Android 版の画面です。歌詞のデモには BV1auGwzMEs1 を、ポッドキャストの素材には、硅谷101『対話 Maxinsights』を使っています。<a href="https://bbplayer.roitium.com/guides/podcast/">ポッドキャストの使い方を見る →</a></sub></p>

## 主な機能

### 再生の基本

- **Bilibili へのログイン**: **QR コード**、**電話番号（SMS の認証コード）**、または Cookie の手動設定で、ログインできます。
- **再生ソース**: ローカルのプレイリストを自由に作れます。ログインすると、アカウント内のお気に入りや、購読しているコレクションにも、そのままアクセスできます。手軽さと便利さを両立しています。
- **外部プレイリストの取り込み**: **NetEase Cloud Music（网易云音乐）** と **QQ 音楽** のプレイリストから、B 站の動画を自動で照合して、プレイリストとして保存できます。
- **フル機能のプレーヤー**: 再生 / 一時停止、リピート、シャッフル、再生キュー、音量の自動調整、続きから再生、起動時の自動再生などがあります。
- **検索**: スマート検索です。BV 番号 / AV 番号や、b23.tv の短縮リンクを解析できます。お気に入りの中や、ローカルのプレイリストの中の検索もあります。

### 歌詞

- **SPL 対応**: [SPL 規格](https://bbplayer.roitium.com/SPL)に基づいて、**逐字の進行**、**ローマ字のふりがな**、**翻訳歌詞**を表示できます。
- **スマートな取得**: 歌詞の自動照合（NetEase Cloud Music / QQ 音楽 / Kugou Music）に対応します。手動の検索、LRC / SPL テキストの貼り付け、オフセットの調整もできます。
- **いろいろな表示**: デスクトップ歌詞（フローティングウィンドウ）と、ステータスバー歌詞に対応します。

### テーマ

アプリの中で、B 站の**どんな**テーマ（装扮）でも検索して、適用できます。次の部分に対応しています。

- ナビゲーションバー
- 起動アニメーション
- シークバーのつまみのアイコン
- いいねのアニメーション
- ページ上部の背景
- アイコンフレーム

### そのほかの特長

- **ダウンロードと書き出し**: 曲を保存して、オフラインで再生できます。シンプルで実用的なダウンロード管理もあります。保存済みの曲を、カバー、メタデータ、埋め込み歌詞つきの `.m4a` ファイルとして、端末のストレージへ書き出すこともできます。
- **UI**: ライト / ダークモードに対応します。UI は Material Design 3 に深く合わせてあり、Material You（Monet）の色取りにも対応します。
- **便利な道具**: スリープタイマー、再生履歴の統計（ランキング）などがあります。

ほかにも、たくさんの機能と驚きがあります。ぜひ[公式サイト](https://bbplayer.roitium.com)で見てみてにゃ！

## 技術スタック

- **フレームワーク**: React Native、Expo
- **状態管理**: Zustand
- **データ取得**: React Query
- **UI**: Material Design 3（React Native Paper + ExpoUI）
- **再生ライブラリ**: [@bbplayer/orpheus](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages/orpheus)（Media3 ベース）
- **ORM**: Drizzle ORM

## プロジェクトの構成（モノレポ）

- **[apps/mobile](https://github.com/bbplayer-app/BBPlayer/tree/dev/apps/mobile)**: BBPlayer のモバイルアプリの中心となるコード。
- **[apps/backend](https://github.com/bbplayer-app/BBPlayer/tree/dev/apps/backend)**: バックエンドのサービス。プレイリストの共有と、ソフトの更新の確認を提供します（Cloudflare Worker）。
- **[apps/docs](https://github.com/bbplayer-app/BBPlayer/tree/dev/apps/docs)**: プロジェクトのドキュメントサイト。
- **[apps/update-publisher](https://github.com/bbplayer-app/BBPlayer/tree/dev/apps/update-publisher)**: 更新を公開するためのツール。
- **[packages/](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages)**: 共有のライブラリとツール。
  - **[@bbplayer/splash](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages/splash)**: 歌詞の解析と変換の中心となるライブラリ。
  - **[@bbplayer/eslint-plugin](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages/eslint-plugin)**: BBPlayer 専用の lint ルール（oxlint の jsPlugins で動かします）。
  - **[@bbplayer/orpheus](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages/orpheus)**: Media3 ベースの音声再生エンジン。
  - **[@bbplayer/logs](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages/logs)**: ログのライブラリ。
  - **[@bbplayer/image-theme-colors](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages/image-theme-colors)**: カバーの色を取り出すツール。
  - **[@bbplayer/native](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages/native)**: BBPlayer のネイティブ機能をまとめたモジュール。
  - **[@bbplayer/heatmap](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages/heatmap)**: SVG で作った、日付のヒートマップ部品。
  - **[expo-wavy-slider](https://github.com/bbplayer-app/BBPlayer/tree/dev/packages/expo-wavy-slider)**: Jetpack Compose の WavySlider を、Expo のモジュールで包んだもの。

## iOS への対応

以前は、iOS にも基本的な対応をしていました。しかし、いまの中心は Android です。iOS 版は並行して開発しておらず、ビルドできることは保証できません。

## プライバシーと利用状況の統計

BBPlayer をよりよくし続けるために、アプリの中に、軽い匿名のデータ収集の仕組み（Firebase Analytics と Sentry）を組み込んでいます。

### 何を集めるか

1. **利用データ**: 機能を使う頻度、再生セッションの長さなど。
2. **クラッシュレポート**: アプリが落ちたときのスタック情報。バグの修正に役立てます。

### プライバシーの約束

- **匿名**: すべてのデータに、**個人を特定できる情報は含まれません**。
- **透明**: アカウントのプライバシーに関わる情報（Cookie の中身、閲覧履歴の詳細など）は、いっさい集めません。統計のコードは、すべてオープンソースで見られます。
- **コントロール**: 「設定 → 一般設定」の「データを共有（クラッシュレポートと匿名の統計）」のスイッチを、いつでもオフにできます。オフにすると、データの送信は完全に止まります。

## 寄付での応援

BBPlayer が役に立ったと思ったら、寄付での応援を考えてもらえるとうれしいです。いただいた寄付は、すべて、Roitium が「クレイジー・サーズデー」（KFC の木曜日のキャンペーン）を食べたり、ギャルゲーを買ったりするために使われます！

<table>
<tr>
<td align="center">
<details>
<summary>WeChat Pay</summary>
<br />
<img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/apps/mobile/assets/images/wechat.png" alt="WeChat Pay の寄付" width="200" />
</details>
</td>
<td align="center">
<details>
<summary>Alipay</summary>
<br />
<img src="https://raw.githubusercontent.com/bbplayer-app/BBPlayer/dev/apps/mobile/assets/images/alipay.jpg" alt="Alipay の寄付" width="200" />
</details>
</td>
</tr>
</table>

## 謝辞

このプロジェクトの開発では、先輩たちから、たくさんの機能とデザインのヒントをもらいました。たとえば、次のものがあります。

- [AzusaPlayer](https://github.com/lovegaoshi/azusa-player-mobile)
- [BiliSound](https://github.com/bilisound/client-mobile)
- [Salt Player](https://github.com/Moriafly/SaltPlayerSource)
- [Spotify](https://spotify.com)

そして、いちばん大切な [Bilibili](https://www.bilibili.com/)

ここに、感謝を表します！（お辞儀）

## Star History

<a href="https://www.star-history.com/?repos=bbplayer-app%2FBBPlayer&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=bbplayer-app/BBPlayer&type=date&theme=dark&legend=top-left&sealed_token=dX4uwZ7hHGaVsselUSXuc8sw1gVheSsQ-1WqJT_RWHZlQlGbnnxQ0tbT5Cmw8kJqwylH9pIZvI0AtnFj7rG3t3XxSUKCAuCK4AiBmKAmkksc1v9-hczB1ogKJEVVF_MrHS0DXPODyp_ZSG9fddCPA-oWZ_1zFWAGIwQSOQ6t3r-SLvzhHujJB-n7GJQ3" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=bbplayer-app/BBPlayer&type=date&legend=top-left&sealed_token=dX4uwZ7hHGaVsselUSXuc8sw1gVheSsQ-1WqJT_RWHZlQlGbnnxQ0tbT5Cmw8kJqwylH9pIZvI0AtnFj7rG3t3XxSUKCAuCK4AiBmKAmkksc1v9-hczB1ogKJEVVF_MrHS0DXPODyp_ZSG9fddCPA-oWZ_1zFWAGIwQSOQ6t3r-SLvzhHujJB-n7GJQ3" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=bbplayer-app/BBPlayer&type=date&legend=top-left&sealed_token=dX4uwZ7hHGaVsselUSXuc8sw1gVheSsQ-1WqJT_RWHZlQlGbnnxQ0tbT5Cmw8kJqwylH9pIZvI0AtnFj7rG3t3XxSUKCAuCK4AiBmKAmkksc1v9-hczB1ogKJEVVF_MrHS0DXPODyp_ZSG9fddCPA-oWZ_1zFWAGIwQSOQ6t3r-SLvzhHujJB-n7GJQ3" />
 </picture>
</a>

## オープンソースライセンス

このプロジェクトは、MIT ライセンスです。
