// Compact timestamp for a chat list row — hh:mm for today, weekday for this
// week, dd/mm otherwise. Distinct from lib/timeAgo on purpose: a conversation
// list wants a clock ("١٠:٤٥", "الخميس"), not an elapsed duration ("منذ ساعتين").
export function formatChatTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const sameDay = then.toDateString() === now.toDateString();
  if (sameDay) return then.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return then.toLocaleDateString('ar-EG', { weekday: 'long' });
  return then.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' });
}
