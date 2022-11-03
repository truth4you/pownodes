import Link from "next/link" // Dynamic routing
import Image from "next/image" // Images
import { eth } from "state/eth" // Global state
import { useEffect, useState } from "react" // State management
import Dropdown from 'react-dropdown'
import 'react-dropdown/style.css'
import cn from "classnames"
import styles from "styles/Header.module.scss" // Component styles
import Router from "next/router"
import { token } from "state/token"

const IconTwitter = () =>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.6425 4.93695C22.8075 5.30695 21.9105 5.55696 20.9675 5.66996C21.9405 5.08775 22.6685 4.17142 23.0155 3.09195C22.1014 3.63494 21.1009 4.01715 20.0575 4.22196C19.3559 3.47282 18.4266 2.97628 17.4138 2.80943C16.4011 2.64258 15.3616 2.81475 14.4568 3.29921C13.5519 3.78367 12.8323 4.55332 12.4097 5.48866C11.9871 6.424 11.8851 7.4727 12.1195 8.47195C10.2672 8.37895 8.45515 7.8975 6.80095 7.05886C5.14674 6.22022 3.68736 5.04312 2.51752 3.60396C2.11752 4.29396 1.88752 5.09396 1.88752 5.94596C1.88708 6.71295 2.07596 7.4682 2.4374 8.14469C2.79885 8.82118 3.32168 9.39799 3.95952 9.82396C3.2198 9.80042 2.4964 9.60054 1.84952 9.24095V9.30095C1.84945 10.3767 2.22156 11.4193 2.90271 12.252C3.58386 13.0846 4.53209 13.6559 5.58652 13.869C4.90031 14.0547 4.18086 14.082 3.48252 13.949C3.78002 14.8746 4.35952 15.684 5.13989 16.2639C5.92026 16.8438 6.86244 17.1651 7.83452 17.183C6.18436 18.4784 4.14641 19.181 2.04852 19.178C1.6769 19.1781 1.3056 19.1564 0.936523 19.113C3.066 20.4821 5.54486 21.2088 8.07652 21.206C16.6465 21.206 21.3315 14.108 21.3315 7.95195C21.3315 7.75196 21.3265 7.54995 21.3175 7.34995C22.2288 6.69093 23.0154 5.87485 23.6405 4.93995L23.6425 4.93695Z" fill="white" />
  </svg>

