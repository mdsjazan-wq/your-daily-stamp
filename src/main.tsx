import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { stopAlarmSound } from "./lib/notifications";

// تسجيل Service Worker للعمل بدون إنترنت
registerSW({ immediate: true });

// الاستماع لرسائل Service Worker لإيقاف صوت الإنذار
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'STOP_ALARM') {
      stopAlarmSound();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
