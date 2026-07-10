# Proofline Issue Tracker Design

## 1. 분위기와 시그니처

페이지가 아니라 작업 도구로 보이는 이슈 원장이다. 48px 컨텍스트 바 아래에 폴더 상태, 상태 탭, 검색, 이슈 목록이 바로 이어진다. 큰 제목, 소개 문장, KPI 카드, 장식 그림자는 없다. GitHub Issues의 검증된 목록 토폴로지와 Linear My Issues의 상태 그룹 밀도를 사용한다.

## 2. 색상

### 라이트 모드

- `#f6f8fa` `--bg`: 앱 배경과 그룹 헤더
- `#ffffff` `--surface`: 목록과 입력 표면
- `#f3f4f6` `--surface-hover`: 행과 컨트롤 호버
- `#1f2328` `--text-strong`: 제목과 현재 위치
- `#25292e` `--text`: 본문
- `#59636e` `--muted`: 메타 정보
- `#818b98` `--subtle`: 비활성 정보
- `#d0d7de` `--line`: 기본 경계
- `#8c959f` `--line-strong`: 호버 경계
- `#0969da` `--accent`: 선택과 포커스
- `#ddf4ff` `--accent-soft`: 선택된 상태 탭 배경
- `#ffffff` `--on-accent`: 강조 버튼 글자
- `rgba(9, 105, 218, 0.3)` `--focus-ring`: 키보드 포커스
- `#cf222e` `--critical`, `#9a6700` `--high`, `#0969da` `--medium`, `#1a7f37` `--low`: 위험도와 상태

### 다크 모드

- `#0d1117` `--bg`, `--surface`: 앱 배경과 목록 표면
- `#151b23` `--surface-subtle`: 그룹 헤더와 상세 표면
- `#212830` `--surface-hover`: 행과 컨트롤 호버
- `#f0f6fc` `--text-strong`: 제목과 현재 위치
- `#c9d1d9` `--text`: 본문
- `#9198a1` `--muted`: 메타 정보
- `#6e7681` `--subtle`: 비활성 정보
- `#3d444d` `--line`: 기본 경계
- `#8b949e` `--line-strong`: 호버 경계
- `#4493f8` `--accent`: 선택과 포커스
- `rgba(56, 139, 253, 0.15)` `--accent-soft`: 선택된 상태 탭 배경
- `rgba(56, 139, 253, 0.4)` `--focus-ring`: 키보드 포커스
- `#f85149` `--critical`, `#d29922` `--high`, `#58a6ff` `--medium`, `#3fb950` `--low`: 위험도와 상태

색상은 선택, 포커스, 위험도처럼 의미가 있을 때만 사용한다. 상태는 색상과 한국어 텍스트를 함께 표시한다.

## 3. 타이포그래피

- UI 스택 `"Segoe UI Variable", "Noto Sans KR", "Segoe UI", sans-serif`
- 코드 스택 `"Cascadia Code", "SFMono-Regular", Consolas, monospace`
- `--type-context` 14px / 600 / 20px / -0.1px: 제품명과 현재 위치
- `--type-body` 14px / 400 / 20px / 0: 본문과 입력
- `--type-title` 15px / 600 / 22px / -0.1px: 이슈 제목
- `--type-label` 13px / 600 / 20px / 0: 탭과 그룹 헤더
- `--type-meta` 12px / 400 / 18px / 0: ID, 날짜, 보조 정보

## 4. 간격과 그리드

- 기본 단위 4px
- `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 20px, `--space-6` 24px, `--space-8` 32px
- `--layout-max` 1200px, 데스크톱 여백 24px, 모바일 여백 12px
- `--context-height` 48px, `--connection-height` 44px, `--tabs-height` 40px
- `--control-height` 36px, `--group-height` 36px, `--issue-row-height` 56px
- `--radius-control` 6px, `--radius-list` 6px
- QA 폭은 390px, 768px, 1280px

## 5. 컴포넌트

- 컨텍스트 바: 48px, 단일 하단 경계, `Proofline / 이슈` 왼쪽, 소스 경로와 테마 오른쪽
- 폴더 연결 바: 최소 44px, 앱 배경과 같은 층, 상태 문구와 조작만 표시
- 상태 탭: 40px, 전체·열림·차단됨·해결됨과 작은 수치. 선택은 2px 하단선과 굵기 변화
- 검색 도구막대: 검색이 남은 폭, 상태·위험도 128px, 높이 36px
- 이슈 그룹: 36px 헤더에 상태명과 수치, 그룹 사이 여백 없음
- 이슈 행: 데스크톱 ID 84px, 제목 가변, 위험도 64px, 날짜 88px, 펼침 24px
- 이슈 상세: 발견 맥락과 다음 조치 2열, 근거와 Markdown은 구분선 아래
- 빈 상태: 목록 컨테이너 안에서 현재 사실과 다음 조작만 표시
- 컨트롤 상태: hover는 `--surface-hover`, focus는 2px `--focus-ring`, disabled는 50% 불투명도

## 6. 모션

- `--duration-fast` 120ms
- `--ease-out` cubic-bezier(0.16, 1, 0.3, 1)
- 배경색, 경계색, 글자색, 불투명도만 전환한다.
- 펼침은 네이티브 `details` 동작을 사용하고 레이아웃 애니메이션을 만들지 않는다.
- `prefers-reduced-motion: reduce`에서는 전환 시간을 0ms로 만든다.

## 7. 깊이

외곽 경계와 내부 구분선만 사용한다. 드롭 섀도, 글로우, 유리 효과, 떠 있는 카드가 없다. 목록 전체가 하나의 표면이며 그룹 헤더와 상세만 한 단계 어두운 표면을 사용한다.

### 금지 규칙

- 큰 H1 영역과 소개 문장 금지
- KPI 요약 카드 금지
- 상태마다 채운 배지와 장식용 점 금지
- 목적지가 없는 사이드바와 탐색 항목 금지
- 외부 제품의 로고, 아바타, 아이콘 복제 금지