const IconDiscord = () =>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_1_185)">
      <path d="M20.3175 4.49197C18.7875 3.80197 17.1475 3.29197 15.4325 3.00197C15.4172 2.99904 15.4014 3.00093 15.3872 3.00738C15.3731 3.01383 15.3613 3.02452 15.3535 3.03797C15.1435 3.40697 14.9095 3.88797 14.7455 4.26797C12.9266 3.99621 11.0774 3.99621 9.25848 4.26797C9.07582 3.84683 8.86983 3.4362 8.64148 3.03797C8.63374 3.02436 8.62203 3.01342 8.60792 3.00663C8.5938 2.99984 8.57795 2.99752 8.56248 2.99997C6.84848 3.28997 5.20848 3.79997 3.67748 4.49097C3.66431 4.4965 3.65314 4.50592 3.64548 4.51797C0.533481 9.09297 -0.319519 13.555 0.0994806 17.961C0.100647 17.9718 0.103996 17.9822 0.109326 17.9917C0.114655 18.0011 0.121853 18.0094 0.130481 18.016C1.94687 19.3384 3.97282 20.3458 6.12348 20.996C6.13847 21.0006 6.15451 21.0006 6.16949 20.9959C6.18448 20.9913 6.19772 20.9823 6.20748 20.97C6.67028 20.351 7.08038 19.6944 7.43348 19.007C7.43838 18.9976 7.44121 18.9872 7.44176 18.9766C7.44232 18.9661 7.4406 18.9555 7.43671 18.9456C7.43282 18.9358 7.42686 18.9268 7.41923 18.9195C7.4116 18.9121 7.40248 18.9065 7.39248 18.903C6.74649 18.6597 6.12057 18.3661 5.52048 18.025C5.5097 18.0188 5.50061 18.0101 5.49404 17.9995C5.48746 17.989 5.48361 17.977 5.48281 17.9646C5.48202 17.9522 5.48432 17.9398 5.48949 17.9286C5.49467 17.9173 5.50257 17.9075 5.51248 17.9C5.63848 17.807 5.76448 17.71 5.88448 17.613C5.89528 17.6043 5.90829 17.5987 5.92206 17.5969C5.93584 17.5952 5.94983 17.5973 5.96248 17.603C9.88948 19.367 14.1425 19.367 18.0235 17.603C18.0362 17.5969 18.0503 17.5946 18.0643 17.5961C18.0782 17.5977 18.0915 17.6032 18.1025 17.612C18.2225 17.71 18.3475 17.807 18.4745 17.9C18.4845 17.9073 18.4925 17.917 18.4979 17.9282C18.5032 17.9394 18.5057 17.9517 18.5051 17.9641C18.5045 17.9765 18.5008 17.9885 18.4945 17.9991C18.4881 18.0098 18.4791 18.0186 18.4685 18.025C17.8705 18.369 17.2485 18.66 16.5955 18.902C16.5855 18.9056 16.5763 18.9114 16.5687 18.9188C16.561 18.9263 16.5551 18.9353 16.5512 18.9452C16.5473 18.9551 16.5456 18.9658 16.5462 18.9764C16.5467 18.9871 16.5496 18.9975 16.5545 19.007C16.9145 19.694 17.3265 20.348 17.7795 20.969C17.7889 20.9817 17.802 20.9912 17.8171 20.9963C17.8321 21.0013 17.8483 21.0015 17.8635 20.997C20.0178 20.3486 22.0471 19.3407 23.8655 18.016C23.8744 18.0098 23.8818 18.0017 23.8873 17.9924C23.8928 17.9831 23.8963 17.9727 23.8975 17.962C24.3975 12.868 23.0595 8.44197 20.3485 4.51997C20.3418 4.50723 20.3308 4.49729 20.3175 4.49197ZM8.02048 15.278C6.83848 15.278 5.86348 14.209 5.86348 12.898C5.86348 11.586 6.81948 10.518 8.02048 10.518C9.23048 10.518 10.1965 11.595 10.1775 12.898C10.1775 14.21 9.22148 15.278 8.02048 15.278ZM15.9955 15.278C14.8125 15.278 13.8385 14.209 13.8385 12.898C13.8385 11.586 14.7935 10.518 15.9955 10.518C17.2055 10.518 18.1715 11.595 18.1525 12.898C18.1525 14.21 17.2065 15.278 15.9955 15.278Z" fill="white" />
    </g>
    <defs>
      <clipPath id="clip0_1_185">
        <rect width="24" height="24" fill="white" />
      </clipPath>
    </defs>
  </svg>

const IconTelegram = () =>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.6646 3.71694L2.93461 10.5539C1.72461 11.0399 1.73161 11.7149 2.71261 12.0159L7.26461 13.4359L17.7966 6.79094C18.2946 6.48794 18.7496 6.65094 18.3756 6.98294L9.84261 14.6839H9.84061L9.84261 14.6849L9.52861 19.3769C9.98861 19.3769 10.1916 19.1659 10.4496 18.9169L12.6606 16.7669L17.2596 20.1639C18.1076 20.6309 18.7166 20.3909 18.9276 19.3789L21.9466 5.15094C22.2556 3.91194 21.4736 3.35094 20.6646 3.71694Z" fill="white" />
  </svg>

