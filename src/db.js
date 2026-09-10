// ============================================================
// F01 · 할 일 데이터 저장 (IndexedDB)
// ------------------------------------------------------------
// IndexedDB는 "브라우저 안의 냉장고" — 여기 저장한 데이터는
// 브라우저를 껐다 켜도 남아 있습니다.
// Dexie는 그 냉장고를 쉬운 문법으로 쓰게 해주는 도우미입니다.
// ============================================================
import Dexie from "dexie";
import { nextOccurrence } from "./date.js";

// 데이터베이스(냉장고)를 만들고 이름을 붙입니다.
export const db = new Dexie("todoDB");

// 냉장고 안의 칸(테이블) 구조를 정의합니다.
// "tasks" 칸에 할 일들을 담습니다.
// 나열된 필드(id, done, ...)는 "이 기준으로 빨리 찾을 수 있게" 만드는 색인입니다.
db.version(1).stores({
  tasks: "id, done, dueDate, priority, category, createdAt",
});

// version 2: "공지(알아둘 것)" 보관함 추가 (F08)
// — 기존 tasks 데이터는 그대로 유지되고 notes 칸만 새로 생김
db.version(2).stores({
  notes: "id, date, createdAt",
});

// version 3: "하루 기록" 보관함 추가 (F04) — 날짜당 1개, date가 키
db.version(3).stores({
  dayLogs: "date",
});

// version 4: "메모장" 보관함 추가 (F11) — 여러 줄 자유 글
db.version(4).stores({
  memos: "id, updatedAt, createdAt",
});

// version 5 (2026-08-03 통합, F11): 노트에 date 속성 추가 +
// "알아둘 것(notes)"의 항목을 노트로 자동 이사 (제목+설명 → 첫 줄+둘째 줄)
db.version(5)
  .stores({
    memos: "id, date, updatedAt, createdAt",
  })
  .upgrade(async (tx) => {
    const oldNotes = await tx.table("notes").toArray();
    if (oldNotes.length > 0) {
      const moved = oldNotes.map((n) => ({
        id: n.id, // 같은 id 유지 (이중 이사 방지)
        text: n.memo ? `${n.text}\n${n.memo}` : n.text,
        date: n.date ?? undefined,
        createdAt: n.createdAt,
        updatedAt: n.createdAt,
      }));
      await tx.table("memos").bulkPut(moved);
      await tx.table("notes").clear();
    }
  });

// version 6: 빈 notes 테이블 제거 (이사 완료 후 정리)
db.version(6).stores({
  notes: null,
});

// version 7 (2026-08-11, F03 R2d): 메모판 "스티커" 목록 보관함 — 이름이 키.
// (메모가 어느 스티커에 속하는지는 task.board 필드 — 화면에서 거르므로 색인 불필요)
db.version(7).stores({
  boards: "name, createdAt",
});

// version 8 (2026-09-10, F12): 구글 캘린더로 보내기 —
// settings: 설정값 한 줄씩 { key, value } (clientId · calendarId · lastSyncAt · lastError)
// gcalLinks: 앱 항목 ↔ 구글 이벤트 연결표 (localId가 키) — 보내기 단계(R3~)에서 사용
db.version(8).stores({
  settings: "key",
  gcalLinks: "localId, eventId",
});

// ------------------------------------------------------------
// 아래는 할 일을 다루는 함수들입니다. 화면(App.jsx)에서 가져다 씁니다.
// ------------------------------------------------------------

/** 새 할 일 추가 — 제목(title)만 있으면 됩니다. (쏟아붓기!)
 *  extra에 선택 필드를 같이 줄 수 있음 (예: { dueDate: "2026-07-02" }) */
export async function addTask(title, extra = {}) {
  const task = {
    id: crypto.randomUUID(),           // 고유 번호 자동 생성
    title: title,                       // 할 일 내용
    done: false,                        // 처음엔 미완료
    createdAt: new Date().toISOString(), // 만든 시각 자동 기록
    ...extra, // 입력에서 인식된 마감일 등 (없으면 아무것도 안 붙음)
  };
  await db.tasks.add(task);
}

