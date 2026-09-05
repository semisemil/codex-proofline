# 호환성 및 지원 환경

이 문서는 Proofline 0.8.3의 공개 실행 계약입니다. Proofline은 특정 Codex 숫자 버전보다 실제 제공 기능을 기준으로 호환성을 판단합니다. 아래 계약을 충족하지 않은 환경은 지원이 확인되지 않은 상태입니다.

## 기본 지원 기준

| 항목 | 지원 기준 | 확인되지 않거나 없을 때 |
| --- | --- | --- |
| Node.js | `node` 22 이상이 `PATH`에 있음. CI 대상은 22·24 | 훅과 Node 기반 도구를 실행할 수 없음 |
| 운영체제 | GitHub-hosted Windows와 Linux | macOS와 자체 호스팅 환경은 현재 CI로 확인하지 않음 |
| Codex 플러그인 | `.codex-plugin/plugin.json`, 플러그인 스킬, 기본 `hooks/hooks.json` 로드 지원 | 설치 또는 해당 기능이 동작하지 않음 |
| 훅 | `SessionStart`, `UserPromptSubmit`, `PreToolUse`를 지원하고 사용자가 승인함 | 승인되지 않은 훅이 담당하는 자동 적용·모드·실행 제한이 동작하지 않음 |
| Git | `start-implementation`의 변경 상태·검증 근거 도구가 사용할 수 있는 Git 저장소 | 시작 상태와 이번 변경분을 확인할 수 없으면 해당 구현 경로를 시작하지 않음 |

저장소 전체 테스트의 공식 진입점은 `npm test`입니다. GitHub Actions는 Windows·Linux와 Node 22·24의 네 조합을 검사합니다.

## 기능별 Codex 계약

| 기능 | 필수 기능 | 실패 방식 |
| --- | --- | --- |
| 공통 `proofline`·응답 모드 | 플러그인 스킬, `SessionStart`, `UserPromptSubmit`, Node.js | 해당 자동 주입 또는 모드 변경이 적용되지 않음 |
| 실행 가드 | `UserPromptSubmit`, `PreToolUse`, 일치하는 도구 이름, 작업·세션 식별자 | 역할이 없는 현재 세션에는 제한 없음. 손상된 역할 상태는 훅 오류로 보고됨 |
| 이슈·Plan·Spec·아키텍처 메모리 | 해당 스킬과 프로젝트 파일 읽기·쓰기 권한 | 필요한 산출물을 생성하거나 갱신할 수 없음 |
| 아키텍처 메모리 자동 연결 | 초기화로 만든 `.proofline/architecture.json`, 세션/에이전트 식별자가 있는 `SessionStart`·`UserPromptSubmit` 훅. 하위 에이전트는 `SubagentStart` | 명시적 스킬 호출 사용. 훅은 매 대화의 기록을 보장하지 않음 |
| `start-implementation` | 현재 폴더에 대응하는 저장 프로젝트 조회, 새 작업 생성, 선택 모델·추론 적용 | 필요한 기능이나 지정 권한이 없으면 제한을 알리고 생성하지 않음 |
| `implement` | 현재 세션의 직접 구현, 아래 독립 에이전트 기능, 변경 상태·검증 근거 도구 | 필요한 독립 리뷰나 근거 확인이 불가능하면 완료로 처리하지 않음 |

## 구현 실행에 필요한 기능

`start-implementation`은 현재 프로젝트와 동일한 저장 프로젝트를 찾아 `local` 환경으로 새 작업을 만듭니다. 생성 인수에 모델·추론 수준을 지정하고 메시지는 `$proofline:implement SPEC-0001` 한 줄로 전달합니다. 원래 세션은 생성 결과를 보고하고 종료합니다. 새 세션의 `implement`가 SPEC 계약을 읽고 구현부터 완료까지 맡습니다. 독립 리뷰에는 구현 대화 이력을 상속하지 않는 `spawn_agent`와 결과를 기다리는 `wait_agent`가 필요합니다. 리뷰 배정 시점의 주 구현자 모델·추론 수준을 설정하거나 같은 설정을 보장하는 이력 없는 상속이 가능해야 합니다.

독립 병렬 구현을 사용하는 경우에도 `spawn_agent`로 배정합니다. 실행 중 조정은 `send_message`, 기존 구현자의 후속 작업은 `followup_task`로 전달합니다. 주 구현자는 배정 직후 자기 작업을 계속하고 같은 턴에서 결과를 기다려 통합합니다. 병렬 구현자를 만들지 않는 단독 구현도 지원합니다.

작업 위치는 현재 프로젝트 폴더입니다. worktree 생성·대화 복제·완료 콜백은 사용하지 않습니다. 준비 단계는 현재 설정을 유지하고, 새 구현 세션과 병렬 구현자에 [모델 라우팅](../skills/start-implementation/assets/model-routing.md)을 적용합니다. 사용자가 모델이나 추론 수준을 명시하면 그 선택이 우선하며, 사용할 수 없는 명시적 선택을 임의로 대체하지 않습니다.

도구 이름이 바뀌었더라도 동일 기능이라고 자동 간주하지 않습니다. 스킬 계약, 훅 matcher, 테스트가 새 이름을 함께 지원하기 전에는 해당 경로가 지원된다고 보지 않습니다. 작업 생성 도구가 모델 지정에 사용자 명시를 요구하면 그 선택을 받은 뒤 생성합니다. 정책에 따른 자동 선정만으로 도구의 지정 조건을 충족했다고 간주하지 않습니다. 필수 기능이 없는 환경에서도 공통 규칙과 개별 스킬은 사용할 수 있지만, 이는 전체 구현 Workflow의 자동 대체 경로가 아닙니다.

## 실행 가드의 경계

`hooks/execution-guard.js`는 Proofline 실행 역할이 정해진 작업에서 실수로 절차를 어기는 것을 줄이는 보호 장치입니다. 보안 샌드박스나 공격적 우회를 막는 경계가 아닙니다.

가드는 등록된 `PreToolUse` matcher와 인식한 명령 형태만 검사합니다. 역할 상태가 없는 현재 세션에는 제한을 적용하지 않습니다. 손상된 상태나 지원하지 않는 역할은 훅 오류로 보고하며, 안정적인 식별자가 없으면 역할을 등록하지 않습니다. 셸 래퍼, 별칭, 사용자 스크립트, 등록되지 않은 도구 이름과 훅이 호출되지 않는 실행 경로도 완전하게 통제한다고 주장하지 않습니다. Codex 공식 문서 역시 도구 훅을 완전한 강제 경계가 아닌 보호 장치로 규정합니다.

참고: [Codex 플러그인](https://developers.openai.com/codex/build-plugins), [Codex 훅](https://developers.openai.com/codex/hooks), [Codex Worktree](https://developers.openai.com/codex/environments/git-worktrees)
