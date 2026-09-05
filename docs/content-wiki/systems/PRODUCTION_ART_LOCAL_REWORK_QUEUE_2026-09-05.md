# Production Art Local Rework Queue — 2026-09-05

## 목적

Human Review Hub와 Motion Review Gallery에서 발견한 시각 문제를 **사람 승인과 분리된 로컬 재작업 후보**로 정리한다.

이 기능은 production 후보를 승인하거나 런타임 정본으로 승격하지 않는다. 현재 production art 경계는 계속 다음과 같다.

- human review: `PENDING` / `UNREVIEWED_RUNTIME_FILES`
- `normalRuntimeAuthoritative: false`
- `generativeAiUsed: false`
- `humanApprovalAuthority: false`

## 진입점

`/assets/production/review/rework-queue.html`

Human Review Hub의 `OPEN LOCAL REWORK QUEUE`에서 진입한다.

## 다루는 범위

현재 Human Review Hub와 같은 11개 review mode를 읽는다.

- First Slice
- Second Slice
- Third Slice
- Fourth Slice
- Chapter 1 Finale 전 단계인 Fifth Slice
- Chapter 1 Finale
- Chapter 2
- Chapter 3
- Chapter 4
- Special Content
- Recruitment

메인 스토리는 Chapter 4에서 끝난다. 이 queue는 추가 chapter를 만들지 않는다.

## 로컬 triage 상태

Queue는 Motion Review Gallery의 다음 로컬 상태를 읽는다.

- `LOCAL CHECKED`
- `GALLERY REVISIT`

그리고 별도 namespace에서 다음 재작업 메모를 저장한다.

- disposition: 없음 / `REVISIT` / `BLOCKER`
- reason: silhouette / motion / attack-contact / scale-clipping / combat-readability / form-distinction / other
- 자유 메모

저장 위치는 브라우저 `localStorage`뿐이다.

- gallery namespace: `frontline-production-review-gallery-local-v1:`
- rework namespace: `frontline-production-review-rework-local-v1:`

## JSON 초안

`COPY REWORK JSON`은 현재 문제 후보만 다음 종류의 JSON으로 복사한다.

`kind: LOCAL_REWORK_TRIAGE_DRAFT`

반드시 다음 경계를 유지한다.

- `humanApprovalAuthority: false`
- `canonicalWrite: false`
- `approvalEvidence: false`
- reviewer identity 저장 금지
- review timestamp 저장 금지
- canonical production JSON 자동 수정 금지
- review package 자동 승인 금지
- runtime authority 자동 승격 금지

이 JSON은 후속 재작업 입력을 사람이 검토하기 위한 **비권위 초안**이다. 실제 production rework 반영은 별도 명시적 처리와 기존 validator를 거쳐야 한다.

## CI

다음 스크립트가 production gate에 포함된다.

- `npm run assets:production:review-queue:materialize`
- `npm run assets:production:review-queue:check`

Queue validator는 11개 metadata mapping, 로컬 storage namespace, disposition/reason vocabulary, clipboard JSON 초안, read-only 경계 및 승인 상태 비주장을 검사한다.
