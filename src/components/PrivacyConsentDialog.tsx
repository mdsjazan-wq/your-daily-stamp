/**
 * Privacy Consent Dialog - Google Play Compliance
 * Shows privacy policy summary before requesting permissions
 * Must be accepted before beacon tracking can be enabled
 */

import { Link } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  MapPin,
  Bluetooth,
  Lock,
  ExternalLink,
} from 'lucide-react';

interface PrivacyConsentDialogProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const PrivacyConsentDialog = ({ open, onAccept, onDecline }: PrivacyConsentDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onDecline()}>
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            سياسة الخصوصية والأذونات
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-right">
              <p className="text-sm text-muted-foreground">
                لتفعيل التسجيل التلقائي، يحتاج التطبيق للوصول إلى بعض الميزات:
              </p>

              {/* Bluetooth Permission */}
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                <Bluetooth className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">البلوتوث</p>
                  <p className="text-xs text-muted-foreground">
                    للكشف عن جهاز Beacon الموجود في مدخل المبنى
                  </p>
                </div>
              </div>

              {/* Location Permission */}
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                <MapPin className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">الموقع</p>
                  <p className="text-xs text-muted-foreground">
                    مطلوب من نظام Android للبحث عن أجهزة Bluetooth القريبة
                  </p>
                </div>
              </div>

              {/* Data Storage */}
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                <Lock className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">الخصوصية</p>
                  <p className="text-xs text-muted-foreground">
                    جميع البيانات تُخزن محلياً على جهازك فقط ولا تُرسل لأي خادم خارجي
                  </p>
                </div>
              </div>

              {/* Important Notes */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>ملاحظة:</strong> يمكنك إيقاف التتبع في أي وقت من صفحة الإعدادات.
                  التطبيق يعمل في الخلفية للكشف عن Beacon.
                </p>
              </div>

              {/* Link to full privacy policy */}
              <Link 
                to="/privacy" 
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
                اقرأ سياسة الخصوصية الكاملة
              </Link>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <AlertDialogCancel 
            onClick={onDecline}
            className="w-full sm:w-auto"
          >
            إلغاء
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onAccept}
            className="w-full sm:w-auto"
          >
            موافق ومتابعة
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PrivacyConsentDialog;
