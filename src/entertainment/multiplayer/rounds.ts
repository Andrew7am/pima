import type { MatchStageId, RoomQuestion } from '../multiplayer';

/**
 * A match is five rounds, drawn fresh each time, with the Golden Round last.
 *
 * The point is that two matches should not feel the same. Before this a match
 * was six questions from three fixed subjects in a fixed order — the content
 * varied, the SHAPE never did, so by the third match a player knew exactly
 * what was coming and in what order.
 *
 * ── Why the round id travels on the question ──────────────────────────────
 * The server stores `questions` as opaque JSONB and only ever reads
 * `correctIdx` out of it (migration 036). So a per-question tag costs no
 * migration and, because BOTH clients read the same array off the room, both
 * arrive at the same round boundary on the same index with nothing to sync.
 * That is why rounds are expressed as a property of the questions rather than
 * as separate match state.
 *
 * ── Why every round is still multiple choice ──────────────────────────────
 * submit_answer scores by comparing the submitted option index to the stored
 * correctIdx. That is the whole contract. A round is therefore free to change
 * the CLOCK, the SCORING, the PRESENTATION and the SOURCE of its questions —
 * all client-side, all agreed by both players because both read the same
 * questions — but a mechanic that is not "pick one of N" needs a new RPC and
 * is out of scope here. Ordering fits anyway: show four candidate orderings
 * and ask which is right, and the server still just sees a multiple choice.
 */
export interface MatchRound {
  id: MatchStageId;
  /** Shown on the transition card and in the header chip. */
  label: string;
  /** One line under the label on the transition card. */
  tagline: string;
  accent: RoundAccent;
  /** Seconds on the clock for each question in this round. */
  seconds: number;
  /**
   * What each correct answer is worth on the scoreboard the players SEE.
   *
   * The server adds exactly 1 per correct answer and cannot be told
   * otherwise without a migration, so this multiplies the displayed score
   * only — and it is safe to do that precisely because it is derived from the
   * questions both clients already hold, not from anything either client
   * asserts. The authoritative rating still comes from finalize_match.
   */
  multiplier: number;
  /** One wrong answer forfeits everything earned in this round. */
  survival?: boolean;
  /** The question is shown, then hidden before the options appear. */
  memorise?: boolean;
  /** Always last, never drawn at random. */
  finale?: boolean;
}

export type RoundAccent = 'amber' | 'emerald' | 'sky' | 'violet' | 'rose' | 'gold';

export const QUESTIONS_PER_ROUND = 2;
export const ROUNDS_PER_MATCH = 5;

/**
 * The draw pool. Golden is excluded — it is appended, not drawn.
 *
 * Everything here is either a rule over questions that already exist or a
 * source that already exists. Nothing in this file invents content: the
 * rounds the brief asked for that would need images (Discover, Bible Places,
 * Picture Quiz) or attributed quotes (Who Said It?) are absent because the
 * repository has no such data, and a round that has to make up scripture to
 * fill itself is worse than a round that does not ship.
 */
export const ROUND_POOL: MatchRound[] = [
  {
    id: 'bible',
    label: 'معلومات كتابية',
    tagline: 'أسئلة من الكتاب والقديسين والطقس',
    accent: 'sky',
    seconds: 20,
    multiplier: 1,
  },
  {
    id: 'whoami',
    label: 'من أنا؟',
    tagline: 'تلميح عن شخصية — اعرفها قبل خصمك',
    accent: 'amber',
    seconds: 20,
    multiplier: 1,
  },
  {
    id: 'fillverse',
    label: 'كمل الآية',
    tagline: 'آية ناقصة كلمة — اختار الصح',
    accent: 'emerald',
    seconds: 20,
    multiplier: 1,
  },
  {
    id: 'speed',
    label: 'تحدي السرعة',
    tagline: 'أسرع عقل هو اللي يكسب',
    accent: 'violet',
    seconds: 10,
    multiplier: 2,
  },
  {
    id: 'lightning',
    label: 'جولة البرق',
    tagline: 'سبع ثواني للسؤال — من غير تفكير طويل',
    accent: 'rose',
    seconds: 7,
    multiplier: 2,
  },
  {
    id: 'survival',
    label: 'جولة النجاة',
    tagline: 'غلطة واحدة تضيّع الجولة كلها',
    accent: 'rose',
    seconds: 20,
    multiplier: 2,
    survival: true,
  },
  {
    id: 'memory',
    label: 'جولة الذاكرة',
    tagline: 'اقرا كويس — السؤال هيختفي',
    accent: 'violet',
    seconds: 15,
    multiplier: 2,
    memorise: true,
  },
];

