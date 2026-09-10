// ------------------------------------------------------------
// 구글 달력 설정 화면 (F12 R1): ⋯ 메뉴 → 📆 구글 달력
// ① 클라이언트 ID 입력·저장 ② 구글 연결 ③ 지금 보내기 · 전부 다시 올리기 ④ 상태 한 줄
// 클라이언트 ID는 이 브라우저의 IndexedDB(settings)에만 저장 — 코드·깃에 남지 않음
// ------------------------------------------------------------
import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, setSetting } from "../db.js";
import { connectGoogle, currentToken, sendAll, resendAll } from "../gcal.js";

/** "HH:MM" */
const hhmm = (d) => d.toTimeString().slice(0, 5);
/** "M/D HH:MM" — 마지막 보낸 시각 표시용 */
function whenLabel(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${hhmm(d)}`;
}

export default function GcalView({ onBack }) {
  // 설정값 전부 (clientId · calendarId · lastSyncAt · lastError) — DB가 바뀌면 자동 갱신
  const settings = useLiveQuery(async () =>
    Object.fromEntries((await db.settings.toArray()).map((s) => [s.key, s.value]))
  );
  const savedId = settings?.clientId ?? "";
  // 입력칸: null이면 저장값을 그대로 보여주고, 타이핑하면 그 내용을 보여줌
  const [draft, setDraft] = useState(null);
  const shownId = draft ?? savedId;

  // 연결 상태 — 출입증은 gcal.js가 메모리에 기억하므로 화면을 나갔다 와도 유지
  const [token, setToken] = useState(currentToken());
  const [connectMsg, setConnectMsg] = useState(""); // 연결 진행·오류 한 줄
  const [sendMsg, setSendMsg] = useState(""); // 보내기 진행·결과 한 줄
  const [busy, setBusy] = useState(false); // 팝업·보내기 진행 중 (버튼 잠금)
  const [confirmReset, setConfirmReset] = useState(false); // 전부 다시 올리기 확인 중?

  // 오프라인 감지 (R2): 인터넷이 없으면 연결 버튼 대신 안내
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  async function handleSave() {
    await setSetting("clientId", shownId.trim());
    setDraft(null);
    setConnectMsg("클라이언트 ID를 저장했어요");
  }

  async function handleConnect() {
    setBusy(true);
    setConnectMsg("구글 팝업을 여는 중…");
    try {
      setToken(await connectGoogle(savedId));
      setConnectMsg("");
    } catch (e) {
      setConnectMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  // 보내기 공통 (R4·R6): 진행 "n/m" → 성공이면 시각 기록, 실패면 오류 한 줄 기록
  async function run(job, label) {
    setBusy(true);
    setSendMsg(`${label} 중…`);
    try {
      const r = await job((done, total) => setSendMsg(`${label} 중 ${done}/${total}`));
      const now = new Date();
      await setSetting("lastSyncAt", now.toISOString());
      await setSetting("lastError", "");
      setSendMsg(`보냄 ${r.sent}건 · 삭제 ${r.deleted}건 · ${hhmm(now)}`);
    } catch (e) {
      await setSetting("lastError", e.message);
      setSendMsg("");
      if (!currentToken()) setToken(null); // 출입증 만료였으면 "연결 안 됨"으로
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  }

  // 출입증 만료 시각 "HH:MM"
  const until = token ? hhmm(new Date(token.expiresAt)) : "";
  const canSend = !!token && !busy;

  return (
    <div className="gcal">
      <div className="trash-head">
        <button className="link-btn" onClick={onBack}>
          ← 뒤로
        </button>
        <h2 className="trash-title">📆 구글 달력</h2>
      </div>

      <section className="help-section">
        <h3>1. 클라이언트 ID</h3>
        <p className="gcal-desc">
          구글 클라우드에서 만든 ID (…apps.googleusercontent.com). 이 컴퓨터의
          브라우저 안에만 저장돼요.
        </p>
        <div className="gcal-row">
          <input
            className="notice-input"
            type="text"
            placeholder="클라이언트 ID 붙여넣기"
            value={shownId}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button onClick={handleSave} disabled={shownId.trim() === ""}>
            저장
          </button>
        </div>
      </section>

      <section className="help-section">
        <h3>2. 구글 연결</h3>
        {online ? (
          <div className="gcal-row">
            <button onClick={handleConnect} disabled={busy || !savedId}>
              {token ? "다시 연결" : "구글 연결"}
            </button>
            <span className="gcal-status">
              {token
                ? `연결됨 · ${until}까지 유효 (1시간짜리 출입증)`
                : savedId
                  ? "연결 안 됨"
                  : "먼저 클라이언트 ID를 저장하세요"}
            </span>
          </div>
        ) : (
          <p className="gcal-desc">오프라인 — 인터넷 연결 후 다시 시도하세요.</p>
        )}
        {connectMsg && <p className="gcal-msg">{connectMsg}</p>}
      </section>

      <section className="help-section">
        <h3>3. 보내기</h3>
        <p className="gcal-desc">
          날짜 있는 할 일·일정 노트를 구글의 "할 일 앱" 달력에 올려요 — 앱 → 구글
          한 방향 (구글에서 고친 건 다음 보내기 때 앱 내용으로 덮여요).
        </p>
        <div className="gcal-row">
          <button onClick={() => run(sendAll, "보내기")} disabled={!canSend}>
            지금 보내기
          </button>
          <span className="gcal-status">
            {settings?.lastSyncAt
              ? `마지막 보냄 ${whenLabel(settings.lastSyncAt)}`
              : "아직 보낸 적 없음"}
            {!token && " · 먼저 구글 연결"}
          </span>
        </div>
        {sendMsg && <p className="gcal-msg">{sendMsg}</p>}
        {settings?.lastError && (
          <p className="gcal-msg gcal-error">마지막 오류: {settings.lastError}</p>
        )}
        {/* R8: 가져오기 등으로 연결이 어긋났을 때 — 달력을 지우고 전부 새로 */}
        <div className="gcal-row gcal-reset">
          {confirmReset ? (
            <span className="danger-confirm">
              구글의 "할 일 앱" 달력을 지우고 전부 새로 올릴까요?
              <button className="delete" onClick={() => run(resendAll, "다시 올리기")}>
                다시 올리기
              </button>
              <button onClick={() => setConfirmReset(false)}>취소</button>
            </span>
          ) : (
            <button
              className="reset-btn"
              onClick={() => setConfirmReset(true)}
              disabled={!canSend}
            >
              전부 다시 올리기
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