export default function Header() {
  const { address, unlock, lock, chains, chainId, switchChain } = eth.useContainer()
  const { info } = token.useContainer()
  const [mobileMenuIsOpen, setMobileMenuIsOpen] = useState(false)
  const [pathname, setPathname] = useState('')

  useEffect(() => {
    setPathname(Router.asPath)
    return () => { }
  }, [])

  return (
    // <header className="title">
    //   <div className="flex flex-wrap items-center justify-between pt-4">
    //     <Link href={'/'} passHref>
    //       <a><img src={"/header-logo.png"} alt="logo" width={349} height={56} /></a>
    //     </Link>
    //     <button
    //       className={cn("flex items-center block px-3 py-2 text-white border rounded md:hidden")}
    //       onClick={() => setMobileMenuIsOpen(!mobileMenuIsOpen)}
    //     >
    //       <svg
    //         className="w-3 h-3 fill-current"
    //         viewBox="0 0 20 20"
    //         xmlns="http://www.w3.org/2000/svg"
    //       >
    //         <title>Menu</title>
    //         <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" fill={"white"} />
    //       </svg>
    //     </button>
    //     <ul className="md:flex flex-col md:flex-row md:items-center md:justify-center w-full md:w-auto hidden md:block">
    //       {[
    //         { title: "Home", route: "/" },
    //         { title: "Team", route: "/team" },
    //         { title: "Whitepaper", route: "https://docs.pownodes.finance/", target: "_blank" },
    //         { title: "Chart", route: "https://www.dextools.io/app/bsc/pair-explorer/0x6b47b1f5a5167acd400270993ff2e29e89ffadf9", target: "_blank", disabled: false },
    //         { title: "Buy", route: "https://pancakeswap.finance/swap?outputCurrency=0xe9c615e0b739e16994a080ca99730ec104f28cc4", target: "_blank", disabled: false },
    //         // { title: "Whitelist", route: "https://presale.pownodes.finance", target: "_blank", disabled: true },
    //         // { title: "Admin", route: "/monitor", owner: true },
    //       ].filter(route => {
    //         // if (route.owner) return info.isOwner
    //         if (route.disabled) return false;
    //         // if (route.presale) return info.isPresaleAllowed || info.isOwner
    //         return true
    //       }).map(({ route, title, target }) => (
    //         <li className="mt-3 md:mt-0 md:mr-6" key={title}>
    //           <Link href={route} passHref>
    //             <a className={cn("text-white hover:text-green-600", pathname == route && styles.active)} target={target}>{title}</a>
    //           </Link>
    //         </li>
    //       ))}
    //       {/* <li className="md:mr-6">
    //         <Dropdown
    //           placeholder="Select an option"
    //           value={chain.id}
    //           className={chain.icon}
    //           options={Object.entries(chains).map(([key, value]: [string, any]) => ({ value: String(key), label: value.name, className: value.icon, icon: value.icon }))}
    //           onChange={handleSwitchChain}
    //         />
    //       </li> */}
    //       <li>
    //         {!address ?
    //           <button className={styles.button} onClick={unlock}>Connect</button>
    //           :
    //           <button className={styles.button} onClick={lock}>Disconnect</button>}
    //       </li>
    //     </ul>
    //   </div>
    //   <div className={cn("z-10 bg-black block md:hidden top-0 left-0 w-full h-auto fixed", mobileMenuIsOpen ? `translate-x-0` : `translate-x-full`)}
    //     style={{ transition: "transform 200ms linear" }}>
    //     <div className="container p-8">
    //       <span className="close_menu mt-10 text-white" onClick={() => setMobileMenuIsOpen(!mobileMenuIsOpen)}>close</span>
    //       <ul
    //         className="items-center justify-center text-sm w-full h-screen flex flex-col -mt-12"
    //       >
    //         {[
    //           { title: "Home", route: "/" },
    //           { title: "Team", route: "/#team" },
    //           { title: "Whitepaper", route: "https://docs.pownodes.finance/", target: "_blank" },
    //           { title: "Chart", route: "https://www.dextools.io/app/bsc/pair-explorer/0x6b47b1f5a5167acd400270993ff2e29e89ffadf9", target: "_blank", disabled: false },
    //           { title: "Buy", route: "https://pancakeswap.finance/swap?outputCurrency=0xe9c615e0b739e16994a080ca99730ec104f28cc4", target: "_blank", disabled: false },
    //           // { title: "Whitelist", route: "https://presale.pownodes.finance", target: "_blank", disabled: true },
    //           { title: "Admin", route: "/monitor", owner: true },
    //         ].filter(route => (info.isOwner || !route.owner) && !route.disabled).map(({ route, title, target }) => (
    //           <li className="mt-5" key={title}>
    //             <Link href={route} passHref >
    //               <a className="block text-white" target={target} onClick={() => setMobileMenuIsOpen(!mobileMenuIsOpen)}>{title}</a>
    //             </Link>
    //           </li>
    //         ))}
    //         <div className={styles.header__actions}>
    //           {!address ?
    //             <button className={styles.button} onClick={unlock}>Connect</button>
    //             :
    //             <button className={styles.button} onClick={lock}>Disconnect</button>}
    //         </div>
    //       </ul>
    //     </div>
    //   </div>
    // </header>
    <div className={styles.header}>
      <Link href={'https://twitter.com'}>
        <a>
          <IconTwitter />
        </a>
      </Link>
      <Link href={'https://discord.com'}>
        <a>
          <IconDiscord />
        </a>
      </Link>
      <Link href={'https://telegram.com'}>
        <a>
          <IconTelegram />
        </a>
      </Link>
      {
        address ?
          <button onClick={() => lock()}>
            Disconnect
          </button>
          :
          <button onClick={() => unlock()}>
            Connect Wallet
          </button>
      }
    </div>
  )
}
