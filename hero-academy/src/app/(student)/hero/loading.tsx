import styles from './page.module.css';
import skeletonStyles from './loading.module.css';

export default function HeroLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <section className={styles.heroSection}>
        <div className={skeletonStyles.heroCard}>
          <div className={skeletonStyles.avatar} />
          <div className={skeletonStyles.column}>
            <div className={`${skeletonStyles.line} ${skeletonStyles.lineLg}`} />
            <div className={`${skeletonStyles.line} ${skeletonStyles.lineSm}`} />
            <div className={skeletonStyles.bars}>
              <div className={skeletonStyles.bar} />
              <div className={skeletonStyles.bar} />
            </div>
          </div>
        </div>
      </section>

      <div className={skeletonStyles.tilesRow}>
        <div className={skeletonStyles.tile} />
        <div className={skeletonStyles.tile} />
        <div className={skeletonStyles.tile} />
      </div>

      <div className={skeletonStyles.block} />
      <div className={skeletonStyles.block} />
    </div>
  );
}
