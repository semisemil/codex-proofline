# Codex Proofline

Codex Proofline은 Codex 위에 얹는 가벼운 협업 품질 하네스입니다.
Codex App과 Codex CLI가 읽고 따를 수 있는 스킬, 템플릿, 작은 상태 저장소로 이루어진 레이어입니다.
Proofline의 목표는 Codex가 더 조심스럽고, 정직하고, 함께 일하기 쉬운 개발 동료처럼 행동하게 돕는 것입니다.

## 왜 만들었나

Codex는 개발 능력이 뛰어나지만, 긴 작업이나 협업 상황에서는 다음 문제가 생길 수 있습니다.

- 큰 요청을 받았는데, Codex가 말없이 작업 범위를 줄인다.
- 리팩터링을 요청했는데, 파일명이나 폴더명만 바뀌고 실제 구조는 그대로 남는다.
- 원본 코드를 그대로 이식하라고 했는데, 비슷하게 다시 작성하고 동일하게 이식했다고 말한다.
- 작업 중 발견한 부수 문제가 채팅 안에만 남고 나중에 잊힌다.
- 실제 검증보다 완료 보고가 먼저 나온다.
- 최종 문서에 대화 중 나온 임시 표현이나 내부 사정이 그대로 들어간다.

Proofline은 이런 순간에 Codex가 따를 수 있는 작은 규칙 묶음입니다.

핵심 생각은 단순합니다.

> 현재 작업에서 나온 증거가 없으면 완료라고 말하지 않는다.

## Proofline이 하는 일

Proofline은 현재 두 개의 스킬로 구성되어 있습니다.

### `proofline-collaboration`

일상적인 개발 협업 품질을 지키는 스킬입니다.

다음을 다룹니다.

- **Scope Integrity**: 사용자가 요청한 목표를 말없이 줄이지 않습니다. 작업이 크면 목표를 줄이는 대신 체크포인트로 나눕니다.
- **Completion Evidence**: 테스트, 타입 확인, 코드 검색, 호출 경로 확인, 실제 인터페이스 확인처럼 현재 작업에서 나온 증거가 있을 때만 완료라고 말합니다.
- **Refactor Proof**: 리팩터링이 이름 바꾸기에서 끝나지 않고, 호출 경로, 책임 분리, 의존 관계, 상태 흐름이 실제로 바뀌었는지 확인합니다.
- **Exact Port**: 원본을 기준으로 이식합니다. 동일한 부분, 의도적 차이, 확인하지 못한 부분을 나눠 보고합니다.
- **Issue Ledger**: 지금 고치지 않는 부수 이슈를 `.proofline/issues/` 아래에 남깁니다.
- **Human-Friendly Cooperation**: 쉬운 표현, 읽기 좋은 코드, 사용자가 판단하기 쉬운 보고를 우선합니다.
- **Context Hygiene**: 대화 중 나온 임시 표현이나 비교 대상이 최종 산출물에 그대로 섞이지 않게 합니다.

### `proofline-capability-growth`

반복되는 수작업을 자동화 후보로 올릴지 확인하는 스킬입니다.

다음을 다룹니다.

- 반복되고 비용이 큰 수작업 찾기
- 이미 기존 도구, 스크립트, 테스트, CI, 스킬로 충분한지 확인하기
- 자동화 후보 목록 만들기
- 너무 넓거나 추측에 가까운 자동화 거르기
- 사용자 승인 뒤 자동화 등록 프롬프트 준비하기

이 스킬은 자동화를 바로 만들지 않습니다. 먼저 후보를 정리하고, 사용자 승인을 받은 뒤에만 다음 단계로 갑니다.

## 프로젝트 구조

```text
skills/
  proofline-collaboration/
    SKILL.md
    assets/
      protocols/
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

snippets/
  AGENTS.repo.minimal.md
  AGENTS.global.example.md
```

## Quick start

설치 방법은 두 가지입니다.

- Codex에게 설치를 맡기는 방법
- 사람이 직접 명령어를 실행하는 방법

