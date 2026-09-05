# Proofline

Proofline은 Codex가 처음 요청받은 작업 범위를 놓치지 않고 실제로 확인한 결과만 완료로 보고하도록 돕는 플러그인입니다.

작업이 길어지고 대화가 쌓이면 Codex가 처음 요청의 세부 조건을 빠뜨리기 쉽습니다.
확인하지 않은 작업까지 끝났다고 보고하거나, 작업 중 발견한 후속 문제를 대화에 남겨둔 채 넘어가기도 합니다.
Proofline은 이런 누락을 줄이기 위해 대표 스킬 `proofline`을 세션마다 불러오고 작업 성격에 맞는 스킬을 제공합니다. 공통 기준은 유지하면서 대화형 응답 표현만 `normal`, `focus`, `caveman` 모드로 전환할 수 있습니다.


## ✨ Proofline을 설치하면
- 새 세션을 시작할 때 `proofline` 공통 기준과 현재 응답 모드가 자동으로 적용됩니다.
- 큰 작업과 리팩터링, 정확한 이식, 작업 완료 보고에는 작업별 스킬을 사용해 정확도를 향상시키고, 시키지 않은 작업을 수행하지 않도록 막아줍니다.
- 대화에서 발견한 버그와 후속 작업을 이슈로 등록해 프로젝트 안에 남겨 다음 세션에서 이어갈 수 있습니다.

## 📦 설치
### Codex CLI에서 설치

Proofline 마켓플레이스를 추가한 다음 플러그인을 설치합니다.

```bash
codex plugin marketplace add semisemil/codex-proofline
codex plugin add proofline@proofline
codex
```

Proofline 훅을 실행하려면 `node` 22 이상이 `PATH`에 있어야 합니다. 저장소 테스트는 Windows와 Linux의 Node 22·24를 대상으로 하며, 기능별 필수 Codex 기능과 중단 조건은 [호환성 및 지원 환경](docs/compatibility.md)에 정리되어 있습니다.

Codex가 열리면 다음 순서로 마무리합니다.

1. `/hooks`를 엽니다.
2. Proofline의 `SessionStart`, `UserPromptSubmit`, `PreToolUse` 훅을 확인하고 승인합니다.
3. 새 세션을 시작합니다.

## 🚀 빠르게 사용하기

### `proofline`과 응답 모드

`proofline`은 따로 호출하지 않아도 적용됩니다. 새 세션을 시작하거나 `/clear`, `/compact`로 대화를 정리하면 `SessionStart` 훅이 공통 기준과 현재 모드를 함께 불러옵니다. 재개(`resume`)에서는 다시 주입하지 않습니다.

특정 요청에 이 기준을 확실히 적용하고 싶다면 프롬프트 첫 줄에 스킬 이름을 적으세요.
```text
$proofline:proofline
이 문서를 처음 읽는 사람도 이해할 수 있게 고쳐줘.
```

프롬프트의 첫 비어 있지 않은 줄에서 다음 명령을 사용할 수 있습니다.

| 명령 | 결과 |
| --- | --- |
| `$proofline` | 현재 모드와 기본 모드 조회 |
| `$proofline normal` | 현재 작업을 일반 응답으로 전환 |
| `$proofline focus` | 결론·다음 행동 우선의 집중 응답으로 전환 |
| `$proofline caveman` | 기술적 정확성을 보존한 초압축 응답으로 전환 |
| `$proofline default` | 새 작업에 적용할 기본 모드 조회 |
| `$proofline default <mode>` | 기본 모드를 저장하고 현재 작업에도 적용 |

초기 기본 모드는 `normal`입니다. 현재 모드는 작업별로 저장되므로 다른 작업에는 영향을 주지 않습니다. 잘못된 명령 뒤에 작업 요청이 있으면 오류를 한 줄로 표시하고 기존 현재 모드로 나머지 작업을 계속합니다.

### 작업에 맞는 스킬 직접 부르기

