export interface Assist {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const ASSISTS_DATA: Assist[] = [
  { id: '5050', name: 'حذف إجابتين', icon: '✂️', desc: 'حذف خيارين خاطئين من بين الإجابات المتاحة.' },
  { id: 'extra_time', name: 'تجميد الوقت', icon: '⏸️', desc: 'تجميد المؤقت لمدة ١٠ ثوانٍ.' },
  { id: 'retry', name: 'فرصة إضافية', icon: '❤️', desc: 'إعطاء فرصة ثانية إذا كانت إجابتك الأولى خاطئة.' }
];
