import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";
import type { Cycle } from "@prisma/client";
import { computeCyclePrediction } from "../src/prediction.js";

function mockCycle(startDate: Date): Cycle {
  return {
    id: crypto.randomUUID(),
    userId: "u1",
    startDate,
    endDate: subDays(startDate, -4),
    length: 28,
    createdAt: new Date()
  };
}

describe("computeCyclePrediction", () => {
  it("uses fallback values for sparse history", () => {
    const result = computeCyclePrediction([], new Date("2026-03-18T00:00:00.000Z"));
    expect(result.averageCycleLength).toBe(28);
    expect(result.lutealLength).toBe(14);
    expect(result.currentCycleDay).toBe(0);
    expect(result.currentPhase).toBe("unknown");
  });

  it("calculates average cycle length from historical cycles", () => {
    const now = new Date("2026-03-18T00:00:00.000Z");
    const cycles = [mockCycle(subDays(now, 84)), mockCycle(subDays(now, 56)), mockCycle(subDays(now, 28))];
    const result = computeCyclePrediction(cycles, now);
    expect(result.averageCycleLength).toBe(28);
    expect(result.currentCycleDay).toBeGreaterThan(0);
    expect(result.nextPeriodDate).toBeTruthy();
  });

  it("clamps irregular cycles into stable range", () => {
    const now = new Date("2026-03-18T00:00:00.000Z");
    const cycles = [mockCycle(subDays(now, 100)), mockCycle(subDays(now, 70)), mockCycle(subDays(now, 22))];
    const result = computeCyclePrediction(cycles, now);
    expect(result.averageCycleLength).toBeGreaterThanOrEqual(21);
    expect(result.averageCycleLength).toBeLessThanOrEqual(35);
  });
});
