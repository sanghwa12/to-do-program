---
기능ID: F01
기능명: 할 일 데이터 저장 (IndexedDB)
마일스톤: 1
상태: 구현완료
최종수정: 2026-07-02
---

# F01 · 할 일 데이터 저장 (IndexedDB)

## 목적
모든 할 일을 브라우저 로컬(IndexedDB)에 저장해서, 브라우저를 껐다 켜도
데이터가 그대로 남아 있게 한다. 다른 모든 기능의 토대.

> 💡 비유: IndexedDB는 브라우저 안의 냉장고. 여기 넣어둔 할 일은 불을 껐다 켜도(=브라우저 재시작) 그대로 있다.

## 사용자 시나리오
- 할 일을 추가하고 브라우저를 껐다 켜도 그 할 일이 그대로 있다.
- 인터넷이 끊긴 상태에서도 목록을 보고 추가/수정할 수 있다.

## 요구사항 (검증 항목)
- [ ] R1. `Task` 데이터 구조가 CLAUDE.md의 데이터 모델과 일치한다.
      필드: `id, title, memo?, dueDate?, startDate?, dateKind?, priority?, category?, done, createdAt`
      (dateKind: "due" 마감 | "day" 당일 | "range" 기간 — 2026-07-02 추가)
- [ ] R2. Dexie.js로 IndexedDB 데이터베이스를 정의한 파일이 있다 (예: `src/db.js`).
- [ ] R3. `tasks` 테이블(스토어)이 정의되어 있고, `id`로 조회 가능한 스키마다.
- [ ] R4. 할 일 저장/조회/수정/삭제 함수(또는 Dexie 호출)가 존재한다.
- [ ] R5. `id`는 저장 시 자동 생성된다 (`crypto.randomUUID()` 등). 사용자가 직접 안 넣는다.
- [ ] R6. `createdAt`은 저장 시 자동으로 채워진다 (ISO 8601 문자열).
- [ ] R7. `title` 외의 필드는 전부 없어도 저장된다 (선택 필드 — 쏟아붓기를 막지 않기).

## 관련 제약 (CLAUDE.md 핵심 제약)
- **localStorage / sessionStorage 사용 금지** → 반드시 IndexedDB.
- 새 라이브러리(Dexie) 추가 이유: 순수 IndexedDB API는 문법이 까다로움.
  Dexie는 같은 저장소를 쉬운 문법으로 쓰게 해주는 도우미 → 입문자 친화적.
- 백엔드 서버 / 클라우드 DB 도입 금지 (전부 브라우저 안에서).

## 관련 파일
- `src/db.js` — Dexie DB 정의 + CRUD 함수 (addTask / toggleDone / updateTask / deleteTask)

## 비고 / 미결정
- `dueDate` 없는 할 일 = "날짜 미정". 정리 뷰(F03)에서 어떻게 보여줄지는 F03에서 결정.
