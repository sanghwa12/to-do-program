// Vite 설정 파일 — 개발 서버와 빌드를 담당하는 도구의 설정입니다.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // 주소를 항상 http://localhost:5173 으로 고정
  // (자동 시작과 중복 실행 시 5174로 밀려 즐겨찾기가 깨지는 것 방지)
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(), // React 코드를 이해할 수 있게 해주는 플러그인

    // F05 · PWA: 설치 가능 + 오프라인 동작
    // 서비스 워커(정적 파일을 캐시해 오프라인에서도 열리게 하는 부품)를
    // 손으로 짜는 대신 이 플러그인이 자동 생성해 줌.
    //
    // ⚠️ 개발 중 임시 설정 (2026-07-03):
    //   selfDestroying=true 로 두면 서비스 워커가 "자기 자신을 지우고 캐시를 비우는" SW가 됨.
    //   → 개발 중 옛 버전이 캐시에 갇혀 최신 코드가 안 뜨는 문제를 없앰 (F5로 바로 갱신).
    //   대신 오프라인 기능은 잠시 꺼짐. 앱이 안정되면 이 줄을 false로 되돌려 오프라인을 켠다.
    VitePWA({
      selfDestroying: true,
      registerType: "autoUpdate", // 새 버전 배포 시 자동 갱신
      manifest: {
        name: "할 일",
        short_name: "할 일",
        description: "쏟아붓는 할 일 관리",
        lang: "ko",
        start_url: "/",
        display: "standalone", // 설치하면 주소창 없는 독립 창으로
        background_color: "#f5f5f5",
        theme_color: "#4a7dff",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
