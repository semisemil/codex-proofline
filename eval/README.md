# Proofline 평가

Proofline이 실제 작업 품질에 어떤 차이를 만드는지 확인하기 위한 공개 평가 세트입니다.

같은 모델에 같은 사용자 프롬프트와 같은 파일을 제공하고, Proofline 플러그인이 없는 격리 환경과 플러그인 및 `SessionStart` hook이 적용된 격리 환경의 결과를 비교합니다. 답변의 인상만 비교하지 않고 의미 보존, 작업 범위, 파일 변경, 명령 실행과 검증 결과를 함께 확인합니다.

## 실행하기

필요한 것은 최신 Node.js LTS와 Codex 로그인 또는 OpenAI API 키입니다. Promptfoo를 전역으로 설치할 필요는 없습니다.

```powershell
cd eval
npm install
npm run eval:validate
npm run eval:smoke
```

`npm install`은 이 폴더에 고정된 버전의 Promptfoo와 Codex SDK를 설치합니다. Promptfoo를 전역으로 따로 설치하지 않습니다. `npm run eval:validate`는 두 격리 환경, 평가용 로컬 플러그인 설치본, 동일 프롬프트와 핵심 평가기를 모델 호출 없이 확인합니다. `npm run eval:smoke`는 각 사례에서 Proofline 없음과 적용 결과를 한 번씩 생성하고 핵심 기준을 검사합니다. 결과는 각 평가 세트의 `results/local/`에 저장되며 Git에는 포함되지 않습니다.

공개 결과용 전체 실행과 상대평가는 다음처럼 나눠 실행합니다.

```powershell
npm run eval:full
npm run eval:judge
npm run eval:publish
```

`eval:full`은 각 조건을 세 번씩 실행해 원시 답변, 턴별 변경 증거와 실제 artifact를 저장합니다. `eval:judge`는 응답 사례는 최종 응답, 표현 압축 사례는 후보별 독립 의미 판정, 사례 09~12는 실제 변경 artifact를 사용합니다. 한쪽만 핵심 기준을 통과하면 평가자를 호출하지 않고 그 결과를 선택합니다. 순서 교차 비교의 승자가 다르거나 의미 있는 차이가 없으면 동점으로 처리하며, 모든 판정에는 이유를 기록합니다. `eval:publish`는 로컬 절대 경로를 제외한 공개 가능한 요약, 메타데이터, artifact와 판정 증거를 `results/published/<날짜>/`에 생성합니다.

Codex 작업은 한 번에 하나씩 실행합니다. 각 작업은 새 세션과 새 작업공간을 사용하므로 이전 실행의 대화나 파일 상태를 이어받지 않습니다.

로컬 Codex 로그인을 사용하는 경우 실행기가 로그인 파일 하나만 평가용 임시 `CODEX_HOME`에 복사합니다. 사용자 설정, 규칙, 스킬, 플러그인과 이전 대화는 복사하지 않으며 임시 홈은 실행 종료 시 삭제합니다. 적용군에만 현재 저장소에서 고정한 Proofline 플러그인을 로컬 marketplace를 통해 설치합니다. 격리 홈에는 플러그인의 CommonJS hook이 상위 평가 패키지의 모듈 형식에 영향을 받지 않도록 별도 모듈 경계를 둡니다. Windows에서는 파일 수정 평가가 작동하도록 비관리자용 sandbox 설정 하나를 각 임시 홈에 생성합니다. `OPENAI_API_KEY`나 `CODEX_API_KEY`가 설정되어 있으면 로그인 파일도 복사하지 않습니다.

## 평가 방법

모든 사례는 다음 두 조건으로 실행합니다.

| 조건 | 설명 |
| --- | --- |
| Proofline 없음 | 새 `CODEX_HOME`에 Proofline 플러그인과 hook이 없습니다. |
| Proofline 적용 | 별도의 새 `CODEX_HOME`에 고정한 Proofline 플러그인을 설치하고 실제 `SessionStart` hook을 실행합니다. |

두 조건은 같은 `prompts/task.txt`를 사용하므로 사용자 프롬프트가 바이트 단위로 같습니다. 프롬프트에는 Proofline 사용 또는 금지 지시가 없습니다. 모델, 추론 강도, 권한과 작업 파일도 같고, 차이는 Proofline 설치 및 hook 적용 여부뿐입니다.

