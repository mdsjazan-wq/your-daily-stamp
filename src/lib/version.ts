// رقم النسخة الافتراضي (يمكن تعديله من الإعدادات)
export const DEFAULT_APP_VERSION = "1.0.0";

// الحصول على رقم النسخة (من localStorage أو الافتراضي)
export const getAppVersion = (): string => {
  return localStorage.getItem("appVersion") || DEFAULT_APP_VERSION;
};

// حفظ رقم النسخة
export const saveAppVersion = (version: string): void => {
  localStorage.setItem("appVersion", version);
};

// للتوافق مع الكود القديم
export const APP_VERSION = getAppVersion();

// معرف البناء التلقائي (يتغير مع كل نشر)
export const APP_BUILD_ID = import.meta.env.VITE_BUILD_TIME || "dev";

// اسم التطبيق
export const APP_NAME = "بصمتي";
