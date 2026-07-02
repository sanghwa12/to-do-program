// Vite 설정 파일 — 개발 서버와 빌드를 담당하는 도구의 설정입니다.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(), // React 코드를 이해할 수 있게 해주는 플러그인

    // F05 · PWA: 설치 가능 + 오프라인 동작
    // 서비스 워커(정적 파일을 캐시해 오프라인에서도 열리게 하는 부품)를
    // 손으로 짜는 대신 이 플러그인이 자동 생성해 줌.
    VitePWA({
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
