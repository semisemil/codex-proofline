# Proofline Issue Ledger Design

## 1. 분위기와 시그니처

페이지가 아니라 작업 도구로 보이는 이슈 원장이다. 상단 컨텍스트 바에 제목, 전역 검색, 폴더 조작, 테마 조작을 모으고 아래에는 상태 탭과 이슈 목록을 바로 둔다. 큰 제목 영역, 소개 문장, KPI 카드, 장식 그림자는 없다. GitHub Issues의 검증된 목록 토폴로지와 Linear My Issues의 상태 그룹 밀도 위에 글래스모피즘의 반투명 표면·배경 blur·밝은 테두리·그림자 원칙을 적용한다.

## 2. 색상

### 라이트 모드

- `#d9d0c8` `--bg`: 앱 배경과 그룹 헤더
- `#f4efeb` `--surface`: 목록과 입력 표면
- `#ded4cc` `--surface-hover`: 행과 컨트롤 호버
- `#2b2521` `--text-strong`: 제목과 현재 위치
- `#3a332e` `--text`: 본문
- `#6f6258` `--muted`: 메타 정보
- `#94867c` `--subtle`: 비활성 정보
- `#d8cec6` `--line`: 기본 경계
- `#9f8f83` `--line-strong`: 호버 경계
- `#c2410c` `--accent`: 선택과 포커스
- `color-mix(... 12%, transparent)` `--accent-soft`: 선택된 상태 탭 배경
- `color-mix(... 30%, transparent)` `--focus-ring`: 키보드 포커스
- `rgba(255, 255, 255, 0.1)` `--glass-surface`: 탭과 이슈 카드의 반투명 유리 표면
- `rgba(255, 255, 255, 0.025)` `--glass-detail`: 펼친 본문의 얇은 명암층
- `rgba(255, 255, 255, 0.68)` `--glass-border`: 유리판의 밝은 1px 경계
- `color-mix(... 10%, transparent)` `--canvas-glow`: 선택한 테마색의 낮은 대비 광원
- `rgba(62, 37, 20, 0.18)` `--glass-shadow`: 유리 패널의 따뜻한 그림자
- `#cf222e` `--critical`, `#9a6700` `--high`, `#c2410c` `--medium`, `#1a7f37` `--low`: 위험도와 상태

### 다크 모드

- `#100f0e` `--bg`, `#151311` `--surface`: 앱 배경과 목록 표면
- `#1d1916` `--surface-subtle`: 그룹 헤더와 상세 표면
- `#2b2520` `--surface-hover`: 행과 컨트롤 호버
- `#faf7f4` `--text-strong`: 제목과 현재 위치
- `#d8d0c9` `--text`: 본문
- `#a79b91` `--muted`: 메타 정보
- `#776c64` `--subtle`: 비활성 정보
- `#4b4038` `--line`: 기본 경계
- `#95877c` `--line-strong`: 호버 경계
- `#fb923c` `--accent`: 선택과 포커스
- `color-mix(... 15%, transparent)` `--accent-soft`: 선택된 상태 탭 배경
- `color-mix(... 35%, transparent)` `--focus-ring`: 키보드 포커스
- `rgba(19, 16, 14, 0.12)` `--glass-surface`: 탭과 이슈 카드의 반투명 유리 표면
- `rgba(255, 255, 255, 0.015)` `--glass-detail`: 펼친 본문의 얇은 명암층
- `rgba(255, 255, 255, 0.28)` `--glass-border`: 유리판의 밝은 1px 경계
- `color-mix(... 10%, transparent)` `--canvas-glow`: 선택한 테마색의 낮은 대비 광원
- `rgba(0, 0, 0, 0.5)` `--glass-shadow`: 유리 패널의 깊은 그림자
- `#f85149` `--critical`, `#d29922` `--high`, `#fb923c` `--medium`, `#3fb950` `--low`: 위험도와 상태

색상은 선택, 포커스, 위험도처럼 의미가 있을 때만 사용한다. 네이티브 컬러 피커의 사용자 색상은 `--accent`, 텍스트 선택색, 배경 광원에만 반영하고, 위험도 색상은 테마와 분리된 고정 의미 팔레트를 사용한다. 상태는 색상과 한국어 텍스트를 함께 표시한다.

## 3. 타이포그래피