/** 여러 할 일을 한 번에 추가 (가져오기용). 초안 배열을 받아 저장하고 개수를 반환 */
export async function addManyTasks(drafts) {
  const base = Date.now();
  const tasks = drafts.map((d, i) => ({
    id: crypto.randomUUID(),
    done: false,
    ...d, // 초안의 title·done·dueDate·category 등
    // 파일에 적힌 순서를 유지하려고 생성 시각을 1ms씩 늘려줌
    createdAt: new Date(base + i).toISOString(),
  }));
  await db.tasks.bulkAdd(tasks);
  // 백업에 적힌 스티커(📌이름)가 아직 없으면 만들어 줌 (F03 R2d 왕복)
  const boardNames = [...new Set(tasks.map((t) => t.board).filter(Boolean))];
  for (const name of boardNames) await addBoard(name);
  return tasks.length;
}

/** 완료 여부 뒤집기 — 체크박스를 누를 때 사용.
 *  완료하면 완료 시각(completedAt)을 기록 — "하루 기록"의 자동 수집용 (F04 R1·R6) */
export async function toggleDone(task) {
  await db.tasks.update(
    task.id,
    task.done
      ? { done: false, completedAt: undefined } // 해제하면 시각도 제거
      : { done: true, completedAt: new Date().toISOString() }
  );
}

/** 완료 표시 풀기 (실행취소용) — 잘못 체크한 것을 미완료로 되돌림 */
export async function uncheckTasks(ids) {
  await db.tasks
    .where("id")
    .anyOf(ids)
    .modify({ done: false, completedAt: undefined });
}

// ------------------------------------------------------------
// 반복 할 일 완료 (F09 R3): 완료 기록을 남기고 다음 회차로
// ------------------------------------------------------------

/** 반복 할 일 체크: 완료 기록 생성 + 원본 날짜를 다음 회차로.
 *  실행취소에 필요한 정보를 돌려줌 */
export async function completeRepeatingTask(task) {
  const next = nextOccurrence(task.dueDate, task.repeat, {
    nth: task.repeatNth,
    weekday: task.repeatWeekday,
  });
  // 완료 기록: 반복 없는 일반 완료 할 일로 사본을 남김
  const record = {
    ...task,
    id: crypto.randomUUID(),
    done: true,
    completedAt: new Date().toISOString(), // 하루 기록 자동 수집용 (F04)
    repeat: undefined,
    repeatNth: undefined,
    repeatWeekday: undefined,
    createdAt: new Date().toISOString(),
  };
  await db.tasks.add(record);
  await db.tasks.update(task.id, { dueDate: next });
  return { recordId: record.id, prevDue: task.dueDate, nextDue: next };
}

/** 반복 완료 실행취소: 기록 삭제 + 원본 날짜 원복 (F09 R4)
 *  단, 완료 이후 사용자가 날짜를 직접 바꿨다면(현재 날짜 ≠ 우리가 넘긴 다음 회차)
 *  그 수정을 존중해 날짜는 건드리지 않는다 — 실행취소가 나중 수정을 덮어쓰지 않게 */
export async function undoCompleteRepeating(recordId, taskId, prevDue, expectedDue) {
  await db.tasks.delete(recordId);
  const current = await db.tasks.get(taskId);
  if (current && current.dueDate === expectedDue) {
    await db.tasks.update(taskId, { dueDate: prevDue });
  }
}

/** 할 일 수정 — 바꿀 내용만 골라서 전달 (예: { title: "새 제목", memo: "메모" }) */
export async function updateTask(id, changes) {
  await db.tasks.update(id, changes);
}

// ------------------------------------------------------------
// 휴지통 (소프트 삭제)
// "삭제"는 진짜로 지우지 않고 deletedAt(버린 시각)을 찍어 휴지통으로 보냄.
// 목록에서는 안 보이지만 데이터는 남아 있어 언제든 복원 가능.
// "완전 삭제"에서만 진짜로 제거됨.
// ------------------------------------------------------------

/** 휴지통으로 보내기 (소프트 삭제) — id 배열 (1개도 배열로) */
export async function trashTasks(ids) {
  const now = new Date().toISOString();
  await db.tasks.where("id").anyOf(ids).modify({ deletedAt: now });
}

