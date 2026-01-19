/**
 * Location Disclosure Dialog
 * Google Play compliant in-app disclosure for background location usage
 * Must be shown before requesting location permissions
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, MapPin, Clock, Power } from "lucide-react";

interface LocationDisclosureDialogProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const LocationDisclosureDialog = ({
  open,
  onAccept,
  onDecline,
}: LocationDisclosureDialogProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md mx-4" dir="rtl">
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            إفصاح عن استخدام الموقع
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-right">
              <p className="text-sm text-muted-foreground leading-relaxed">
                يستخدم تطبيق "بصمتي" صلاحيات الموقع والبلوتوث للتحقق من قربك من
                جهاز Beacon داخل مقر العمل.
              </p>

              <div className="space-y-3 bg-muted/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">
                    نستخدم البلوتوث وخدمات الموقع للتحقق من قربك من جهاز Beacon
                    لتسجيل الحضور والانصراف تلقائياً
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">
                    يعمل التتبع <strong>فقط</strong> عند تفعيلك لخيار "تتبع
                    Beacon أثناء الدوام" - حتى عند إغلاق التطبيق أو قفل الشاشة
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <Power className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">
                    يمكنك <strong>إيقاف التتبع</strong> في أي وقت من الإعدادات
                    أو من الإشعار الدائم
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                لا نقوم بتتبع موقعك الجغرافي الفعلي أو مشاركته مع أي جهة خارجية
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <AlertDialogAction
            onClick={onAccept}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            متابعة
          </AlertDialogAction>
          <AlertDialogCancel onClick={onDecline} className="flex-1">
            إلغاء
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LocationDisclosureDialog;
