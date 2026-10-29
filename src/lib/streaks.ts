/**
 * Daily streak rules — pure, client-safe and unit-tested.
 *
 * - One check-in per Malta calendar day.
 * - Checking in the day after the last check-in continues the streak;
 *   missing a whole day resets it to 1 on the next check-in.
 * - Each check-in earns pointsPerCheckIn, plus a bonus on milestone days.
 *   After the longest milestone, its bonus repeats every time the streak
 *   reaches another multiple of it (e.g. 60, 90… for a 30-day milestone).
 */

export interface Milestone {
  days: number;
  points: number;
}

/** Add whole days to a YYYY-MM-DD date. */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Streak to show today: still alive if the last check-in was today or yesterday. */
export function liveStreak(lastCheckInDay: string | null, currentStreak: number, today: string): number {
  if (!lastCheckInDay) return 0;
  return lastCheckInDay === today || lastCheckInDay === shiftDay(today, -1) ? currentStreak : 0;
}

export function checkedInToday(lastCheckInDay: string | null, today: string): boolean {
  return lastCheckInDay === today;
}

/** The streak after checking in today (unchanged if already checked in today). */
export function streakAfterCheckIn(lastCheckInDay: string | null, currentStreak: number, today: string): number {
  if (lastCheckInDay === today) return currentStreak;
  if (lastCheckInDay === shiftDay(today, -1)) return currentStreak + 1;
  return 1;
}

function sorted(milestones: Milestone[]): Milestone[] {
  return [...milestones].filter((m) => m.days > 1 && m.points > 0).sort((a, b) => a.days - b.days);
}

/** Bonus points earned on reaching this streak length. */
export function milestoneBonus(streak: number, milestones: Milestone[]): number {
  const list = sorted(milestones);
  const exact = list.find((m) => m.days === streak);
  if (exact) return exact.points;
  const top = list[list.length - 1];
  if (top && streak > top.days && streak % top.days === 0) return top.points;
  return 0;
}

/** The next milestone ahead of this streak, and how many days away it is. */
export function nextMilestone(streak: number, milestones: Milestone[]): (Milestone & { daysToGo: number }) | null {
  const list = sorted(milestones);
  if (list.length === 0) return null;
  const ahead = list.find((m) => m.days > streak);
  if (ahead) return { ...ahead, daysToGo: ahead.days - streak };
  const top = list[list.length - 1];
  const nextMultiple = (Math.floor(streak / top.days) + 1) * top.days;
  return { days: nextMultiple, points: top.points, daysToGo: nextMultiple - streak };
}

/** Points earned by a check-in that produces this streak. */
export function checkInPoints(streak: number, pointsPerCheckIn: number, milestones: Milestone[]) {
  const bonus = milestoneBonus(streak, milestones);
  return { base: pointsPerCheckIn, bonus, total: pointsPerCheckIn + bonus };
}

/** Last `n` calendar days ending today, oldest first (for the streak calendar). */
export function recentDays(today: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(today, i - (n - 1)));
}

/** Short, practical daily tips that rotate by day (a reason to come back). */
export const DAILY_TIPS = [
  "Spread your protein over the day — 30–40 g a meal is easier than one huge serving.",
  "Drink a glass of water with every meal. Thirst often feels like hunger.",
  "Sleep is training too. Aim for a consistent bedtime this week.",
  "Eat your protein first, then your carbs — it keeps you fuller for longer.",
  "Walking after a meal helps digestion and adds easy daily steps.",
  "Plan tomorrow's meals tonight. Fewer decisions, better choices.",
  "A rest day is part of the plan, not a break from it.",
  "Keep your meals in the fridge at the front — see it, eat it.",
  "Track your training, not just your food. Progress needs proof.",
  "Hungry between meals? Add volume with veg before adding snacks.",
  "Consistency beats perfection. Today's check-in counts.",
  "Warm up properly — five minutes now saves weeks later.",
  "Salt your food to taste, especially on hot training days in Malta.",
  "Fibre matters: aim for veg or fruit with most meals.",
  "Weigh yourself at the same time of day if you track your weight.",
  "Pre-workout meal 2–3 hours before training works for most people.",
  "Post-workout, a protein-rich meal is all you need — no magic window.",
  "Caffeine after mid-afternoon can cost you sleep quality.",
  "Write down one win from today, however small.",
  "Stretch the muscles you trained yesterday for five minutes.",
  "Swap one sugary drink this week for water or sparkling water.",
  "Eat slowly — it takes about 20 minutes to feel full.",
  "Set a step goal you can hit on your busiest day.",
  "Prep your gym bag the night before.",
  "Protein at breakfast makes the rest of the day easier.",
  "Progress photos tell a better story than the scale.",
  "If you miss a meal, don't double the next one — just get back on track.",
  "Strength takes weeks; habits take days. Check in again tomorrow.",
  "Train the movement, not just the muscle — quality reps first.",
  "Enjoy your food. Sustainable beats strict.",
] as const;

/** Tip for a calendar day (stable for everyone on that day). */
export function tipForDay(day: string): string {
  const n = Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 86_400_000);
  return DAILY_TIPS[((n % DAILY_TIPS.length) + DAILY_TIPS.length) % DAILY_TIPS.length];
}
