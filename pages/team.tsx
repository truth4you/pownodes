import classNames from "classnames"
import Image from "next/image"
import styles from "styles/Team.module.scss"

export default function Team() {
  return (
    <div className="flex flex-col">
      <div className={classNames(styles.welcome, "pt-10 md:pt-20 md:flex")}>
        <div className="text-2xl md:text-5xl">Meet our <span>fully doxxed</span> team members</div>
        <div className="m-10 hidden md:block"><Image className="" src="/basic.png" alt="basic" width={143} height={143} /></div>
      </div>

      <div className={classNames(styles.blogs, "md:flex flex-wrap justify-between gap-10 md:pt-10")}>
        <div className="flex-1">
          <h2 className="flex mb-4 justify-center">Team Member 1</h2>
          <p className="flex justify-center">
            <Image className={classNames(styles.teamMember)} src="/team/team1.png" alt="team" width={350} height={350} />
          </p>
        </div>

        <div className="flex-1 mt-20 md:mt-0">
          <h2 className="flex mb-4 justify-center">Team Member 2</h2>
          <p className="flex justify-center">
            <Image className={classNames(styles.teamMember)} src="/team/team1.png" alt="team" width={350} height={350} />
          </p>
        </div>

        <div className="flex-1 mt-20 md:mt-0">
          <h2 className="flex mb-4 justify-center">Team Member 3</h2>
          <p className="flex justify-center">
            <Image className={classNames(styles.teamMember)} src="/team/team1.png" alt="team" width={350} height={350} />
          </p>
        </div>
      </div>

    </div>
  )
}
