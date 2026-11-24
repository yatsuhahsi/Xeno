XENO 非公式・仲間内対戦版 / 初回実装 v1.0
====================================================
対象: GitHub Yatsuhahsi / XENO
予定URL: https://yatsuhahsi.github.io/XENO/
Firebase: xeno-f6d63（接続設定組み込み済み、Spark想定）

■ 公開前に
本作は非公式ファン実装です。原作のイラスト・音源は使用せず、
承認済み生成画像と独自の合成音を使っています。GitHub Pagesのファイルは
一般から閲覧可能です。公開・配布については権利者の許諾や利用条件を確認してください。
無料プランのホスト管理方式のため、ホストは技術的に全手札・山札を閲覧/改変できます。
4桁のルームコードは強い認証情報ではありません。仲間内でのみ共有し、参加者を確認してください。

■ 1. Firebase の設定
1) https://console.firebase.google.com/project/xeno-f6d63/overview を開く
2) Authentication → Sign-in method → 匿名（Anonymous）を有効化、保存。
3) Realtime Database → ルール を開く。
4) このZIPの database.rules.json をテキストエディタで開き、内容全体をコピー。
5) Firebaseのルール欄を全選択し、上記の内容に置換。「公開」を押す。
   既存の他プロジェクトのルールは変更しない。
6) Authentication → Settings → Authorized domains に
   yatsuhahsi.github.io を登録（匿名認証だけなら通常必須ではない）。
7) データベースURLは https://xeno-f6d63-default-rtdb.firebaseio.com であることを確認。
   firebase-config.js は編集不要。サービスアカウント秘密鍵は使用しない。

■ 2. GitHub Pages 公開
1) https://github.com/Yatsuhahsi/XENO を開く（なければ https://github.com/new から Public で作成）。
2) ZIPを展開する。
3) リポジトリの Add file → Upload files を選ぶ。
4) 展開したファイルの中から以下をドラッグ&ドロップ。ZIPのままではなく、中身を置く。
   index.html / style.css / game.js / engine.js / firebase-config.js / assets フォルダ
   database.rules.json / README.txt / engine.test.mjs は任意（公開動作には不要）。
   index.html がリポジトリの最上位になるようにする。assets/cards 以下の画像も必須。
5) Commit changes を押す。
6) Settings → Pages → Source: Deploy from a branch → main / (root) → Save。
7) Actions / Pages にて公開が成功したことを確認し、予定URLを開く。

■ 3. 最初の対戦テスト
1) ホストが名前を入力してルーム作成。ルールと制限時間を選択。
2) 4桁のコードを別の端末/ブラウザプロファイルの参加者に伝える。
   同じブラウザの通常タブは匿名認証UIDを共有するため、別人として参加できない場合がある。
3) 参加者が名前とコードを入力して参加。ホストが参加者を確認しゲーム開始。
4) ドロー、相手から裏面が見えること、ドラッグ、シャッフル、発言、カード使用を確認。
5) 死神を使用した場合: 対象の追加ドロー→シャッフルする/しない→カード選択。
   選択中は再シャッフル不可。対象者は手札を移動可能。
6) 兵士の数字選択: 相手に検討中の数字を表示。確定で判定。
7) 設定ボタンで詳細表示、使用前確認、演出短縮、BGM/SE音量を変更。
8) 終了後は残り山札・転生札を公開。同じルームで再戦できる。
9) 通信切断時は、元と同じブラウザ/プロファイルでコードを入れ直して復帰。
   ホストが離脱している間はゲーム進行を処理できない。ホストの引き継ぎはない。
   ホストは同一ルームを複数のタブで同時に開かないこと。
10) ロビーまたは対戦終了時にホストが退出するとルームを削除する。
    突然の閉鎖で残った古いルームはFirebaseのデータタブから rooms/<4桁> を削除可能。
    使用中のルームを削除しないこと。

■ エラー確認
・匿名認証に失敗: Authentication の匿名認証が有効か確認。
・Permission denied: Realtime Databaseのルールが完全に貼り付けられ、公開されているか確認。
・画像が出ない: assets/cards/01.webp ～ 10.webp と back.svg の配置を確認。
・参加できない: ホストのページが開いているか、コード、参加ロック、人数を確認。
・ページ404: main/(root) 設定、index.htmlの位置、Actionsの公開結果を確認。
・BGMが鳴らない: ブラウザの自動再生制限により初回クリック/タップ後に再生。音量設定も確認。

■ 実装・検証の範囲
ゲームエンジン: 全10種の処理、18枚の保存則、2～4人のランダム対戦3,000回、
死神のID更新・再シャッフル拒否、革命、英雄の転生と皇帝による阻止、貴族新ルールを確認。
JavaScript構文チェックとルールJSONの形式チェック済み。
実際のFirebaseへのログイン、ルールのコンパイル・許可/拒否テスト、ブラウザ上の実通信と
描画・タッチ・音声の実機テストは未実施。公開後の初回テストが必要。
細部の演出、同期遅延、スマホ画面の配置などは実機での調整を想定。

■ データの構成
rooms/<code>/meta      ホストUID・作成日時（認証ユーザーが直接コード指定で確認可）
rooms/<code>/state     ホストのみ読み書き可能なゲーム原本
rooms/<code>/public    参加者向け公開状態。秘密のカード数字は含めない
rooms/<code>/private/<UID> 本人とホストのみ読める手札・一時的な透視情報
rooms/<code>/requests/<UID> 操作要求。ホストが検証・反映
rooms/<code>/motion/<UID> 位置・角度（カードの公開ID）
rooms/<code>/cursor/<UID> 選択状況
rooms/<code>/chat      生存者/脱落者のチャットを分離
シャッフルは順番をランダム化し、公開カードIDも再生成。位置のログから対応付けにくくする。
参加者にホスト用ゲーム原本を配信しない。ただし改造クライアント対策を完全保証するものではない。

■ 参考
原作のルール: https://www.happybrainwash.com/xeno
Firebase認証: https://firebase.google.com/docs/auth/web/anonymous-auth
Firebaseルール: https://firebase.google.com/docs/database/security
