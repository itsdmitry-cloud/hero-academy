'use client';

import React from 'react';
import Image from 'next/image';
import styles from './page.module.css';

export default function StudentTab() {
  return (
    <div className={styles.loreContainer}>
      
      {/* SECTION 1: WELCOME TO ACADEMY */}
      <section className={styles.loreSection}>
        <div className={styles.loreContent}>
          <h2 className={styles.loreTitle}>Добро пожаловать в Академию, Герой! 🎓✨</h2>
          <p className={styles.loreParagraph}>
            Ты — не просто ученик. Ты — Адепт магических искусств и защитник нашего мира от тёмных сил Невежества. 
            Твоя ручка — это твой меч, а твои знания — самое мощное заклинание. 
            В <span className={styles.highlightPrimary}>Hero Academy</span> каждое домашнее задание — это опасный квест, 
            а контрольная — эпичная битва с Боссом.
          </p>
          <p className={styles.loreParagraph}>
            Твоя цель — прокачать своего Героя до максимального <strong>100 Уровня</strong>, собрать Легендарные Артефакты 
            и привести свою Гильдию (класс) к победе в конце Сезона!
          </p>
        </div>
        <div className={styles.loreImageWrapper}>
          <Image src="/assets/wiki/academy.png" alt="Hero Academy" className={styles.loreImage} width={400} height={300} />
          <div className={styles.imageCaption}>Парящая техно-магическая цитадель Hero Academy</div>
        </div>
      </section>

      {/* SECTION 2: CORE RESOURCES (HP, XP, GOLD) */}
      <section className={`${styles.loreSection} ${styles.loreSectionReverse}`}>
        <div className={styles.loreImageWrapper}>
          <Image src="/assets/wiki/boss.png" alt="Boss Battle" className={styles.loreImage} width={400} height={300} />
          <div className={styles.imageCaption}>Сражение с Кибер-Драконом на контрольной</div>
        </div>
        <div className={styles.loreContent}>
          <h2 className={styles.loreTitle}>Три Столпа Силы ⚡</h2>
          
          <div className={styles.resourceCard}>
            <div className={`${styles.resourceIcon} ${styles.iconHp}`}>
              <span style={{ fontSize: 24 }}>❤️</span>
            </div>
            <div className={styles.resourceText}>
              <h3>Кристалл Жизни (HP) ❤️</h3>
              <p>
                Энергия твоей души. Ошибки в домашней работе или тестах наносят тебе <strong>Урон</strong>. 
                Если твоё HP опустится до нуля — твой Герой падет в обморок и вылетит из гонки до конца Сезона! 
                <em>Пей зелья, чтобы восстанавливать здоровье!</em>
              </p>
            </div>
          </div>

          <div className={styles.resourceCard}>
            <div className={`${styles.resourceIcon} ${styles.iconXp}`}>
              <span style={{ fontSize: 24 }}>⚡</span>
            </div>
            <div className={styles.resourceText}>
              <h3>Опыт (XP) ⚡</h3>
              <p>
                Ты получаешь XP за правильные ответы, сдачу квестов вовремя и урон по Боссам. 
                Накопив достаточно Опыта, твой Герой <strong>Повышает Уровень</strong>, становясь сильнее!
              </p>
            </div>
          </div>

          <div className={styles.resourceCard}>
            <div className={`${styles.resourceIcon} ${styles.iconGold}`}>
              <span style={{ fontSize: 24 }}>💰</span>
            </div>
            <div className={styles.resourceText}>
              <h3>Золото 💰</h3>
              <p>
                Единственная валюта Академии. Зарабатывай золото в подземельях и трать его в <strong>Магазине</strong> 
                на спасительные зелья или магические Лутбоксы.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: ARTIFACTS AND STREAKS */}
      <section className={styles.loreSection}>
        <div className={styles.loreContent}>
          <h2 className={styles.loreTitle}>Артефакты и Магия Дисциплины 🎁</h2>
          
          <div className={styles.mechanicList}>
            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>⚔️</span>
              <div>
                <h4>Эпичные Битвы с Боссами</h4>
                <p>Когда учитель объявляет контрольную — в Академию вторгается Босс. Решая задачи, ты и твои друзья наносите ему урон. Победите его — и весь класс получит огромную награду и сундуки с лутом!</p>
              </div>
            </div>

            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>🎁</span>
              <div>
                <h4>Волшебные Артефакты</h4>
                <p>Они выпадают из Лутбоксов (сундуков). Некоторые артефакты — это одноразовые зелья (например, +100 XP), а другие кладутся на <strong>Полку</strong> и дают мощные пассивные баффы (например, +20% к золоту или щит от ошибок).</p>
              </div>
            </div>

            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>🔥</span>
              <div>
                <h4>Магия Стрика (Серии)</h4>
                <p>Делай хотя бы один квест каждый день, чтобы растить свой <strong>Стрик 🔥</strong>. За серии в 3, 7, 14 и 30 дней Система выдаст тебе огромную гору опыта и бесплатные Лутбоксы редкого качества. Но пропустишь хоть день — и магия обнулится!</p>
              </div>
            </div>

            <div className={styles.mechanicItem}>
              <span className={styles.mechanicIcon} style={{ fontSize: 24 }}>🏆</span>
              <div>
                <h4>Битва Гильдий</h4>
                <p>Твой класс — это твоя Гильдия. Все заработанные вами XP идут в общую копилку. В конце Сезона (четверти) подводятся итоги: лучшие Гильдии Школы получают вечную славу и уникальные награды!</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.loreImageWrapper}>
          <Image src="/assets/wiki/loot.png" alt="Loot and Artifacts" className={styles.loreImage} width={400} height={300} />
          <div className={styles.imageCaption}>Древний сундук с магическими предметами и зельями восстановления</div>
        </div>
      </section>

      {/* FOOTER CALL TO ACTION */}
      <div className={styles.loreFooter}>
        <h3>Готов стать Легендой?</h3>
        <p>Открывай вкладку «Квесты», бери своё первое задание и отправляйся в путь!</p>
      </div>

    </div>
  );
}
