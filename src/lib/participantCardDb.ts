// Supabase-backed participant cards (ported from the source's Firestore layer).
// Same public surface as the original so the ConferenceHub components stay
// unchanged. Cards are readable by everyone signed in (the hub shows the
// participants list); a user writes their own; servants/owners/admins may edit
// any card. See migration 074_conference_hub.sql.
import { supabase } from './supabase';
import { ParticipantCard, CardAuditLog } from '../types';

const TABLE = 'participant_cards';

type Row = {
  user_id: string;
  user_name: string;
  avatar_url: string;
  team_name: string;
  room_no: string;
  building: string;
  floor: string;
  points: number;
  level: number;
  attendance_status: string;
  card_status: string;
  qr_code_data: string;
  audit_log: CardAuditLog[] | null;
  updated_at: string;
};

function rowToCard(r: Row): ParticipantCard {
  return {
    userId: r.user_id,
    userName: r.user_name,
    avatarUrl: r.avatar_url,
    teamName: r.team_name,
    roomNo: r.room_no,
    building: r.building,
    floor: r.floor,
    points: r.points,
    level: r.level,
    attendanceStatus: (r.attendance_status as ParticipantCard['attendanceStatus']) || 'تم التسجيل',
    cardStatus: (r.card_status as ParticipantCard['cardStatus']) || 'فعالة',
    qrCodeData: r.qr_code_data,
    auditLog: r.audit_log || [],
    updatedAt: r.updated_at,
  };
}

// Map a camelCase partial card to a snake_case update payload.
function cardToRow(u: Partial<ParticipantCard>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (u.userName !== undefined) row.user_name = u.userName;
  if (u.avatarUrl !== undefined) row.avatar_url = u.avatarUrl;
  if (u.teamName !== undefined) row.team_name = u.teamName;
  if (u.roomNo !== undefined) row.room_no = u.roomNo;
  if (u.building !== undefined) row.building = u.building;
  if (u.floor !== undefined) row.floor = u.floor;
  if (u.points !== undefined) row.points = u.points;
  if (u.level !== undefined) row.level = u.level;
  if (u.attendanceStatus !== undefined) row.attendance_status = u.attendanceStatus;
  if (u.cardStatus !== undefined) row.card_status = u.cardStatus;
  if (u.qrCodeData !== undefined) row.qr_code_data = u.qrCodeData;
  if (u.auditLog !== undefined) row.audit_log = u.auditLog;
  return row;
}

export async function getParticipantCard(userId: string): Promise<ParticipantCard | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) { console.warn('getParticipantCard:', error.message); return null; }
  return data ? rowToCard(data as Row) : null;
}

export async function createOrGetParticipantCard(
  userId: string,
  userName: string,
  avatarUrl?: string
): Promise<ParticipantCard> {
  const existing = await getParticipantCard(userId);
  if (existing) return existing;

  const newCard: ParticipantCard = {
    userId,
    userName,
    avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(userName)}`,
    teamName: 'فريق القديس بولس الرسول',
    roomNo: 'B12',
    building: 'B',
    floor: 'الثاني',
    points: 320,
    level: 5,
    attendanceStatus: 'تم التسجيل',
    cardStatus: 'فعالة',
    qrCodeData: `COPTIC-CONF-CARD-${userId}`,
    auditLog: [
      {
        id: `init-${Date.now()}`,
        action: 'تفعيل البطاقة',
        details: 'تم إصدار بطاقة مشارك رقمية تفاعلية للمؤتمر تلقائياً عند الدخول.',
        updatedBy: 'نظام المؤتمر التلقائي',
        timestamp: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase.from(TABLE).insert({
    user_id: newCard.userId,
    user_name: newCard.userName,
    avatar_url: newCard.avatarUrl,
    team_name: newCard.teamName,
    room_no: newCard.roomNo,
    building: newCard.building,
    floor: newCard.floor,
    points: newCard.points,
    level: newCard.level,
    attendance_status: newCard.attendanceStatus,
    card_status: newCard.cardStatus,
    qr_code_data: newCard.qrCodeData,
    audit_log: newCard.auditLog,
    updated_at: newCard.updatedAt,
  });
  if (error) {
    // Someone else may have created it concurrently — return the stored one.
    const again = await getParticipantCard(userId);
    if (again) return again;
    console.warn('createOrGetParticipantCard:', error.message);
  }
  return newCard;
}

export function listenToParticipantCard(
  userId: string,
  onUpdate: (card: ParticipantCard) => void,
  onError?: (err: unknown) => void
): () => void {
  getParticipantCard(userId).then((c) => { if (c) onUpdate(c); }).catch((e) => onError?.(e));
  const channel = supabase
    .channel(`participant_card_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` }, async () => {
      const c = await getParticipantCard(userId);
      if (c) onUpdate(c);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function updateParticipantCard(
  _adminId: string,
  adminName: string,
  userId: string,
  updates: Partial<ParticipantCard>,
  logAction: string,
  logDetails: string
): Promise<void> {
  const current = await getParticipantCard(userId);
  if (!current) { console.warn('updateParticipantCard: card not found'); return; }

  const newAuditLogItem: CardAuditLog = {
    id: `log-${Date.now()}`,
    action: logAction,
    details: logDetails,
    updatedBy: adminName || 'خادم مشرف',
    timestamp: new Date().toISOString(),
  };

  const payload = {
    ...cardToRow(updates),
    audit_log: [newAuditLogItem, ...(current.auditLog || [])].slice(0, 50),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(TABLE).update(payload).eq('user_id', userId);
  if (error) console.warn('updateParticipantCard:', error.message);
}

export async function getAllParticipantCards(): Promise<ParticipantCard[]> {
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) { console.warn('getAllParticipantCards:', error.message); return []; }
  return ((data ?? []) as Row[]).map(rowToCard);
}

export function listenToAllParticipantCards(onUpdate: (cards: ParticipantCard[]) => void): () => void {
  getAllParticipantCards().then(onUpdate).catch(() => {});
  const channel = supabase
    .channel('participant_cards_all')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, async () => {
      onUpdate(await getAllParticipantCards());
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
