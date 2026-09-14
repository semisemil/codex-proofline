# WebAgent와 Sol SubAgent 비용

2026-09-14. 같은 코드 검토와 작업 배치 문제를 각각 실행했습니다. SubAgent는 GPT-5.6 Sol / high로 새로 측정했습니다. WebAgent는 직전 측정의 GPT-5.6 Sol / High 결과입니다. 부모는 두 경로 모두 Astra / medium입니다.

| 작업 | SubAgent 부모 | Sol 자식 | SubAgent 합계 | WebAgent |
| --- | ---: | ---: | ---: | ---: |
| 코드 검토 | $0.3499 | $0.1358 | $0.4857 | $0.1668 |
| 작업 배치 | $0.2916 | $0.0271 | $0.3187 | $0.1680 |

비용은 기록된 토큰에 API 단가를 적용한 달러($) 추정치이며 실제 청구액이 아닙니다. 100만 토큰당 비캐시 입력, 캐시 입력, 출력 순서로 [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)는 $10, $1, $50이고 [Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)은 $4, $0.40, $20입니다. 추론 토큰은 출력에 포함하므로 중복 가산하지 않았습니다.

SubAgent는 문제마다 대화 내역을 상속하지 않고 새로 생성했습니다. 부모의 생성, 대기, 답변 검토 및 기록 3회와 자식의 전체 추론을 합산했습니다. WebAgent는 첫 문제에서 새 Chat을 생성하고 두 번째 문제에서 재사용했으며 요청부터 회수까지 1회, 검토 1회입니다. 브라우저 연결과 실행기 로딩은 요청 전에 마쳤으며, 그 과정의 모델 호출은 합산하지 않았습니다. 비용을 집계하고 보고서를 작성한 호출도 제외했습니다.

각 문제를 조건별로 한 번씩 실행했습니다.

양쪽 답변은 캐시 요구 충족 여부와 수정 원칙, 작업 배치의 시간, 선행 조건, 중복 없는 실행과 최적 완료 시각을 검증했습니다.

[응답별 사용량과 답변](webagent-sol-comparison.json) / [동일 문제](webagent-comparison-prompts.json)
