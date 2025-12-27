import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// تسجيل Service Worker للعمل بدون إنترنت
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
