# Codex Proofline

## 개요

Proofline은 코덱스의 대화 기본 품질을 높이고, 범위 축소, 확인 누락, 불완전한 완료 보고로 생기는 신뢰성 하락을 줄이는 플러그인입니다.

## 구성

### `proofline-baseline-quality`

`proofline-baseline-quality`는 hook을 사용해 상시 적용됩니다. 새 대화 시작, 이전 대화 다시 열기, 대화 비우기, 대화 내용 줄이기 때 다시 적용됩니다.

- 사용자의 주 사용 언어로 자연스럽게 작성. 번역체 지양, 영어를 과도하게 섞는 문제 완화
- 진단용 예시, 거절된 문구, 교정 과정이 결과물에 섞이지 않게 확인
- 불필요한 설명 지양

### `proofline-collaboration`

큰 작업, 위험한 작업, 여러 단계 작업, 범위가 줄기 쉬운 작업, 확인이 필요한 완료 보고, 구조 리팩터링, 정확한 이식, 실제 부수 이슈 기록에 씁니다.

작업 내용이 조건에 맞거나 사용자가 `$proofline-collaboration`을 직접 호출할 때 사용합니다.
작업 성격에 따라 필요한 규칙 파일만 읽습니다.

- `scope-integrity.md`: 크거나 위험하거나 여러 단계인 작업, 범위가 줄어들기 쉬운 작업
- `completion-evidence.md`: 최종 보고, 막힌 작업, 생략되거나 실패한 확인
- `refactor-proof.md`: 리팩터링, 의존 정리, 책임 분리, 상태·데이터 흐름 변경
- `exact-port.md`: 정확한 이식, 마이그레이션, 동작 보존 복사, 재작성 금지 작업
- `issue-ledger.md`: 현재 범위에서 고치지 않는 실제 부수 이슈

### `proofline-capability-growth`

반복되는 수작업이 자동화 후보인지 확인할 때 씁니다.

- 반복 수작업 확인
- 기존 도구, 테스트, CI, hook, 스킬 확인
- 자동화 후보 목록 작성
- 근거가 약하거나 너무 넓은 후보 제외
- 사용자 승인 뒤 등록 프롬프트 준비

## 설치

```bash
codex plugin marketplace add semisemil/codex-proofline
codex
```

1. `/plugins`를 엽니다.
2. Proofline 마켓플레이스에서 `Proofline`을 선택합니다.
3. `Install plugin`을 선택합니다.
4. `/hooks`를 열고 Proofline의 `SessionStart` hook을 확인한 뒤 승인합니다.
5. 새 대화를 시작합니다.

## 이전 설치에서 옮기기

새 플러그인을 설치하고 hook을 승인한 뒤 기존 설치를 정리합니다.

### 1. `AGENTS.md`의 Proofline 블록 제거

`AGENTS.md`에서 아래 표시 사이의 내용만 제거합니다.

```text
<!-- BEGIN CODEX-PROOFLINE -->
...
<!-- END CODEX-PROOFLINE -->
```

표시에 `v1`이 붙은 이전 블록도 같은 방식으로 제거합니다.

```text
<!-- BEGIN CODEX-PROOFLINE v1 -->
...
<!-- END CODEX-PROOFLINE v1 -->
```

Proofline 블록 밖의 내용은 그대로 둡니다.

### 2. 기존 스킬 제거

`~/.agents/skills/` 또는 프로젝트의 `.agents/skills/`에서 아래 폴더를 제거합니다.

```text
proofline-baseline-quality/
proofline-collaboration/
proofline-capability-growth/
```

프로젝트의 `.proofline/` 폴더는 그대로 둡니다.

## 사용 예시

### `proofline-baseline-quality`

새 세션에서는 자동으로 적용됩니다.
현재 세션에서 다시 적용하려면 직접 호출합니다.

```text
$proofline-baseline-quality
[요청 사항]
```

### `proofline-collaboration`

```text
$proofline-collaboration
이 모듈을 리팩터링해줘.
```

```text
$proofline-collaboration
이 원본 구현을 target 쪽으로 그대로 이식해줘.
```

### `proofline-capability-growth`

```text
$proofline-capability-growth
최근 반복되는 수작업을 살펴보고 자동화 후보를 제안해줘.
```

## 프로젝트 구조

```text
.agents/
  plugins/
    marketplace.json

.codex-plugin/
  plugin.json

hooks/
  hooks.json

skills/
  proofline-baseline-quality/
    SKILL.md
    agents/
      openai.yaml

  proofline-collaboration/
    SKILL.md
    assets/
      protocols/
        completion-evidence.md
        exact-port.md
        issue-ledger.md
        refactor-proof.md
        scope-integrity.md
      templates/
      state-starter/
        STATE.md
        config.json
        issues/
          PL-0000.example.md
        dashboard/
          index.html
          style.css
          app.js

  proofline-capability-growth/
    SKILL.md
    assets/
      protocols/
      prompts/
      templates/

evals/
  baseline-quality/
    correction-example-leakage.md
    correction-generalization.md
    explicit-preservation-exceptions.md
```
