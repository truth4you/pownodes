import Link from "next/link";
import styles from "styles/Footer.module.scss"

export default function Footer() {
  return (
    <div className={styles.footer}>
      <div className="container mx-auto px-4">
        <div className="text-center pt-4">

          <ul className="list-inline">
            <li>
            <Link href="https://docs.nodegrid.finance/" passHref>
              <a target="_blank">Whitepaper</a>
            </Link>
            </li>
            
            <li>
            <Link href="https://twitter.com/_nodegrid" passHref>
              <a target="_blank">Twitter</a>
            </Link>
            </li>

            <li>
            <Link href="https://discord.gg/3EneCWEX" passHref>
              <a target="_blank">Discord</a>
            </Link>
            </li>

            <li>
            <Link href="https://www.dextools.io/app/bsc/pair-explorer/0x6b47b1f5a5167acd400270993ff2e29e89ffadf9" passHref>
              <a target="_blank">Chart</a>
            </Link>
            </li>

            <li>
            <Link href="https://pancakeswap.finance/swap?outputCurrency=0xe9c615e0b739e16994a080ca99730ec104f28cc4" passHref>
              <a target="_blank">Buy Now</a>
            </Link>
            </li>

            <li>
            <Link href="https://bscscan.com/address/0xe9C615E0b739e16994a080cA99730Ec104F28CC4" passHref>
              <a target="_blank">BSCScan</a>
            </Link>
            </li>

          </ul>


          <p className="mt-10">
            &copy; 2022 NodeGrid.finance. All Rights Reserved.
          </p>

          <p className="mt-10">
            <small>
              While cryptocurrencies have the potential for great rewards, they may not be suitable for all investors. Before deciding to trade any cryptocurrency or DeFi
              protocol you should carefully consider your investment objectives, level of experience, and risk appetite. Daily reward rate is not guaranteed.
              The information provided on this website does not constitute investment advice, financial advice, trading advice, or any other sort of advice, and
              you should not treat any of the website's content as such. NodeGrid.finance will not accept liability for any loss or damage, including without
              limitation to, any loss of profit, which may arise directly or indirectly from use of or reliance on such information.
            </small>
          </p>
        </div>
      </div>
    </div>
  );
}
