'use client';

import { StatCard } from '@/components/ui/StatCard';
import styles from './page.module.css';

// Subscription model: 500₽/month per student account
const PRICE_PER_MONTH = 500;

const mockRevenue = {
  mrr: 621500, // Monthly Recurring Revenue
  arr: 7458000,
  activeSubscriptions: 1243,
  newThisMonth: 87,
  churnedThisMonth: 14,
  churnRate: 1.13,
  avgLifetimeMonths: 8.4,
  ltv: 4200, // Lifetime Value per student
  trialActive: 156,
  trialConversion: 72,
  overduePayments: 23,
  overdueAmount: 11500,
  forecastNextMonth: 658000,
  forecastGrowth: '+5.9%',
};

const mockSchoolRevenue = [
  { school: 'Школа №42', students: 340, active: 328, overdue: 8, trial: 4, mrr: 164000, avgMonths: 10.2, churn: 0.8 },
  { school: 'Лицей "Альфа"', students: 220, active: 215, overdue: 3, trial: 2, mrr: 107500, avgMonths: 9.5, churn: 0.9 },
  { school: 'Гимназия №7', students: 280, active: 268, overdue: 6, trial: 6, mrr: 134000, avgMonths: 7.8, churn: 1.4 },
  { school: 'Школа №15', students: 180, active: 172, overdue: 4, trial: 4, mrr: 86000, avgMonths: 6.2, churn: 1.8 },
  { school: 'Школа №28', students: 223, active: 204, overdue: 2, trial: 17, mrr: 102000, avgMonths: 4.1, churn: 2.1 },
];

const mockDurationBreakdown = [
  { label: '< 1 мес. (триал)', count: 156, pct: 12.5, color: '#6b7280' },
  { label: '1–3 мес.', count: 210, pct: 16.9, color: '#3b82f6' },
  { label: '3–6 мес.', count: 285, pct: 22.9, color: '#22c55e' },
  { label: '6–12 мес.', count: 380, pct: 30.6, color: '#eab308' },
  { label: '> 12 мес.', count: 212, pct: 17.1, color: '#a855f7' },
];

const mockMonthlyRevenue = [
  { month: 'Сен', revenue: 490000 },
  { month: 'Окт', revenue: 520000 },
  { month: 'Ноя', revenue: 548000 },
  { month: 'Дек', revenue: 572000 },
  { month: 'Янв', revenue: 598000 },
  { month: 'Фев', revenue: 610000 },
  { month: 'Мар', revenue: 621500 },
];
const maxRev = Math.max(...mockMonthlyRevenue.map(m => m.revenue));

