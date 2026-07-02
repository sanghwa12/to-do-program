// ============================================================
// F06 · 파일 내보내기 (백업 · Obsidian 호환)
// ------------------------------------------------------------
// 할 일 전체를 마크다운(.md) 텍스트 파일로 다운로드합니다.
// - 데이터가 브라우저 안에만 갇히지 않게 하는 백업 수단
// - "- [ ] 제목" 형식은 Obsidian에서 체크리스트로 그대로 보임
// - 서버 업로드 없음: 파일은 오직 내 컴퓨터에 저장됨
// ============================================================
import { db } from "./db.js";
import { todayStr } from "./date.js";
import { PRIORITY_LABEL } from "./labels.js";

/** 할 일 하나를 마크다운 한 줄로 변환 */
function taskToLine(task) {
  const box = task.done ? "x" : " "; // 완료면 [x], 미완료면 [ ]
  let line = `- [${box}] ${task.title}`;
  if (task.dueDate) line += ` 📅 ${task.dueDate}`;
  if (task.priority) line += ` (${PRIORITY_LABEL[task.priority]})`;
  if (task.category) line += ` #${task.category}`;
  // 메모는 들여쓴 다음 줄로 (줄바꿈이 있으면 " / "로 이어붙임)
  if (task.memo) line += `\n    - 메모: ${task.memo.replace(/\n/g, " / ")}`;
  return line;
}

/** 전체 할 일을 .md 파일로 만들어 다운로드 */
export async function exportBackup() {
  // 저장된 할 일을 읽기만 함 (변경 ❌) — 만든 순서대로
  const tasks = await db.tasks.orderBy("createdAt").toArray();
  const today = todayStr();
  const todo = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const lines = [
    `# 할 일 백업 (${today})`,
    "",
    `## 미완료 (${todo.length}개)`,
    ...todo.map(taskToLine),
    "",
    `## 완료 (${done.length}개)`,
    ...done.map(taskToLine),
    "",
  ];

  // 브라우저의 파일 다운로드 기능만 사용 (외부 전송 없음)
  const blob = new Blob([lines.join("\n")], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `할일백업-${today}.md`; // 파일명에 날짜 → 백업본 구분
  a.click();
  URL.revokeObjectURL(url); // 뒷정리
}
