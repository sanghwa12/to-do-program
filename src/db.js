// ============================================================
// F01 · 할 일 데이터 저장 (IndexedDB)
// ------------------------------------------------------------
// IndexedDB는 "브라우저 안의 냉장고" — 여기 저장한 데이터는
// 브라우저를 껐다 켜도 남아 있습니다.
// Dexie는 그 냉장고를 쉬운 문법으로 쓰게 해주는 도우미입니다.
// ============================================================
import Dexie from "dexie";

// 데이터베이스(냉장고)를 만들고 이름을 붙입니다.
export const db = new Dexie("todoDB");

// 냉장고 안의 칸(테이블) 구조를 정의합니다.
// "tasks" 칸에 할 일들을 담습니다.
// 나열된 필드(id, done, ...)는 "이 기준으로 빨리 찾을 수 있게" 만드는 색인입니다.
db.version(1).stores({
  tasks: "id, done, dueDate, priority, category, createdAt",
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
  return tasks.length;
}

/** 완료 여부 뒤집기 — 체크박스를 누를 때 사용 */
export async function toggleDone(task) {
  await db.tasks.update(task.id, { done: !task.done });
}

/** 완료 표시 풀기 (실행취소용) — 잘못 체크한 것을 미완료로 되돌림 */
export async function uncheckTasks(ids) {
  await db.tasks.where("id").anyOf(ids).modify({ done: false });
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
