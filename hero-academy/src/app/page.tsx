import Link from 'next/link';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>🎮 RPG × Образование</div>
          <h1 className={`${styles.title} text-display`}>
            Hero<br />
            <span className="text-gradient">Academy</span>
          </h1>
          <p className={styles.subtitle}>
            Превращай учёбу в приключение. Домашка — это квест. Тест — битва с боссом. Каждый ответ — шаг к победе.
          </p>
          <div className={styles.actions}>
            <Link href="/auth/login" className={styles.btnPrimary} id="landing-login">
              Войти
            </Link>
            <Link href="/auth/join" className={styles.btnSecondary} id="landing-join">
              У меня есть код класса
            </Link>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroEmoji}>🧙‍♂️</div>
          <div className={styles.particles}>
            <span className={styles.particle}>⭐</span>
            <span className={styles.particle}>💎</span>
            <span className={styles.particle}>⚔️</span>
            <span className={styles.particle}>🔥</span>
            <span className={styles.particle}>🛡️</span>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>📚</span>
          <h3>Квесты</h3>
          <p>Домашние задания стали интересными квестами с наградами</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>🐉</span>
          <h3>Боссы</h3>
          <p>Контрольные — это командные битвы с боссом</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>💎</span>
          <h3>Артефакты</h3>
          <p>Собирай редкие предметы и усиливай своего героя</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>🏆</span>
          <h3>Рейтинг</h3>
          <p>Соревнуйся с одноклассниками и другими школами</p>
        </div>
      </section>

      {/* Roles */}
      <section className={styles.roles}>
        <h2 className="text-display">Для всех участников</h2>
        <div className={styles.roleGrid}>
          <div className={styles.roleCard}>
            <span className={styles.roleIcon}>🧑‍🎓</span>
            <h3>Ученик</h3>
            <p>Выполняй квесты, прокачивай героя, побеждай боссов</p>
          </div>
          <div className={styles.roleCard}>
            <span className={styles.roleIcon}>👩‍🏫</span>
            <h3>Учитель</h3>
            <p>Создавай задания, управляй наградами, следи за прогрессом</p>
          </div>
          <div className={styles.roleCard}>
            <span className={styles.roleIcon}>👨‍👩‍👧</span>
            <h3>Родитель</h3>
            <p>Следи за успехами ребёнка в режиме реального времени</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>🏰 Hero Academy © 2026</span>
        <Link href="/hero">Demo →</Link>
      </footer>
    </div>
  );
}
