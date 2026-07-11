# Codex Proofline

## 개요

Proofline은 Codex가 요청받은 범위를 끝까지 지키고, 확인한 근거로 작업 결과를 보고하도록 돕는 플러그인입니다. 대화 중 발견한 문제와 앞으로 할 작업도 프로젝트 안에 남겨 다음 작업에서 이어갈 수 있습니다.

## 구성

### `proofline-baseline-quality`

`proofline-baseline-quality`는 대화를 시작할 때 자동으로 적용됩니다. 이전 대화를 다시 열거나 대화 내용을 정리한 뒤에도 다시 적용됩니다.

- 사용자의 언어로 자연스럽고 이해하기 쉽게 작성
- 요청과 관계없는 설명이나 작업 과정이 결과물에 섞이지 않게 정리
- 검토 결과와 기술 판단을 결론부터 명확하게 전달

### 필요할 때 사용하는 스킬

작업 성격에 맞는 스킬을 직접 호출해 사용합니다.

- `proofline-scope-integrity`: 크거나 위험하거나 여러 단계인 작업, 범위가 줄어들기 쉬운 작업
- `proofline-completion-evidence`: 완료 보고, 막힌 작업, 생략되거나 실패한 확인
- `proofline-refactor-proof`: 리팩터링, 의존 정리, 책임 분리, 상태·데이터 흐름 변경
- `proofline-exact-port`: 정확한 이식, 마이그레이션, 동작 보존 복사, 재작성 금지 작업

### `proofline-issue-ledger`

대화 중 발견한 문제나 나중에 구현할 기능을 프로젝트 작업 원장에 남깁니다. 각 항목에는 현재 상태, 다음에 할 일, 완료 조건, 판단 근거와 진행 내역이 함께 기록됩니다.

- 버그, 일반 작업, 기능, 조사, 문서화, 유지보수 작업 관리
- 등록한 작업의 진행 상황과 근거 갱신
- 완료 조건과 근거를 확인한 뒤 작업 종료
- 대시보드에서 전체 작업과 진행 상태 확인

작업 내용은 프로젝트의 `.proofline/issues/` 폴더에 저장되며, `.proofline/dashboard/index.html`에서 확인할 수 있습니다. 새 대화를 시작하면 기존 대시보드는 번들 버전이 더 최신일 때 자동으로 갱신됩니다. 이전 방식으로 기록한 이슈도 그대로 사용할 수 있습니다.

### `proofline-capability-growth`

반복되는 수작업이 자동화 후보인지 확인할 때 씁니다.

- 반복 수작업 확인
- 기존 도구, 테스트, CI, 훅, 스킬 확인
- 자동화 후보 목록 작성
- 근거가 약하거나 너무 넓은 후보 제외
- 사용자 승인 뒤 자동화 등록 준비

## 설치

```bash
codex plugin marketplace add semisemil/codex-proofline
codex
```

`SessionStart` 훅 실행에는 `node` 명령이 필요합니다.

1. `/plugins`를 엽니다.
2. Proofline 마켓플레이스에서 `Proofline`을 선택합니다.
3. `Install plugin`을 선택합니다.
4. `/hooks`를 열고 Proofline의 `SessionStart` 훅을 확인한 뒤 승인합니다.
5. 새 대화를 시작합니다.

훅 실행이 실패하면 상세 오류는 `~/.codex/log/proofline-hook.log`에 JSON Lines 형식으로 기록됩니다.

## 업그레이드

### Codex App

프로그램을 완전히 종료한 뒤 다시 실행합니다.

### Codex CLI

```bash
codex plugin marketplace upgrade proofline
```

## 사용 예시

### `proofline-baseline-quality`

새 대화에서는 자동으로 적용됩니다.
현재 대화에서 다시 적용하려면 직접 호출합니다.

```text
$proofline-baseline-quality
[요청 사항]
```

### 작업별 스킬

```text
$proofline-refactor-proof
이 모듈을 리팩터링해줘.
```

```text
$proofline-exact-port
이 원본 구현을 대상 프로젝트로 그대로 이식해줘.
```

### `proofline-issue-ledger`

```text
$proofline-issue-ledger
이 기능 구현 계획을 프로젝트 작업 원장에 등록해줘.
```

```text
$proofline-issue-ledger
PL-0012의 진행 상황과 근거를 갱신해줘.
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
  load-baseline.js
  refresh-dashboard.js

skills/
  proofline-baseline-quality/
    SKILL.md
    agents/
      openai.yaml

  proofline-scope-integrity/
    SKILL.md
    agents/
      openai.yaml
    assets/
      templates/

  proofline-completion-evidence/
    SKILL.md
    agents/
      openai.yaml
    assets/
      templates/

  proofline-refactor-proof/
    SKILL.md
    agents/
      openai.yaml
    assets/
      templates/

  proofline-exact-port/
    SKILL.md
    agents/
      openai.yaml
    assets/
      templates/

  proofline-issue-ledger/
    SKILL.md
    agents/
      openai.yaml
    assets/
      templates/
      state-starter/
        STATE.md
        issues/
          PL-0000.example.md
        dashboard/
          VERSION
          index.html
          style.css
          app.js

  proofline-capability-growth/
    SKILL.md
    assets/
      protocols/
      prompts/
      templates/
```
