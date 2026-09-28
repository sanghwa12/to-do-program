// ============================================================
// F12 · 구글 캘린더로 보내기 — 구글 연결(R2) + API 호출·보내기(R3~R6·R8)
// ------------------------------------------------------------
// 브라우저가 구글에서 "1시간짜리 임시 출입증"(액세스 토큰)을 팝업으로 받아 옵니다.
// 우리 서버는 없습니다. 구글의 로그인 라이브러리(GIS)는 버튼을 누를 때 불러옵니다
// (정적 <script> 태그 ❌ — 오프라인 설치형 앱에서 페이지가 깨지지 않게).
// 출입증은 저장하지 않고 메모리에만 둡니다 (앱을 끄면 사라짐 → 다시 "구글 연결").
// 캘린더 API는 전부 브라우저 fetch로 직접 호출합니다 (서버 없음).
// ============================================================
import { db, getSetting, setSetting } from "./db.js";
import { taskToEvents, memoToEvents, fingerprint } from "./gcalEvents.js";

// 권한 범위: "앱이 만든 달력만" — 기본 달력엔 손댈 수 없음 (기획서 핵심 결정)
const SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const GIS_URL = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/calendar/v3";
// 앱이 만드는 보조 달력 이름 (R3) — 새로 만들 때만 쓰임 (찾을 땐 저장해 둔 id).
// 2026-09-28 이전에 만든 달력은 구글에서 이름을 바꾸기 전까지 "할 일 앱"
const CALENDAR_NAME = "My planner";

// 메모리에만 두는 출입증: { accessToken, expiresAt(ms) } — 없으면 null
let token = null;

/** 지금 유효한 출입증 (만료 1분 전부터는 없는 것으로 침). 없으면 null */
export function currentToken() {
  if (token && Date.now() < token.expiresAt - 60_000) return token;
  return null;
}

/** 구글 로그인 라이브러리를 그때 불러옴 — 이미 있으면 바로 완료 */
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_URL;
    s.async = true;
    s.onload = resolve;
    s.onerror = () =>
      reject(new Error("구글 로그인 라이브러리를 불러오지 못했어요 (인터넷 연결 확인)"));
    document.head.append(s);
  });
}

/** "구글 연결": 팝업으로 출입증을 받아 메모리에 보관하고 돌려줌 */
export async function connectGoogle(clientId) {
  await loadGis();
  const resp = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => (r.error ? reject(new Error(describe(r))) : resolve(r)),
      error_callback: (e) => reject(new Error(describe(e))),
    });
    client.requestAccessToken();
  });
  // 만료 시각은 응답의 expires_in(초)으로 계산 — 3600 고정 ❌ (R2)
  token = {
    accessToken: resp.access_token,
    expiresAt: Date.now() + Number(resp.expires_in) * 1000,
  };
  return token;
}

/** 구글이 주는 오류 코드를 사람 말로 */
function describe(e) {
  const code = e?.type ?? e?.error ?? "";
  if (code === "popup_closed") return "팝업을 닫았어요 — 다시 시도하세요";
  if (code === "popup_failed_to_open")
    return "팝업이 열리지 않았어요 (설치형 앱 창의 제한일 수 있음 — 브라우저 탭에서 시도해 보세요)";
  if (code === "access_denied") return "권한을 허용하지 않았어요";
  return `구글 오류: ${code || e?.message || "알 수 없음"}`;
}

// ------------------------------------------------------------
// 캘린더 API 호출 (R3~R6)
// ------------------------------------------------------------

/** API 호출 한 번. 401(출입증 만료)이면 출입증을 버리고 "다시 연결" 안내 (R6) */
async function call(method, path, body) {
  const t = currentToken();
  if (!t) throw new Error("먼저 '구글 연결'을 눌러 주세요");
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${t.accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    token = null;
    throw new Error("출입증이 만료됐어요 — '지금 보내기'를 다시 누르면 새로 받아요");
  }
  return res;
}

/** 성공(2xx)이어야 하는 호출 — 아니면 구글의 오류 문구를 담아 던짐 */
async function callOk(method, path, body) {
  const res = await call(method, path, body);
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error?.message ?? "";
    } catch {
      // 본문이 JSON이 아니면 상태 코드만
    }
    throw new Error(`구글 응답 ${res.status}${detail ? ": " + detail : ""}`);
  }
  return res.status === 204 ? null : res.json();
}

const calPath = (id) => `/calendars/${encodeURIComponent(id)}`;

/** 보조 달력 확보 (R3): 기억한 id가 살아 있으면 그대로,
 *  사용자가 구글에서 지웠으면(404) 새로 만들고 연결표를 비움 */
