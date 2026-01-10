import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Flame,
  HeartPulse,
  Sparkles,
  Trash2,
  Waves,
  Zap,
  type LucideIcon
} from "lucide-react";
import { api } from "../lib/api";
import { PeriodLogModal } from "../components/PeriodLogModal";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MOOD_OPTIONS = [
  { label: "Happy", icon: "😊" },
  { label: "High Energy", icon: "🤩" },
  { label: "Okay", icon: "🙂" },
  { label: "Balanced", icon: "😌" },
  { label: "Calm", icon: "🫶" },
  { label: "Down", icon: "😕" },
  { label: "Low Energy", icon: "😴" }
];
type SymptomOption = {
  label: string;
  icon: LucideIcon;
  aliases: string[];
};

const SYMPTOM_OPTIONS: SymptomOption[] = [
  { label: "Cramps", icon: Zap, aliases: ["cramp", "cramps"] },
  { label: "Bloating", icon: Flame, aliases: ["bloat", "bloating"] },
  { label: "Headache", icon: Waves, aliases: ["headache", "head pain"] },
  { label: "Acne", icon: Sparkles, aliases: ["acne", "pimples"] },
  { label: "Back Pain", icon: HeartPulse, aliases: ["back pain", "backpain"] },
  { label: "High Energy", icon: Zap, aliases: ["high energy", "energy"] }
];
const PHASE_INSIGHTS = {
  period: {
    title: "Period Phase",
    note: "Your body is restoring. Prioritize warmth, hydration, and rest."
  },
  ovulation: {
    title: "Ovulation Window",
    note: "Energy and confidence often peak. Good time for movement and social plans."
  },
  fertile: {
    title: "Fertile Window",
    note: "Body temperature and cervical fluid patterns may shift in this window."
  },
  follicular: {
    title: "Follicular Phase",
    note: "Your estrogen levels are rising. You might feel more social and energetic today."
  }
};

function normalizeSymptomKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z]/g, "");
}

const symptomIconByKey = new Map<string, LucideIcon>(
  SYMPTOM_OPTIONS.flatMap((option) =>
    [option.label, ...option.aliases].map((alias) => [normalizeSymptomKey(alias), option.icon] as const)
  )
);

function symptomIconFromLabel(label: string): LucideIcon {
  return symptomIconByKey.get(normalizeSymptomKey(label)) ?? Activity;
}

function moodEmojiFromLabel(label?: string | null): string | null {
  if (!label) {
    return null;
  }
  const found = MOOD_OPTIONS.find((option) => option.label.toLowerCase() === label.toLowerCase());
  return found?.icon ?? null;
}

function moodToneFromLabel(label?: string | null): "energetic" | "neutral" | "low" | null {
  if (!label) {
    return null;
  }
  const score = moodScoreFromLabel(label);
  if (score >= 4) {
    return "energetic";
  }
  if (score === 3) {
    return "neutral";
  }
  return "low";
}

