'use client';

import styles from './ActionBreakdown.module.css';

export interface ActionBreakdownProps {
  action: string;
  metadata: Record<string, unknown> | null;
  xpChange: number | null;
  hpChange: number | null;
  goldChange: number | null;
  showRawJson?: boolean;
  borderColor?: string;
}

const RARITY_EMOJI: Record<string, string> = {
  common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟡',
};

const RARITY_LABEL: Record<string, string> = {
  common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный',
};

function Row({ label, value, dim }: { label: string; value: string | number; dim?: boolean }) {
  return (
    <div className={`${styles.row} ${dim ? styles.rowDim : ''}`}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

function Total({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <>
      <div className={styles.divider} />
      <div className={styles.totalRow}>
        <span className={styles.totalLabel} style={{ color }}>{label}</span>
        <span className={styles.totalValue} style={{ color }}>{value}</span>
      </div>
    </>
  );
}

function RichBreakdown({ breakdown }: { breakdown: Record<string, unknown> }) {
  const xp = breakdown.xp as Record<string, unknown> | null;
  const hp = breakdown.hp as Record<string, unknown> | null;
  const gold = breakdown.gold as Record<string, unknown> | null;
  const cleanArt = (n: string) => n.split(' (')[0];

  return (
    <>
      <div className={styles.columns}>
        {xp && (
          <div className={styles.column}>
            <span className={styles.columnTitle} style={{ color: 'var(--accent-xp)' }}>⭐ Опыт</span>
            <Row label="Базовое" value={Number(xp.base)} />
            <Row label={`Баланс ×${xp.balancePct}%`} value={`→ ${xp.afterBalance}`} dim />
            {Boolean(xp.artBoost) && (
              <Row
                label={`Арт. +${String(xp.artBoost)}%${Array.isArray(xp.artNames) && xp.artNames.length > 0 ? ` (${xp.artNames.map((n: string) => cleanArt(n)).join(', ')})` : ''}`}
                value={`→ ${String(xp.afterArt)}`}
                dim
              />
            )}
            <Row label={`Рандом ${Number(xp.randomPct) >= 0 ? '+' : ''}${xp.randomPct}%`} value={`→ ${xp.final}`} dim />
            <Total label="Итого" value={`+${String(xp.final)} XP = ⚔️ Урон`} color="var(--accent-xp)" />
          </div>
        )}
        {hp && (
          <div className={styles.column}>
            <span className={styles.columnTitle} style={{ color: '#f87171' }}>❤️ Урон</span>
            {Number(hp.base) === 0 ? (
              <>
                <Row label="Базовое" value={0} />
                <Total label="Итого" value="-0 HP" color="#4ade80" />
              </>
            ) : (
              <>
                <Row label="Базовое" value={Number(hp.base)} />
                <Row label={`Баланс ×${hp.balancePct}%`} value={`→ ${hp.afterBalance}`} dim />
                {hp.shield ? (
                  <>
                    <Row label="🛡️ Щит" value={String(hp.shield)} />
                    <Row label="Заряд -1" value="Заблокировано" />
                  </>
                ) : hp.passivePct ? (
                  <Row
                    label={`Защита -${hp.passivePct}%`}
                    value={`→ ${Math.round(Number(hp.afterBalance) * (1 - Number(hp.passivePct) / 100))}`}
                    dim
                  />
                ) : null}
                {!hp.shield && (
                  <Row label={`Рандом ${Number(hp.randomPct) >= 0 ? '+' : ''}${hp.randomPct}%`} value={`→ ${hp.final}`} dim />
                )}
                {Boolean(hp.undoCrit) && (
                  <>
                    <Row label="⏪ Отмена смерти" value={String(hp.undoCrit)} />
                    <Row label="Заряд -1" value="Обнулён" />
                  </>
                )}
                {Boolean(hp.deathSaved) && (
                  <>
                    <Row label="🔥 Выживание" value={String(hp.deathSaved)} />
                    <Row label="Заряд -1" value="Спасён" />
                  </>
                )}
                <Total
                  label="Итого"
                  value={hp.shield ? '0 HP 🛡️' : hp.undoCrit ? '0 HP ⏪' : hp.deathSaved ? `Спасён 🔥` : `-${hp.final} HP`}
                  color={hp.shield || hp.undoCrit ? '#4ade80' : hp.deathSaved ? '#fbbf24' : '#f87171'}
                />
              </>
            )}
          </div>
        )}
      </div>
      {gold && (
        <div className={styles.columns}>
          <div className={styles.column}>
            <span className={styles.columnTitle} style={{ color: 'var(--accent-gold)' }}>💰 Золото</span>
            <Row label="Базовое" value={Number(gold.base)} />
            <Row label={`Баланс ×${gold.balancePct}%`} value={`→ ${gold.afterBalance}`} dim />
            {Boolean(gold.artBoost) && (
              <Row
                label={`Арт. +${String(gold.artBoost)}%${Array.isArray(gold.artNames) && gold.artNames.length > 0 ? ` (${gold.artNames.map((n: string) => cleanArt(n)).join(', ')})` : ''}`}
                value={`→ ${String(gold.final)}`}
                dim
              />
            )}
            <Total label="Итого" value={`+${String(gold.final)}`} color="var(--accent-gold)" />
          </div>
        </div>
      )}
    </>
  );
}

function PipelineList({ pipeline }: { pipeline: string[] }) {
  return (
    <div className={styles.pipelineList}>
      {pipeline.map((line, i) => {
        const isFinal = i === pipeline.length - 1;
        return (
          <span key={i} className={isFinal ? styles.pipelineLineFinal : styles.pipelineLine}>
            {line}
          </span>
        );
      })}
    </div>
  );
}

function MiniCard({ lines }: { lines: string[] }) {
  return (
    <div className={styles.miniCard}>
      {lines.map((l, i) => (
        <span key={i} className={styles.miniLine}>{l}</span>
      ))}
    </div>
  );
}

function renderActionSpecific(
  action: string,
  meta: Record<string, unknown>,
  xpChange: number | null,
  hpChange: number | null,
  goldChange: number | null,
): string[] | null {
  if (action === 'artifact_drop') {
    const rar = String(meta.rarity ?? 'common');
    const src = meta.source === 'boss_kill' ? 'убийства босса' : 'задания';
    return [`🎁 ${meta.artifact ?? 'Артефакт'} (${RARITY_EMOJI[rar] ?? '⚪'} ${RARITY_LABEL[rar] ?? rar})`, `Источник: ${src}`];
  }
  if (action === 'lootbox_opened' || action === 'seasonal_lootbox_opened') {
    const lines = [`📦 ${meta.box_name ?? 'Лутбокс'}`];
    if (meta.gold) lines.push(`💰 +${String(meta.gold)} золота`);
    if (meta.xp) lines.push(`⭐ +${String(meta.xp)} XP`);
    if (Array.isArray(meta.items_received)) {
      (meta.items_received as unknown[]).forEach(it => lines.push(`• ${String(it)}`));
    }
    return lines;
  }
  if (action === 'shop_purchase') {
    return [`🛒 Куплено: ${meta.item ?? '?'}`, `Цена: ${String(meta.price ?? '?')} 💰`];
  }
  if (action === 'potion_used') {
    const lines = [`⚗️ ${meta.item ?? meta.artifact ?? 'Расходник'}`];
    if (meta.effect) lines.push(`Эффект: ${String(meta.effect)}`);
    return lines;
  }
  if (action === 'boss_damage') {
    const subj = String(meta.subject ?? meta.boss_name ?? 'Босс');
    const dmg = Number(meta.damage_dealt ?? 0);
    return [`🐉 Босс: ${subj}`, `⚔️ Урон: ${dmg.toLocaleString('ru-RU')}`];
  }
  if (action === 'boss_kill_reward') {
    const lines: string[] = [];
    if (meta.is_mvp) lines.push('👑 MVP — наибольший урон в классе');
    if (meta.is_last_hit) lines.push('🗡️ Последний удар — бонус +1000 XP');
    if (meta.damage_dealt) lines.push(`⚔️ Нанесено урона: ${String(meta.damage_dealt)}`);
    if (Array.isArray(meta.level_ups)) (meta.level_ups as number[]).forEach(l => lines.push(`🆙 Уровень ${l}`));
    if (xpChange) lines.push(`⭐ +${xpChange} XP`);
    if (goldChange) lines.push(`💰 +${goldChange} золота`);
    return lines.length > 0 ? lines : null;
  }
  if (action === 'streak_reward' || action === 'streak_update' || action === 'streak_bonus') {
    const days = meta.days ?? meta.streak ?? '?';
    const lines = [`🔥 Стрик: ${String(days)} дней`];
    if (xpChange) lines.push(`⭐ +${xpChange} XP`);
    if (goldChange) lines.push(`💰 +${goldChange} золота`);
    return lines;
  }
  if (action === 'class_artifact_used' || action === 'team_artifact_activated') {
    const actor = String(meta.activator_name ?? 'Одноклассник');
    const art = String(meta.artifact ?? 'Артефакт');
    const lines = [`✨ ${actor} применил «${art}»`];
    if (meta.effect_value) lines.push(`Эффект: +${String(meta.effect_value)}%`);
    if (meta.duration_hours) lines.push(`Длительность: ${String(meta.duration_hours)}ч`);
    return lines;
  }
  if (action === 'level_up') {
    return [`🆙 Уровень: ${String(meta.level ?? '?')}`];
  }
  if (action === 'passive_regen') {
    return [`💚 +${hpChange ?? 0} HP (пассивная регенерация)`];
  }
  if (action === 'bp_reward_claimed') {
    return [`🎫 Боевой пропуск — ур. ${String(meta.tier ?? '?')}`, `Награда: ${String(meta.reward ?? '?')}`];
  }
  if (action === 'admin_undo') {
    return [`↩️ Отменено действие: ${String(meta.original_action ?? '?')}`];
  }
  return null;
}

export function ActionBreakdown({
  action, metadata, xpChange, hpChange, goldChange, showRawJson = false, borderColor,
}: ActionBreakdownProps) {
  const meta = metadata ?? {};

  let body: React.ReactNode = null;

  if (meta.breakdown && typeof meta.breakdown === 'object') {
    body = <RichBreakdown breakdown={meta.breakdown as Record<string, unknown>} />;
  } else if (Array.isArray(meta.pipeline) && (meta.pipeline as string[]).length > 0) {
    body = <PipelineList pipeline={meta.pipeline as string[]} />;
  } else {
    const lines = renderActionSpecific(action, meta, xpChange, hpChange, goldChange);
    if (lines && lines.length > 0) {
      body = <MiniCard lines={lines} />;
    } else if (typeof meta.reason === 'string' && meta.reason) {
      body = <MiniCard lines={[String(meta.reason)]} />;
    } else {
      body = <MiniCard lines={['(нет деталей)']} />;
    }
  }

  return (
    <div
      className={styles.container}
      style={borderColor ? { borderTopColor: borderColor } : undefined}
    >
      {body}
      {showRawJson && (
        <details className={styles.rawJson}>
          <summary>Raw JSON</summary>
          <pre>{JSON.stringify({ action, metadata, xpChange, hpChange, goldChange }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
