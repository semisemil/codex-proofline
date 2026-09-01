# 호환성 및 지원 환경

이 문서는 Proofline 0.8.2의 공개 실행 계약입니다. Proofline은 특정 Codex 숫자 버전보다 실제 제공 기능을 기준으로 호환성을 판단합니다. 아래 계약을 충족하지 않은 환경은 지원이 확인되지 않은 상태입니다.

## 기본 지원 기준

| 항목 | 지원 기준 | 확인되지 않거나 없을 때 |
| --- | --- | --- |
| Node.js | `node` 22 이상이 `PATH`에 있음. CI 대상은 22·24 | 훅과 Node 기반 도구를 실행할 수 없음 |
| 운영체제 | GitHub-hosted Windows와 Linux | macOS와 자체 호스팅 환경은 현재 CI로 확인하지 않음 |
| Codex 플러그인 | `.codex-plugin/plugin.json`, 플러그인 스킬, 기본 `hooks/hooks.json` 로드 지원 | 설치 또는 해당 기능이 동작하지 않음 |
| 훅 | `SessionStart`, `UserPromptSubmit`, `PreToolUse`를 지원하고 사용자가 승인함 | 승인되지 않은 훅이 담당하는 자동 적용·모드·실행 제한이 동작하지 않음 |
| Git | `start-implementation`은 커밋된 기준 revision과 Git Worktree 생성이 가능한 저장소를 요구함 | 전체 구현 Workflow를 시작하지 않음 |

저장소 전체 테스트의 공식 진입점은 `npm test`입니다. GitHub Actions는 Windows·Linux와 Node 22·24의 네 조합을 검사합니다.

## 기능별 Codex 계약

| 기능 | 필수 기능 | 실패 방식 |
| --- | --- | --- |
| 공통 `proofline`·응답 모드 | 플러그인 스킬, `SessionStart`, `UserPromptSubmit`, Node.js | 해당 자동 주입 또는 모드 변경이 적용되지 않음 |
| 실행 가드 | `UserPromptSubmit`, `PreToolUse`, 일치하는 도구 이름, 작업·세션 식별자 | 역할 상태가 없거나 읽히지 않으면 차단하지 않음 |
| 이슈·Plan·Spec·아키텍처 메모리 | 해당 스킬과 프로젝트 파일 읽기·쓰기 권한 | 필요한 산출물을 생성하거나 갱신할 수 없음 |
| `start-implementation` | 아래 작업 전송 기능과 Git Worktree | 필수 기능 하나라도 없으면 대체 실행 없이 미완료로 중단함 |

## `start-implementation` 필수 기능

전체 구현 Workflow에는 다음 Codex 기능이 모두 필요합니다.

1. `create_thread`의 Git Worktree 생성
2. `fork_thread`의 같은 디렉터리 작업 생성
3. 발신자 정보가 보존되는 `send_message_to_thread` 콜백
4. 새 검토 작업을 위한 `spawn_agent`와 `wait_agent`

기본 내부 경로는 Worktree holder·Slice coordinator에 `gpt-5.6-luna` + `low`, 준비·구현·Repair·Reviewer에 `gpt-5.6-sol` + `medium`입니다. 사용자가 모델이나 추론 수준을 명시하면 그 선택이 우선합니다. 기본 모델을 사용할 수 없을 때 Proofline은 다른 모델로 자동 대체하지 않으며, 대체 경로에는 사용자 승인이 필요합니다.

도구 이름이 바뀌었더라도 동일 기능이라고 자동 간주하지 않습니다. 스킬 계약, 훅 matcher, 테스트가 새 이름을 함께 지원하기 전에는 해당 경로가 지원된다고 보지 않습니다. 필수 기능이 없는 환경에서도 공통 규칙과 개별 스킬은 사용할 수 있지만, 이는 전체 구현 Workflow의 자동 대체 경로가 아닙니다.

## 실행 가드의 경계

`hooks/execution-guard.js`는 Proofline 실행 역할이 정해진 작업에서 실수로 절차를 어기는 것을 줄이는 보호 장치입니다. 보안 샌드박스나 공격적 우회를 막는 경계가 아닙니다.

가드는 등록된 `PreToolUse` matcher와 인식한 명령 형태만 검사합니다. 역할 상태가 없거나 손상됐거나 식별자를 만들 수 없으면 차단하지 않습니다. 셸 래퍼, 별칭, 사용자 스크립트, 등록되지 않은 도구 이름과 훅이 호출되지 않는 실행 경로도 완전하게 통제한다고 주장하지 않습니다. Codex 공식 문서 역시 도구 훅을 완전한 강제 경계가 아닌 보호 장치로 규정합니다.

참고: [Codex 플러그인](https://developers.openai.com/codex/build-plugins), [Codex 훅](https://developers.openai.com/codex/hooks), [Codex Worktree](https://developers.openai.com/codex/environments/git-worktrees)
