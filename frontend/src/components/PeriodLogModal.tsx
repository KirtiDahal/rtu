import { addDays, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { useEffect, useMemo, useState } from "react";

type PeriodRange = {
  startDate: string;
  endDate: string;
};

type PeriodLogModalProps = {
  open: boolean;
  initialDate?: string;
  pending?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (range: PeriodRange) => Promise<void> | void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseDateOnly(value: string): Date | null {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function PeriodLogModal({
  open,
  initialDate,
  pending = false,
  error = "",
  onClose,
  onConfirm
}: PeriodLogModalProps) {
  const fallback = initialDate ? new Date(initialDate) : new Date();
  const [viewDate, setViewDate] = useState(() => new Date(fallback.getFullYear(), fallback.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => toDateString(fallback));

  useEffect(() => {
    if (!open) {
      return;
    }
    const start = initialDate ? new Date(initialDate) : new Date();
    setViewDate(new Date(start.getFullYear(), start.getMonth(), 1));
    setSelectedDate(toDateString(start));
  }, [open, initialDate]);

  const previewDates = useMemo(() => {
    const start = parseDateOnly(selectedDate);
    if (!start || Number.isNaN(start.getTime())) {
      return new Set<string>();
    }
    return new Set(
      Array.from({ length: 5 }, (_, index) => toDateString(addDays(start, index)))
    );
  }, [selectedDate]);

  const monthCells = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const startOffset = (getDay(monthStart) + 6) % 7;
    const days = monthEnd.getDate();
    const cells: Array<Date | null> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= days; day += 1) {
      cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
    }
    return cells;
  }, [viewDate]);

  async function handleConfirm() {
    const start = parseDateOnly(selectedDate);
    if (!start || Number.isNaN(start.getTime())) {
      return;
    }
    await onConfirm({
      startDate: toDateString(start),
      endDate: toDateString(addDays(start, 4))
    });
  }

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Log period">
      <div className="period-modal">
        <div className="period-modal-header">
          <h3>Log Period Start</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            x
          </button>
        </div>
        <p className="subtitle">Pick any start date. We will automatically mark 5 days.</p>
        <p className="subtitle">Only the selected start date shows a tick now. Remaining days tick day-by-day.</p>

        <div className="period-modal-month">
          <button type="button" className="month-nav" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
            &lt;
          </button>
          <strong>{format(viewDate, "MMMM yyyy")}</strong>
          <button type="button" className="month-nav" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
            &gt;
          </button>
        </div>

        <div className="period-weekdays">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="period-grid">
          {monthCells.map((date, index) => {
            if (!date) {
              return <span key={`empty-${index}`} className="period-cell empty" />;
            }
            const key = toDateString(date);
            const inPreview = previewDates.has(key);
            const selected = key === selectedDate;

            return (
              <button
                type="button"
                key={key}
                className={[
                  "period-cell",
                  inPreview ? "preview-range" : "",
                  selected ? "selected" : ""
                ].join(" ")}
                onClick={() => setSelectedDate(key)}
              >
                <span>{date.getDate()}</span>
                {selected && <span className="tick-icon" aria-hidden />}
              </button>
            );
          })}
        </div>

        {error && <p className="action-error">{error}</p>}
        <div className="period-modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={handleConfirm} disabled={pending}>
            {pending ? "Saving..." : "Save 5-Day Period"}
          </button>
        </div>
      </div>
    </div>
  );
}