Codex는 설치된 스킬 중 작업에 맞는 것을 필요할 때 불러옵니다. 중요한 작업에서 적용 기준을 분명히 하고 싶다면 스킬 이름을 직접 적으세요.
책임과 호출 경로를 실제로 바꾸는 리팩터링에는 `refactor-proof`를 사용합니다.

```text
$proofline:refactor-proof
사용자 설정 저장 책임을 서비스 계층으로 옮겨줘.
```

원본 동작을 바꾸지 않고 그대로 옮겨야 한다면 `exact-port`를 사용합니다.

```text
$proofline:exact-port
이 원본 구현을 대상 프로젝트로 동작 변경 없이 이식해줘.
```

기획부터 구현까지 이어지는 작업에는 아래의 [개발 루프](#-plan에서-구현까지)를 사용합니다.

## 🧩 포함된 스킬

| 스킬 | 사용시점       |  개선사항|
| --- | --- | --- |
| `$proofline:proofline` | 모든 대화와 결과물 | 대상 독자에 맞는 언어, 자연스러운 문장, 수정 권한, 근거가 있는 판단 |
| `$proofline:scope-integrity` | 크거나 위험하고 여러 단계로 이어지는 작업 | 처음 합의한 목표, 필수 조건, 중간 점검, 검증 계획, 범위 변경 승인 |
| `$proofline:refactor-proof` | 책임, 의존 방향, 호출 경로, 상태 흐름을 바꾸는 리팩터링 | 실제 구조 변경, 남은 기존 결합, 동작 보존 범위, 검증 근거 |
| `$proofline:exact-port` | 원본 동작을 그대로 옮겨야 하는 이식 | 원본과 대상의 대응 관계, 승인된 차이, 독립 비교 결과, 확인하지 못한 부분 |
| `$proofline:issue-ledger` | 버그나 후속 작업을 프로젝트에 남길 때 | 현재 상태, 다음 조치, 완료 조건, 핵심 결정과 판정 근거 |
| `$proofline:architecture-memory-init` | 기존 코드베이스에 아키텍처 메모리를 처음 만들 때 | C4 L1·L2 기준선, 선택적 L3, 현재 맥락, 미확인 영역 |
| `$proofline:architecture-memory` | 개발 판단에 프로젝트 맥락이 필요하거나 대화에서 지속할 정보가 나올 때 | 관련 절 검색·참조, 사용자 결정과 운영 맥락 갱신 |
| `$proofline:architecture-memory-update` | 마지막 확인 뒤의 커밋 변경을 문서에 따라잡을 때 | Git 체크포인트 이후의 관련 diff만 읽어 문서와 체크포인트 갱신 |
| `$proofline:capability-growth` | 반복되는 수작업을 자동화할지 검토할 때 | 반복 근거, 기존 도구, 가장 작은 자동화 후보, 등록 전 사용자 승인 |
| `$proofline:figure-it-out` | 기획 여부 판단부터 구현 완료까지 맡길 때 | 선택적 Plan, Plan·Spec Tenet 반복, Slice·구현·독립 검토 자동 연결 |
| `$proofline:development-plan` | 거친 제품·기능·소프트웨어·업무 시스템 아이디어를 개발 기획으로 구체화할 때 | 전체 기획 대화의 현재 의도·결정·제약 종합, Spec 작성 준비 상태 |
| `$proofline:implementation-spec` | 여러 작업이나 독립 검토가 필요한 구현 계약을 만들거나 수정할 때 | 관찰 가능한 인수 조건, 구현 전 검증 계획, Spec 수명주기 |
| `$proofline:tenet-me` | 구현 전에 Plan이나 Spec의 의도와 검증 경로를 검토할 때 | Plan 의도·Spec 인수 조건·검증 연결, 누락과 사용자 결정 확인 |
| `$proofline:spec-slice` | 준비된 Spec의 실행 구조를 계획하고 검증할 때 | Spec 루트와 Slice·SubSlice·Leaf 위치, v3 Node·Gate 실행 트리 |
| `$proofline:start-implementation` | 준비된 Spec을 구현 후 독립 검토와 함께 진행할 때 | Spec 통합 작업, Slice 조정 작업, 재귀 Leaf 실행, Gate 재검증과 독립 검토 |

## 🔁 Plan에서 구현까지

한 번에 맡기려면 `figure-it-out`을 호출합니다. Plan 필요성을 판단한 뒤 `Plan ↔ tenet-me`와 `Spec ↔ tenet-me`를 필요한 만큼 반복하고, 준비된 Spec을 `start-implementation`으로 이어갑니다. 저장소 근거로 결정할 수 없는 중요한 선택만 사용자에게 확인하며, 답변 뒤에는 새 스킬 호출 없이 중단한 단계부터 계속합니다.

```text
$proofline:figure-it-out
사용자 알림 설정 개선을 필요한 기획부터 구현과 독립 검토까지 맡아서 완료해 줘.
```

각 단계를 직접 제어하려면 `development-plan` → `implementation-spec` → `tenet-me` → `start-implementation` 순서로 별도 호출합니다. `start-implementation`은 `spec-slice`를 내부에서 적용해 v3 Node·Gate 실행 트리를 준비하고 검증하므로 실행 계획을 위한 별도 호출은 필요하지 않습니다.

1. `development-plan`: 아이디어와 기획 대화를 구현 방향과 결정이 정리된 Plan으로 만듭니다.
2. `implementation-spec`: Plan을 인수 조건과 검증 계획이 명확한 Spec으로 만듭니다.
3. `tenet-me`: Plan의 의도가 Spec의 인수 조건과 검증 계획에 빠짐없이 반영됐는지 검토합니다.
4. `start-implementation`: Spec에 따라 구현하고 검사·독립 검토·통합까지 진행합니다.

실행 구조를 변경하거나 스킬을 확장할 때는 [Start Implementation 실행 골격](docs/start-implementation-execution-skeleton.md)을 기준으로 task, Gate, Review, 통합과 정리 경계를 함께 확인합니다.

스킬 프롬프트와 실행 비용을 최적화할 때는 [스킬 프롬프트 작성 원칙](docs/skill-prompt-authoring-principles.md)의 성능·비용 계약을 적용합니다. 무스킬 대비 품질 우위를 먼저 확인하고, 그 품질을 유지하는 후보 사이에서 전체 작업의 실제 비용을 줄입니다.

```text
$proofline:development-plan
반복 업무를 자동화하는 내부 도구 아이디어를 개발 기획 Plan으로 구체화해줘.

$proofline:implementation-spec
PLAN-0001을 구현 가능한 Spec으로 정리해줘.

$proofline:tenet-me
SPEC-0001의 결과 경로를 검토해줘.

$proofline:start-implementation
SPEC-0001 구현을 시작해줘.
```

기존 `.proofline/prds/**`는 새 스킬이 읽지 않습니다. 필요한 프로젝트에서는 새 Spec을 만들기 전에 [PRD → Spec 일회성 마이그레이션 프롬프트](docs/migrations/prd-to-spec.md)를 복사해 프로젝트 루트에서 실행하세요. 원본 PRD는 변경하거나 삭제하지 않습니다.

## 🗂️ `issue-ledger`로 이슈 남기기

대화 중 발견한 버그나 나중에 할 작업은 세션이 끝나면 다시 찾기 어렵습니다. `issue-ledger`는 이런 작업을 프로젝트의 `.proofline/` 폴더에 저장합니다. 버그뿐 아니라 일반 작업, 기능, 조사, 문서화, 유지보수 항목도 기록할 수 있습니다.

```text
$proofline:issue-ledger
설정 파일 호환성 문제를 이슈로 등록해줘.
```

```text
$proofline:issue-ledger
PL-0012의 진행 상황과 확인 근거를 갱신해줘.
```

처음 이슈를 등록하면 다음 구조가 만들어집니다.

```text
.proofline/
  STATE.md
  issues/
    PL-0001.json
```

각 신규 이슈는 구조화된 JSON 파일 하나로 저장됩니다. 현재 요약과 상태별 필드, 완료 조건, 핵심 결정, 판정 근거를 중복 없이 보존합니다. 상세 로그와 실험 보고서는 별도 산출물로 연결하고, 기존 Markdown 이슈는 점진적 전환을 위해 계속 읽을 수 있습니다.

새 기록은 프로젝트별 `.proofline/dashboard/`를 만들거나 갱신하지 않습니다. 기존 프로젝트에 정적 대시보드가 있으면 삭제하거나 변경하지 않습니다.

## 🏛️ 아키텍처 메모리

세 스킬의 전역 암시 호출은 꺼져 있습니다. `init`이 성공하면 `.proofline/architecture.json`에 상대 메모리 위치를 저장합니다. 훅은 이 연결 파일이 있는 프로젝트에만 현재 설치된 메모리 스킬의 위치를 알립니다. 초기화 전에는 고정 경로의 파일 존재만 확인하며 스킬을 호출하거나 문서를 탐색하지 않습니다. 최초 생성과 Git 동기화는 명시적으로 호출합니다.

`$proofline:architecture-memory-init`은 코드·기존 문서·현재 대화를 근거로 `docs/architecture/`에 Markdown 기준선을 만듭니다. C4 L1·L2, 필요한 L3, 사용자 결정·현장 환경·제약과 ADR 색인을 만들고 근거가 없는 내용은 미확인으로 남깁니다. 코드 근거는 시작 시점의 커밋에 고정하며, 커밋이 없으면 관찰한 작업 파일의 변경을 검사합니다. 필수 문서와 등록 구조가 준비된 초안을 반영한 뒤 연결을 활성화합니다.

개발 판단 전에 로컬 검색기가 주제·한글 별칭·코드 경로로 관련 절을 찾습니다. 에이전트는 선택한 절과 공통 제약·필수 참조를 읽고, 이미 대화에 남은 근거는 재사용합니다. 출력 한도를 넘으면 문장을 자르지 않고 누락과 이어 읽기 커서를 반환합니다. 원본은 Markdown 한 곳이며 별도 DB·임베딩·검색 캐시는 없습니다. 디스크 검색량은 문서량에 비례하지만 전체 본문을 모델에 전달하지 않습니다. 기존 문서도 검색되며, 갱신하는 절부터 안정 ID와 검색 정보를 붙일 수 있습니다.

관리 중인 프로젝트에서는 새로 확립된 지속 정보를 해당 절에 반영합니다. 사용자 발언·추론·제안·확정 계획·현재 구현을 구별하며 코드로 선택 이유를 만들어내지 않습니다. 읽기 전용 요청에는 쓰지 않습니다. 메모리가 삭제되거나 관리가 꺼졌으면 건너뜁니다. 설치 경로는 훅이 해석하므로 플러그인 갱신 때 프로젝트 연결을 다시 작성할 필요가 없습니다. 훅이 지원되지 않는 환경에서는 명시적 호출을 사용합니다. 매 대화를 빠짐없이 기록하는 기능은 아닙니다.

`$proofline:architecture-memory-update`는 체크포인트부터 시작 시점의 `HEAD`까지 변경 경로를 분류하고 관련 diff만 읽습니다. 미커밋 코드가 있어도 실행할 수 있으며, 해당 코드는 기준선에 섞지 않습니다. 분류와 초안을 저장해 재실행 때 재사용하고, 반영 중 중단되면 이미 쓴 파일과 남은 파일을 구분해 재개합니다. 외부 편집은 덮어쓰지 않습니다. 코드 변경의 검토가 끝나면 문서 수정이 없어도 체크포인트를 전진시키며, 동일 커밋과 메모리 문서만 바뀐 구간은 그대로 종료합니다.

Dashboard 서버의 `/architecture`는 매니페스트에 등록된 문서, Git 체크포인트, 로컬 Mermaid 다이어그램을 읽기 전용으로 표시합니다. 편집·저장 API는 없습니다.

스킬 본문과 유발되는 읽기·재시도 비용의 측정값 및 한계는 [개편·비용 분석](docs/architecture-memory-rework.md)에 정리했습니다.

## 🖥️ 통합 작업 대시보드

통합 화면의 `/`에서는 Dashboard와 Architecture를 선택합니다. `/dashboard`는 등록된 여러 프로젝트의 Issue·Plan·Spec 원본과 흐름 점검을, `/architecture`는 아키텍처 메모리를 제공합니다. 모두 같은 `127.0.0.1` 로컬 서버와 프로젝트 선택을 사용합니다. LAN이나 외부 interface에 바인딩하지 않고 외부 요청을 보내지 않습니다. Issue·Plan·Spec 쓰기나 아키텍처 초기화에 성공한 프로젝트가 등록되며, SessionStart 훅은 프로젝트 파일을 건드리지 않고 전역 로컬 서버만 확인해 시작합니다.

명시 호출 `$proofline:dashboard-server`는 다음 네 동작을 제공합니다.

| 동작 | 결과 |
| --- | --- |
| `add` | 현재 작업 디렉터리에 `.proofline/`이 있으면 해당 프로젝트를 통합 대시보드에 등록합니다. 다른 경로를 탐색하거나 프로젝트 상태를 만들지 않습니다. |
| `open` | 검증된 실행 서버를 현재 플러그인 version 확인 주소로 엽니다. 중지 상태에서는 시작하지 않습니다. |
| `status` | 실행 URL·instance·version 또는 중지 원인을 표시합니다. |
| `stop` | health의 instance가 실행 상태와 일치하는 현재 서버만 종료합니다. 등록 프로젝트는 유지합니다. |

```text
$proofline:dashboard-server add
$proofline:dashboard-server open
$proofline:dashboard-server status
$proofline:dashboard-server stop
```

파일 변경은 프로젝트별 cache만 무효화합니다. 화면이 보이는 동안 30초마다 확인하고, 탭 복귀 시 한 번 확인하며, `다시 읽기`는 watcher 상태와 무관하게 선택 프로젝트 원본을 재파싱합니다. 기존 `.proofline/dashboard/`는 직접 열 수 있지만 새 기능과 지원 진입점은 통합 로컬 서버입니다.

## ✅ 개발 검증

저장소 루트에서 다음 한 명령으로 전체 테스트를 실행합니다. 별도 패키지 설치는 필요하지 않습니다.

```bash
npm test
```

GitHub Actions는 push와 pull request마다 Windows와 Linux에서 Node 22·24 조합을 검사합니다. 저장소의 텍스트 파일은 운영체제와 무관하게 LF로 체크아웃됩니다.

## 🔄 업데이트

설정된 Proofline 마켓플레이스 정보를 갱신합니다.

```bash
codex plugin marketplace upgrade proofline
```

갱신이 끝나면 Codex를 완전히 종료한 뒤 다시 실행하고 새 세션을 시작하세요.

## 🛠️ 문제가 생겼을 때

### `proofline` 또는 응답 모드가 적용되지 않을 때

1. 플러그인 설치 뒤 새 세션을 시작했는지 확인합니다.
2. `/hooks`에서 Proofline의 `SessionStart`, `UserPromptSubmit`, `PreToolUse` 훅이 승인되어 있는지 확인합니다.
3. 터미널에서 `node --version`이 실행되는지 확인합니다.
4. 재개한 작업이라면 새 작업을 시작하세요. `resume`에서는 Proofline을 다시 주입하지 않습니다.

### 훅 실행에 실패할 때

상세 오류는 `~/.codex/log/proofline-hook.log`에 JSON Lines 형식으로 기록됩니다.

### 대시보드에 이슈가 표시되지 않을 때

`$proofline:dashboard-server status`로 서버 상태를 확인하고 통합 대시보드에서 `다시 읽기`를 누르세요. `.proofline/`이 있는 현재 프로젝트가 목록에 없다면 `$proofline:dashboard-server add`로 등록하세요.


## 라이선스

[MIT](LICENSE)
