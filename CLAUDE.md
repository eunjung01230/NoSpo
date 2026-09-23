# NoSpo

“다 본 사람 말고, 나만큼 본 사람들과.” 작성자가 지정한 글의 내용 범위와 독자의
감상 진도를 비교해 감상 글을 공개하는 웹 커뮤니티. AI 스포일러 판별 서비스가 아니다.

## 스택
Next.js(App Router, TypeScript) + Neon Postgres(`@neondatabase/serverless`).
연결 문자열은 `.env.local`의 `DATABASE_URL`(gitignore 대상, 출력·로그 금지).
스키마와 시연 데이터: `npm run db:setup` (재실행해도 기존 데이터를 덮어쓰지 않음).

## 핵심 규칙
- 공개 조건: `글의 max_stage <= 현재 사용자의 진도`. 판정은 항상 서버에서 한다.
- 게시판(감상/질문/해석/후기)은 `posts.board_type` 한 컬럼으로 구분한다. 게시판별 테이블을
  만들지 않으며, 게시판·내 글 필터는 공개 조건에 AND로만 덧붙인다.
- 화면에서는 게시판이 각각 독립된 공간으로 보이게 한다: 고유 주소
  (/works/[workId]/impressions|questions|analysis|reviews), 고유 제목·설명, 목록,
  게시판별 글쓰기 버튼. 슬러그와 타입 매핑은 lib/boards.ts에만 둔다.
- 수정·삭제는 `author_id = 현재 사용자`를 SQL 조건으로 강제하고, 0행이면 권한 없음으로 본다.
- 진도는 올리기와 낮추기 모두 가능하다. 낮추면 그 이후 글이 즉시 다시 숨겨지고 글은 남는다.
- 진도 단위는 works.progress_unit으로 구분한다: episode(화), film(편), volume(권),
  single(단일 작품, 단계 1개 "봤다"). 단일 영화를 회차로 억지 분할하지 않는다.
- 작품 데이터는 저작권 보호를 위해 작품명·포맷·진도 단위·한 줄 소개만 저장한다.
- 작품은 여러 개를 지원한다. 회차 표기는 `work_stages.label`과 `works.progress_unit`에서
  가져오고 화면에 "N화"를 하드코딩하지 않는다.
- 제한된 글의 제목·본문·미리보기는 쿼리 단계에서 제외한다. CSS나 화면 조건문으로
  숨기지 않고, 목록·상세·서버 렌더링 결과 어디에도 포함하지 않는다.
- 현재 사용자는 httpOnly 쿠키 id를 DB와 대조해 서버에서 확정한다. 모든 응답은
  `Cache-Control: no-store, private` + `Vary: Cookie` (next.config.ts).
- 사용자 전환은 공개 시연 장치이며 실제 인증이 아니다. 화면에 '시연 사용자'로 표시한다.
- 진도는 `사용자 + 작품` 조합으로 저장한다. 다른 작품·시리즈와 자동 연동하지 않는다.
- 작성 시 묻는 값은 '글에 포함된 마지막 회차'이며 작성자의 전체 진도와 다르다.
  이번 구현에서는 자기 진도 이하만 선택 가능(서버 검증).
- 빈 제목·본문, 존재하지 않는 회차 등 입력 오류는 서버에서도 검증한다.
- 시연 데이터는 `is_demo_seed`로 표시하고 실제 사건·결말을 지어내지 않는다.

## 나중에 로그인 추가할 자리
신원 확인은 `lib/session.ts`의 `getCurrentUser()` 한 곳에서만 결정하고, 데이터 함수는
모두 `userId`를 인자로 받는다. 실제 로그인을 붙일 때는 이 함수의 구현(쿠키 → 세션)만
교체하면 되고 화면·쿼리는 그대로 둔다. `users` 테이블도 그대로 쓰고 인증 식별자 컬럼만 더한다.

## 환경 변수
Vercel 프로젝트 `nospo`에 Neon 통합으로 `DATABASE_URL` 등이 Preview/Production에
등록되어 있다. Secret이라 `vercel env pull`로는 값을 내려받을 수 없으므로, 로컬은 Neon
콘솔의 연결 문자열을 `.env.local`에 직접 입력한다. 연결 확인은 `npm run db:check`.

## 작품 메타
포스터 이미지는 저작권이 있으므로 파일을 저장하지 않고, 공개 API가 주는 주소만
works.poster_url에 담아 불러온다(영화·드라마·애니는 TMDB — TMDB_API_KEY 필요,
책·만화는 Open Library). 채우는 스크립트는 npm run posters이며, 주소가 없으면 같은
비율의 자리표시자가 나온다. 줄거리 전문·대사는 저장하지 않고 한 문단 소개와 연도·제작자만 둔다.

## 카테고리
작품은 분야(works.category: movie/drama/anime/comic/book), 국내외(works.origin:
domestic/foreign, 영화·드라마만), 장르(works.genre)로 분류한다. 탐색은 왼쪽 CATEGORIES 사이드바(app/CategorySidebar.tsx)로 하며, 현재 분야 아래에
국내·외국과 장르가 펼쳐진다. 경로는
/categories/[category] → (영화·드라마는 [origin] →) [genre] 순이며, 슬러그 매핑과
분야 목록은 lib/categories.ts 한 곳에만 둔다. 분류는 작품 메타일 뿐이고 글 공개 판정에는
관여하지 않는다.

## 디자인
밤의 서재 톤(웜 다크 + 종이). 토큰은 app/globals.css의 --ns-* 한 곳에서만 정의한다:
어두운 층(배경 #27221F → 섹션 #342D29 → 패널 #3A322D)은 탐색·진도, 밝은 종이 층
(#E7DED2 / 작성 #EEE7DC / 입력 #FBF8F3)은 읽고 쓰는 영역이다. 와인색 #7A4E4E와
말린 장미 #C08A7E는 회차·진도·주요 행동에만 쓴다. 서체는 제목·진도 Gowun Batang,
본문 Pretendard, 숫자·라벨 IBM Plex Mono. 반경은 2·4와 세그먼트 pill만, 그림자는 쓰지 않는다.
게시판은 같은 종이 시트 안에서 목록 형식이 달라진다(감상 행 / 질문 Q. / 해석 넓은 행 / 후기 카드).

## 이번 범위 밖
댓글, 좋아요, 검색, 사용자 작품 등록, AI 판별, 추천, 알림, 관리자 화면, 잠금 카드 UI.
미정: 서비스명·최종 디자인, 잠금 카드 표시 방식.
