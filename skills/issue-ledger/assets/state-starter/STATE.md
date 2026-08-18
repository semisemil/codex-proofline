# Proofline State

This directory stores project-local Proofline state.

Source of truth:

- `.proofline/issues/*.json` (Issue Ledger v2)
- `.proofline/issues/*.md` (legacy read compatibility)

## Local dashboard

Proofline의 통합 작업 대시보드는 플러그인 소유의 `127.0.0.1` 로컬 서버에서 이 프로젝트의 Issue, Plan, Spec 원본을 읽습니다.

`$proofline:dashboard-server open`으로 실행 중인 대시보드를 엽니다. 서버 상태 확인과 종료는 각각 `status`, `stop`을 사용합니다. 서버는 SessionStart에서 시작되며 `open`은 중지된 서버를 시작하지 않습니다.

새 Proofline 기록은 프로젝트별 `.proofline/dashboard/`를 만들거나 갱신하지 않습니다. 기존 `.proofline/dashboard/`가 있으면 그대로 보존되지만 새 기능과 지원 진입점은 통합 로컬 서버입니다.
