import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const phaseCards = [
  {
    key: "menstrual",
    title: "MENSTRUAL",
    copy: "Energy is lowest; focus on rest and gentle movement. Stay hydrated."
  },
  {
    key: "follicular",
    title: "FOLLICULAR",
    copy: "Rising estrogen boosts confidence and brain power. Perfect for planning."
  },
  {
    key: "ovulation",
    title: "OVULATION",
    copy: "The peak of your cycle. Socializing and physical activity feel effortless."
  },
  {
    key: "luteal",
    title: "LUTEAL",
    copy: "Energy turns inward. Great for completing tasks and winding down."
  }
] as const;

function toHoursAndMinutes(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.dashboard.summary()
  });

  if (isLoading || !data) {
    return <div className="panel">Loading dashboard...</div>;
  }

  const firstName = user?.displayName.split(" ")[0] ?? "Sarah";
  const isUninitializedCycle = data.cycleDay === 0;
  const nextPeriodDate = new Date(data.nextPeriodDate);
  const daysUntilNext = Math.max(0, differenceInCalendarDays(nextPeriodDate, new Date()));
  const moodBars = [26, 46, Math.min(58, Math.max(24, data.quickStats.moodPositivityPercent - 5)), 58, 34];
  const sleepMinutes = Math.min(100, Math.max(8, Math.round((data.quickStats.averageSleepHours / 9) * 100)));

  return (
    <div className="dashboard-grid">
      <section className="dashboard-main">
          <header className="dashboard-title-row">
            <div>
              <h1>Good morning, {firstName}</h1>
              <p className="subtitle">
                {isUninitializedCycle
                  ? "Log your first cycle to start personalized insights."
                  : "Your body is preparing for its peak energy phase."}
              </p>
            </div>
          </header>

          <article className="hero-card">
            <div className="cycle-ring">
              <span>{data.cycleDay}</span>
              <small>CYCLE DAY</small>
            </div>
            <div>
              <p className="chip">
                {isUninitializedCycle ? "Start Tracking" : `${data.currentPhase} phase`}
              </p>
              <h3>{isUninitializedCycle ? "Let's start your cycle journey." : "Looking bright today!"}</h3>
              <p>{data.phaseExplanation}</p>
              <div className="dot-row">
                <span>{isUninitializedCycle ? "Tap Log Period" : "High Energy"}</span>
                <span>{isUninitializedCycle ? "Build baseline" : "Low Stress"}</span>
              </div>
            </div>
          </article>

        <section>
          <div className="section-row">
            <h3 className="section-title">Hormonal Phases</h3>
            <button className="about-link" type="button" onClick={() => navigate("/knowledge")}>
              About Hormones
            </button>
          </div>
          <div className="phase-grid">
            {phaseCards.map((phase) => (
              <article key={phase.key} className={phase.key === data.currentPhase ? "active-phase" : ""}>
                <h4>{phase.title}</h4>
                <p>{phase.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-bottom-cards">
          <article className="metric-card">
            <h4>Mood Summary</h4>
            <p className="subtitle">
              Your mood has been <strong>{data.quickStats.moodPositivityPercent}% positive</strong> this week.
            </p>
            <div className="mini-bars">
              {moodBars.map((height, index) => (
                <span key={index} style={{ height: `${height}px` }} />
              ))}
            </div>
          </article>
          <article className="metric-card">
            <h4>Sleep Tracker</h4>
            <p className="sleep-value">{toHoursAndMinutes(data.quickStats.averageSleepHours)}</p>
            <p className="subtitle">Average sleep time</p>
            <div className="sleep-line">
              <span style={{ width: `${sleepMinutes}%` }} />
            </div>
          </article>
        </section>
      </section>

      <aside className="dashboard-side">
        <article className="next-period-card">
          <h5>NEXT PERIOD</h5>
          <p>In {daysUntilNext} Days</p>
          <span>{format(nextPeriodDate, "MMM d")}</span>
        </article>

        <section className="panel side-panel">
          <h3>Recent Activity</h3>
          <p className="subtitle">Your logs from the last 24 hours</p>
          <ul className="activity-list">
            {data.recentActivity.slice(0, 4).map((activity, index) => (
              <li key={`${activity.type}-${activity.at}-${index}`}>
                <strong>{activity.label}</strong>
                <span>{format(new Date(activity.at), "EEE, h:mm a")}</span>
              </li>
            ))}
          </ul>
        </section>

        <article className="fact-card">
          <h4>Did you know?</h4>
          <p>
            During the follicular phase, your brain&apos;s verbal and cognitive abilities are often at
            their peak.
          </p>
          <button className="learn-more-link" type="button" onClick={() => navigate("/knowledge")}>
            Learn more
          </button>
        </article>

        <article className="community-card">
          <h4>Community Buzz</h4>
          {data.communityTeaser.slice(0, 2).map((message) => (
            <p key={message.id}>
              <strong>{message.senderName}</strong> shared: {message.body}
            </p>
          ))}
          <button className="secondary-btn" type="button" onClick={() => navigate("/community")}>
            View Community
          </button>
        </article>
      </aside>
    </div>
  );
}
