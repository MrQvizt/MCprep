import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { getSettings, type AllSettings } from "@/lib/settings";
import { checkInPoints, shiftDay, streakAfterCheckIn } from "@/lib/streaks";
import { zonedDateString } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export class LoyaltyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoyaltyError";
  }
}

const CONFIRMED_STATUSES = ["CONFIRMED", "IN_PREPARATION", "COMPLETED"] as const;
/** At most this many unused rewards per customer (keeps redemptions honest and simple). */
export const MAX_AVAILABLE_REWARDS = 3;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function todayFor(settings: Pick<AllSettings, "business">, now = new Date()): string {
  return zonedDateString(now, settings.business.timeZone);
}

function rewardCode(): string {
  let code = "MC-";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

async function lockAccount(tx: Tx, accountId: string) {
  const rows = await tx.$queryRaw<{ id: string; currentStreak: number; longestStreak: number; lastCheckInDay: Date | null; pointsBalance: number }[]>`
    SELECT "id", "currentStreak", "longestStreak", "lastCheckInDay", "pointsBalance"
    FROM "CustomerAccount" WHERE "id" = ${accountId} FOR UPDATE`;
  if (rows.length === 0) throw new LoyaltyError("Your account couldn't be found. Please sign in again.");
  return rows[0];
}

export interface CheckInResult {
  alreadyCheckedIn: boolean;
  streak: number;
  pointsEarned: number;
  bonus: number;
  balance: number;
}

/** Record today's check-in (once per Malta calendar day) and award points. */
export async function checkIn(accountId: string, now = new Date()): Promise<CheckInResult> {
  const settings = await getSettings();
  const loyalty = settings.loyalty;
  if (!loyalty.enabled) throw new LoyaltyError("Daily check-ins are paused right now.");
  const today = todayFor(settings, now);
  return db.$transaction(async (tx) => {
    const acct = await lockAccount(tx, accountId);
    const last = toDay(acct.lastCheckInDay);
    if (last === today) {
      return { alreadyCheckedIn: true, streak: acct.currentStreak, pointsEarned: 0, bonus: 0, balance: acct.pointsBalance };
    }
    const streak = streakAfterCheckIn(last, acct.currentStreak, today);
    const pts = checkInPoints(streak, loyalty.pointsPerCheckIn, loyalty.milestones);
    await tx.customerCheckIn.create({ data: { accountId, day: dayDate(today), streak, pointsAwarded: pts.total, createdAt: now } });
    await tx.rewardLedgerEntry.create({
      data: { accountId, type: "CHECK_IN", points: pts.base, description: `Daily check-in (day ${streak})`, createdAt: now },
    });
    if (pts.bonus > 0) {
      await tx.rewardLedgerEntry.create({
        data: { accountId, type: "STREAK_BONUS", points: pts.bonus, description: `${streak}-day streak bonus`, createdAt: now },
      });
    }
    const updated = await tx.customerAccount.update({
      where: { id: accountId },
      data: {
        currentStreak: streak,
        longestStreak: Math.max(acct.longestStreak, streak),
        lastCheckInDay: dayDate(today),
        pointsBalance: { increment: pts.total },
      },
      select: { pointsBalance: true },
    });
    return { alreadyCheckedIn: false, streak, pointsEarned: pts.total, bonus: pts.bonus, balance: updated.pointsBalance };
  });
}

export async function hasConfirmedOrder(accountId: string, tx: Tx | typeof db = db): Promise<boolean> {
  return (await tx.order.count({ where: { accountId, status: { in: [...CONFIRMED_STATUSES] } } })) > 0;
}

/** Swap points for a reward from the catalogue. */
export async function redeemReward(accountId: string, rewardKey: string, now = new Date()) {
  const settings = await getSettings();
  const loyalty = settings.loyalty;
  if (!loyalty.enabled) throw new LoyaltyError("Rewards are paused right now.");
  const reward = loyalty.rewards.find((r) => r.key === rewardKey);
  if (!reward) throw new LoyaltyError("That reward isn't available any more.");
  return db.$transaction(async (tx) => {
    const acct = await lockAccount(tx, accountId);
    if (acct.pointsBalance < reward.points) {
      throw new LoyaltyError(`You need ${reward.points - acct.pointsBalance} more points for this reward.`);
    }
    if (loyalty.redeemRequiresConfirmedOrder && !(await hasConfirmedOrder(accountId, tx))) {
      throw new LoyaltyError("Rewards unlock after your first confirmed order.");
    }
    const open = await tx.rewardRedemption.count({ where: { accountId, status: "AVAILABLE" } });
    if (open >= MAX_AVAILABLE_REWARDS) {
      throw new LoyaltyError(`You already have ${open} rewards waiting — use one on your next order first.`);
    }
    let redemption = null;
    for (let attempt = 0; attempt < 5 && !redemption; attempt++) {
      const code = rewardCode();
      if (await tx.rewardRedemption.findUnique({ where: { code }, select: { id: true } })) continue;
      redemption = await tx.rewardRedemption.create({
        data: {
          accountId,
          rewardKey: reward.key,
          rewardName: reward.name,
          description: reward.description || null,
          pointsCost: reward.points,
          percentOff: reward.percentOff,
          code,
          createdAt: now,
        },
      });
    }
    if (!redemption) throw new LoyaltyError("Something went wrong — please try again.");
    await tx.rewardLedgerEntry.create({
      data: { accountId, type: "REDEEMED", points: -reward.points, description: `Redeemed: ${reward.name}`, redemptionId: redemption.id, createdAt: now },
    });
    await tx.customerAccount.update({ where: { id: accountId }, data: { pointsBalance: { decrement: reward.points } } });
    return redemption;
  });
}

/** Discount for a percentage reward on the price after any promotion (rounded half-up). */
export function rewardDiscountCents(goodsCents: number | null, percentOff: number | null): number {
  if (goodsCents === null || goodsCents <= 0 || !percentOff) return 0;
  return Math.min(goodsCents, Math.floor((goodsCents * percentOff + 50) / 100));
}

/** An unused reward of this account, by code (for the order form). */
export async function findAvailableReward(accountId: string, code: string, tx: Tx | typeof db = db) {
  return tx.rewardRedemption.findFirst({
    where: { accountId, code: code.trim().toUpperCase(), status: "AVAILABLE" },
    select: { id: true, code: true, rewardName: true, description: true, percentOff: true },
  });
}

/** Give a reward back when its order is cancelled (the customer can use it again). */
export async function releaseRewardForOrder(tx: Tx, orderId: string) {
  await tx.rewardRedemption.updateMany({
    where: { orderId, status: "USED" },
    data: { status: "AVAILABLE", orderId: null, usedAt: null },
  });
}

/** Team adjustment (+/-) with a reason; never takes the balance below zero. */
export async function adjustPoints(accountId: string, points: number, reason: string, adminId: string) {
  if (!Number.isInteger(points) || points === 0) throw new LoyaltyError("Enter a whole number of points (not 0).");
  return db.$transaction(async (tx) => {
    const acct = await lockAccount(tx, accountId);
    if (acct.pointsBalance + points < 0) throw new LoyaltyError(`The balance is only ${acct.pointsBalance} points.`);
    await tx.rewardLedgerEntry.create({
      data: { accountId, type: "ADJUSTMENT", points, description: reason.slice(0, 200) || "Adjustment by our team", createdById: adminId },
    });
    return tx.customerAccount.update({ where: { id: accountId }, data: { pointsBalance: { increment: points } } });
  });
}

/** Cancel an unused reward and refund its points. */
export async function cancelReward(redemptionId: string, adminId: string | null) {
  return db.$transaction(async (tx) => {
    const r = await tx.rewardRedemption.findUnique({ where: { id: redemptionId } });
    if (!r || r.status !== "AVAILABLE") throw new LoyaltyError("Only unused rewards can be cancelled.");
    await lockAccount(tx, r.accountId);
    await tx.rewardRedemption.update({ where: { id: r.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await tx.rewardLedgerEntry.create({
      data: {
        accountId: r.accountId,
        type: "REFUND",
        points: r.pointsCost,
        description: `Refund: ${r.rewardName}`,
        redemptionId: r.id,
        createdById: adminId,
      },
    });
    await tx.customerAccount.update({ where: { id: r.accountId }, data: { pointsBalance: { increment: r.pointsCost } } });
  });
}

/** Everything the dashboard needs about streaks and rewards. */
export async function getLoyaltyOverview(accountId: string, now = new Date()) {
  const settings = await getSettings();
  const today = todayFor(settings, now);
  const since = dayDate(shiftDay(today, -34));
  const [checkIns, ledger, available, confirmed] = await Promise.all([
    db.customerCheckIn.findMany({ where: { accountId, day: { gte: since } }, select: { day: true }, orderBy: { day: "asc" } }),
    db.rewardLedgerEntry.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.rewardRedemption.findMany({ where: { accountId, status: "AVAILABLE" }, orderBy: { createdAt: "desc" } }),
    hasConfirmedOrder(accountId),
  ]);
  return {
    today,
    settings: settings.loyalty,
    checkInDays: checkIns.map((c) => c.day.toISOString().slice(0, 10)),
    ledger,
    availableRewards: available,
    rewardsUnlocked: !settings.loyalty.redeemRequiresConfirmedOrder || confirmed,
  };
}
