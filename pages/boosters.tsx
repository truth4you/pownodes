import classNames from "classnames"
import styles from "styles/Boosters.module.scss"

export default function Mint() {
  return (
    <div className={styles.boosters}>
      <div className={styles.header}>
        <h1>Boosters</h1>
        <div>
          <h2>My Boosters</h2>
          <ul>
            <li>10 $POWN</li>
            <li>250% APR</li>
            <li>Earn 10 $POWN / DAY</li>
            <li><button>Mint</button></li>
          </ul>
        </div>
      </div>
      <div className={styles.content}>
      </div>
    </div>
  )
}