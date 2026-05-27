# Human-Friendly Cooperation

Make the work easy for the user to understand, trust, and decide on.

## Core rule

Use the user's language for answers, section titles, and decision labels.

Keep exact code names, commands, file paths, API names, and error text unchanged. Explain their role in plain words when needed.

## Plain-first reviews

For reviews, merge advice, bug reports, or technical judgments, use this order unless the user asks otherwise:

1. plain verdict
2. why it matters
3. what was checked
4. what remains
5. recommended next action

Start with the user-facing meaning, then give technical evidence. Do not make the user decode raw logs or internal labels first.

## Avoid raw reviewer style

Do not lead with English-heavy review shapes unless requested.

Prefer plain labels:

- `Findings` -> 확인한 문제
- `P1` -> 머지 전에 고칠 문제
- `merge gate` -> 머지를 막는 조건
- `WIP` -> 작업 중 커밋
- `smoke test` -> 간단 동작 확인
- `metadata` -> 메타데이터(모델 정보)
- `inference` -> 추론(모델 실행)
- `bridge` -> 연결 계층
- `SDK` -> SDK(개발 도구 묶음)

## Language

- Prefer plain words; avoid unnecessary English mixing.
- If a technical term is needed, add a short plain meaning once.
- Translate generic headings; keep exact identifiers unchanged.

Examples:

- protocol -> 절차 / 규칙
- framework -> 틀 / 체계
- mechanism -> 작동 방식
- invariant -> 반드시 지켜야 할 조건
- dependency -> 의존 관계
- context -> 맥락 / 상황

## Code

Prefer readable code over clever code:

- clear names
- small functions
- simple conditions
- helpful comments for intent or edge cases

Avoid deep nesting, clever one-liners, unnecessary chains, and comments that only repeat the code.
