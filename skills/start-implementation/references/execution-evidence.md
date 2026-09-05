# 실행 근거

주 구현자는 구현 전에 시작 상태를 남기고, 실제 변경에 필요한 검증과 독립 리뷰를 연결한다. 아래 도구는 Git 인덱스·브랜치·커밋을 변경하지 않는다. 실행 상태 형식은 버전 2다. SPEC 원문·ID·revision·해시는 도구가 직접 보존한다. 원래 대화와 별도 인계 요약은 필요하지 않다. 실행 자료는 시스템 임시 디렉터리에 저장하며 반환된 `state_path`를 같은 실행에서 사용한다. 이 자료는 원본 Spec과 과거 실행 기록을 대체하지 않는다.

## 시작 상태

`node <plugin-root>/skills/start-implementation/scripts/implementation-state.js capture --cwd <repository-root> --spec <relative-path-to-SPEC.md>`

다음 JSON을 stdin으로 전달한다. 파일을 통해 전달할 때는 셸 문자열로 재구성하지 말고 파일 내용을 그대로 입력한다.

```json
{
  "sources": ["docs/original-contract.md"],
  "requirements": [
    { "id": "C1", "text": "Spec의 완료 조건" },
    { "id": "C2", "text": "사용자가 지정한 검증 명령과 성공 조건" }
  ],
  "settings": { "model": "현재 세션의 실제 모델 ID", "reasoning": "현재 세션의 실제 추론 수준" }
}
```

완료 조건과 사용자 지정 검증을 빠짐없이 옮긴다. 서로 필수인 검사에는 별도 ID를 부여한다. 검사 명령을 미리 고정할 필요는 없다. 모델·추론 설정을 알 수 없으면 임의로 추측하지 않는다. 런타임이 새 문맥에서도 주 구현자의 두 설정을 상속한다고 보장한다면 `settings: { "inherit_current": true }`로 그 배정 방식을 기록한다. 리뷰어 생성 시 `fork_turns: "none"`으로 문맥을 분리하고 모델·추론 재정의는 생략한다. 그런 보장도 없으면 필요한 기능을 확인할 때까지 독립 리뷰를 완료로 간주하지 않는다.

시작 상태는 추적 파일과 Git이 무시하지 않는 미추적 파일의 실제 내용을 포함한다. 활성 Spec은 별도 원본으로 보존·확인하며 제품 변경 지문에서 제외한다. 기존 스테이징과 작업 파일이 달라도 작업 파일을 기준으로 이번 실행의 변경분을 계산한다. Git이 무시하는 생성물·외부 서비스·설치된 의존성 상태는 자동 추적 대상이 아니므로 그것이 바뀌면 영향받는 검증을 다시 수행하고 근거를 갱신한다.

## 검증 기록

이하 모든 명령에 `--state <state_path>`를 사용한다.

주 구현자가 병렬 구현자의 반환 근거를 모아 실행 상태에 차례로 기록한다. 같은 상태 파일에 대한 동시 갱신은 거부하며, 이미 수행한 검증은 실제 출력과 검증 당시 지문을 보존해 다시 기록한다. 테스트 자체를 무조건 다시 실행할 필요는 없다.

`status`는 현재 fingerprint, 시작 이후 변경 경로, 필수 조건별 검증 여부를 반환한다. 주 구현자가 `snapshot`으로 현재 파일 내용을 임시 저장소에 보존하면 `diff`에서 시작 이후의 실제 파일 변경을 읽을 수 있다. `review-input` 전에 최신 상태의 snapshot을 준비한다. 자동 스테이징이나 커밋은 하지 않는다. 병렬 작업의 쓰기가 끝나고 주 구현자가 통합한 상태에서 최종 검증·리뷰를 준비한다.

`check`는 JSON stdin으로 지정한 명령을 실제 실행하고 명령·위치·출력·종료 코드·검증한 상태를 기록한다.

```json
{
  "requirements": ["C1"],
  "command": ["node", "--test", "tests/example.test.js"],
  "cwd": ".",
  "dependencies": ["src", "tests", "package.json", "package-lock.json"]
}
```

`command`는 실행 파일과 인수 배열이다. 셸 문법이 필요한 명령은 해당 셸과 인수로 명시한다. Windows의 `npm.cmd`처럼 셸을 요구하는 진입점은 일반 실행 도구로 실행하고 아래 `evidence`로 기록할 수도 있다. `dependencies`는 결과에 영향을 주는 파일·디렉터리 전체이며 생략하면 저장소 전체다. 명령 실행 중 관련 상태가 변하거나 종료 코드가 0이 아니면 성공으로 기록하지 않는다.

