import { addDays, differenceInCalendarDays, formatISO, isAfter, startOfDay, subDays } from "date-fns";
import type { Cycle } from "@prisma/client";

export type CyclePrediction = {
  averageCycleLength: number;
  lutealLength: number;
  currentCycleDay: number;
  currentPhase: "unknown" | "menstrual" | "follicular" | "ovulation" | "luteal";
  phaseExplanation: string;
  nextPeriodDate: string;
  ovulationDate: string;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  currentCycleStart: string;
};

function average(values: number[]): number {
  if (!values.length) {
    return 28;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toIsoDay(date: Date): string {
  return formatISO(startOfDay(date), { representation: "date" });
}

function phaseForCycleDay(day: number, cycleLength: number): CyclePrediction["currentPhase"] {
  if (day <= 5) {
    return "menstrual";
  }
  const ovulationDay = Math.max(14, cycleLength - 14);
  if (day < ovulationDay - 2) {
    return "follicular";
  }
  if (day <= ovulationDay + 1) {
    return "ovulation";
  }
  return "luteal";
}

function phaseCopy(phase: CyclePrediction["currentPhase"]): string {
  switch (phase) {
    case "unknown":
      return "Log your first period to start personalized cycle-day tracking.";
    case "menstrual":
      return "Energy is often lowest. Focus on rest, hydration and gentle movement.";
    case "follicular":
      return "Rising estrogen boosts confidence and mental clarity. Great phase for planning.";
    case "ovulation":
      return "Communication and social energy often peak around ovulation.";
    case "luteal":
      return "Progesterone rises. Prioritize sleep, stress reduction and steady meals.";
    default:
      return "";
  }
}

function inferCycleLength(cycles: Cycle[]): number {
  if (cycles.length < 2) {
    return 28;
  }

  const sorted = [...cycles].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const differences: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    differences.push(
      Math.max(21, Math.min(35, differenceInCalendarDays(sorted[i].startDate, sorted[i - 1].startDate)))
    );
  }
  return average(differences);
}

export function computeCyclePrediction(cycles: Cycle[], now = new Date()): CyclePrediction {
  const today = startOfDay(now);
  const averageCycleLength = inferCycleLength(cycles);
  const lutealLength = 14;
  const sorted = [...cycles].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const hasCycleHistory = sorted.length > 0;

  if (!hasCycleHistory) {
    const nextPeriodDate = addDays(today, averageCycleLength);
    const ovulationDate = subDays(nextPeriodDate, lutealLength);
    const fertileWindowStart = subDays(ovulationDate, 5);
    const fertileWindowEnd = addDays(ovulationDate, 1);

    return {
      averageCycleLength,
      lutealLength,
      currentCycleDay: 0,
      currentPhase: "unknown",
      phaseExplanation: phaseCopy("unknown"),
      nextPeriodDate: toIsoDay(nextPeriodDate),
      ovulationDate: toIsoDay(ovulationDate),
      fertileWindowStart: toIsoDay(fertileWindowStart),
      fertileWindowEnd: toIsoDay(fertileWindowEnd),
      currentCycleStart: toIsoDay(today)
    };
  }

  const lastKnown = startOfDay(sorted.at(-1)!.startDate);

  let currentCycleStart = lastKnown;
  while (isAfter(today, addDays(currentCycleStart, averageCycleLength))) {
    currentCycleStart = addDays(currentCycleStart, averageCycleLength);
  }

  const currentCycleDay = Math.max(1, differenceInCalendarDays(today, currentCycleStart) + 1);
  const nextPeriodDate = addDays(currentCycleStart, averageCycleLength);
  const ovulationDate = subDays(nextPeriodDate, lutealLength);
  const fertileWindowStart = subDays(ovulationDate, 5);
  const fertileWindowEnd = addDays(ovulationDate, 1);
  const currentPhase = phaseForCycleDay(currentCycleDay, averageCycleLength);

  return {
    averageCycleLength,
    lutealLength,
    currentCycleDay,
    currentPhase,
    phaseExplanation: phaseCopy(currentPhase),
    nextPeriodDate: toIsoDay(nextPeriodDate),
    ovulationDate: toIsoDay(ovulationDate),
    fertileWindowStart: toIsoDay(fertileWindowStart),
    fertileWindowEnd: toIsoDay(fertileWindowEnd),
    currentCycleStart: toIsoDay(currentCycleStart)
  };
}
