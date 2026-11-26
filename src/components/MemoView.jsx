// ------------------------------------------------------------
// 노트 (F11 통합, 2026-08-03): 자유 글 + 선택적 날짜
//  · 날짜 없음 → 노트 — 이 화면(노트 탭)에 카드로, 최신 수정순
//    카드 오른쪽 "완료" = 지우지 않고 이 화면에서만 안 보이게 (R12, 2026-11-26).
//    완료한 노트는 검색으로 찾아서 다시 꺼낼 수 있음
//  · 날짜 있음 → 일정 — 달력과 오늘 탭에 보라색 줄로 보이고, 거기서 바로 수정 (R10).
//    예전엔 이 화면에 "📅 일정" 목록이 있었으나 2026-09-28 제거 (사용자 결정)
//  · 아래 MemoEditor는 노트·일정 공용 에디터 (달력·오늘 탭의 일정 줄도 이걸 씀)
// ------------------------------------------------------------
import { useState } from "react";
import Icon from "./Icon.jsx";
import { addMemo, updateMemo } from "../db.js";
import { parseQuickInput } from "../parse.js";
import { dateOnly } from "../date.js";
import { noteDatesFrom, noteDateText, normalizeNoteDates } from "../notes.js";
import ExceptionDates from "./ExceptionDates.jsx";

