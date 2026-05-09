// client/src/utils/bonusCalculator.ts
import { EmployerBonus } from '../services/employerApi';

export function timeRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMins(start1), e1 = toMins(end1);
  const s2 = toMins(start2), e2 = toMins(end2);

  const normalize = (s: number, e: number): [number, number][] =>
    s <= e ? [[s, e]] : [[s, 24 * 60], [0, e]];

  const ranges1 = normalize(s1, e1);
  const ranges2 = normalize(s2, e2);

  for (const [a1, a2] of ranges1) {
    for (const [b1, b2] of ranges2) {
      if (a1 < b2 && b1 < a2) return true;
    }
  }
  return false;
}

export function getApplicableBonuses(
  bonuses: EmployerBonus[] | undefined,
  dateStr: string,
  startTime: string,
  endTime: string
): EmployerBonus[] {
  if (!bonuses || bonuses.length === 0) return [];

  const date = new Date(dateStr + 'T00:00:00Z');
  const dayOfWeek = date.getUTCDay();

  return bonuses.filter((bonus) => {
    if (bonus.conditionType === 'day_of_week') {
      const match = bonus.daysOfWeek?.includes(dayOfWeek) ?? false;
      if (!match) {
        console.log('[bonusCalculator] day_of_week MISS:', bonus.name, '| bonus days:', bonus.daysOfWeek, '| entry day:', dayOfWeek, '(', dateStr, ')');
      }
      return match;
    }
    if (bonus.conditionType === 'time_range') {
      if (!bonus.startTime || !bonus.endTime) {
        console.log('[bonusCalculator] time_range SKIP:', bonus.name, '| missing start/end time');
        return false;
      }
      const match = timeRangesOverlap(startTime, endTime, bonus.startTime, bonus.endTime);
      if (!match) {
        console.log('[bonusCalculator] time_range MISS:', bonus.name, '| bonus:', bonus.startTime, '-', bonus.endTime, '| entry:', startTime, '-', endTime);
      }
      return match;
    }
    if (bonus.conditionType === 'specific_dates') {
      const match = bonus.specificDates?.includes(dateStr) ?? false;
      if (!match) {
        console.log('[bonusCalculator] specific_dates MISS:', bonus.name, '| bonus dates:', bonus.specificDates, '| entry date:', dateStr);
      }
      return match;
    }
    return false;
  });
}

export function calculateEffectiveHourlyRate(
  baseRate: number | null | undefined,
  bonuses: EmployerBonus[] | undefined,
  dateStr: string,
  startTime: string,
  endTime: string
): number | null {
  if (baseRate == null) return null;
  const applicable = getApplicableBonuses(bonuses, dateStr, startTime, endTime);
  if (applicable.length === 0) return baseRate;
  const multiplier = applicable.reduce((acc, b) => acc * (1 + b.multiplier), 1);
  return Math.round(baseRate * multiplier * 100) / 100;
}

export function formatBonusCondition(bonus: EmployerBonus): string {
  if (bonus.conditionType === 'day_of_week' && bonus.daysOfWeek?.length) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return bonus.daysOfWeek.map((d) => days[d]).join(', ');
  }
  if (bonus.conditionType === 'time_range' && bonus.startTime && bonus.endTime) {
    return `${bonus.startTime}–${bonus.endTime}`;
  }
  if (bonus.conditionType === 'specific_dates' && bonus.specificDates?.length) {
    return `${bonus.specificDates.length} date${bonus.specificDates.length !== 1 ? 's' : ''}`;
  }
  return 'Custom';
}