/** 휴지통에서 복원 — deletedAt을 지워 목록으로 되돌림 */
export async function restoreTasks(ids) {
  await db.tasks.where("id").anyOf(ids).modify({ deletedAt: null });
}

/** 완전 삭제 (진짜 제거, 되돌릴 수 없음) — id 배열 */
export async function permanentDeleteTasks(ids) {
  await db.tasks.bulkDelete(ids);
}

/** 휴지통 비우기 — 버려진 것 전부 완전 삭제 */
export async function emptyTrash() {
  await db.tasks.filter((t) => !!t.deletedAt).delete();
}

// ------------------------------------------------------------
// 하루 기록 (F04) — 날짜당 1개의 문서: { date, plans, extras, note }
// ------------------------------------------------------------

/** 그 날짜의 기록을 가져오고, 없으면 빈 기록을 만들어 반환 (저장은 안 함) */
async function getDayLog(date) {
  return (await db.dayLogs.get(date)) ?? { date, plans: [], extras: [], note: "" };
}

/** 오늘의 계획에 한 줄 추가 (자유 작성, R3) */
export async function addPlanLine(date, text) {
  const log = await getDayLog(date);
  log.plans.push({ id: crypto.randomUUID(), text, done: false });
  await db.dayLogs.put(log);
}

/** 계획 줄의 달성 체크 토글 (할 일과 독립, R3) */
export async function togglePlanLine(date, id) {
  const log = await getDayLog(date);
  const line = log.plans.find((p) => p.id === id);
  if (line) {
    line.done = !line.done;
    await db.dayLogs.put(log);
  }
}

/** 계획 줄 내용 수정 (F04 R3 — 2026-08-05: 그 자리 편집) */
export async function updatePlanLine(date, id, text) {
  const log = await getDayLog(date);
  const line = log.plans.find((p) => p.id === id);
  if (!line) return;
  line.text = text;
  await db.dayLogs.put(log);
}

/** "계획 외에 한 일" 줄 내용 수정 (F04 R4) */
export async function updateExtraLine(date, id, text) {
  const log = await getDayLog(date);
  const line = log.extras.find((x) => x.id === id);
  if (!line) return;
  line.text = text;
  await db.dayLogs.put(log);
}

/** 계획 줄 삭제 */
export async function deletePlanLine(date, id) {
  const log = await getDayLog(date);
  log.plans = log.plans.filter((p) => p.id !== id);
  await db.dayLogs.put(log);
}

/** 못한 계획 줄을 다른 날짜의 계획으로 미루기 (F04 R8)
 *  원본은 지우지 않고 "미룸(movedTo)" 표시로 남김 — 그날의 계획 총 개수 보존.
 *  (지우면 미루기로 달성률을 조작하는 거짓 기록이 됨) */
export async function movePlanLine(fromDate, id, toDate) {
  if (fromDate === toDate) return;
  const from = await getDayLog(fromDate);
  const line = from.plans.find((p) => p.id === id);
  if (!line || line.movedTo) return;
  line.movedTo = toDate; // 원본에 "→ 어디로" 기록
  const to = await getDayLog(toDate);
  to.plans.push({ id: crypto.randomUUID(), text: line.text, done: false });
  await db.dayLogs.put(from);
  await db.dayLogs.put(to);
}

/** 계획 줄을 "언젠가(메모)"로 미룸 표시 (F04 R8 — 할 일 추가는 화면 쪽에서) */
export async function markPlanMovedToMemo(date, id) {
  const log = await getDayLog(date);
  const line = log.plans.find((p) => p.id === id);
  if (!line || line.movedTo) return;
  line.movedTo = "memo";
  await db.dayLogs.put(log);
}

/** "계획 외에 한 일" 한 줄 추가 (R4) */
export async function addExtraLine(date, text) {
  const log = await getDayLog(date);
  log.extras.push({ id: crypto.randomUUID(), text });
  await db.dayLogs.put(log);
}

/** 계획 외 줄 삭제 */
export async function deleteExtraLine(date, id) {
  const log = await getDayLog(date);
  log.extras = log.extras.filter((x) => x.id !== id);
  await db.dayLogs.put(log);
}

/** 회고 메모 저장 (R5) */
export async function setDayNote(date, note) {
  const log = await getDayLog(date);
  log.note = note.trim();
  await db.dayLogs.put(log);
}

