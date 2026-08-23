# 플레이어 캐릭터 데이터

`chapter-01.json`은 제1장 플레이어 캐릭터 수치의 런타임 정본이다.

- 이름/희귀도/역할/설명
- HP/공격력/이동속도/사거리
- 공격 주기/타격 프레임/후딜
- 자연 KB 횟수
- 단일/범위 공격
- 생산 비용/재생산 시간

`apps/client/src/prototype.ts`에 같은 수치를 다시 하드코딩하지 않는다. 클라이언트는 이 JSON을 `@frontline/content-schema`로 검증한 뒤 `BattleUnitDefinition`으로 변환한다.

새 캐릭터를 추가할 때는 스테이지 해금 또는 별도 수집 경로가 반드시 존재해야 하며, 현재 제1장에서는 `militia`만 시작 캐릭터다.
