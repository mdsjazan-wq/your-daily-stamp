/**
 * Privacy Policy Page
 * In-app privacy policy for Google Play compliance
 */

import { ArrowRight, Shield, MapPin, Database, Clock, Lock, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { APP_NAME, APP_VERSION } from "@/lib/version";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background pb-8" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-l from-primary to-primary/90 text-primary-foreground px-6 py-4 safe-area-top">
        <div className="flex items-center gap-4 max-w-lg mx-auto">
          <Link
            to="/settings"
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">سياسة الخصوصية</h1>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* App Info */}
        <div className="bg-card rounded-3xl shadow-card p-6 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{APP_NAME}</h2>
          <p className="text-sm text-muted-foreground">
            نظام تسجيل الحضور والانصراف الذكي
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            الإصدار {APP_VERSION}
          </p>
        </div>

        {/* Section 1: What Data We Collect */}
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">ما البيانات التي نجمعها؟</h3>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span>أوقات الحضور والانصراف المسجلة</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span>حالة القرب من جهاز Beacon (داخل النطاق / خارج النطاق)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span>إعدادات التطبيق المفضلة لديك</span>
            </li>
          </ul>
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
            <p className="text-xs text-green-700 dark:text-green-400">
              ✓ لا نجمع موقعك الجغرافي الفعلي (GPS)
            </p>
          </div>
        </div>

        {/* Section 2: Why Location Permission */}
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">لماذا نحتاج أذونات الموقع؟</h3>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              يتطلب نظام Android صلاحية الموقع لمسح أجهزة Bluetooth (BLE).
              هذا متطلب تقني من نظام التشغيل وليس لتتبع موقعك.
            </p>
            <div className="p-3 bg-muted/50 rounded-xl space-y-2">
              <p className="font-medium text-foreground">نستخدم هذه الصلاحية فقط لـ:</p>
              <ul className="space-y-1">
                <li>• البحث عن جهاز Beacon في مدخل مقر العمل</li>
                <li>• التحقق من قربك من الجهاز للتسجيل التلقائي</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 3: When Tracking Works */}
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">متى يعمل التتبع؟</h3>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span><strong>فقط</strong> عند تفعيلك لخيار "تتبع Beacon" من الإعدادات</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span>يمكنك إيقافه في أي وقت من الإعدادات أو من الإشعار الدائم</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span>لا يعمل تلقائياً 24/7 - أنت تتحكم بتشغيله وإيقافه</span>
            </li>
          </ul>
        </div>

        {/* Section 4: Data Storage */}
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">أين تُخزن البيانات؟</h3>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="font-medium text-green-700 dark:text-green-400 mb-2">
                جميع البيانات تُخزن محلياً على جهازك فقط
              </p>
              <ul className="space-y-1 text-green-600 dark:text-green-400/80">
                <li>✓ لا نرسل بياناتك لأي خادم خارجي</li>
                <li>✓ لا نشارك بياناتك مع أي طرف ثالث</li>
                <li>✓ يمكنك حذف جميع البيانات من الإعدادات</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 5: Your Rights */}
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Eye className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground">حقوقك</h3>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span>إلغاء أذونات الموقع والبلوتوث في أي وقت من إعدادات الجهاز</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span>إيقاف خدمة التتبع من الإشعار الدائم أو من إعدادات التطبيق</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span>حذف جميع سجلات الحضور من صفحة الإعدادات</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
              <span>إلغاء تثبيت التطبيق لحذف جميع البيانات نهائياً</span>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div className="bg-muted/50 rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground">
            آخر تحديث: يناير 2026
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            للاستفسارات: تواصل معنا عبر متجر Google Play
          </p>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