async function ensureCalendar() {
  const saved = await getSetting("calendarId");
  if (saved) {
    const res = await call("GET", calPath(saved));
    if (res.ok) return saved;
    if (res.status !== 404) throw new Error(`구글 응답 ${res.status}`);
    await db.gcalLinks.clear(); // 달력이 없어졌으니 옛 연결표는 무효
  }
  const cal = await callOk("POST", "/calendars", { summary: CALENDAR_NAME });
  await setSetting("calendarId", cal.id);
  return cal.id;
}

/** 보낼 대상 = 날짜 있는 할 일(휴지통 제외, 완료 무관) + 날짜 있는 노트 (R4) */
async function targets() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tasks = await db.tasks.filter((t) => !!t.dueDate && !t.deletedAt).toArray();
  const memos = await db.memos.filter((m) => !!m.date).toArray();
  // 보통은 항목 하나 = 이벤트 하나. 예외 날짜가 있는 기간은 조각 수만큼 (F03 R9) —
  // 조각은 id 뒤에 "#0", "#1"…을 붙여 구분. 조각 수가 줄면 남는 것은 아래에서 삭제됨
  return [
    ...tasks.flatMap((t) =>
      taskToEvents(t, tz).map(({ key, event }) => ({ localId: t.id + key, event }))
    ),
    ...memos.flatMap((m) =>
      memoToEvents(m, tz).map(({ key, event }) => ({
        localId: "memo:" + m.id + key,
        event,
      }))
    ),
  ];
}

/** 구글에 보내는 본문: 이벤트 + 앱 id 표식 (나중에 찾아볼 수 있게) */
const withTag = (localId, event) => ({
  ...event,
  extendedProperties: { private: { todoId: localId } },
});

/** "지금 보내기" (R4): 새 항목은 추가, 바뀐 것만 수정, 달력에서 빠진 것은 삭제.
 *  onProgress(done, total)로 진행을 알림. 결과 { sent, deleted }.
 *  한 건씩 끝날 때마다 연결표를 저장하므로 중간에 실패해도 보낸 것은 남음 (R6) */
export async function sendAll(onProgress) {
  const calId = await ensureCalendar();
  const list = await targets();
  const links = new Map((await db.gcalLinks.toArray()).map((l) => [l.localId, l]));
  const wanted = new Set(list.map((x) => x.localId));

  // 할 일을 먼저 세어야 "n/m" 진행을 보여줄 수 있음
  const steps = [];
  for (const { localId, event } of list) {
    const hash = fingerprint(event);
    const link = links.get(localId);
    if (!link) {
      steps.push(async () => {
        const made = await callOk("POST", `${calPath(calId)}/events`, withTag(localId, event));
        await db.gcalLinks.put({ localId, eventId: made.id, hash });
        return "sent";
      });
    } else if (link.hash !== hash) {
      // 통째 교체(update): 부분 수정(patch)은 종일↔시간 전환 시 date/dateTime이 겹쳐 실패할 수 있음
      steps.push(async () => {
        await callOk("PUT", `${calPath(calId)}/events/${link.eventId}`, withTag(localId, event));
        await db.gcalLinks.put({ localId, eventId: link.eventId, hash });
        return "sent";
      });
    }
  }
  for (const link of links.values()) {
    if (wanted.has(link.localId)) continue;
    steps.push(async () => {
      const res = await call("DELETE", `${calPath(calId)}/events/${link.eventId}`);
      // 이미 구글에서 지워진 것(404/410)도 성공으로 침
      if (!res.ok && res.status !== 404 && res.status !== 410)
        throw new Error(`구글 응답 ${res.status}`);
      await db.gcalLinks.delete(link.localId);
      return "deleted";
    });
  }

  let sent = 0;
  let deleted = 0;
  for (let i = 0; i < steps.length; i++) {
    if ((await steps[i]()) === "sent") sent++;
    else deleted++;
    onProgress?.(i + 1, steps.length);
  }
  return { sent, deleted };
}

/** "전부 다시 올리기" (R8): 보조 달력을 지우고 연결표를 비운 뒤 전부 새로 보냄
 *  (가져오기로 id가 새로 생겨 옛 연결이 고아가 됐을 때 등) */
export async function resendAll(onProgress) {
  const saved = await getSetting("calendarId");
  if (saved) {
    const res = await call("DELETE", calPath(saved));
    if (!res.ok && res.status !== 404) throw new Error(`구글 응답 ${res.status}`);
  }
  await db.gcalLinks.clear();
  await setSetting("calendarId", "");
  return sendAll(onProgress);
}
