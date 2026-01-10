import { useState, useEffect } from "react";
import { Download, Share, Smartphone, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // إذا كان التطبيق Native، أعد التوجيه للصفحة الرئيسية
  useEffect(() => {
    if (isNative) {
      window.location.hash = "#/";
    }
  }, [isNative]);

  // لا تعرض شيء في وضع Native
  if (isNative) {
    return null;
  }

  useEffect(() => {
    // Check if already installed
    const checkStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(checkStandalone);

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone || isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-3xl shadow-card p-8 max-w-sm w-full text-center animate-scale-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl gradient-success flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">تم التثبيت بنجاح!</h1>
          <p className="text-muted-foreground mb-6">
            تطبيق بصمتي مثبت الآن على جهازك
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 gradient-primary text-primary-foreground rounded-2xl font-semibold"
          >
            <ArrowLeft className="w-5 h-5" />
            العودة للتطبيق
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary text-primary-foreground pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-6 px-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-primary-foreground/10 rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">تثبيت التطبيق</h1>
            <p className="text-sm text-primary-foreground/80">أضف بصمتي للشاشة الرئيسية</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* App Preview Card */}
        <div className="bg-card rounded-3xl shadow-card p-6 text-center animate-fade-in">
          <img
            src="/icons/icon-192x192.png"
            alt="بصمتي"
            className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-lg"
          />
          <h2 className="text-xl font-bold text-foreground mb-1">بصمتي</h2>
          <p className="text-muted-foreground text-sm">نظام الدوام المرن</p>
        </div>

        {/* Features */}
        <div className="bg-card rounded-3xl shadow-card p-6 animate-fade-in stagger-1">
          <h3 className="text-lg font-bold text-foreground mb-4">مميزات التثبيت</h3>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-success" />
              </div>
              <span className="text-foreground">وصول سريع من الشاشة الرئيسية</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-success" />
              </div>
              <span className="text-foreground">يعمل بدون إنترنت</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <span className="text-foreground">تجربة سلسة كالتطبيقات الأصلية</span>
            </li>
          </ul>
        </div>

        {/* Install Instructions */}
        <div className="bg-card rounded-3xl shadow-card p-6 animate-fade-in stagger-2">
          {deferredPrompt ? (
            // Android / Chrome Install Button
            <div className="text-center">
              <button
                onClick={handleInstallClick}
                className="btn-attendance gradient-primary text-primary-foreground w-full flex items-center justify-center gap-3"
              >
                <Download className="w-6 h-6" />
                تثبيت التطبيق
              </button>
            </div>
          ) : isIOS ? (
            // iOS Instructions
            <div>
              <h3 className="text-lg font-bold text-foreground mb-4 text-center">
                طريقة التثبيت على الآيفون
              </h3>
              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-foreground">اضغط على زر المشاركة</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Share className="w-4 h-4" /> في أسفل الشاشة
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-foreground">اختر "إضافة إلى الشاشة الرئيسية"</p>
                    <p className="text-sm text-muted-foreground">Add to Home Screen</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-foreground">اضغط "إضافة"</p>
                    <p className="text-sm text-muted-foreground">سيظهر التطبيق على شاشتك الرئيسية</p>
                  </div>
                </li>
              </ol>
            </div>
          ) : (
            // Generic Instructions
            <div>
              <h3 className="text-lg font-bold text-foreground mb-4 text-center">
                طريقة التثبيت
              </h3>
              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-foreground">افتح قائمة المتصفح</p>
                    <p className="text-sm text-muted-foreground">النقاط الثلاث في الأعلى</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-foreground">اختر "تثبيت التطبيق"</p>
                    <p className="text-sm text-muted-foreground">أو "إضافة إلى الشاشة الرئيسية"</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-foreground">أكّد التثبيت</p>
                    <p className="text-sm text-muted-foreground">سيظهر التطبيق على شاشتك الرئيسية</p>
                  </div>
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            العودة للتطبيق
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Install;
