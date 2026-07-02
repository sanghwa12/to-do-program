// ------------------------------------------------------------
// 쏟아붓기 입력창 (F02): 제목 쓰고 Enter만 누르면 추가.
// 추가 후 입력창은 비워지고 커서는 그대로 → 연속 입력 가능.
// "도서 반납 (~7/2)"처럼 쓰면 마감일을 자동 인식 (F02 R9)
// ※ 날짜·우선순위 등을 따로 묻지 않음 — 입력을 느리게 하지 않기 위해 (핵심 원칙!)
// ------------------------------------------------------------
import { useState } from "react";
import { addTask } from "../db.js";
import { parseQuickInput } from "../parse.js";

export default function QuickInput() {
  const [text, setText] = useState("");

  // 지금 친 내용에서 날짜가 인식되는지 (미리보기용, F02 R10)
  const parsed = parseQuickInput(text);

  // 폼 제출 = Enter를 눌렀을 때
  async function handleSubmit(e) {
    e.preventDefault(); // 페이지 새로고침(폼 기본 동작) 막기
    const { title, ...dateFields } = parseQuickInput(text);
    if (title === "") return; // 빈 제목은 추가하지 않음
    await addTask(title, dateFields); // 인식된 날짜(있으면)를 같이 저장
    setText(""); // 입력창 비우기 (커서는 입력창에 그대로 남음)
  }

  // 인식된 날짜 종류에 따른 미리보기 문구 (F02 R10)
  function previewText(p) {
    if (p.dateKind === "range")
      return `"${p.title}" — 📅 ${p.startDate} ~ ${p.dueDate} 기간으로 저장됩니다`;
    if (p.dateKind === "day")
      return `"${p.title}" — 📅 ${p.dueDate} 당일 일정으로 저장됩니다`;
    return `"${p.title}" — 📅 ${p.dueDate}까지 마감으로 저장됩니다`;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        className="quick-input"
        type="text"
        placeholder="할 일을 쓰고 Enter (예: 도서 반납 ~7/2, 안전점검 7/7)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      {/* 날짜가 인식되면 Enter 치기 전에 미리 보여줌 */}
      {parsed.dueDate && <p className="parse-hint">{previewText(parsed)}</p>}
    </form>
  );
}
