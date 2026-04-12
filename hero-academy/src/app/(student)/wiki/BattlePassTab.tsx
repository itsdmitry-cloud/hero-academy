'use client';

import React from 'react';
import Image from 'next/image';
import styles from './page.module.css';

export default function BattlePassTab() {
  return (
    <div className={styles.loreContainer}>

      {/* SECTION 1: BATTLE PASS INTRO */}
      <section className={styles.loreSection}>
        <div className={styles.loreContent}>
          <h2 className={styles.loreTitle}>Боевой Пропуск Стихий 🔥❄️🌿💧</h2>
          <p className={styles.loreParagraph}>
            Каждый Сезон (учебный чреверть) в Академии пробуждается древняя сила одного из{' '}
            <span className={styles.highlightPrimary}>Четырёх Первоэлементов</span>.
            Огонь, Лёд, Земля или Вода — стихия определяет тему всего Сезона,
            вид наград и облик Сезонных Сундуков.
          </p>
          <p className={styles.loreParagraph}>
            Боевой Пропуск — это твоя <strong>сезонная дорога наград</strong>.
            Просто учись, решай квесты и набирай XP — шкала Пропуска заполняется автоматически.
            Каждый новый уровень Пропуска приносит золото, артефакты, Сезонные Сундуки
            или редкие <strong>коллекционные реликвии</strong>, которые навсегда останутся в твоём Зале Славы.
          </p>
        </div>
        <div className={styles.loreImageWrapper}>
          <Image src="/assets/ui/bp_fire_chest.png" alt="Огненный Сундук" className={styles.loreImage} width={400} height={300} />
          <div className={styles.imageCaption}>🔥 Огненный Сундук — награда Сезона Пламени</div>
        </div>
      </section>

      {/* SECTION 2: HOW IT WORKS */}
      <section className={`${styles.loreSection} ${styles.loreSectionReverse}`}>
        <div className={styles.loreImageWrapper}>
          <Image src="/assets/ui/bp_reward_track.png" alt="Лента наград" className={styles.loreImage} width={400} height={300} />
          <div className={styles.imageCaption}>Путь Героя через 30 уровней Боевого Пропуска</div>
        </div>
        <div className={styles.loreContent}>
          <h2 className={styles.loreTitle}>Как это работает? 📜</h2>

          <div className={styles.mechanicList}>
            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>📈</span>
              <div>
                <h4>30 Уровней Пропуска</h4>
                <p>Пропуск содержит 30 уровней. Первые уровни открываются быстро (по 250 XP),
                а ближе к концу потребуется больше усилий. Общая цель — <strong>15 000 XP</strong> за Сезон.</p>
              </div>
            </div>

            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>⚡</span>
              <div>
                <h4>XP = Прогресс</h4>
                <p>Твой <strong>Сезонный XP</strong> растёт параллельно с основным XP уровня.
                Каждая оценка, каждый удар по Боссу, каждая награда от учителя
                автоматически добавляет очки в шкалу Пропуска.</p>
              </div>
            </div>

            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>🎁</span>
              <div>
                <h4>Забирай Награды</h4>
                <p>Нажми на виджет Пропуска на экране Героя, чтобы открыть ленту наград.
                Если уровень достигнут — жми кнопку <strong>«🎁 Забрать»</strong> и получи приз прямо в рюкзак!</p>
              </div>
            </div>

            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>🔄</span>
              <div>
                <h4>Сезонный Сброс</h4>
                <p>В конце каждого Сезона (четверти) шкала Пропуска обнуляется, и начинается
                <strong> новая Стихия</strong>. Но все заработанные коллекционные реликвии остаются навсегда!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: SEASONS */}
      <section className={styles.loreSection}>
        <div className={styles.loreContent}>
          <h2 className={styles.loreTitle}>Четыре Стихии 🌍</h2>
          <p className={styles.loreParagraph}>
            Каждый Сезон приносит с собой силу новой Стихии. Стихия определяет внешний вид
            Сезонных Сундуков и коллекционных реликвий, которые ты можешь заработать:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
            <div className={styles.resourceCard}>
              <div className={`${styles.resourceIcon}`} style={{ background: 'rgba(239,68,68,0.15)' }}>
                <span style={{ fontSize: 28 }}>🔥</span>
              </div>
              <div className={styles.resourceText}>
                <h3 style={{ color: '#ef4444' }}>Осень — Огонь</h3>
                <p>Огненные Сундуки · Сердце Дракона 🐉</p>
              </div>
            </div>

            <div className={styles.resourceCard}>
              <div className={`${styles.resourceIcon}`} style={{ background: 'rgba(59,130,246,0.15)' }}>
                <span style={{ fontSize: 28 }}>❄️</span>
              </div>
              <div className={styles.resourceText}>
                <h3 style={{ color: '#3b82f6' }}>Зима — Лёд</h3>
                <p>Ледяные Сундуки · Кристалл Вечной Мерзлоты ❄️</p>
              </div>
            </div>

            <div className={styles.resourceCard}>
              <div className={`${styles.resourceIcon}`} style={{ background: 'rgba(34,197,94,0.15)' }}>
                <span style={{ fontSize: 28 }}>🌿</span>
              </div>
              <div className={styles.resourceText}>
                <h3 style={{ color: '#22c55e' }}>Весна — Земля</h3>
                <p>Земляные Сундуки · Камень Жизни 🌿</p>
              </div>
            </div>

            <div className={styles.resourceCard}>
              <div className={`${styles.resourceIcon}`} style={{ background: 'rgba(99,102,241,0.15)' }}>
                <span style={{ fontSize: 28 }}>💧</span>
              </div>
              <div className={styles.resourceText}>
                <h3 style={{ color: '#6366f1' }}>Лето — Вода</h3>
                <p>Водяные Сундуки · Трезубец Посейдона 🔱</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: REWARDS & HALL OF FAME */}
      <section className={`${styles.loreSection} ${styles.loreSectionReverse}`}>
        <div className={styles.loreImageWrapper}>
          <Image src="/assets/ui/bp_hall_of_fame.png" alt="Зал Славы" className={styles.loreImage} width={400} height={300} />
          <div className={styles.imageCaption}>Зал Славы — витрина твоих легендарных реликвий</div>
        </div>
        <div className={styles.loreContent}>
          <h2 className={styles.loreTitle}>Награды и Зал Славы 🏆</h2>

          <div className={styles.mechanicList}>
            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>💰</span>
              <div>
                <h4>Золото</h4>
                <p>Большинство уровней приносят золото — от 50 до 750 монет. Потрать их в Магазине на зелья или артефакты!</p>
              </div>
            </div>

            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>📦</span>
              <div>
                <h4>Сезонные Сундуки</h4>
                <p>На ключевых рубежах (5, 10, 15, 25 уровни) выдаются <strong>Сезонные Сундуки</strong>.
                Их содержимое зависит от уровня твоего Героя — чем выше уровень, тем лучше лут!</p>
              </div>
            </div>

            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>✨</span>
              <div>
                <h4>Коллекционные Реликвии</h4>
                <p>На уровнях 10, 20 и 30 ты получаешь <strong>сезонные реликвии</strong> — уникальные значки,
                которые хранятся в твоём Зале Славы навечно. Собери все 4 стихии!</p>
              </div>
            </div>

            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>🐉</span>
              <div>
                <h4>Финальная Реликвия (Уровень 30)</h4>
                <p>Пройди весь Пропуск до конца и получи легендарную Реликвию Стихии:
                Сердце Огненного Дракона, Кристалл Вечной Мерзлоты, Камень Жизни или Трезубец Посейдона.
                <strong> Только сильнейшие Адепты заполняют все 30 уровней!</strong></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TIPS */}
      <div className={styles.loreFooter}>
        <h3>💡 Совет Мудреца</h3>
        <p>Старайся решать хотя бы 2 задания каждый день — тогда к концу Сезона ты точно пройдёшь
        все 30 уровней и получишь Легендарную Реликвию. Не забывай заглядывать в Пропуск и забирать награды!</p>
      </div>

    </div>
  );
}