처음에는 Codex에게 설치를 맡기는 방식을 추천합니다. 이 하네스는 Codex가 읽고 따르는 스킬 묶음이므로, 설치도 Codex에게 맡기는 흐름이 자연스럽습니다.

### 방법 A. Codex에게 설치 맡기기

아래 프롬프트를 그대로 입력하세요.

```text
https://github.com/semisemil/codex-proofline 이 레포지토리에 있는 Proofline 스킬을 설치해줘.
```

Codex가 따라야 할 설치 절차는 다음과 같습니다.

```text
1. 사용자에게 설치 위치를 확인한다.
   - 전역 설치
   - 프로젝트 설치

2. 전역 설치라면:
   - `skills/proofline-collaboration`을 `~/.agents/skills/proofline-collaboration`에 복사한다.
   - `skills/proofline-capability-growth`를 `~/.agents/skills/proofline-capability-growth`에 복사한다.
   - 필요하면 `~/.codex/AGENTS.md`에 `snippets/AGENTS.global.example.md` 내용을 추가한다.

3. 프로젝트 설치라면:
   - `skills/proofline-collaboration`을 `<project>/.agents/skills/proofline-collaboration`에 복사한다.
   - `skills/proofline-capability-growth`를 `<project>/.agents/skills/proofline-capability-growth`에 복사한다.
   - 프로젝트 `AGENTS.md`에 `snippets/AGENTS.repo.minimal.md` 내용을 추가한다.

4. `AGENTS.md`를 수정할 때:
   - 기존 내용을 보존한다.
   - `BEGIN CODEX-PROOFLINE` / `END CODEX-PROOFLINE` 블록이 있으면 그 블록만 교체한다.
   - 블록이 없으면 파일 끝에 새 Proofline 블록을 추가한다.
   - 블록 밖의 내용은 수정하지 않는다.

5. 설치 후 확인한다.
   - 두 `SKILL.md` 파일이 실제로 있는지 확인한다.
   - 완료 보고에는 실행한 명령과 확인 결과를 나눠서 적는다.
```

### 방법 B. 사람이 직접 설치하기

이 레포지토리를 clone한 뒤, 스킬 폴더를 Codex 스킬 폴더로 복사합니다.

```bash
git clone https://github.com/semisemil/codex-proofline.git
cd codex-proofline

mkdir -p ~/.agents/skills
cp -R skills/proofline-collaboration ~/.agents/skills/
cp -R skills/proofline-capability-growth ~/.agents/skills/
```

설치 확인:

```bash
ls ~/.agents/skills/proofline-collaboration/SKILL.md
ls ~/.agents/skills/proofline-capability-growth/SKILL.md
```

### 프로젝트에 최소 지침 추가하기

Proofline을 사용할 프로젝트의 `AGENTS.md`에는 Proofline 블록만 작게 넣는 것을 권장합니다.
최소 지침은 다음 파일에 들어 있습니다.

```text
snippets/AGENTS.repo.minimal.md
```

개인 기본값으로 더 넓게 쓰고 싶다면, 전역 `AGENTS.md`에 아래 파일의 내용을 참고해 넣을 수 있습니다.

```text
snippets/AGENTS.global.example.md
```

두 스니펫 모두 `BEGIN CODEX-PROOFLINE` / `END CODEX-PROOFLINE` 영역 구분을 포함합니다. 나중에 Proofline 지침이 바뀌면 이 블록만 교체하면 됩니다.

## 사용 예시

### 큰 작업을 맡길 때

```text
$proofline-collaboration
이 작업은 범위를 줄이지 말고 체크포인트로 나눠서 진행해줘. 완료 보고에는 무엇을 확인했는지 포함해줘.
```

### 리팩터링을 맡길 때

```text
$proofline-collaboration
이 모듈을 리팩터링해줘. 파일명만 바꾸지 말고, 호출 경로와 책임 분리가 실제로 바뀌었는지 증거를 남겨줘.
```

### 정확한 이식을 맡길 때