// ------------------------------------------------------------
// 노트 (F11 통합) — 자유 글 + 선택적 날짜(일정 성격)
// ------------------------------------------------------------

/** 새 노트 저장 (date는 선택 — 있으면 일정 성격). 만든 노트의 id를 반환 */
export async function addMemo(text, date) {
  const now = new Date().toISOString();
  const memo = {
    id: crypto.randomUUID(),
    text,
    date: date || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.memos.add(memo);
  return memo.id;
}

/** 노트 수정 (내용·날짜) — 수정 시각 갱신 (목록 정렬 기준) */
export async function updateMemo(id, text, date) {
  await db.memos.update(id, {
    text,
    date: date || undefined,
    updatedAt: new Date().toISOString(),
  });
}

/** 메모 삭제 (실행취소는 restoreMemos로) */
export async function deleteMemo(id) {
  await db.memos.delete(id);
}

/** 삭제한 메모 되살리기 — 실행취소용 */
export async function restoreMemos(memos) {
  await db.memos.bulkAdd(memos);
}

// ------------------------------------------------------------
// 메모판 스티커 (F03 R2d, 2026-08-11): 날짜 없는 할 일을 이름 붙인 스티커로 나누기
// 스티커 = boards 테이블의 한 줄, 소속 = task.board (없으면 기본 "📌 메모")
// ------------------------------------------------------------

/** 스티커 만들기 — 같은 이름이 이미 있으면 아무것도 안 함 */
export async function addBoard(name) {
  const n = name.trim();
  if (!n) return;
  if (await db.boards.get(n)) return;
  await db.boards.add({ name: n, createdAt: new Date().toISOString() });
}

/** 스티커 이름 바꾸기 — 안의 메모들도 새 이름으로 따라감 */
export async function renameBoard(oldName, newName) {
  const n = newName.trim();
  if (!n || n === oldName) return;
  if (await db.boards.get(n)) return; // 이미 있는 이름으로는 못 바꿈
  await db.transaction("rw", db.boards, db.tasks, async () => {
    const old = await db.boards.get(oldName);
    await db.boards.delete(oldName);
    await db.boards.add({
      name: n,
      createdAt: old?.createdAt ?? new Date().toISOString(), // 만든 순서 유지
      col: old?.col, // 배치된 자리도 유지 (R2e — 이름 바꿔도 스티커가 안 튀게)
      ord: old?.ord,
    });
    await db.tasks.filter((t) => t.board === oldName).modify({ board: n });
  });
}

/** 스티커 삭제 — 안에 있던 메모는 기본 스티커로 돌아감 (메모는 지워지지 않음) */
export async function deleteBoard(name) {
  await db.transaction("rw", db.boards, db.tasks, async () => {
    await db.boards.delete(name);
    await db.tasks.filter((t) => t.board === name).modify({ board: undefined });
  });
}

/** 메모를 다른 스티커로 옮기기 (board가 비어 있으면 기본 스티커로) */
export async function moveTaskToBoard(id, board) {
  await db.tasks.update(id, { board: board || undefined });
}

/** 스티커 배치 일괄 저장 (R2e) — cols는 열별 스티커 이름 배열. "" = 기본 📌 메모 스티커.
 *  각 스티커에 몇 번째 열(col)·열 안 순서(ord)를 기록. 기본 스티커는 "" 이름의 행으로 보관 */
export async function saveBoardLayout(cols) {
  await db.transaction("rw", db.boards, async () => {
    for (let c = 0; c < cols.length; c++) {
      for (let j = 0; j < cols[c].length; j++) {
        const name = cols[c][j];
        const row = await db.boards.get(name);
        if (row) await db.boards.update(name, { col: c, ord: j });
        else await db.boards.put({ name, createdAt: "", col: c, ord: j });
      }
    }
  });
}

// ------------------------------------------------------------
// 설정값 (F12) — { key, value } 한 줄씩. 예: clientId
// ------------------------------------------------------------

/** 설정값 읽기 (없으면 undefined) */
export async function getSetting(key) {
  return (await db.settings.get(key))?.value;
}

/** 설정값 저장 (같은 key가 있으면 덮어씀) */
export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}