/** Always the finale. Hardest questions, triple score, gold. */
export const GOLDEN_ROUND: MatchRound = {
  id: 'golden',
  label: 'الجولة الذهبية',
  tagline: 'أصعب الأسئلة — والنقط بتلاتة',
  accent: 'gold',
  seconds: 25,
  multiplier: 3,
  finale: true,
};

export const ALL_ROUNDS: MatchRound[] = [...ROUND_POOL, GOLDEN_ROUND];

export function roundById(id: MatchStageId | undefined): MatchRound | null {
  if (!id) return null;
  return ALL_ROUNDS.find((r) => r.id === id) ?? null;
}

/**
 * Draw the rounds for one match: four distinct from the pool, Golden last.
 *
 * "Random but balanced" in the brief means two things here, and both are
 * enforced rather than hoped for:
 *
 *   • no round appears twice in a match — the draw is without replacement;
 *   • the fast rounds do not all land together. Speed, Lightning, Survival
 *     and Memory each put the player under pressure, and a match that opened
 *     with three of them back to back would be exhausting rather than varied,
 *     so at most two pressure rounds are drawn and they are never adjacent.
 *
 * `pick` is injectable so the tests can drive the draw deterministically
 * instead of running it a thousand times and hoping.
 */
export function drawMatchRounds(pick: (n: number) => number = (n) => Math.floor(Math.random() * n)): MatchRound[] {
  const drawn: MatchRound[] = [];
  const remaining = [...ROUND_POOL];
  const wanted = ROUNDS_PER_MATCH - 1; // Golden takes the last slot

  while (drawn.length < wanted && remaining.length > 0) {
    const candidates = remaining.filter((r) => allowed(drawn, r));
    // If the balance rules leave nothing, relax them rather than return a
    // short match — a match with five rounds and imperfect pacing is better
    // than one with four.
    const from = candidates.length > 0 ? candidates : remaining;
    const chosen = from[pick(from.length)];
    drawn.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
  }

  return [...drawn, GOLDEN_ROUND];
}

/** Rounds that press the player. Golden is hard but not hurried. */
export function isPressure(round: MatchRound): boolean {
  return round.seconds <= 10 || round.survival === true || round.memorise === true;
}

function allowed(drawn: MatchRound[], candidate: MatchRound): boolean {
  if (!isPressure(candidate)) return true;
  const last = drawn[drawn.length - 1];
  if (last && isPressure(last)) return false;          // never adjacent
  return drawn.filter(isPressure).length < 2;          // at most two per match
}

/**
 * Where each round starts, so the match screen knows when to show a
 * transition and which round the current question belongs to.
 */
export function roundOfQuestion(questions: RoomQuestion[], idx: number): MatchRound | null {
  return roundById(questions[idx]?.stage);
}

export function startsRound(questions: RoomQuestion[], idx: number): boolean {
  const here = questions[idx]?.stage;
  if (!here) return false;
  return idx === 0 || questions[idx - 1]?.stage !== here;
}

/** 1-based position of a round within the match, for «الجولة ٣ من ٥». */
export function roundNumber(questions: RoomQuestion[], idx: number): number {
  const seen: string[] = [];
  for (let i = 0; i <= idx && i < questions.length; i++) {
    const id = questions[i]?.stage;
    if (id && seen[seen.length - 1] !== id) seen.push(id);
  }
  return seen.length;
}

/** How many rounds this match has, read off the questions themselves. */
export function totalRounds(questions: RoomQuestion[]): number {
  const seen: string[] = [];
  for (const q of questions) {
    if (q.stage && seen[seen.length - 1] !== q.stage) seen.push(q.stage);
  }
  return seen.length;
}