```text
$proofline-collaboration
이 원본 구현을 target 쪽으로 그대로 이식해줘. 재작성하지 말고, 원본-대상 대응표와 차이점을 보고해줘.
```

### 부수 이슈를 남기고 싶을 때

```text
$proofline-collaboration
작업 중 발견했지만 지금 고치지 않는 실제 문제는 `.proofline/issues/`에 이슈로 남겨줘.
```

### 자동화 후보를 검토하고 싶을 때

```text
$proofline-capability-growth
최근 반복되는 수작업을 살펴보고 자동화 후보를 제안해줘. 근거가 부족한 후보는 제외하고, 자동화는 아직 만들지 마.
```

## Repo-local state

Proofline은 프로젝트별 상태를 전용 폴더에 둡니다.

```text
.proofline/
  STATE.md
  config.json
  issues/
    PL-0001.md
    PL-0002.md
  dashboard/
    index.html
    style.css
    app.js
```

이 폴더는 기본적으로 처음부터 만들지 않습니다. 다음 상황에서만 만듭니다.

- 첫 번째 실제 부수 이슈를 기록할 때
- 사용자가 명시적으로 Proofline 상태 영역 초기화를 요청할 때

Proofline은 기본적으로 작업 계약, 원본 대화, 긴 추론 기록, 모든 검증 로그를 저장하지 않습니다. 다음 작업의 행동을 바꿀 수 있는 이슈 정보만 작게 저장합니다.

## Issue Ledger

각 이슈는 하나의 Markdown 파일로 저장합니다.

```text
.proofline/issues/PL-0001.md
.proofline/issues/PL-0002.md
```

원본은 다음 파일들입니다.

```text
.proofline/issues/*.md
```

대시보드 파일은 고정된 프론트 파일입니다. 일반적인 이슈 등록 중에는 수정하지 않습니다.

```text
.proofline/dashboard/index.html
.proofline/dashboard/style.css
.proofline/dashboard/app.js
```

이슈에는 최소한 다음 정보가 있어야 합니다.

- `id`
- `status`
- `title`
- `discovered_while`
- `evidence`
- `risk`
- `suggested_next_step`
- `linked_context`
- `resolved_evidence`, 해결된 경우
- `created_at`
- `updated_at`

## Dashboard

대시보드는 정적 HTML/CSS/JS 뷰어입니다.

### Stored folder mode

로컬에서 볼 때는 아래 파일을 엽니다.

```text
.proofline/dashboard/index.html
```

처음 한 번 화면의 `issues 폴더 연결` 버튼을 눌러 `.proofline/issues` 폴더를 선택합니다.

그 뒤에는 대시보드를 열 때 저장된 폴더 권한으로 `.proofline/issues/*.md` 파일을 자동으로 읽습니다. 새 이슈는 Markdown 파일만 추가하면 됩니다.

이슈 폴더 위치가 바뀌면 `폴더 재지정` 버튼으로 새 `.proofline/issues` 폴더를 선택합니다.

브라우저 권한이 지워졌거나 자동 연결이 막히면 `issues 폴더 연결`을 눌러 권한을 다시 확인합니다. 폴더 권한 저장을 지원하지 않는 브라우저에서는 화면의 폴더 선택 방식으로 읽습니다.

## 설계 원칙

Proofline은 다음 원칙을 따릅니다.

- 위험하거나 큰 작업 전에는 공개적으로 확인 가능한 작업 계약을 만든다.
- 현재 작업에서 나온 증거만 완료 증거로 인정한다.
- 막힌 상태와 완료 상태를 섞지 않는다.
- 요구사항을 확인 가능한 조건으로 바꿔 생각한다.
- 가능하면 실제 사용자가 쓰는 인터페이스로 확인한다.
- 쓰기 범위를 작게 유지한다.
- 다음 작업의 행동을 바꾸는 정보만 저장한다.
- 영리해 보이는 출력보다 읽기 쉬운 코드와 설명을 우선한다.
- 최종 산출물은 대화 로그가 아니라 독립 문서처럼 읽혀야 한다.