- UI 스택 `"Segoe UI Variable", "Noto Sans KR", "Segoe UI", sans-serif`
- 코드 스택 `"Cascadia Code", "SFMono-Regular", Consolas, monospace`
- `--type-context` 14px / 600 / 20px / -0.1px: 제품명과 현재 위치
- `--type-body` 14px / 400 / 20px / 0: 본문과 입력
- `--type-title` 15px / 600 / 22px / -0.1px: 이슈 제목
- `--type-label` 13px / 600 / 20px / 0: 탭과 그룹 헤더
- `--type-meta` 12px / 400 / 18px / 0: ID, 날짜, 보조 정보
- `--detail-line-height` 1.65: 펼친 상세 본문

## 4. 간격과 그리드

- 기본 단위 4px
- `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 20px, `--space-6` 24px, `--space-8` 32px
- `--layout-max` 1200px, `--detail-max` 832px, 데스크톱 여백 24px, 모바일 여백 12px
- `--context-height` 48px, `--connection-height` 44px, `--tabs-height` 40px
- `--control-height` 36px, `--group-height` 36px, `--issue-row-height` 56px
- `--radius-control` 6px, `--radius-list` 6px
- `--glass-blur` 12px, `--glass-saturation` 1.6, `--glass-brightness` 라이트 1.06 / 다크 0.92
- QA 폭은 390px, 768px, 1280px

## 5. 컴포넌트

- 컨텍스트 바: 최소 48px, `Proofline Issue Ledger` 왼쪽, 전역 검색 중앙, 다시 읽기·폴더 재지정·컬러 피커·테마 오른쪽. 좁은 화면에서는 검색과 조작을 별도 행으로 분리
- 폴더 연결 바: 초기 설정·권한·오류처럼 조치가 필요할 때만 표시하고 정상 연결 상태에서는 숨김
- 상태 탭: 40px, 각각 독립된 유리 표면에 전체·활성·보류·완료와 작은 수치. 선택은 강조 경계와 굵기 변화
- 필터 도구막대: 상태·위험도만 오른쪽에 배치하고 각 136px, 높이 36px
- 이슈 그룹: 접을 수 있는 36px 헤더에 상태명과 수치, 그룹 사이 여백 없음
- 이슈 행: 요약과 상세를 한 장의 반투명 유리판으로 묶고, 데스크톱 ID 84px, 제목 가변, 위험도 64px, 날짜 88px, 펼침 24px
- 이슈 상세: 카드 자체의 20px 배경 blur를 공유하고 내부에는 얇은 명암층과 밝은 상단 경계만 추가한다. 최대 832px 읽기 폭, 발견 맥락과 다음 조치 2열, Markdown 본문을 바로 표시하고 근거는 기본 접힘으로 공간을 절약
- 빈 상태: 목록 컨테이너 안에서 현재 사실과 다음 조작만 표시
- 컨트롤 상태: hover는 `--surface-hover`, focus는 2px `--focus-ring`, disabled는 50% 불투명도

## 6. 모션

- `--duration-fast` 120ms
- `--ease-out` cubic-bezier(0.16, 1, 0.3, 1)
- 배경색, 경계색, 글자색, 불투명도만 전환한다.
- 펼침은 네이티브 `details` 동작을 사용하고 레이아웃 애니메이션을 만들지 않는다.
- `prefers-reduced-motion: reduce`에서는 전환 시간을 0ms로 만든다.

## 7. 깊이

배경은 64px 저대비 그리드와 화면 전체에 희미하게 퍼지는 사용자 선택 테마색만 사용해 콘텐츠보다 앞으로 나오지 않게 한다. 라이트 모드는 중립 웜그레이 배경과 매우 옅은 유리 표면을 분리해 뒤 그리드가 카드 안에서 흐려지는 모습을 남긴다. 상태 탭과 각 이슈 카드는 12px blur, 160% saturation, 방향성 반사광, 밝은 상단과 어두운 하단 림, 얕은 그림자를 함께 사용한다. 펼친 본문은 별도 유리판을 중첩하지 않고 같은 카드 재질을 공유한다. 표와 코드 블록은 가독성을 위해 불투명하게 유지한다.

### 금지 규칙

- 큰 H1 영역과 소개 문장 금지
- KPI 요약 카드 금지
- 상태마다 채운 배지와 장식용 점 금지
- 목적지가 없는 사이드바와 탐색 항목 금지
- 외부 제품의 로고, 아바타, 아이콘 복제 금지
