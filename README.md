# Codex Proofline

Codex Proofline은 Codex 협업을 위한 작은 품질 안전장치입니다.
Codex가 작업 범위를 지키고, 완료 전에 확인하고, 명확하게 보고하고, 실제 부수 이슈를 잊지 않게 돕습니다.

## 해결하려는 문제

- 사용자가 요청한 목표가 말없이 줄어든다.
- 리팩터링이 이름 변경에서 끝나고 구조는 그대로 남는다.
- 정확한 이식이 비슷한 재작성으로 바뀐다.
- 작업 중 발견한 부수 이슈가 채팅 안에만 남는다.
- 확인보다 완료 보고가 먼저 나온다.
- 최종 산출물에 임시 대화 표현이나 내부 과정이 섞인다.

Proofline은 이런 지점을 작게 붙잡는 규칙 묶음입니다.

## 스킬

### `proofline-collaboration`

코딩, 글쓰기, 리뷰, 리팩터링, 정확한 이식, 부수 이슈 기록, 완료 보고에 쓰는 협업 품질 스킬입니다.
항상 하나의 기본 프로토콜을 읽습니다.

```text
skills/proofline-collaboration/assets/protocols/baseline-quality.md
```

Baseline Quality가 다루는 내용:

- 사용자 언어 사용
- 쉬운 말과 명확한 판단 순서
- 독립적으로 읽히는 최종 산출물
- 제품 세계 안에 머무는 UI 문구
- 읽기 쉬운 코드

작업 성격에 따라 필요한 프로토콜만 추가로 읽습니다.

- `scope-integrity.md`: 크거나 위험하거나 여러 단계인 작업, 범위가 줄어들기 쉬운 작업
- `completion-evidence.md`: 최종 보고, 막힌 작업, 생략되거나 실패한 확인
- `refactor-proof.md`: 리팩터링, 의존 정리, 책임 분리, 상태/데이터 흐름 변경
- `exact-port.md`: 정확한 이식, 마이그레이션, 동작 보존 복사, 재작성 금지 작업
- `issue-ledger.md`: 현재 범위에서 고치지 않는 실제 부수 이슈

### `proofline-capability-growth`

반복되는 수작업이 자동화 후보인지 검토할 때 쓰는 스킬입니다.

- 반복 수작업 검토
- 기존 도구, 테스트, CI, 훅, 스킬 확인
- 자동화 후보 목록 작성
- 근거가 약하거나 너무 넓은 후보 제외
- 사용자 승인 뒤 등록 프롬프트 준비

## 프로젝트 구조

```text
skills/
  proofline-collaboration/
    SKILL.md
    assets/
      protocols/
        baseline-quality.md
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

snippets/
  AGENTS.repo.minimal.md
  AGENTS.global.example.md
```

## 설치

### Codex에게 설치 맡기기

Codex에 아래 프롬프트를 입력합니다.

```text
https://github.com/semisemil/codex-proofline 이 레포지토리에 있는 Proofline 스킬을 설치해줘.
```

Codex가 해야 할 일:

1. 전역 설치인지 프로젝트 설치인지 확인한다.
2. 두 스킬 디렉터리를 복사한다.
3. 알맞은 `AGENTS.md`에 Proofline 블록을 추가하거나 교체한다. (파일이 없으면 생성)
4. Proofline 블록 밖의 기존 내용은 보존한다.
5. 설치 뒤 두 `SKILL.md` 파일이 있는지 확인한다.

### 직접 설치하기

레포지토리를 clone한 뒤 스킬 폴더를 Codex 스킬 폴더로 복사합니다.

```bash
git clone https://github.com/semisemil/codex-proofline.git
cd codex-proofline

mkdir -p ~/.agents/skills
cp -R skills/proofline-collaboration ~/.agents/skills/
cp -R skills/proofline-capability-growth ~/.agents/skills/
```

확인:

```bash
ls ~/.agents/skills/proofline-collaboration/SKILL.md
ls ~/.agents/skills/proofline-capability-growth/SKILL.md
```

## AGENTS 블록

프로젝트 단위 설치에는 아래 파일의 Proofline 블록을 넣습니다.

```text
snippets/AGENTS.repo.minimal.md
```

개인 기본값으로 넓게 쓰려면 아래 파일을 참고합니다.

```text
snippets/AGENTS.global.example.md
```

두 스니펫 모두 영역 표시를 포함합니다.

```text
<!-- BEGIN CODEX-PROOFLINE v1 -->
...
<!-- END CODEX-PROOFLINE v1 -->
```

Proofline 지침을 갱신할 때는 이 블록만 교체하고 `AGENTS.md`의 나머지 내용은 그대로 둡니다.

## 사용 예시

### Proofline-Collaboration

```text
$proofline-collaboration
이 모듈을 리팩터링해줘.
```

```text
$proofline-collaboration
이 원본 구현을 target 쪽으로 그대로 이식해줘.
```

### proofline-capability-growth

```text
$proofline-capability-growth
최근 반복되는 수작업을 살펴보고 자동화 후보를 제안해줘.
```

## 프로젝트 상태 저장소

Proofline은 필요할 때만 프로젝트 안에 상태 폴더를 만듭니다.

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

`.proofline/`은 다음 경우에만 만듭니다.

- 첫 번째 실제 부수 이슈를 기록할 때
- 사용자가 명시적으로 Proofline 상태 초기화를 요청할 때

Proofline은 기본적으로 전체 대화, 넓은 작업 계약, 긴 추론 기록, 모든 확인 로그를 저장하지 않습니다. 다음 작업의 행동을 바꿀 수 있는 작은 이슈 기록만 남깁니다.

## Issue Ledger

각 이슈는 하나의 Markdown 파일입니다.

```text
.proofline/issues/PL-0001.md
.proofline/issues/PL-0002.md
```

기록 대상은 현재 작업에서 고치지 않았고, 미래 작업에 영향을 줄 수 있으며, 구체적인 근거와 다음 단계가 있는 실제 부수 이슈입니다.

필수 front matter:

- `id`
- `status`
- `title`
- `discovered_while`
- `evidence`
- `risk`
- `suggested_next_step`
- `linked_context`
- `resolved_evidence`
- `created_at`
- `updated_at`

## Dashboard

대시보드는 `.proofline/issues/*.md`를 읽는 정적 HTML/CSS/JS 뷰어입니다.

아래 파일을 엽니다.

```text
.proofline/dashboard/index.html
```

폴더 선택으로 `.proofline/issues` 접근 권한을 부여하면 대시보드가 이슈 파일을 읽습니다. 브라우저 권한이 지워졌거나 이슈 폴더 위치가 바뀌면 폴더를 다시 선택합니다.

## 설계 원칙

Proofline은 다음 원칙을 따릅니다.

- 사용자의 목표를 말없이 줄이지 않는다.
- 큰 작업은 줄이는 대신 체크포인트로 나눈다.
- 현재 작업에서 나온 확인만 완료 증거로 인정한다.
- 막힌 상태와 완료 상태를 섞지 않는다.
- 리팩터링은 구조가 바뀐 증거로 확인한다.
- 정확한 이식에서는 원본 동작을 기준으로 삼는다.
- 근거와 다음 단계가 있는 부수 이슈만 기록한다.
- 최종 산출물에서 임시 대화 표현과 내부 과정 메모를 제거한다.
- 영리해 보이는 출력보다 읽기 쉬운 코드와 명확한 보고를 우선한다.