구현자는 일반 실행 도구로 테스트를 추가·실행할 수 있다. 이미 실행한 명령이나 수동 확인은 `evidence`에 기록한다. 실행 전에 얻은 fingerprint가 현재 상태와 같아야 하며, 명령 기록에는 다음 정보가 필요하다.

```json
{
  "requirements": ["C2"],
  "kind": "command",
  "fingerprint": "실제로 검증한 상태의 fingerprint",
  "passed": true,
  "command": "npm test",
  "cwd": "실제 실행 디렉터리",
  "exit_code": 0,
  "result": "실제 테스트 결과와 출력 근거",
  "basis": "이 결과가 완료 조건을 충족하는 근거"
}
```

수동 확인은 `kind: "inspection"`과 구체적인 관찰·원본 근거를 `basis`에 기록한다. 이 기록은 구현자가 제공한 근거임을 표시하며, 도구가 명령 실행 자체를 증명한 것으로 취급하지 않는다. 기계적 검사가 요구된 조건을 수동 확인으로 대신하지 않는다.

같은 관련 상태의 성공 결과는 재사용한다. 관련 파일이 바뀌면 영향받는 검사만 다시 수행한다. 같은 조건의 나중 실패는 이전 성공보다 우선한다. 필수 조건이 하나라도 미검증이면 리뷰 준비와 완료가 거부된다.

## 독립 리뷰와 완료

설정의 실제 값을 사용하는 경우 아래 두 CLI 옵션을 전달한다. 보장된 현재 설정 상속을 사용하는 경우에는 두 옵션 대신 `review-input --inherit-current true`를 사용하고, 결과 기록의 `main_settings`와 `reviewer_settings`도 각각 `{ "inherit_current": true }`로 남긴다. 이 기록은 설정값을 추측한 것이 아니라 실제 배정에서 사용한 런타임 상속 방식이다. 상속 보장과 배정 당시 도구 인수는 주 구현자가 확인한다.

`review-input --model <main-model-at-dispatch> --reasoning <main-effort-at-dispatch>`는 Spec 계약·관련 원본 경로·실제 변경·현재 검증 근거를 구성한다. 매번 새 리뷰어에게 이 입력과 [리뷰 배정](reviewer.md)을 전달한다. 반환된 `reviewer_settings`로 `fork_turns: "none"`인 리뷰어를 생성한다. 이전 리뷰·판정·반박·제외 기록과 구현 대화는 전달하지 않는다. 전체 실행 상태 파일에는 주 구현자의 판단 기록이 있으므로 리뷰어에게 그 파일을 읽도록 지시하지 않는다.

리뷰어의 결과는 주 구현자가 `review`에 JSON stdin으로 기록한다.

```json
{
  "reviewer_id": "이번에 새로 생성한 에이전트 ID",
  "fingerprint": "리뷰 입력의 fingerprint",
  "main_settings": { "model": "배정 당시 주 구현자 모델", "reasoning": "배정 당시 추론 수준" },
  "reviewer_settings": { "model": "실제 리뷰어 모델", "reasoning": "실제 리뷰어 추론 수준" },
  "verdict": "fail",
  "findings": [{
    "id": "R1",
    "category": "out_of_scope",
    "requirement": "위반했다고 판단한 요구사항 또는 동작",
    "trigger": "발생 조건",
    "evidence": "관련 코드 위치와 근거",
    "change_relation": "이번 변경과의 관계"
  }],
  "exclusions": [{
    "id": "R1",
    "reason": "주 구현자가 확인한 범위 밖 사유",
    "evidence": "Spec과 실제 변경에 근거한 제외 판단"
  }]
}
```

`category`는 `requirement`, `regression`, `contract`, `out_of_scope` 중 하나다. 지적 없는 `pass`는 빈 findings/exclusions를 사용한다. 의미상 유효성·범위 판단은 주 구현자의 책임이다. 도구는 그 판단을 자동 증명하지 않으며 근거 없는 제외는 허용하지 않는다. 범위 밖 지적만 남은 `fail`도 제외 근거를 기록하면 완료를 막지 않는다. 유효한 지적은 담당 구현자가 수정·검증하고, 이전 리뷰 내용을 받지 않은 새 리뷰어가 최신 상태를 검토한다.

`complete`는 모든 필수 검증과 최신 상태의 수용 가능한 독립 리뷰를 확인하고 Spec의 `status`만 `completed`로 갱신한다. 제품 파일·인덱스·커밋에는 쓰지 않는다. 실행 중 합의된 Spec 변경이 생기면 `authority`에 `accepted_change`와 최신 `requirements`를 전달한다. 시작 상태는 보존하고 검증·리뷰 효력은 초기화한다. 실행 중 승인된 변경은 Spec에 반영한 뒤 갱신한다. 버전 1을 포함한 기존 실행 기록을 새 실행 형식으로 재개하거나 변환하지 않는다.
