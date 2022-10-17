import classNames from "classnames"
import Image from "next/image"
import styles from "styles/Home.module.scss"

export default function Home() {
  return (
    <div className="flex flex-col">
      <div className={classNames(styles.welcome, "pt-10 md:pt-20 md:flex")}>
        <div className="text-2xl md:text-5xl">Sustainable, community oriented, and adaptable node protocol on the <span>Binance Smart Chain</span></div>
        <div className="flex-grow m-10"><Image className="w-full flow-grow" src="/GreenNodelogo.png" width={421} height={421} /></div>
      </div>
      <div className={classNames(styles.blogs, "md:flex flex-wrap justify-between gap-10 md:pt-20")}>
        <div className="flex-1">
          <h2 className="flex-1 mb-4 mt-10 md:mt-0">Sustainability</h2>
          <p className="flex-1">
            One of the most significant values for the NodeGrid project is to offer a sustainable node investment vehicle. 
            We plan to achieve perennial sustainability through innovative holder incentives, a malleable protocol, and transparency. 
            The team is committed to continuously innovating, trialing new features, and evolving our way to a protocol that creates a mutually 
            beneficial scenario for all participants. The team knows it can realize our vision of a robust passive income opportunity that can 
            dominate within the DaaS space. To read more in depth regarding the specific strategies the team will implement please visit Strategic Plan and Roadmap.
          </p>
        </div>
        <div className="flex-1">
          <h2 className="flex-1  mb-4 mt-10 md:mt-0">Community Oriented</h2>
          <p className="flex-1">
            The protocol's success will be reliant on a strong and diverse community. This is an age old theme throughout the DeFi space. Without the ability 
            to rapidly expand the NodeGrid community at various times, the project faces the possibility to fail to carry the momentum necessary to overcome 
            price fluctuations. Maintaining community strength and engagement is of the utmost concerns of the team. We designed NodeGrid to be a mutually 
            beneficial experience for everyone involved.
          </p>
        </div>
        <div className="flex-1">
          <h2 className="flex-1  mb-4 mt-10 md:mt-0">Adaptability</h2>
          <p className="flex-1">
            Adaptability is a zero sum game. It is a necessity in order to remain relevant through continually evolving and fast paced markets. 
            Adaptability and community orientation are intertwined in the sense that NodeGrid will have to cater to the desires of the community members.
            If there is outpouring of support for a new feature to be implemented, best believe the we as the NodeGrid team will honor what our community members desire.
          </p>
        </div>
      </div>

      

      <div className={classNames(styles.howit, "pt-20 text-center")}>
        <h2 className="uppercase">How It Works</h2>
        <div className="md:flex justify-between gap-10 pt-5">
          <div className="w-full md:w-1/2">
            <p><span>Buy</span> NODEGRID tokens, <span>create a Nodes and </span>earn daily rewards.</p>
          </div>
          <div className="w-full md:w-1/2">
            <p>Our objective <span>is to help as many to generate passive income continuously with minimal effort. This is the reward people truly deserve and we are bringing this to you.</span></p>
          </div>
        </div>
        
        
      </div>
    </div>
  )
}
