import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

const UpdateNotification = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // التحقق من وجود تحديث جديد عبر Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // التحقق الدوري من التحديثات
        const checkForUpdates = () => {
          registration.update();
        };

        // التحقق كل 5 دقائق
        const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

        // الاستماع لحدث التحديث
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // يوجد تحديث جديد متاح
                setWaitingWorker(newWorker);
                setShowUpdate(true);
              }
            });
          }
        });

        // التحقق إذا كان هناك تحديث منتظر بالفعل
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        return () => clearInterval(interval);
      });

      // الاستماع لرسالة من Service Worker للتحديث الفوري
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // التحقق من تغيير الإصدار المخزن محلياً
    const storedVersion = localStorage.getItem("app_version");
    if (storedVersion && storedVersion !== APP_VERSION) {
      // تم التحديث مؤخراً
      localStorage.setItem("app_version", APP_VERSION);
    } else if (!storedVersion) {
      localStorage.setItem("app_version", APP_VERSION);
    }
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      // إذا لم يكن هناك Service Worker منتظر، فقط أعد تحميل الصفحة
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
      <div className="max-w-md mx-auto bg-primary text-primary-foreground rounded-2xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-foreground/20 rounded-xl">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm mb-1">تحديث جديد متاح!</h3>
            <p className="text-xs opacity-90">
              يتوفر إصدار جديد من التطبيق. قم بالتحديث للحصول على أحدث الميزات.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-primary-foreground/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleUpdate}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-primary-foreground text-primary rounded-xl font-semibold text-sm hover:bg-primary-foreground/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث الآن
          </button>
          <button
            onClick={handleDismiss}
            className="py-2 px-4 bg-primary-foreground/20 rounded-xl font-medium text-sm hover:bg-primary-foreground/30 transition-colors"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