// onConvert(일정): 에디터의 "할 일로 바꾸기"를 눌렀을 때 (R9)
// onToggleDone(노트): "완료"를 눌렀을 때 (R12)
export default function MemoView({ memos, onDelete, onConvert, onToggleDone }) {
  // null = 목록, "new" = 새 노트, 그 외 = 그 id 편집
  const [openId, setOpenId] = useState(null);
  const [quickText, setQuickText] = useState("");

  // 이 화면엔 날짜 없는 노트만 — 최신 수정순 (날짜 있는 것 = 일정은 달력·오늘 탭에서)
  // 완료한 노트(doneAt)는 데이터는 남아 있지만 여기엔 안 보임 (R12)
  const plain = (memos ?? [])
    .filter((m) => !m.date && !m.doneAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // 빠른 입력: 날짜 자동 인식 (지난 날짜 그대로, 반복 인식 없음 — F11 R2)
  const parsed = parseQuickInput(quickText, {
    allowPast: true,
    repeatable: false,
    weekable: false, // "~이번주"는 할 일 전용 (F02 R17)
  });
  const quickDates = noteDatesFrom(parsed); // 날짜·기간의 끝·시간 (없으면 빈 값)

  async function handleQuickAdd(e) {
    e.preventDefault();
    if (parsed.title === "") return;
    await addMemo(parsed.title, quickDates);
    setQuickText("");
  }

  // 에디터 열림
  if (openId !== null) {
    const memo = openId === "new" ? null : plain.find((m) => m.id === openId);
    return (
      <MemoEditor
        key={openId}
        memo={memo}
        onClose={() => setOpenId(null)}
        onDelete={onDelete}
        onConvert={onConvert}
        onToggleDone={onToggleDone}
      />
    );
  }

  return (
    <div className="memo-view">
      {/* 입력줄 (R2): 보통은 노트. 날짜를 쓰면 일정이 되어 달력·오늘 탭으로 감 */}
      <form onSubmit={handleQuickAdd}>
        <input
          className={"notice-input" + (quickDates.date ? " note" : "")}
          type="text"
          placeholder="기록·참고 + Enter (예: 외부 강연 등록은 윤리센터 · 날짜를 쓰면 일정으로)"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
        />
        {quickDates.date && (
          <p className="parse-hint event">
            "{parsed.title}" — {noteDateText(quickDates)} 일정으로 저장됩니다
            (달력·오늘 탭에 보여요)
          </p>
        )}
      </form>
      <button className="memo-new" onClick={() => setOpenId("new")}>
        + 새 노트 (긴 글)
      </button>

      {/* 📝 노트 목록 (R3) */}
      {plain.length === 0 && (
        <p className="hint">
          아직 없어요. 위에 한 줄 쓰거나 "+ 새 노트"로 시작하세요.
        </p>
      )}
      <ul className="memo-list">
        {plain.map((m) => {
          const [first, ...rest] = m.text.split("\n");
          const preview = rest.join(" ").trim();
          return (
            <li key={m.id} className="memo-row">
              <button className="memo-card" onClick={() => setOpenId(m.id)}>
                <span className="memo-title">{first || "(빈 노트)"}</span>
                {preview && <span className="memo-preview">{preview}</span>}
                <span className="memo-date">{dateOnly(m.updatedAt)}</span>
              </button>
              {/* 완료 (R12): 지우지 않고 이 목록에서만 안 보이게 — 실행취소 가능 */}
              <button
                className="memo-done"
                onClick={() => onToggleDone(m)}
                title="완료 — 지우지 않고 노트 탭에서만 안 보이게 (검색으로 다시 찾을 수 있어요)"
              >
                <Icon name="check" /> 완료
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 노트 에디터 (R4): 여러 줄 + 날짜(선택) — 날짜를 붙이면 일정이 됨.
// 일정에는 끝 날짜(기간) 또는 시간을 더 붙일 수 있음 (R8)
// 달력 아래 목록의 일정 줄(EventItem)도 이 에디터를 씀 (R10) — rows로 글 칸 높이 조절
// onToggleDone이 있으면 날짜 없는 노트에 "완료"(이미 완료한 노트면 "완료 취소") 버튼 (R12)
export function MemoEditor({
  memo,
  onClose,
  onDelete,
  onConvert,
  onToggleDone,
  rows = 12,
}) {
  const [text, setText] = useState(memo?.text ?? "");
  const [date, setDate] = useState(memo?.date ?? "");
  const [endDate, setEndDate] = useState(memo?.endDate ?? ""); // 기간의 끝 (선택)
  const [time, setTime] = useState(memo?.time ?? ""); // 시간 (선택, 기간이 아닐 때)
  // 기간의 예외 날짜 (F03 R9): 제외한 날들 / 추가한 날들
  const [skipDates, setSkipDates] = useState(memo?.skipDates ?? []);
  const [extraDates, setExtraDates] = useState(memo?.extraDates ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 에디터의 날짜 칸 전부 — 정리(앞뒤 바뀐 기간, 범위를 벗어난 예외 등)는 normalizeNoteDates가 함
  const dates = { date, endDate, time, skipDates, extraDates };
  // 기간일 때만 예외 날짜 칸을 보여줌. 화면에도 정리된 값으로 (기간을 고치면 바로 반영)
  const shown = normalizeNoteDates(dates);

  async function handleSave() {
    const trimmed = text.trim();
    if (trimmed === "") {
      onClose(); // 빈 노트는 저장하지 않음
      return;
    }
    if (memo) await updateMemo(memo.id, trimmed, dates);
    else await addMemo(trimmed, dates);
    onClose();
  }

  // 할 일로 바꾸기 (R9): 지금 에디터에 보이는 내용 그대로 할 일이 됨
  function handleConvert() {
    const trimmed = text.trim();
    if (trimmed === "" || !date) return;
    // 예전 날짜 칸을 비운 뒤 지금 값으로 채움 (끝 날짜를 지웠다면 지운 대로)
    const { endDate: _e, time: _t, skipDates: _s, extraDates: _x, ...rest } = memo;
    onConvert({ ...rest, text: trimmed, ...shown });
    onClose();
  }

  return (
    <div className="memo-editor">
      <textarea
        className="memo-textarea"
        placeholder={"자유롭게 쓰세요.\n첫 줄이 목록에서 제목처럼 보여요."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={rows}
        autoFocus
      />
      <div className="memo-editor-date">
        <label>
          날짜 (선택 — 붙이면 일정·달력에 표시)
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {/* 기간·시간 (R8) — 날짜가 있을 때만. 끝 날짜를 넣으면 기간이 되고 시간 칸은 숨음 */}
        {date && (
          <label>
            끝 날짜 (선택 — 기간일 때)
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        )}
        {date && !endDate && (
          <label>
            시간 (선택)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        )}
        {date && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setDate("");
              setEndDate("");
              setTime("");
              setSkipDates([]);
              setExtraDates([]);
            }}
          >
            날짜 지우기
          </button>
        )}
      </div>
      {/* 기간의 예외 날짜 (F03 R9): 제외할 날 / 추가할 날 — 기간일 때만 */}
      {shown.endDate && (
        <ExceptionDates
          start={shown.date}
          end={shown.endDate}
          skip={shown.skipDates ?? []}
          extra={shown.extraDates ?? []}
          onChange={({ skip, extra }) => {
            setSkipDates(skip);
            setExtraDates(extra);
          }}
        />
      )}
      <div className="edit-buttons">
        {/* 할 일로 바꾸기 (R9) — 이미 저장된 일정(날짜 있음)에만.
            왼쪽 끝 정렬은 바로 뒤 삭제 버튼(.memo-delete)이 맡음 */}
        {memo && date && onConvert && (
          <button
            type="button"
            onClick={handleConvert}
            title="체크하는 할 일로 바꾸기 — 첫 줄은 제목, 나머지는 세부 메모가 돼요"
          >
            <Icon name="task" />
            할 일로 바꾸기
          </button>
        )}
        {/* 완료 / 완료 취소 (R12) — 저장된 노트(날짜 없음)에만. 고치던 내용은 저장하지 않고 닫음 */}
        {memo && !date && onToggleDone && (
          <button
            type="button"
            onClick={() => {
              onToggleDone(memo);
              onClose();
            }}
            title={
              memo.doneAt
                ? "노트 탭에 다시 보이게"
                : "지우지 않고 노트 탭에서만 안 보이게"
            }
          >
            <Icon name="check" />
            {memo.doneAt ? "완료 취소" : "완료"}
          </button>
        )}
        {memo &&
          (confirmDelete ? (
            <span className="danger-confirm">
              삭제할까요?
              <button
                className="delete"
                onClick={() => {
                  onDelete(memo);
                  onClose();
                }}
              >
                삭제
              </button>
              <button onClick={() => setConfirmDelete(false)}>취소</button>
            </span>
          ) : (
            <button
              className="delete memo-delete"
              onClick={() => setConfirmDelete(true)}
            >
              삭제
            </button>
          ))}
        <button onClick={handleSave}>저장</button>
        <button onClick={onClose}>취소</button>
      </div>
    </div>
  );
}
