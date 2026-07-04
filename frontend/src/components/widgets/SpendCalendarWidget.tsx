import type { CSSProperties } from "react";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { formatMoney } from "./format";
import { NoData } from "./NoData";
import { spendCalendar, type CalendarCell } from "./derive";

const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function cellClass(cell: CalendarCell): string {
  if (!cell.inRange) return "calendar-cell calendar-cell--empty";
  if (cell.spendCents > 0) return "calendar-cell calendar-cell--spend";
  if (cell.netCents > 0) return "calendar-cell calendar-cell--income";
  return "calendar-cell calendar-cell--zero";
}

function cellTitle(cell: CalendarCell): string {
  if (!cell.inRange) return cell.date;
  const parts = [cell.date];
  if (cell.spendCents > 0) parts.push(`spend ${formatMoney(cell.spendCents)}`);
  if (cell.netCents !== 0) parts.push(`net ${formatMoney(cell.netCents)}`);
  if (cell.count > 0) parts.push(`${cell.count} txns`);
  return parts.join(" · ");
}

export function SpendCalendarWidget({
  dashboard,
}: {
  dashboard: LedgerDashboardData;
}) {
  const calendar = spendCalendar(dashboard.dailySpend);
  if (!calendar) return <NoData message="NO DAILY ACTIVITY" />;

  const { weeks, totalSpendCents, dayCount } = calendar;

  return (
    <div className="calendar">
      <div className="calendar-head">
        <strong>{formatMoney(totalSpendCents)}</strong>
        <span>spent across {dayCount} active days</span>
      </div>
      <div className="calendar-grid">
        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>
        <div className="calendar-weeks">
          {weeks.map((week) => (
            <div key={week[0].date} className="calendar-week">
              {week.map((cell) => (
                <i
                  key={cell.date}
                  className={cellClass(cell)}
                  style={{ "--i": cell.intensity } as CSSProperties}
                  title={cellTitle(cell)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="calendar-legend">
        <span>Less</span>
        <i className="calendar-cell calendar-cell--spend" style={{ "--i": 0.15 } as CSSProperties} />
        <i className="calendar-cell calendar-cell--spend" style={{ "--i": 0.45 } as CSSProperties} />
        <i className="calendar-cell calendar-cell--spend" style={{ "--i": 0.75 } as CSSProperties} />
        <i className="calendar-cell calendar-cell--spend" style={{ "--i": 1 } as CSSProperties} />
        <span>More</span>
      </div>
    </div>
  );
}
