// ------------------------------------------------------------
// 쏟아붓기 입력창 (F02): 제목 쓰고 Enter만 누르면 추가.
// 추가 후 입력창은 비워지고 커서는 그대로 → 연속 입력 가능.
// "도서 반납 (~7/2)"처럼 쓰면 마감일을 자동 인식 (F02 R9)
// 📅 버튼으로 표기 없이 날짜를 붙일 수도 있음 (F02 R14)
// 종류 토글 [할 일] [📢 일정] (F02 R16): 기본은 할 일. 일정을 고르면 체크 없는
//   일정(날짜 있는 노트, F11)으로 저장 — 고른 종류는 바꿀 때까지 유지
// ※ 날짜·우선순위 등을 따로 묻지 않음 — 입력을 느리게 하지 않기 위해 (핵심 원칙!)
// ------------------------------------------------------------
import { useState, useRef } from "react";
import Icon from "./Icon.jsx";
import { addTask, addMemo } from "../db.js";
import { parseQuickInput } from "../parse.js";
import { repeatLabelOf, weekRangeText } from "../labels.js";
import { noteDatesFrom, noteDateText } from "../notes.js";

export default function QuickInput() {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("task"); // "task" 할 일 | "note" 📢 일정 (R16)
  const [showPicker, setShowPicker] = useState(false); // 📅 날짜 선택기 열림?
  const [pickedDate, setPickedDate] = useState(""); // 선택기로 고른 날짜
  const inputRef = useRef(null); // 토글을 눌러도 커서가 입력칸으로 돌아오게

  const isNote = kind === "note";

  // 지금 친 내용에서 날짜·반복이 인식되는지 (미리보기용, F02 R10)
  // 일정은 노트 입력 규칙: 지난 날짜도 그대로, 반복·"~이번주" 인식 없음 (F11 R2, F02 R17)
  const parsed = isNote
    ? parseQuickInput(text, { allowPast: true, repeatable: false, weekable: false })
    : parseQuickInput(text);

  // [할 일] 저장될 내용 (R14): 텍스트 표기가 있으면 표기 우선, 없으면 선택기 날짜(마감)
  const effective =
    parsed.dueDate || parsed.repeat
      ? parsed
      : pickedDate
        ? { ...parsed, dueDate: pickedDate, dateKind: "due" }
        : parsed;

  // [일정] 날짜 칸(날짜·기간의 끝·시간): 텍스트 표기 우선, 없으면 📅로 고른 날짜.
  // 둘 다 없으면 빈 값 → 날짜 없는 노트가 됨
  const noteDates = noteDatesFrom(parsed, pickedDate);

  // 종류 바꾸기 — 바로 이어서 칠 수 있게 커서를 입력칸으로
  function switchKind(k) {
    setKind(k);
    inputRef.current?.focus();
  }

  // 폼 제출 = Enter를 눌렀을 때
  async function handleSubmit(e) {
    e.preventDefault(); // 페이지 새로고침(폼 기본 동작) 막기
    if (isNote) {
      if (parsed.title === "") return;
      await addMemo(parsed.title, noteDates);
    } else {
      const { title, ...dateFields } = effective;
      if (title === "") return; // 빈 제목은 추가하지 않음
      await addTask(title, dateFields); // 인식·선택된 날짜(있으면)를 같이 저장
    }
    // 다음 입력은 다시 날짜 없음으로 (커서는 입력창에 그대로 남음).
    // 종류는 그대로 둠 — 일정을 여러 개 연달아 넣기 편하게 (R16)
    setText("");
    setPickedDate("");
    setShowPicker(false);
  }

  // 인식된 날짜 종류에 따른 미리보기 문구 (F02 R10)
  function previewText(p) {
    if (p.repeat) {
      return `"${p.title}" — ${repeatLabelOf(p)} 반복 · 첫 날짜 ${p.dueDate}로 저장됩니다`;
    }
    if (p.dateKind === "range")
      return `"${p.title}" — ${p.startDate} ~ ${p.dueDate} 기간으로 저장됩니다`;
    if (p.dateKind === "week")
      return `"${p.title}" — 이번 주(${weekRangeText(p)}) 안에 할 일로 저장됩니다`;
    const time = p.dueTime ? ` ${p.dueTime}` : ""; // 시간이 있으면 같이 (R15)
    if (p.dateKind === "day")
      // "당일 일정"이라고 쓰면 📢 일정과 헷갈리므로 "당일 할 일" (2026-09-28)
      return `"${p.title}" — ${p.dueDate}${time} 당일 할 일로 저장됩니다`;
    return `"${p.title}" — ${p.dueDate}${time}까지 마감으로 저장됩니다`;
  }

  return (
    <form className="quick-capture" onSubmit={handleSubmit}>
      <div className="quick-row">
        {/* R16: 무엇으로 저장할지 — 기본은 할 일 (안 건드리면 예전과 똑같이 동작) */}
        <button
          type="button"
          className={"date-toggle kind-btn" + (!isNote ? " active" : "")}
          onClick={() => switchKind("task")}
          title="체크하는 할 일로 저장"
          aria-pressed={!isNote}
        >
          <Icon name="task" />
          할 일
        </button>
        <button
          type="button"
          className={"date-toggle kind-btn kind-note" + (isNote ? " active" : "")}
          onClick={() => switchKind("note")}
          title="체크 없는 일정으로 저장 (달력·오늘 탭에 보라색 줄로 표시)"
          aria-pressed={isNote}
        >
          <Icon name="calendar" /> 일정
        </button>
        <input
          ref={inputRef}
          className="quick-input"
          type="text"
          placeholder={
            isNote
              ? "일정을 쓰고 Enter (예: 학회 10/6, 정전 안내 8/12)"
              : "할 일을 쓰고 Enter (예: 도서 반납 ~7/2, 안전점검 7/7)"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        {/* R14: 표기를 몰라도 날짜를 붙일 수 있는 버튼 */}
        <button
          type="button"
          className={
            "date-toggle" +
            (isNote ? " kind-note" : "") + // 고른 종류의 색상으로 표시
            (pickedDate ? " active" : "")
          }
          onClick={() => setShowPicker((s) => !s)}
          title="날짜 붙이기 (선택)"
          aria-label="날짜 붙이기"
          aria-expanded={showPicker}
        >
          <Icon name="calendar" />
        </button>
      </div>
      {showPicker && (
        <div className="quick-date-row">
          <input
            type="date"
            aria-label="붙일 날짜"
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
      {/* 입력 중엔 어떤 종류로 저장될지 항상 보여줌 (R14: 날짜 있음/없음 구분, R16: 일정) */}
      {text.trim() !== "" &&
        (isNote ? (
          noteDates.date ? (
            <p className="parse-hint event">
              "{parsed.title}" — {noteDateText(noteDates)} 일정으로 저장됩니다
            </p>
          ) : (
            <p className="parse-hint muted">
              "{parsed.title}" — 날짜가 없어 노트로 저장됩니다 (달력 버튼으로 날짜 붙이기)
            </p>
          )
        ) : effective.dueDate ? (
          <p className="parse-hint">{previewText(effective)}</p>
        ) : (
          <p className="parse-hint muted">
            "{effective.title}" — 메모(날짜 없음)로 저장됩니다 (달력 버튼으로 날짜 붙이기)
          </p>
        ))}
    </form>
  );
}