실행 후에는 두 조건의 실제 사용자 턴 배열, 격리 세션, 사용자 전역 Proofline·memory 경로 누출을 검사합니다. 적용 조건의 `load-baseline.js` 호출과 성공 종료도 별도로 기록하며, 이 시스템 검사가 실패하면 사례 점수와 무관하게 실행 전체를 실패 처리합니다.

개발 중 빠른 점검에서는 두 조건을 각각 한 번 실행하고, 공개 결과를 만들 때는 강건성 확인을 위해 각각 세 번 실행합니다. 상대평가자는 어느 결과가 Proofline 적용 결과인지 모르는 상태에서 같은 기준으로 판정합니다. 빠른 점검 결과는 공개 성능 주장에 사용하지 않습니다.

## 평가 대상

| 스킬 | 확인하는 내용 |
| --- | --- |
| [`proofline-baseline-quality`](proofline-baseline-quality/) | 의미 보존, 표현 압축, 합의와 미정의 구분, 모호성 처리, 수정 권한, 검토 태도, 결과 보고와 코드 품질 |

다른 Proofline 스킬도 같은 형식으로 평가 세트를 추가합니다.

## 디렉터리 구성

```text
eval/
  package.json
  package-lock.json
  README.md
  PROTOCOL.md
  scripts/
  proofline-baseline-quality/
    README.md
    promptfooconfig.yaml
    prompts/
    tests/
    assertions/
    lib/
    providers/
    rubrics/
    fixtures/
    extensions/
    results/
```

- `prompts/`: 두 조건이 함께 사용하는 동일 사용자 프롬프트
- `tests/`: 실제 사용자 요청과 사례 정보
- `assertions/`: 파일 변경과 의미 보존 같은 핵심 기준의 자동 검사
- `lib/`: workspace snapshot, write monitor와 artifact 증거 수집 공통 코드
- `providers/`: 격리 Codex 턴 실행과 턴별 증거 수집
- `rubrics/`: 응답 의미 또는 실제 artifact를 비교할 때 사용하는 사례별 기준
- `fixtures/`: 해당 요청을 수행하는 데 필요한 최소 파일
- `extensions/`: 각 실행에 사용할 임시 작업공간 준비와 정리
- `results/`: 실행 조건, 사례별 결과와 전체 요약

평가 대상 Codex에는 사용자 요청과 해당 사례의 작업 파일만 제공합니다. 적용 조건의 Proofline 지침은 설치된 플러그인의 `SessionStart` hook이 전달합니다. 판정 기준과 다른 사례의 내용은 보여주지 않습니다. 스킬 라우팅이나 스킬 파일을 읽은 흔적은 사례 점수로 채점하지 않습니다.

## 결과 해석

평균 점수가 높더라도 중요한 의미를 바꾸거나 허용되지 않은 파일을 수정하면 좋은 결과로 판정하지 않습니다. 먼저 중대한 실패가 새로 생기지 않았는지 확인하고, 그다음 전체 실패 횟수와 보조 품질을 비교합니다.

공개된 사례만으로 모든 작업에서의 성능 우위를 주장하지 않습니다. 결과에는 평가 세트와 플러그인 버전, manifest·hook·baseline skill 해시, 모델, 추론 강도, Promptfoo·Codex SDK·Node.js 버전과 실행 시점을 함께 기록합니다.

## 알려진 의존성 경고

현재 고정된 최신 Promptfoo 버전의 선택적 로컬 모델 실행 경로에는 `onnxruntime-node`를 거쳐 `adm-zip` 0.5 계열이 포함됩니다. `npm audit`은 조작된 ZIP을 읽을 때 과도한 메모리를 할당할 수 있는 문제를 높은 심각도로 표시합니다. 이 평가기는 외부 모델 ZIP을 입력으로 받거나 해당 로컬 모델 실행 경로를 사용하지 않습니다. 호환되는 상위 버전이 나오기 전까지 강제 의존성 교체나 Promptfoo 다운그레이드는 하지 않습니다.

자세한 실행 및 판정 원칙은 [PROTOCOL.md](PROTOCOL.md)를 참고하세요.
