<div align="center">
<img src="./apps/mobile/assets/images/icon-bbmusica.png" alt="BBMusica" width="96" />
<h1>BBMusica</h1>

Bilibili の音楽を、軽く気持ちよく聴くための Android 向けプレーヤーです。
アカウント登録は要りません。日本語と中国語に対応しています。

**[ダウンロード ➔ www.aruteko.com/BBmusica](https://www.aruteko.com/BBmusica)**

</div>

---

## 画面のプレビュー

<table>
  <tr>
    <th align="center" width="50%">ホーム</th>
    <th align="center" width="50%">ライブラリ</th>
  </tr>
  <tr>
    <td align="center"><img src="./assets/screenshots/home.jpg" alt="ホーム：ステーションの大きな画像、最近再生した曲、下の再生バー" width="280" /></td>
    <td align="center"><img src="./assets/screenshots/library.jpg" alt="ライブラリ：プレイリスト、お気に入り、コレクション、分割P動画を、2列のグリッドで表示" width="280" /></td>
  </tr>
  <tr>
    <td align="center">ステーション · 最近再生 · 検索欄をタップで履歴</td>
    <td align="center">プレイリスト · お気に入り · コレクション · 分割P</td>
  </tr>
  <tr>
    <th align="center">マイページ</th>
    <th align="center">検索結果</th>
  </tr>
  <tr>
    <td align="center"><img src="./assets/screenshots/profile.jpg" alt="マイページ：Bilibili アカウント、累計の再生時間、再生記録のヒートマップ" width="280" /></td>
    <td align="center"><img src="./assets/screenshots/search.jpg" alt="検索結果：関連する投稿者と動画の一覧" width="280" /></td>
  </tr>
  <tr>
    <td align="center">アカウント · 再生の統計 · 履歴のヒートマップ</td>
    <td align="center">投稿者と動画をまとめて検索 · すぐ再生</td>
  </tr>
  <tr>
    <th align="center">音楽の再生</th>
    <th align="center">歌詞</th>
  </tr>
  <tr>
    <td align="center"><img src="./assets/screenshots/music-player.jpg" alt="音楽プレーヤー：丸いカバー、波形のシークバー、ハート（いいね）" width="280" /></td>
    <td align="center"><img src="./assets/screenshots/lyrics.jpg" alt="歌詞：ローマ字つきの歌詞を、再生に合わせて強調して表示" width="280" /></td>
  </tr>
  <tr>
    <td align="center">丸いカバー · 波形のシークバー · いいね</td>
    <td align="center">ローマ字 · 翻訳 · 自動で追従</td>
  </tr>
  <tr>
    <th align="center" colspan="2">MV（動画）の再生</th>
  </tr>
  <tr>
    <td align="center" colspan="2"><img src="./assets/screenshots/mv-player.gif" alt="MV の再生：プレーヤーの画面を横にスワイプすると、丸いカバーが動画に切り替わる" width="280" /></td>
  </tr>
  <tr>
    <td align="center" colspan="2">プレーヤーの画面を横にスワイプすると、MV（動画）を見られます</td>
  </tr>
</table>

<p align="center"><sub>上は、Android 版の画面です（中国語の表示。日本語の表示にも対応しています）。MV のデモには、Bilibili の「《明日方舟》EP - 酸橙色信笺」（明日方舟）を使っています。</sub></p>

## 特長

- **ログインなしで使える**: 検索、再生、投稿者のページは、Bilibili にログインしなくても使えます。ログインすると、お気に入り、フォロー、あとで見る、いいねも使えます。
- **ステーション**: ホームの大きな画像の曲から始めて、似た曲を続けて流します。
- **プレイリスト**: ローカルのプレイリスト、Bilibili のお気に入り・コレクション・分割P動画の同期、外部プレイリストの取り込みができます。
- **歌詞**: 逐字歌詞、翻訳、ローマ字、デスクトップ歌詞に対応しています。
- **MV**: プレーヤーの画面を横にスワイプして、動画を見られます。
- **ダウンロードとバックアップ**: 曲を端末に保存できます。データは、1つの zip にまとめて書き出せます。
- **見た目**: ライト / ダーク、Bilibili のテーマ（装扮）に合わせた配色、波形のシークバー、イコライザー。
- **日本語 / 中国語**: 端末の言語に合わせます。設定で切り替えられます。

## 注意

BBMusica は、個人が作った非公式のアプリです。Bilibili とは関係ありません。
Bilibili の利用規約を守って、自分の責任で使ってください。

## 元になったプロジェクト

BBMusica は、Roitium さんの **[BBPlayer](https://github.com/bbplayer-app/BBPlayer)**（MIT ライセンス）をもとに作りました。
素晴らしいプロジェクトを公開してくださったことに、敬意と感謝を込めて。

変更した主な点は、[NOTICE.md](./NOTICE.md) にまとめています。

## 作る

Windows のパソコンで、APK を作る手順です。

```bash
corepack pnpm install
corepack pnpm type-check
corepack pnpm lint
```

APK の作り方は、[scripts/build-local.ps1](./scripts/build-local.ps1) の先頭に書いてあります。
リリース用の署名鍵は、リポジトリには入れず、自分の `~/.gradle/gradle.properties` に書きます（`BBMUSICA_STORE_FILE` など）。

## プライバシー

[PRIVACY.md](./PRIVACY.md) を見てください。

## ライセンス

MIT ライセンスです。[LICENSE](./LICENSE) を見てください。

---

<details>
<summary>English</summary>

BBMusica is an unofficial Android player for Bilibili music, built on top of
[BBPlayer](https://github.com/bbplayer-app/BBPlayer) by Roitium (MIT).
No account is needed. The UI is available in Japanese and Chinese.
Download: <https://www.aruteko.com/BBmusica>. It is not affiliated with Bilibili.

</details>
