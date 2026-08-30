# LP コンテンツ構成案

> ステータス: **実装に追従**。下記セクションは `src/pages/index.astro` に実装済み。
> 2026-06 時点の本体 SPEC 進捗 (v0.2–v0.5 実装済み、戦闘刷新 epic 実装済み、v1.0 一部実装済み) に合わせてコピーを更新済み。
> ショーケース/ヒーローの実アセット差し込みは完了済み。文言や訴求の磨き込みは継続課題。

紹介ページとして 1 ページ (シングルページ) で完結させる想定。上から下へ読むだけで
「何のゲームか → 面白さ → 仕組み → 疑問の解消 → プレイ」までたどり着ける構成にする。

## セクション構成 (実装済み)

実際の並び順は `src/pages/index.astro` を正とし、本ドキュメントはその対応表として保つ。

1. **ヒーロー (ファーストビュー)** — `HeroSection`
   - キャッチコピー + 一言説明
   - 「今すぐプレイ」ボタン (web 版へ) / 「GitHub を見る」ボタン
   - ゲーム画面のスクリーンショット、または `public/hero-battle.{webm,mp4}` +
     `hero-poster.jpg` による短い自動再生動画 (実アセット差し込み済み)

2. **コンセプト** — `ConceptSection`
   - 「直接操作しない。AI ルールを組んで戦わせる」という核を説明
   - 設計 → 観察 → デバッグ → 改善のサイクルが面白さ、という訴求

3. **遊び方 (3 ステップ)** — `HowToPlaySection`
   - ① ルールを組む (行動ルール式) → ② 自動戦闘を見る → ③ ログで分析して直す

4. **特徴 / 魅力** — `FeaturesSection`
   - 行動ルール式 + 簡易プログラム UI / 複数ユニット・障害物・武器などの戦術要素 /
     ログとリプレイによる分析

5. **プログラム言語** — `ProgramSection`
   - 行動ルール UI とテキストの簡易プログラム言語が相互変換できることを紹介
   - 構文は本体 `docs/program-language.md` を正典とし、実在する語のみ使用する
   - この整合性を自動検証する CI は無い(本体が private のため cross-repo diff には
     PAT secret の追加が必要でコストに見合わないと判断・見送り済み。
     keroway/code-tactics-lp#166 参照)。本体側で構文が変わった場合は
     `ProgramSection.astro` のサンプルを手動で見直すこと

6. **どう動くか (HowItWorks)** — `HowItWorksSection`
   - ルール → シミュレーション → ログ → 改善の流れを図解的に補足し、
     コンセプト/遊び方の説明を実装イメージに落とし込む

7. **到達点とロードマップ** — `RoadmapSection`
   - MVP から v0.5・戦闘刷新・v1.0 一部実装までの到達点と、残タスク (本体 SPEC に連動)

8. **FAQ** — `FaqSection`
   - 「プログラミング知識は必要？」「無料？」など、プレイ前の心理障壁を下げる Q&A

9. **フッター / CTA** — `Layout.astro` (Footer)
   - プレイ導線・GitHub・ライセンス・クレジット

> 当初ドラフトの「スクリーンショット or デモ」専用セクションは独立せず、
> ヒーロー/特徴/HowItWorks 内に分散して取り込んでいる。

## 用意したアセット (差し込み済み)

- ゲーム画面のスクリーンショット数点 (`src/assets/` に配置、`HeroSection.astro` /
  `HowItWorksSection.astro` で使用)
- 5〜10 秒のプレイ動画 (`public/hero-battle.webm`, `public/hero-battle.mp4`) と
  poster (`public/hero-poster.jpg`)
- 実ゲーム画面ベースの OGP 画像 (SNS シェア用)

## コピーの素材

- ゲーム概要・コンセプト・ロードマップは本体の
  [SPEC.md](https://github.com/keroway/code-tactics/blob/main/SPEC.md) が正典。
  ここから言い回しを引いて LP 向けに短くする。
- 簡易プログラム言語は本体 `docs/program-language.md`、キャンペーンは ADR 0009、
  戦闘刷新は ADR 0010/0011、公開方針は ADR 0012 も参照する。
