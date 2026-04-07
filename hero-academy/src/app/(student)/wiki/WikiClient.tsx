'use client';

import React, { useState } from 'react';
import styles from './page.module.css';
import ArtifactsTab from './ArtifactsTab';
import StudentTab from './StudentTab';
import BattlePassTab from './BattlePassTab';

export default function WikiClient() {
  const [activeTab, setActiveTab] = useState<'artifacts' | 'student' | 'battlepass'>('artifacts');

  return (
    <div className={styles.page}>
      
      <header className={styles.header}>
        <h1 className={`${styles.mainTitle} text-display`}>Энциклопедия Академии</h1>
        <p className={styles.mainSubtitle}>
          Изучай артефакты и правила нашей магической вселенной.
        </p>
        
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'artifacts' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('artifacts')}
          >
            <span className={styles.tabIcon}>🛡️</span>
            Артефакты
          </button>
          
          <button 
            className={`${styles.tabBtn} ${activeTab === 'student' ? styles.tabActiveStudent : ''}`}
            onClick={() => setActiveTab('student')}
          >
            <span className={styles.tabIcon}>📖</span>
            Ученику
          </button>

          <button 
            className={`${styles.tabBtn} ${activeTab === 'battlepass' ? styles.tabActiveStudent : ''}`}
            onClick={() => setActiveTab('battlepass')}
          >
            <span className={styles.tabIcon}>🔥</span>
            Пропуск
          </button>
        </div>
      </header>

      <div className={styles.contentArea}>
        {activeTab === 'artifacts' && <ArtifactsTab />}
        {activeTab === 'student' && <StudentTab />}
        {activeTab === 'battlepass' && <BattlePassTab />}
      </div>

    </div>
  );
}
