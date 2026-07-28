# Proofline

Proofline은 Codex가 처음 요청받은 작업 범위를 놓치지 않고 실제로 확인한 결과만 완료로 보고하도록 돕는 플러그인입니다.

작업이 길어지고 대화가 쌓이면 Codex가 처음 요청의 세부 조건을 빠뜨리기 쉽습니다.
확인하지 않은 작업까지 끝났다고 보고하거나, 작업 중 발견한 후속 문제를 대화에 남겨둔 채 넘어가기도 합니다.
Proofline은 이런 누락을 줄이기 위해 `proofline-baseline-quality`를 세션마다 불러오고 작업 성격에 맞는 스킬을 제공합니다.


## ✨ Proofline을 설치하면
- 새 세션을 시작하거나 기존 세션을 다시 열 때 `proofline-baseline-quality`가 자동으로 적용됩니다.
- 큰 작업과 리팩터링, 정확한 이식, 작업 완료 보고에는 작업별 스킬을 사용해 정확도를 향상시키고, 시키지 않은 작업을 수행하지 않도록 막아줍니다.
- 대화에서 발견한 버그와 후속 작업을 프로젝트 안에 남겨 다음 세션에서 이어갈 수 있습니다.

## 📊 공개 평가에서 확인한 효과

`proofline-baseline-quality`를 사용했을 때와 사용하지 않았을 때를 같은 모델과 작업 조건에서 비교했습니다. 정상 동작 3개와 실수하기 쉬운 부정 사례 3개를 각각 세 번 실행했습니다.

| 결과 | 스킬 미적용 | 스킬 적용 |
| --- | ---: | ---: |
| 핵심 품질 기준 통과 | 15/18 | **18/18** |
| 최종 평가자 선택     | 1회 | **8회** |

(최종 평가자 선택 18회 중 9회는 동점 판정)

이 결과는 공개된 6개 평가 사례의 범위에 한정됩니다. [결과 요약](eval/proofline-baseline-quality/results/published/2026-07-20/summary.md)에서 사례별 결과를 확인하거나, [평가 방법과 실행 코드](eval/)로 직접 재현할 수 있습니다.

### 표현 압축 스킬 적용 시
`gpt-5.6-sol`의 `high`와 `medium`에서 각각 세 번 테스트 진행.
평균 답변 길이 각각 **16.61%**, **8.63%** 감소.
[표현 압축 결과](eval/proofline-baseline-quality/results/published/2026-07-22-expression-compression/summary.md)

## 📦 설치
### Codex CLI에서 설치

Proofline 마켓플레이스를 추가한 다음 플러그인을 설치합니다.

```bash
codex plugin marketplace add semisemil/codex-proofline
codex plugin add proofline@proofline
codex
```

Codex가 열리면 다음 순서로 마무리합니다.

1. `/hooks`를 엽니다.
2. Proofline의 `SessionStart` 훅을 확인하고 승인합니다.
3. 새 세션을 시작합니다.

## 🚀 빠르게 사용하기

### `proofline-baseline-quality`

`proofline-baseline-quality`는 따로 호출하지 않아도 적용됩니다. 새 세션을 시작하거나 기존 세션을 다시 열 때, `/clear` 또는 `/compact`로 대화를 정리한 뒤에도 `SessionStart` 훅이 이 스킬을 다시 불러옵니다.

특정 요청에 이 기준을 확실히 적용하고 싶다면 프롬프트 첫 줄에 스킬 이름을 적으세요.
```text
$proofline:proofline-baseline-quality
이 문서를 처음 읽는 사람도 이해할 수 있게 고쳐줘.
```

### 작업에 맞는 스킬 직접 부르기

Codex는 설치된 스킬 중 작업에 맞는 것을 필요할 때 불러옵니다. 중요한 작업에서 적용 기준을 분명히 하고 싶다면 스킬 이름을 직접 적으세요.
책임과 호출 경로를 실제로 바꾸는 리팩터링에는 `proofline-refactor-proof`를 사용합니다.

```text
$proofline:proofline-refactor-proof
사용자 설정 저장 책임을 서비스 계층으로 옮겨줘.
```

원본 동작을 바꾸지 않고 그대로 옮겨야 한다면 `proofline-exact-port`를 사용합니다.

```text
$proofline:proofline-exact-port
이 원본 구현을 대상 프로젝트로 동작 변경 없이 이식해줘.
```

여러 작업과 독립 검토가 필요한 구현은 먼저 `proofline-implementation-spec`으로 Spec을 만듭니다.

```text
$proofline:proofline-implementation-spec
사용자 알림 설정 개선 작업을 구현 가능한 Spec으로 정리해줘.
```

준비된 Spec을 구현하려면 `proofline-start-implementation`을 사용합니다. 작은 작업은 바로 구현하고, 한 작업 컨텍스트를 넘는 경우에만 Spec 아래에 `Work Slice`를 만들어 Slice별 구현·검토 후 통합 검토를 수행합니다. 사전 검토는 사용자가 요청할 때만 실행하며, 검토가 실패해도 자동 롤백하지 않습니다.

```text
$proofline:proofline-start-implementation
SPEC-0001 구현을 시작해줘.
```

기존 `.proofline/prds/**`는 새 스킬이 읽지 않습니다. 필요한 프로젝트에서는 새 Spec을 만들기 전에 [PRD → Spec 일회성 마이그레이션 프롬프트](docs/migrations/prd-to-spec.md)를 복사해 프로젝트 루트에서 실행하세요. 원본 PRD는 변경하거나 삭제하지 않습니다.