function moodScoreFromLabel(label: string): number {
  switch (label) {
    case "Happy":
      return 5;
    case "High Energy":
      return 4;
    case "Okay":
    case "Balanced":
    case "Calm":
      return 3;
    case "Down":
      return 2;
    case "Low Energy":
      return 1;
    default:
      return 3;
  }
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [moodLabel, setMoodLabel] = useState("Okay");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [savedEntriesByDate, setSavedEntriesByDate] = useState<
    Record<string, { moodLabel: string; symptoms: string[] }>
  >({});
  const [deletedEntriesByDate, setDeletedEntriesByDate] = useState<Record<string, true>>({});
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [periodModalOpen, setPeriodModalOpen] = useState(false);

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();
  const todayDateKey = format(new Date(), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", month, year],
    queryFn: () => api.calendar.get(month, year)
  });

  useEffect(() => {
    if (!data) {
      return;
    }
    const found = data.days.some((day) => day.date === selectedDate);
    if (!found && data.days.length > 0) {
      setSelectedDate(data.days[0].date);
    }
  }, [data, selectedDate]);

  const periodMutation = useMutation({
    mutationFn: (payload: { startDate: string; endDate: string }) => api.logs.period(payload),
    onSuccess: async () => {
      setActionMessage("Period saved. Pink ticks will appear day-by-day for the next 5 days.");
      setActionError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })
      ]);
    },
    onError: (error) => {
      setActionError((error as Error).message);
    }
  });

  const moodMutation = useMutation({
    mutationFn: (payload: { date: string; mood: number; label: string }) => api.logs.mood(payload),
    onError: (error) => {
      setActionError((error as Error).message);
    }
  });

  const symptomMutation = useMutation({
    mutationFn: (payload: { date: string; symptoms: string[] }) => api.logs.symptoms(payload),
    onError: (error) => {
      setActionError((error as Error).message);
    }
  });

  const deleteDayLogsMutation = useMutation({
    mutationFn: (date: string) =>
      Promise.all([api.logs.deleteMoodByDate(date), api.logs.deleteSymptomsByDate(date)]),
    onError: (error) => {
      setActionError((error as Error).message);
    }
  });

  const monthTitle = useMemo(() => format(new Date(year, month - 1, 1), "MMMM yyyy"), [month, year]);
  const nextPeriodDate = data ? parseISO(data.prediction.nextPeriodDate) : new Date();
  const nextPeriodEndDate = addDays(nextPeriodDate, 5);
  const daysUntilNextPeriod = Math.max(differenceInCalendarDays(nextPeriodDate, new Date()), 0);
  const selectedDay = data?.days.find((day) => day.date === selectedDate);
  const selectedPhase = useMemo(() => {
    if (selectedDay?.isPeriodDay) {
      return PHASE_INSIGHTS.period;
    }
    if (selectedDay?.isOvulationDay) {
      return PHASE_INSIGHTS.ovulation;
    }
    if (selectedDay?.isFertileWindow) {
      return PHASE_INSIGHTS.fertile;
    }
    return PHASE_INSIGHTS.follicular;
  }, [selectedDay]);

  function toggleSymptom(symptom: string) {
    setSelectedSymptoms((current) =>
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]
    );
  }

  function resetDailyLog() {
    setMoodLabel("Okay");
    setSelectedSymptoms([]);
    setActionError("");
    setActionMessage("");
  }

  async function startPeriodToday() {
    const endDate = format(addDays(new Date(), 4), "yyyy-MM-dd");
    setActionError("");
    setActionMessage("");
    try {
      await periodMutation.mutateAsync({ startDate: todayDateKey, endDate });
      setSelectedDate(todayDateKey);
    } catch {
      // handled by mutation callbacks
    }
  }

  async function saveMoodAndSymptoms() {
    setActionError("");
    setActionMessage("");

    try {
      await moodMutation.mutateAsync({
        date: selectedDate,
        mood: moodScoreFromLabel(moodLabel),
        label: moodLabel
      });
      if (selectedSymptoms.length > 0) {
        await symptomMutation.mutateAsync({
          date: selectedDate,
          symptoms: selectedSymptoms
        });
      }
      setActionMessage(`Mood${selectedSymptoms.length ? " and symptoms" : ""} logged for ${selectedDate}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })
      ]);
      setSavedEntriesByDate((current) => ({
        ...current,
        [selectedDate]: {
          moodLabel,
          symptoms: selectedSymptoms
        }
      }));
      setDeletedEntriesByDate((current) => {
        if (!current[selectedDate]) {
          return current;
        }
        const next = { ...current };
        delete next[selectedDate];
        return next;
      });
      setSelectedSymptoms([]);
    } catch {
      // handled by mutation callbacks
    }
  }

  async function deleteMoodAndSymptomsForDay() {
    setActionError("");
    setActionMessage("");
    try {
      await deleteDayLogsMutation.mutateAsync(selectedDate);
      setSavedEntriesByDate((current) => {
        if (!current[selectedDate]) {
          return current;
        }
        const next = { ...current };
        delete next[selectedDate];
        return next;
      });
      setDeletedEntriesByDate((current) => ({
        ...current,
        [selectedDate]: true
      }));
      setSelectedSymptoms([]);
      setMoodLabel("Okay");
      setActionMessage(`Mood and symptoms removed for ${selectedDate}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })
      ]);
    } catch {
      // handled by mutation callbacks
    }
  }

  if (isLoading || !data) {
    return <div className="panel">Loading cycle calendar...</div>;
  }

  return (
    <div className="calendar-page">
      <section className="panel calendar-surface">
        <div className="calendar-top-row">
          <div>
            <h1>Your Cycle Calendar</h1>
            <p className="subtitle">Tracking your natural rhythm with care.</p>
          </div>
          <div className="calendar-top-actions">
            <button type="button" className="secondary-btn compact-btn" onClick={() => setPeriodModalOpen(true)}>
              Cycle History
            </button>
            <button
              type="button"
              className="primary-btn compact-btn"
              onClick={startPeriodToday}
              disabled={periodMutation.isPending}
            >
              {periodMutation.isPending ? "Starting..." : "+ Start Period Today"}
            </button>
          </div>
        </div>

        <div className="calendar-content-grid">
          <div className="calendar-left-column">
            <div className="calendar-header">
              <div className="month-label-wrap">
                <span>{monthTitle}</span>
                <div className="month-nav-wrap">
                  <button
                    type="button"
                    className="month-nav"
                    aria-label="Previous month"
                    onClick={() => setViewDate(new Date(year, month - 2, 1))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="month-nav"
                    aria-label="Next month"
                    onClick={() => setViewDate(new Date(year, month, 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="calendar-legend">
                <span>
                  <i className="legend-dot period-dot" />
                  Period
                </span>
                <span>
                  <i className="legend-dot ovulation-dot" />
                  Ovulation
                </span>
                <span>
                  <i className="legend-dot fertile-dot" />
                  Follicular
                </span>
              </div>
            </div>

            <div className="calendar-weekdays">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid compact-grid">
              {data.days.map((day) => {
                const isLocallyDeleted = Boolean(deletedEntriesByDate[day.date]);
                const localEntry = savedEntriesByDate[day.date];
                const dayMoodLabel = isLocallyDeleted ? null : localEntry?.moodLabel ?? day.moodLabel ?? null;
                const dayMoodTone = isLocallyDeleted
                  ? null
                  : localEntry
                    ? moodToneFromLabel(localEntry.moodLabel)
                    : day.moodTone ?? null;
                const daySymptoms = isLocallyDeleted ? [] : localEntry?.symptoms ?? day.symptoms ?? [];
                const symptomPreview = daySymptoms.slice(0, 2);
                const moodEmoji = moodEmojiFromLabel(dayMoodLabel);
                const dayHasSymptoms = !isLocallyDeleted && (day.hasSymptoms || daySymptoms.length > 0);
                const hasVisiblePeriodTick = day.isPeriodDay && day.date <= todayDateKey;
                const moodClass = dayMoodTone ? `mood-${dayMoodTone}` : "";
                return (
                  <button
                    key={day.date}
                    type="button"
                    className={[
                      "calendar-cell",
                      moodClass,
                      hasVisiblePeriodTick ? "period" : "",
                      day.isOvulationDay ? "ovulation" : "",
                      day.isFertileWindow ? "fertile" : "",
                      day.date === selectedDate ? "selected" : ""
                    ].join(" ")}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <strong>{day.day}</strong>
                    <span className="calendar-markers">
                      {hasVisiblePeriodTick && <span className="tick-icon" aria-hidden />}
                      {moodEmoji && (
                        <span className="calendar-mood-emoji" title={dayMoodLabel ?? "Mood"}>
                          {moodEmoji}
                        </span>
                      )}
                      {symptomPreview.length > 0 && (
                        <span className="symptom-icon-row" aria-label="Symptoms logged">
                          {symptomPreview.map((symptom, index) => {
                            const SymptomIcon = symptomIconFromLabel(symptom);
                            return (
                              <SymptomIcon
                                key={`${day.date}-${symptom}-${index}`}
                                size={12}
                                className="calendar-symptom-icon"
                                aria-hidden
                              />
                            );
                          })}
                        </span>
                      )}
                      {dayHasSymptoms && symptomPreview.length === 0 && (
                        <Activity size={12} className="calendar-symptom-icon" aria-label="Symptoms logged" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calendar-right-column">
            <article className="prediction-card">
              <h4>Predictions</h4>
              <div className="prediction-block">
                <p className="prediction-label">Next Period</p>
                <p className="prediction-main">
                  {format(nextPeriodDate, "MMM dd")} - {format(nextPeriodEndDate, "MMM dd")}
                </p>
                <p className="prediction-sub">{daysUntilNextPeriod} days away</p>
              </div>
              <div className="prediction-block">
                <p className="prediction-label">Ovulation Window</p>
                <p className="prediction-main">
                  {format(parseISO(data.prediction.fertileWindowStart), "MMM dd")} -{" "}
                  {format(parseISO(data.prediction.fertileWindowEnd), "MMM dd")}
                </p>
              </div>
            </article>

            <article className="phase-insight-card">
              <h4>Phase Insights</h4>
              <h5>{selectedPhase.title}</h5>
              <p>{selectedPhase.note}</p>
              <h6>Detection Logic</h6>
              <ul>
                <li>Based on your average 28-day cycle.</li>
                <li>Ovulation usually occurs around day 14.</li>
                <li>Fertile window includes 3 days before and 1 day after ovulation.</li>
              </ul>
            </article>

            <article className="health-tip">
              Logging your symptoms daily helps improve prediction accuracy over 3-4 months of data collection.
            </article>
          </aside>
        </div>

        <section className="calendar-log-panel">
          <div className="calendar-log-header">
            <div>
              <h3>Log for {format(parseISO(selectedDate), "MMMM dd, yyyy")}</h3>
              <p>How are you feeling today?</p>
            </div>
            <div className="calendar-log-tools">
              <button
                type="button"
                className="log-delete-btn"
                onClick={deleteMoodAndSymptomsForDay}
                disabled={deleteDayLogsMutation.isPending || moodMutation.isPending || symptomMutation.isPending}
                aria-label="Delete mood and symptoms log for selected day"
                title="Delete mood and symptoms for this day"
              >
                <Trash2 size={14} />
              </button>
              <span className="log-phase-tag">Phase: {selectedPhase.title.replace(" Phase", "").toUpperCase()}</span>
            </div>
          </div>

          <div className="calendar-field-row">
            <p className="calendar-field-title">Mood</p>
            <div className="mood-pill-row">
              {MOOD_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`mood-pill ${moodLabel === option.label ? "active" : ""}`}
                  onClick={() => setMoodLabel(option.label)}
                >
                  <span>{option.icon}</span>
                  <small>{option.label}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="calendar-field-row">
            <p className="calendar-field-title">Symptoms</p>
            <div className="symptom-chip-row">
              {SYMPTOM_OPTIONS.map((symptomOption) => {
                const SymptomIcon = symptomOption.icon;
                return (
                  <button
                    key={symptomOption.label}
                    type="button"
                    className={`symptom-chip ${
                      selectedSymptoms.includes(symptomOption.label) ? "active" : ""
                    }`}
                    onClick={() => toggleSymptom(symptomOption.label)}
                  >
                    <SymptomIcon size={14} aria-hidden />
                    <span>{symptomOption.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="calendar-log-actions">
            <button type="button" className="secondary-btn subtle-btn" onClick={resetDailyLog}>
              Cancel
            </button>
            <button
              className="primary-btn subtle-btn"
              type="button"
              disabled={moodMutation.isPending || symptomMutation.isPending || deleteDayLogsMutation.isPending}
              onClick={saveMoodAndSymptoms}
            >
              {moodMutation.isPending || symptomMutation.isPending ? "Saving..." : "Save Entry"}
            </button>
          </div>

          {actionMessage && <p className="action-feedback">{actionMessage}</p>}
          {actionError && <p className="action-error">{actionError}</p>}
        </section>
      </section>

      <PeriodLogModal
        open={periodModalOpen}
        initialDate={selectedDate}
        pending={periodMutation.isPending}
        error={actionError}
        onClose={() => setPeriodModalOpen(false)}
        onConfirm={async (range) => {
          setSelectedDate(range.startDate);
          await periodMutation.mutateAsync(range);
          setPeriodModalOpen(false);
        }}
      />
    </div>
  );
}
