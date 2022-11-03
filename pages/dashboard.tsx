import classNames from "classnames"
import { useState } from "react"
import { eth } from "state/eth"
import { token } from "state/token"
import { formatEther, parseEther } from "ethers/lib/utils"
import { BigNumber } from "@ethersproject/bignumber"
import styles from "styles/Dashboard.module.scss"
import { toast } from "react-toastify"
import Link from "next/link"

export default function Dashboard() {
  const { address, chainId, unlock, switchChain } = eth.useContainer()
  const { info, tiers, approve, createNode, compoundNode, claim, multicall, mintNFT } = token.useContainer()
  const [loading, setLoading] = useState(false)

  let lastTime = new Date()

  const isMyChain = () => {
    return chainId == Number(process.env.NEXT_PUBLIC_RPC_NETWORK)
  }

  const parseError = (ex: any) => {
    if (typeof ex == 'object')
      return (ex.data?.message ?? null) ? ex.data.message.replace('execution reverted: ', '') : ex.message
    return ex
  }

  const formatToken = (val: any, prec: number = 2) => {
    let num = 0
    if (typeof val == 'object' && val._isBigNumber)
      num = Number(formatEther(val))
    else
      num = Number(val)
    const str = num.toFixed(prec)
    return str.includes(".") ? str.replace(/(0+)$/g, "").replace(/\.$/, "") : str
  }

  const calcRewards = (node: any) => {
    if (!address) return 0
    const tier = tiers[0]
    if (!tier) return 0;
    const now = new Date()
    const days = Math.round((node.limitedTime - now.getTime() / 1000) / 86400) + 30
    if (days < 0) return 0
    const diff = now.getTime() - node.claimedTime * 1000
    if (diff <= 0) return 0
    let one: BigNumber = parseEther("1"), m: BigNumber = parseEther("1")
    if (node.multiplier) {
      const multiplier = BigNumber.from(info.multiplier ?? '1000000000000000000')
      m = node.multiplier.mul(lastTime.getTime() - node.claimedTime).add(multiplier.mul(now.getTime() - lastTime.getTime())).div(now.getTime() - node.claimedTime)
    }

    let claimInterval = tier.claimInterval;
    if (claimInterval <= 0)
      claimInterval = 0.000000000000001;
    return tier?.rewardsPerTime.mul(diff).mul(m).div(one).div(1000).div(claimInterval) ?? 0
  }

  const calcRewardsTotal = () => {
    if (!address) return 0
    if (info.nodes?.length)
      return [...info.nodes].map((node) => parseFloat(formatEther(calcRewards(node)))).reduce((a, b) => a + b)
    return 0
  }

  const handleApprove = () => {
    setLoading(true)
    try {
      approve().then(async () => {
        toast.success(`Successfully approved!`)
        await multicall()
        setLoading(false)
      }).catch(ex => {
        toast.error(parseError(ex))
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setLoading(false)
    }
  }

  const handleCreate = () => {
    // if (countCreate == 0) {
    //   toast.warning('Input number of nodes.')
    //   return
    // }
    setLoading(true)
    try {
      createNode(1).then(async () => {
        toast.success(`Successfully created 1 node!`)
        // if (address) getNodes(address).then(nodes => setNodes(nodes))
        await multicall()
        setLoading(false)
      }).catch(ex => {
        toast.error(parseError(ex))
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setLoading(false)
    }
  }

  const handleCompound = () => {
    // if (countCreate == 0) {
    //   toast.warning('Input number of nodes.')
    //   return
    // }
    setLoading(true)
    try {
      compoundNode(1).then(async () => {
        toast.success(`Successfully compounded 1 node!`)
        // if (address) getNodes(address).then(nodes => setNodes(nodes))
        await multicall()
        setLoading(false)
      }).catch(ex => {
        toast.error(parseError(ex))
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setLoading(false)
    }
  }

  const handleClaim = () => {
    setLoading(true)
    try {
      claim().then(async () => {
        toast.success(`Successfully claimed!`)
        // if (address) getNodes(address).then(nodes => setNodes(nodes))
        await multicall()
        setLoading(false)
      }).catch(ex => {
        toast.error(parseError(ex))
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setLoading(false)
    }
  }

  const handleMintNFT = () => {
    setLoading(true)
    try {
      mintNFT().then(async () => {
        toast.success(`Successfully mint!`)
        // if (address) getNodes(address).then(nodes => setNodes(nodes))
        await multicall()
        setLoading(false)
      }).catch(ex => {
        toast.error(parseError(ex))
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setLoading(false)
    }
  }

  return (
    <div className={classNames(styles.dashboard, loading ? "loading" : "")}>
      <div className={classNames(styles.header, "")}>
        <div>
          <h1>Token Price</h1>
          <h2>${formatToken(info.priceETH ?? 0)}</h2>
          <Link href="https://pancakeswap.finance/swap?outputCurrency=0xe9c615e0b739e16994a080ca99730ec104f28cc4" passHref target="_new">
            <button>Buy Now</button>
          </Link>
        </div>
        {
          address ?
            <div>
              <h1>My Nodes</h1>
              <h2>{info.countOfUser ?? 0} / {info.countTotal ?? 0}</h2>
              <Link href="/mint" passHref>
                <button>View Nodes</button>
              </Link>
            </div>
            :
            <div>
              <h1>Total Nodes</h1>
              <h2>{info.countTotal ?? 0}</h2>
            </div>
        }
        <div>
          <h1>My Boosters</h1>
          <h2>? / ?</h2>
          <Link href="/boosters" passHref>
            <button>View Boosters</button>
          </Link>
        </div>
        <div>
          <h1>My Rewards</h1>
          <h2>{formatToken(calcRewardsTotal(), 5)}</h2>
          {
            address ?
              isMyChain() ?
                <button onClick={handleClaim}>Claim All</button>
                :
                <button onClick={() => switchChain()}>Switch Chain</button>
              :
              <button onClick={unlock}>Connect</button>
          }
        </div>
      </div>
      <div className={styles.content}>
        <h1>Mint Nodes</h1>
        <div>
          <h2>Mint Nodes</h2>
          <ul>
            <li>100 $POW</li>
            <li>250% APR</li>
            <li>Earn 0.12 $POW / DAY</li>
            <li>
              {
                address ?
                  isMyChain() ?
                    info.approved ?
                      <button onClick={handleCreate}>Create</button>
                      :
                      <button onClick={handleApprove}>Approve</button>
                    :
                    <button onClick={() => switchChain()}>Switch Chain</button>
                  :
                  <button onClick={() => unlock()}>Connect</button>
              }
              {address && isMyChain() && <> | <button onClick={handleCompound}>Compound</button></>}
            </li>
          </ul>
        </div>
        <h1>Token Distribution</h1>
        <div className={styles.part3}>
          <div>
            <h2>Token in Rewards wallet</h2>
            <h3>85%</h3>
          </div>
          <div>
            <h2>Token in Development</h2>
            <h3>5%</h3>
          </div>
          <div>
            <h2>Tokens in Treasury</h2>
            <h3>10%</h3>
          </div>
        </div>
        <div>
          <h2>My Boosters</h2>
          <table className="w-full">
            {
              info.boosters?.map((token: any) =>
                <tr>
                  <td>#{token.id.toNumber() + 1}</td>
                  <td>+{token.multiplier / 10}%</td>
                  <td>Earn {formatToken(token.multiplier * 0.12 / 1000, 4)} $POW / DAY</td>
                </tr>
              )
            }
          </table>
          <button onClick={handleMintNFT} className="mt-4">Mint</button>
        </div>
        <h1>Mint Nodes</h1>
        <div>
          <p>Everytime a user buys or sells, a 5% tax will be applied which will go towards development</p>
        </div>
        <div className={styles.price}>
          <h2>Mint POW Node</h2>
          <h3>${formatToken(info.priceETH)}</h3>
          <button>Buy Now</button>
        </div>
      </div>
    </div>
  )
}