## 🧩 포함된 스킬

| 스킬 | 사용시점       |  개선사항|
| --- | --- | --- |
| `$proofline:proofline-baseline-quality` | 모든 대화와 결과물 | 대상 독자에 맞는 언어, 자연스러운 문장, 수정 권한, 근거가 있는 판단 |
| `$proofline:proofline-scope-integrity` | 크거나 위험하고 여러 단계로 이어지는 작업 | 처음 합의한 목표, 필수 조건, 중간 점검, 검증 계획, 범위 변경 승인 |
| `$proofline:proofline-completion-evidence` | 완료 결과나 막힌 상황을 보고할 때 | 완료한 일과 검증 결과의 분리, 통과·실패·미실행 검사, 막힌 이유, 다음 조치 |
| `$proofline:proofline-refactor-proof` | 책임, 의존 방향, 호출 경로, 상태 흐름을 바꾸는 리팩터링 | 실제 구조 변경, 남은 기존 결합, 동작 보존 범위, 검증 근거 |
| `$proofline:proofline-exact-port` | 원본 동작을 그대로 옮겨야 하는 이식 | 원본과 대상의 대응 관계, 승인된 차이, 독립 비교 결과, 확인하지 못한 부분 |
| `$proofline:proofline-issue-ledger` | 버그나 후속 작업을 프로젝트에 남길 때 | 현재 상태, 다음 조치, 완료 조건, 핵심 결정과 판정 근거 |
| `$proofline:proofline-capability-growth` | 반복되는 수작업을 자동화할지 검토할 때 | 반복 근거, 기존 도구, 가장 작은 자동화 후보, 등록 전 사용자 승인 |
| `$proofline:proofline-implementation-spec` | 여러 작업이나 독립 검토가 필요한 구현 계약을 만들거나 수정할 때 | 작업별 최소 구조, 통합 요구사항·완료 조건, Spec 수명주기 |
| `$proofline:proofline-start-implementation` | 준비된 Spec을 구현 후 독립 검토와 함께 진행할 때 | 조건부 Work Slice, 작업 귀속 diff, Slice 검토, 최종 통합 판정 |

## 🗂️ `proofline-issue-ledger`로 이슈 남기기

대화 중 발견한 버그나 나중에 할 작업은 세션이 끝나면 다시 찾기 어렵습니다. `proofline-issue-ledger`는 이런 작업을 프로젝트의 `.proofline/` 폴더에 저장합니다. 버그뿐 아니라 일반 작업, 기능, 조사, 문서화, 유지보수 항목도 기록할 수 있습니다.

```text
$proofline:proofline-issue-ledger
설정 파일 호환성 문제를 이슈로 등록해줘.
```

```text
$proofline:proofline-issue-ledger
PL-0012의 진행 상황과 확인 근거를 갱신해줘.
```

처음 이슈를 등록하면 다음 구조가 만들어집니다.

```text
.proofline/
  STATE.md
  issues/
    PL-0001.json
  dashboard/
    index.html
```

각 신규 이슈는 구조화된 JSON 파일 하나로 저장됩니다. 현재 요약과 상태별 필드, 완료 조건, 핵심 결정, 판정 근거를 중복 없이 보존합니다. 상세 로그와 실험 보고서는 별도 산출물로 연결하고, 기존 Markdown 이슈는 점진적 전환을 위해 계속 읽을 수 있습니다.

대시보드를 보려면 `.proofline/dashboard/index.html`을 열고 `.proofline/issues/` 폴더를 한 번 연결하세요. 브라우저가 연결한 폴더를 기억하고 JSON 및 레거시 Markdown 이슈를 함께 읽습니다. 상세 화면은 진행 중·보류·완료·취소·대체 상태에 맞춰 현재 상황과 판정 근거를 다르게 보여줍니다. Proofline 원장이 없는 프로젝트에는 대시보드 파일을 만들지 않습니다. 원장이 있는 프로젝트에서는 새 세션을 시작할 때 더 최신인 번들 대시보드로 갱신합니다.

## 🔄 업데이트

설정된 Proofline 마켓플레이스 정보를 갱신합니다.

```bash
codex plugin marketplace upgrade proofline
```

갱신이 끝나면 Codex를 완전히 종료한 뒤 다시 실행하고 새 세션을 시작하세요.

## 🛠️ 문제가 생겼을 때

### `proofline-baseline-quality`가 적용되지 않을 때

1. 플러그인 설치 뒤 새 세션을 시작했는지 확인합니다.
2. `/hooks`에서 Proofline의 `SessionStart` 훅이 승인되어 있는지 확인합니다.
3. 터미널에서 `node --version`이 실행되는지 확인합니다.

### 훅 실행에 실패할 때

상세 오류는 `~/.codex/log/proofline-hook.log`에 JSON Lines 형식으로 기록됩니다.

### 대시보드에 이슈가 표시되지 않을 때

대시보드에서 `.proofline/issues/` 폴더를 연결했는지 확인한 뒤 다시 읽기를 누르세요. 아직 이슈 원장을 만들지 않았다면 먼저 `proofline-issue-ledger`로 이슈를 하나 등록해야 합니다.


## 라이선스

[MIT](LICENSE)
