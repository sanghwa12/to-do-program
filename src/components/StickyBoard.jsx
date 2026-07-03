// ------------------------------------------------------------
// 메모판 (F03 R2c): 날짜 미정 + 미완료 할 일을 스티커 메모처럼
// 오늘 탭 하단에 항상 보여줌 — 잊히지 않게.
// 여기서는 보기 + 완료 체크만 (수정·삭제는 "전체" 탭에서 — 단순 유지)
// ------------------------------------------------------------
import { toggleDone } from "../db.js";

// 우선순위 정렬 순서: 높음 → 중간 → 낮음 → 미지정
const ORDER = { high: 0, med: 1, low: 2 };

export default function StickyBoard({ tasks }) {
  const sorted = [...tasks].sort(
    (a, b) => (ORDER[a.priority] ?? 3) - (ORDER[b.priority] ?? 3)
  );

  return (
    <section className="sticky-board">
      <h2 className="sticky-title">
        📌 날짜 없는 할 일 <span className="group-count">{tasks.length}</span>
      </h2>
      <ul className="sticky-list">
        {sorted.map((t) => (
          <li key={t.id} className="sticky-item">
            <label>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleDone(t)}
              />
              <span
                className={
                  "sticky-text" + (t.priority === "high" ? " hi" : "")
                }
              >
                {t.title}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="sticky-hint">체크하면 완료 · 수정/삭제는 "전체" 탭에서</p>
    </section>
  );
}