export default function SubscriptionsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className="text-display">💳 Подписки и доход</h1>
          <p className={styles.subtitle}>Стоимость подписки: {PRICE_PER_MONTH}₽/мес. на ученика</p>
        </div>
      </div>

      {/* Revenue KPIs */}
      <h3 className={styles.sectionTitle}>💰 Доход</h3>
      <div className={styles.kpiGrid}>
        <StatCard icon="💰" label="MRR" value={`${(mockRevenue.mrr / 1000).toFixed(0)}K ₽`} color="gold" desc="Ежемесячный повторяющийся доход" />
        <StatCard icon="📊" label="ARR" value={`${(mockRevenue.arr / 1000000).toFixed(1)}M ₽`} color="gold" desc="Годовой доход (MRR × 12)" />
        <StatCard icon="📈" label="Прогноз (след. мес.)" value={`${(mockRevenue.forecastNextMonth / 1000).toFixed(0)}K ₽`} color="streak" trend={mockRevenue.forecastGrowth} desc="Ожидаемый доход с учётом роста" />
        <StatCard icon="💎" label="LTV ученика" value={`${mockRevenue.ltv.toLocaleString()} ₽`} color="xp" desc="Сколько платит 1 ученик за всё время" />
      </div>

      {/* Subscribers KPIs */}
      <h3 className={styles.sectionTitle}>👥 Подписчики</h3>
      <div className={styles.kpiGrid}>
        <StatCard icon="✅" label="Активных подписок" value={mockRevenue.activeSubscriptions} color="streak" desc="Оплаченных учеников прямо сейчас" />
        <StatCard icon="🆕" label="Новых за месяц" value={`+${mockRevenue.newThisMonth}`} color="primary" desc="Подключились в текущем месяце" />
        <StatCard icon="📉" label="Отток (Churn)" value={`${mockRevenue.churnRate}%`} color="hp" desc="% учеников отписавшихся за месяц" />
        <StatCard icon="⏳" label="Ср. подписка" value={`${mockRevenue.avgLifetimeMonths} мес.`} color="info" desc="Среднее время жизни подписки" />
      </div>

      {/* Payments KPIs */}
      <h3 className={styles.sectionTitle}>⚠️ Оплаты</h3>
      <div className={styles.kpiGrid}>
        <StatCard icon="🔴" label="Просрочено" value={mockRevenue.overduePayments} color="hp" desc="Учеников с истёкшей оплатой" />
        <StatCard icon="💸" label="Сумма долга" value={`${(mockRevenue.overdueAmount / 1000).toFixed(1)}K ₽`} color="hp" desc="Деньги которые могут не поступить" />
        <StatCard icon="🎁" label="На триале" value={mockRevenue.trialActive} color="info" desc="Бесплатный пробный период" />
        <StatCard icon="🔄" label="Конверсия триала" value={`${mockRevenue.trialConversion}%`} color="streak" desc="% кто оплатил после пробного" />
      </div>

      {/* Revenue Chart */}
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <h3>📈 Динамика MRR (6 мес.)</h3>
          <div className={styles.chartArea}>
            {mockMonthlyRevenue.map((m, i) => (
              <div key={i} className={styles.revenueCol}>
                <div className={styles.revenueBar} style={{ height: `${(m.revenue / maxRev) * 100}%` }}>
                  <span className={styles.revenueVal}>{(m.revenue / 1000).toFixed(0)}K</span>
                </div>
                <span className={styles.revenueLabel}>{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.chartCard}>
          <h3>⏳ Длительность подписок</h3>
          <div className={styles.durationList}>
            {mockDurationBreakdown.map((d, i) => (
              <div key={i} className={styles.durationRow}>
                <div className={styles.durationInfo}>
                  <span className={styles.durationDot} style={{ background: d.color }} />
                  <span>{d.label}</span>
                  <span className={styles.durationCount}>{d.count} уч.</span>
                </div>
                <div className={styles.durationBarWrap}>
                  <div className={styles.durationBarFill} style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <span className={styles.durationPct}>{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue by School */}
      <h3 className={styles.sectionTitle}>🏫 Доход по школам</h3>
      <div className={styles.tableWrap}>
        <div className={styles.tHeader}>
          <span>Школа</span>
          <span>Учеников</span>
          <span>Активных</span>
          <span>Просроч.</span>
          <span>Триал</span>
          <span>MRR</span>
          <span>Ср. подписка</span>
          <span>Отток</span>
        </div>
        {mockSchoolRevenue.map((s, i) => (
          <div key={i} className={styles.tRow}>
            <span className={styles.schoolName}>{s.school}</span>
            <span>{s.students}</span>
            <span className={styles.activeCount}>{s.active}</span>
            <span className={s.overdue > 5 ? styles.dangerVal : ''}>{s.overdue}</span>
            <span>{s.trial}</span>
            <span className={styles.revenueCell}>{(s.mrr / 1000).toFixed(0)}K ₽</span>
            <span>{s.avgMonths} мес.</span>
            <span className={`${styles.churnCell} ${s.churn > 1.5 ? styles.dangerVal : s.churn > 1.0 ? styles.warnVal : styles.goodVal}`}>
              {s.churn}%
            </span>
          </div>
        ))}
        <div className={styles.tFooter}>
          <span>ИТОГО</span>
          <span>{mockSchoolRevenue.reduce((a, s) => a + s.students, 0)}</span>
          <span>{mockSchoolRevenue.reduce((a, s) => a + s.active, 0)}</span>
          <span>{mockSchoolRevenue.reduce((a, s) => a + s.overdue, 0)}</span>
          <span>{mockSchoolRevenue.reduce((a, s) => a + s.trial, 0)}</span>
          <span className={styles.revenueCell}>{(mockSchoolRevenue.reduce((a, s) => a + s.mrr, 0) / 1000).toFixed(0)}K ₽</span>
          <span>{(mockSchoolRevenue.reduce((a, s) => a + s.avgMonths, 0) / mockSchoolRevenue.length).toFixed(1)} мес.</span>
          <span>{(mockSchoolRevenue.reduce((a, s) => a + s.churn, 0) / mockSchoolRevenue.length).toFixed(1)}%</span>
        </div>
      </div>

      {/* Forecast */}
      <div className={styles.forecastSection}>
        <h3 className={styles.sectionTitle}>🔮 Прогноз на 3 месяца</h3>
        <div className={styles.forecastGrid}>
          <div className={styles.forecastCard}>
            <span className={styles.forecastMonth}>Апрель 2026</span>
            <span className={styles.forecastAmount}>658K ₽</span>
            <span className={styles.forecastStudents}>~1 316 уч.</span>
            <span className={styles.forecastNote}>+73 новых −14 ушло</span>
          </div>
          <div className={styles.forecastCard}>
            <span className={styles.forecastMonth}>Май 2026</span>
            <span className={styles.forecastAmount}>694K ₽</span>
            <span className={styles.forecastStudents}>~1 388 уч.</span>
            <span className={styles.forecastNote}>+86 новых −14 ушло</span>
          </div>
          <div className={styles.forecastCard}>
            <span className={styles.forecastMonth}>Июнь 2026</span>
            <span className={styles.forecastAmount}>710K ₽</span>
            <span className={styles.forecastStudents}>~1 420 уч.</span>
            <span className={styles.forecastNote}>⚠️ Сезон может снизить −5%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
