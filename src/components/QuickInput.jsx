// ------------------------------------------------------------
// 쏟아붓기 입력창 (F02): 제목 쓰고 Enter만 누르면 추가.
// 추가 후 입력창은 비워지고 커서는 그대로 → 연속 입력 가능.
// "도서 반납 (~7/2)"처럼 쓰면 마감일을 자동 인식 (F02 R9)
// 📅 버튼으로 표기 없이 날짜를 붙일 수도 있음 (F02 R14)
// ※ 날짜·우선순위 등을 따로 묻지 않음 — 입력을 느리게 하지 않기 위해 (핵심 원칙!)
// ------------------------------------------------------------
import { useState } from "react";
import { addTask } from "../db.js";
import { parseQuickInput } from "../parse.js";
import { repeatLabelOf } from "../labels.js";

export default function QuickInput() {
  const [text, setText] = useState("");
  const [showPicker, setShowPicker] = useState(false); // 📅 날짜 선택기 열림?
  const [pickedDate, setPickedDate] = useState(""); // 선택기로 고른 날짜

  // 지금 친 내용에서 날짜·반복이 인식되는지 (미리보기용, F02 R10)
  const parsed = parseQuickInput(text);

  // 저장될 내용 결정 (R14): 텍스트 표기가 있으면 표기 우선, 없으면 선택기 날짜(마감)
  const effective =
    parsed.dueDate || parsed.repeat
      ? parsed
      : pickedDate
        ? { ...parsed, dueDate: pickedDate, dateKind: "due" }
        : parsed;

  // 폼 제출 = Enter를 눌렀을 때
  async function handleSubmit(e) {
    e.preventDefault(); // 페이지 새로고침(폼 기본 동작) 막기
    const { title, ...dateFields } = effective;
    if (title === "") return; // 빈 제목은 추가하지 않음
    await addTask(title, dateFields); // 인식·선택된 날짜(있으면)를 같이 저장
    // 다음 입력은 다시 기본(날짜 없음)으로 (커서는 입력창에 그대로 남음)
    setText("");
    setPickedDate("");
    setShowPicker(false);
  }

  // 인식된 날짜 종류에 따른 미리보기 문구 (F02 R10)
  function previewText(p) {
    if (p.repeat) {
      return `"${p.title}" — 🔁 ${repeatLabelOf(p)} 반복 · 첫 날짜 ${p.dueDate}로 저장됩니다`;
    }
    if (p.dateKind === "range")
      return `"${p.title}" — 📅 ${p.startDate} ~ ${p.dueDate} 기간으로 저장됩니다`;
    if (p.dateKind === "day")
      return `"${p.title}" — 📅 ${p.dueDate} 당일 일정으로 저장됩니다`;
    return `"${p.title}" — 📅 ${p.dueDate}까지 마감으로 저장됩니다`;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="quick-row">
        <input
          className="quick-input"
          type="text"
          placeholder="할 일을 쓰고 Enter (예: 도서 반납 ~7/2, 안전점검 7/7)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        {/* R14: 표기를 몰라도 날짜를 붙일 수 있는 버튼 */}
        <button
          type="button"
          className={"date-toggle" + (pickedDate ? " active" : "")}
          onClick={() => setShowPicker((s) => !s)}
          title="날짜 붙이기 (선택)"
          aria-label="날짜 붙이기"
        >
          📅
        </button>
      </div>
      {showPicker && (
        <div className="quick-date-row">
          <input
            type="date"
            value={pickedDate}
            onChange={(e) => setPickedDate(e.target.value)}
          />
          {pickedDate && (
            <button
              type="button"
              className="link-btn"
              onClick={() => setPickedDate("")}
            >
              날짜 지우기
            </button>
          )}
        </div>
      )}
      {/* 입력 중엔 어떤 종류로 저장될지 항상 보여줌 (R14: 날짜 있음/없음 구분) */}
      {text.trim() !== "" &&
        (effective.dueDate ? (
          <p className="parse-hint">{previewText(effective)}</p>
        ) : (
          <p className="parse-hint muted">
            "{effective.title}" — 날짜 없는 할 일로 저장됩니다 (📅로 날짜 붙이기)
          </p>
        ))}
    </form>
  );
}
