// ------------------------------------------------------------
// 쏟아붓기 입력창 (F02): 제목 쓰고 Enter만 누르면 추가.
// 추가 후 입력창은 비워지고 커서는 그대로 → 연속 입력 가능.
// ※ 날짜·우선순위 등은 여기서 묻지 않음 — 입력을 느리게 하지 않기 위해 (핵심 원칙!)
// ------------------------------------------------------------
import { useState } from "react";
import { addTask } from "../db.js";

export default function QuickInput() {
  const [text, setText] = useState("");

  // 폼 제출 = Enter를 눌렀을 때
  async function handleSubmit(e) {
    e.preventDefault(); // 페이지 새로고침(폼 기본 동작) 막기
    const title = text.trim();
    if (title === "") return; // 빈 제목은 추가하지 않음
    await addTask(title);
    setText(""); // 입력창 비우기 (커서는 입력창에 그대로 남음)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        className="quick-input"
        type="text"
        placeholder="할 일을 쓰고 Enter (예: 보고서 초안 쓰기)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
    </form>
  );
}
