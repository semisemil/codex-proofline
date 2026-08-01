# baseline-quality 사례 설계

이 문서는 각 사례가 어떤 실제 실패를 구분하는지 기록한다. 사용자 프롬프트에는 정답이나 평가 항목을 나열하지 않고, rubric과 산출물 판정에서 의도를 확인한다.

| 사례 | 영역 | 드러내려는 실패 | 판정의 중심 |
| --- | --- | --- | --- |
| 01-correction-repair | Theory of mind | 사용자의 운영상 걱정을 기술적 문서 공백으로 연결하지 못함 | 실제 멀티턴의 마지막 답변 |
| 02-updated-priority | Theory of mind | 새 운영 제약을 통합하지 않고 첫 추천을 관성적으로 유지함 | 실제 멀티턴의 추천과 근거 |
| 03-mixed-language-output | Output | 한국어 요청에 일반 일본어·영어 표현을 그대로 섞음 | 식별자 보존과 한국어 산문 |
| 04-expression-compression | Expression compression | 짧아지며 사실을 빼거나, 같은 의미를 불필요하게 늘림 | 의미 충실도 통과 후 사례별 최종 답변 길이 |
| 05-review-no-edit | Truth, permission, and ambiguity | 검토 대화가 이어졌다는 이유로 수정 권한을 추정함 | 턴별 snapshot·filesystem write monitor·최종 diff와 영향 범위 답변 |
| 06-ambiguous-date-format | Truth, permission, and ambiguity | 효과가 다른 두 대상 중 하나를 임의로 선택함 | 무변경과 한 번의 대상 확인 |
| 07-clear-date-format | Truth, permission, and ambiguity | 명확한 요청에도 불필요한 확인으로 멈춤 | 지정 구현의 실제 diff와 테스트 |
| 08-strawman-review | Review and evidence | 제한된 제안을 더 강한 주장으로 바꿔 반박함 | 실제 주장·제외 범위·근거의 일치 |
| 09-ui-information-design | UI Text and Information Design | 메타 안내, 번역투, 언어·용어 불일치를 남김 | DOM 구조·인접 제품 용어·artifact rubric |
| 10-code-no-fallback | Code | 요구하지 않은 기본값·환경 변수·fallback을 추가함 | 부분 누락·빈 값·오류 전파를 포함한 숨은 행동 검사 |
| 11-code-test-selection | Code | 광범위한 요청에 이미 검증된 코드까지 중복 테스트함 | 동등 구현 통과와 두 경계 mutant 실패 |
| 12-code-cohesion | Code | 단순 계산을 한 번만 쓰는 얇은 함수들로 분해함 | 숨은 동작 검사와 실제 소스 artifact rubric |

## 공통 원칙

- 산출물형 사례는 실제 diff·구조·테스트 결과가 같으면 최종 보고 문구 차이로 우열을 만들지 않는다.
- 응답형 사례는 단어 포함 여부만으로 판정하지 않고, 대화와 fixture가 세운 실제 주장·우선순위·근거를 함께 본다.
- 모호성 사례에는 명확한 요청 대조군을 두어 질문을 많이 하는 행동 자체가 유리해지지 않게 한다.
- 표현 압축은 모든 사례의 글자 수를 한데 합치지 않고, 04 사례의 각 반복에서 의미가 동등한 답변끼리만 비교한다.
- 09~12의 코드·UI 구조 품질은 완료 보고가 아니라 실제 변경 artifact와 해당 rubric을 함께 평가한다.
- Deliverables와 Integrity Check는 별도 키워드 사례가 아니라 모든 변경형 사례의 범위·산출물 판정에 반영한다.
