import classNames from "classnames"
import Image from "next/image"
import { useEffect, useState } from "react"
import { eth } from "state/eth"
import { token } from "state/token"
import { formatEther, parseEther, formatUnits } from "ethers/lib/utils"
import { BigNumber } from "@ethersproject/bignumber"
import ReactTooltip from 'react-tooltip'
import { solidityKeccak256 } from "ethers/lib/utils"
import styles from "styles/Home.module.scss"
import { toast } from "react-toastify"

const CopyIcon = (props: any): JSX.Element => {
  const formatRPC = (index: number): string => {
    return solidityKeccak256(["uint32"], [index]).slice(2)
  }
  // const path = `https://bsc-rpc.nodegrid.financial/${formatRPC(props.node)}`
  const path = `https://nodegrid-rpc.vercel.app/${formatRPC(props.node)}`
  return (
    <div className="flex justify-center">
      <a data-tip={path} onClick={() => navigator.clipboard.writeText(path).then(() => toast.success(`RPC URL was copied!`))} className="cursor-pointer hover:opacity-50">
        <svg width="32" height="32" stroke="#44F1A680" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.788 16.757H8.394C8.02429 16.757 7.66972 16.6101 7.40829 16.3487C7.14687 16.0873 7 15.7327 7 15.363V8.394C7 8.02429 7.14687 7.66972 7.40829 7.40829C7.66972 7.14687 8.02429 7 8.394 7H15.363C15.7327 7 16.0873 7.14687 16.3487 7.40829C16.6101 7.66972 16.757 8.02429 16.757 8.394V9.788" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.558 9.78799H18.775C18.9792 9.78799 19.175 9.86912 19.3194 10.0135C19.4638 10.1579 19.545 10.3538 19.545 10.558V18.775C19.545 18.9792 19.4638 19.1751 19.3194 19.3195C19.175 19.4639 18.9792 19.545 18.775 19.545H10.558C10.3537 19.545 10.1579 19.4639 10.0135 19.3195C9.86909 19.1751 9.78796 18.9792 9.78796 18.775V10.558C9.78796 10.3538 9.86909 10.1579 10.0135 10.0135C10.1579 9.86912 10.3537 9.78799 10.558 9.78799V9.78799Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </div>
  )
}

export default function Dashboard() {
  const { address, chains, chainId } = eth.useContainer()
  const isPublic = address != undefined && true
  const { info, tiers, approve, createNode, approveBUSD, compoundNode, transferNode, upgradeNode, swapNode, claim, pay, multicall, airdrops, claimAirdrop } = token.useContainer()
  // const [nodes, setNodes] = useState<any[]>([])
  const [activedTier, activeTier] = useState('')
  const [countCreate, setCountCreate] = useState(0)
  const [checked, setChecked] = useState<string[]>([])
  const [countUpgrade, setCountUpgrade] = useState(0)
  const [countSwap, setCountSwap] = useState(0)
  // const [multiplier, setMultiplier] = useState<BigNumber>(BigNumber.from("1000000000000000000"))
  const [addressTransfer, setAddressTransfer] = useState('')
  const [showingTransfer, showTransfer] = useState(false)
  const [filterTier, setFilterTier] = useState(-1)
  const [swapTier, setSwapTier] = useState(0)
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(0)
  const [months, setMonths] = useState(1)
  const [upgradeFeeBasicLight, setUpgradeFeeBasicLight] = useState(0);

  let lastTime = new Date()

  const parseError = (ex: any) => {
    if (typeof ex == 'object')
      return (ex.data?.message ?? null) ? ex.data.message.replace('execution reverted: ', '') : ex.message
    return ex
  }

  const getTierDescription = (tierFrom: any) => {
    return tiers.filter(tier => tier.price.gt(tierFrom.price)).sort((a: any, b: any) => {
      if (a.price.gt(b.price)) return -1
      else if (a.price.eq(b.price) && a.createdTime < b.createdTime) return -1
      return 1
    }).map(tier => (
      <p key={tier.tierIndex}>Upgrade {tier.price / tierFrom.price} <span className="capitalize">{tierFrom.name}</span> Nodes to 1 <span className="capitalize">{tier.name}</span> Node</p>
    ))
  }

  const formatTime = (time: number) => {
    return new Date(time * 1000).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatDays = (time: number) => {
    const days = Math.round((time - new Date().getTime() / 1000) / 86400) + 30
    if (days < 0)
      return <span className="text-red-500">overdue {-days} days</span>
    return <span className="text-green-500">due in {days} days</span>
  }

  const calcRewards = (node: any) => {
    if (!address) return 0
    const tier = findTier(node.tierIndex)
    if (!tier)
      return 0;
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

  const handleApproveBusd = () => {
    setLoading(true)
    try {
      approveBUSD().then(async () => {
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
    if (countCreate == 0) {
      toast.warning('Input number of nodes.')
      return
    }
    setLoading(true)
    try {
      createNode(activedTier, countCreate).then(async () => {
        toast.success(`Successfully created ${countCreate} nodes!`)
        // if (address) getNodes(address).then(nodes => setNodes(nodes))
        setCountCreate(0)
        await multicall()
        setLoading(false)
      }).catch(ex => {
        toast.error(parseError(ex))
        setCountCreate(0)
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setCountCreate(0)
      setLoading(false)
    }
  }

  const handleCompound = () => {
    if (countCreate == 0) {
      toast.warning('Input number of nodes.')
      return
    }
    setLoading(true)
    try {
      compoundNode(activedTier, countCreate).then(async () => {
        toast.success(`Successfully compounded ${countCreate} nodes!`)
        // if (address) getNodes(address).then(nodes => setNodes(nodes))
        setCountCreate(0)
        await multicall()
        setLoading(false)
      }).catch(ex => {
        toast.error(parseError(ex))
        setCountCreate(0)
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setCountCreate(0)
      setLoading(false)
    }
  }

  const handleShowTransfer = () => {
    if (countCreate == 0) {
      toast.warning('Input number of nodes.')
      return
    }
    showTransfer(true)
  }

  const handleInputAddress = (e: any) => {
    const text = e.target.value
    if (text == '0' || text == '0x' || /^0x[0-9a-f]{0,40}$/i.test(text)) {
      setAddressTransfer(text)
    }
  }

  const handleTransfer = () => {
    if (countCreate == 0) {
      toast.warning('Input number of nodes.')
      return
    } else if (addressTransfer == '') {
      toast.warning('Input address of recipient.')
      return
    }
    setLoading(true)
    try {
      transferNode(activedTier, countCreate, addressTransfer).then(async () => {
        toast.success(`Successfully transfered ${countCreate} nodes!`)
        // if (address) getNodes(address).then(nodes => setNodes(nodes))
        await multicall()
        setCountCreate(0)
        setAddressTransfer('')
        showTransfer(false)
        setLoading(false)
      }).catch(ex => {
        toast.error(parseError(ex))
        setCountCreate(0)
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setCountCreate(0)
      setLoading(false)
    }
  }

  const handleUpgrade = (tierName1: string, tierName2: string) => {
    if (countUpgrade == 0) {
      toast.warning('Input number of nodes.')
      return
    }
    setLoading(true)
    try {
      upgradeNode(tierName1, tierName2, countUpgrade).then(async () => {
        toast.success(`Successfully upgraded ${countUpgrade} nodes!`)
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

  const handleSwap = (targetChain: number) => {
    if (countSwap == 0) {
      toast.warning('Input number of nodes.')
      return
    }
    setLoading(true)
    try {
      const tierName = tiers[swapTier].name
      if (info[`countOfTier${tierName}`] < countSwap) throw new Error('Insufficient Nodes')
      swapNode(targetChain, tierName, countSwap).then(async () => {
        toast.success(`Successfully swapped ${countSwap} nodes!`)
        // if (address) getNodes(address).then(nodes => setNodes(nodes))
        await multicall()
        setLoading(false)
      }).catch((ex: any) => {
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

  const handlePay = () => {
    setLoading(true)
    try {
      let fee = BigNumber.from(0)
      const selected: number[] = []
      const allChecked = countChecked() == 0
      info.nodes?.filter(cbFilter).map((node: any) => {
        const tier = findTier(node.tierIndex)
        if (allChecked || checked.indexOf(String(node.id)) > -1) {
          fee = fee.add(tier.maintenanceFee.mul(months))
          selected.push(node.id)
        }
      })
      pay(months, selected, fee).then(async () => {
        toast.success(`Successfully paid!`)
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

  const handleAirdrop = (label: string) => {
    setLoading(true)
    try {
      claimAirdrop(label).then(async () => {
        toast.success(`Successfully claimed!`)
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

  const handleCountCreate = (e: any) => {
    setCountCreate(Number(e.target.value))
  }

  const handleCountUpgrade = (e: any) => {
    setCountUpgrade(Number(e.target.value))
  }

  const handleCountSwap = (e: any) => {
    setCountSwap(Number(e.target.value))
  }

  const handleMonthsMinus = () => {
    if (months > 1)
      setMonths(months - 1)
  }

  const handleMonthsPlus = () => {
    if (months < 12)
      setMonths(months + 1)
  }

  const handleCheck = (e: any) => {
    const id = String(e.target.value)
    const chk = e.target.checked
    const pos = checked.indexOf(id)
    if (chk && pos == -1) {
      checked.push(id)
    } else if (!chk && pos > -1) {
      checked.splice(pos, 1)
    }
    setChecked([...checked])
  }

  const handleCheckAll = (e: any) => {
    const chk = e.target.checked
    if (chk) {
      const checkedNew = info.nodes?.filter(cbFilter).map((node: any) => String(node.id))
      setChecked([...checked, ...checkedNew])
    } else {
      setChecked([])
    }
  }

  const isCheckedAll = () => {
    if (checked.length == 0)
      return false
    return info.nodes?.filter(cbFilter).reduce((a: any, b: any) => a && checked.indexOf(String(b.id)) > -1, true)
  }

  const countChecked = () => {
    if (checked.length == 0)
      return 0
    return info.nodes?.filter(cbFilter).reduce((a: any, b: any) => a + (checked.indexOf(String(b.id)) > -1 ? 1 : 0), 0)
  }

  const findTier = (tierIndex: number) => {
    if (tiers.length) for (const tier of tiers) {
      if (tier.id == tierIndex)
        return tier
    }
    return undefined
  }

  const cbFilter = (node: any) => {
    if (filterTier == -1)
      return true
    return node.tierIndex == filterTier
  }

  useEffect(() => {
    if (address) {
      lastTime = new Date()
      // getMultiplier(lastTime).then(multiplier => setMultiplier(multiplier))
      // getNodes(address).then(nodes => setNodes(nodes))
      // allowance().then(approved => setApproved(approved))
      multicall()
    }
  }, [address])

  useEffect(() => {
    if (activedTier == '' && tiers[0]) activeTier(tiers[0].name)
  }, [tiers])
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(timer + 1)
    }, 300)
    return () => clearInterval(interval)
  }, [timer])

  return (
    <div className={classNames(loading ? "loading" : "", "flex flex-col")}>
      <div className={classNames(styles.welcome, "pt-10 md:pt-20")}>
        <h1>Welcome to NodeGrid!!!</h1>
        <p className="">You can use this app to create NodeGrid nodes, view, claim and compound rewards.</p>
        <div>
          {airdrops.map(({ label, tier, amount }) =>
            info[`canAirdrop${label}`] && <button key={label} className="mt-10" onClick={() => handleAirdrop(label)}>Claim Airdrop ({tier} {amount})</button>
          )}
        </div>
      </div>
      <div className={classNames(styles.status, "flex flex-wrap justify-between md:gap-10 gap-5 md:pt-10 pt-2")}>
        <ul className="md:flex-1 w-full">
          <li key="my-node"><em>My nodes :</em> {address ? (info.countOfUser ?? 0) : 0} / {info.maxCountOfUser ?? 'Infinite'}</li>
          {tiers.map((tier, index) =>
            <li key={`my-node-${tier.name}`}>
              <em>{tier.name} :</em> {address ? (info.nodes?.filter((node: any) => node.tierIndex == index).length ?? 0) : 0}  / {tier.maxPurchase}
            </li>
          )}
        </ul>
        <ul className="md:flex-1 w-full">
          <li key="total-node"><em>Total nodes :</em> {info.countTotal ?? 0}</li>
          {tiers.map(tier =>
            <li key={`total-node-${tier.name}`}>
              <em>{tier.name} :</em> {info[`countOfTier${tier.name}`] ?? 0}
            </li>
          )}
        </ul>
        <ul className="flex-1 flex flex-col justify-between">
          <li key="reward-header">
            <em>Rewards</em>
            {address && info.nodes ? ` : ${(calcRewardsTotal() + parseFloat(formatEther(info.unclaimed))).toFixed(8)}` : null}
          </li>
          {address ?
            <>
              <ins key="reward-amount">
                {info.unclaimed?.gt(0) ?
                  `${parseFloat(formatEther(info.unclaimed)).toFixed(8)} + ${calcRewardsTotal().toFixed(8)}` :
                  calcRewardsTotal().toFixed(8)
                }
              </ins>
              <ins key="reward-button">
                {(info.nodes?.length > 0 || info.unclaimed?.gt(0)) && <button className="w-full" onClick={handleClaim}>Claim Rewards{info.claimFee ? ` (Tax: ${info.claimFee / 100}%)` : ''}</button>}
              </ins>
            </> : null
          }
        </ul>
      </div>
      <div className={classNames(styles.create, "md:mt-10 mt-5")}>
        <h1>Create a Node</h1>
        <p>Choose between the three tiers of nodes below:</p>

        <div className={classNames(styles.tiers, "flex flex-wrap justify-around md:gap-5 lg:gap-10 gap-5 mt-4")}>
          {tiers.map(tier =>
            <a className={classNames("tier w-full md:w-auto", tier.name, tier.name == activedTier ? styles.selected : "", tier.name == activedTier ? "selected" : "")} key={tier.name} onClick={() => activeTier(tier.name)}>
              <h2>{tier.name}</h2>
              <p>{formatEther(tier.price)} NodeGrid per Node</p>
              <p>Earn {formatEther(tier.rewardsPerTime)} NodeGrid per Day</p>
            </a>
          )}
        </div>
        <div className={styles.active}>Active Tier: <label>{activedTier}</label></div>
        <div className={classNames(styles.edit, "flex flex-wrap md:flex-nowrap gap-1 md:gap-10")}>
          <input disabled={!isPublic} placeholder="Number of Nodes" type="number" className="w-full md:w-auto" value={countCreate ? countCreate : ''} onChange={handleCountCreate} />
          <span>Please approve the contract before creating a node if this is your first interaction with NodeGrid.</span>
        </div>
        {showingTransfer ?
          <>
            <div className={classNames(styles.group, "md:flex gap-1 mt-4 mt-10 hidden md:block")}>
              <input placeholder="Address of Recipient" type="text" className="flex-1 w-full" value={addressTransfer} onInput={handleInputAddress} />
              <button disabled={!isPublic || info.nodes?.length == 0} onClick={handleTransfer}>Confirm</button>
              <button disabled={!isPublic || info.nodes?.length == 0} onClick={() => showTransfer(false)}>Cancel</button>
            </div>
            <div className={"md:flex gap-1 mt-4 mt-10 md:hidden"}>
              <input placeholder="Address of Recipient" type="text" className="flex-1 w-full mb-2" value={addressTransfer} onInput={handleInputAddress} />
              <button disabled={!isPublic || info.nodes?.length == 0} onClick={handleTransfer} className={"mr-4"}>Confirm</button>
              <button disabled={!isPublic || info.nodes?.length == 0} onClick={() => showTransfer(false)}>Cancel</button>
            </div>
          </>
          :
          <div className="flex flex-wrap justify-between mt-4 md:mt-10 gap-2">
            {info.approvedNodeGrid ?
              <button disabled={!isPublic} className={classNames(styles.approved, "w-full md:w-auto")}>Approved</button> :
              <button disabled={!isPublic} onClick={handleApprove} className="w-full md:w-auto">Approve Contract</button>}
            <button disabled={!isPublic || !info.approvedNodeGrid} onClick={handleCreate} className="w-full md:w-auto">Create Nodes</button>
            <button disabled={!isPublic || !info.approvedNodeGrid} onClick={handleCompound} className="w-full md:w-auto">Compound Nodes</button>
            <button disabled={!isPublic || !info.canNodeTransfer || countCreate == 0 || info.nodes?.length == 0} onClick={handleShowTransfer} className="w-full md:w-auto">Transfer Nodes</button>
          </div>}
        <hr className="my-10" />
        <div className={styles.upgrade}>
          <h2>Upgrade Nodes</h2>
          <p>In order to upgrade node tiers, you must possess a quantity of $NGRID tokens that is equal to or greater than the difference in the tiers price.</p>
          <br />
          {/* <ul className={styles.upgradeUl, "ml-5"}>
            <li key="basic-light">Basic to Light nodes - Costs 5 Basic nodes + 10% of Light node price in $BNB ({info && new Number(formatEther(info.upgradeBasicToLightFee ?? 0) as unknown as number).toFixed(3)} BNB)</li>
            <li key="basic-pro">Basic to Pro nodes - Costs 10 Basic nodes + 15% of Pro node price in $BNB ({info && new Number(formatEther(info.upgradeBasicToProFee ?? 0) as unknown as number).toFixed(3)} BNB)</li>
            <li key="light-pro">Light to Pro nodes - Costs 2 Light nodes + 10% of Light node price in $BNB ({info && new Number(formatEther(info.upgradeLightToProFee ?? 0) as unknown as number).toFixed(3)} BNB)</li>
          </ul> */}
          <ul className={classNames(styles.upgradeUl, "ml-5")}>
            <li key="basic-light">Basic to Light nodes - Costs 5 Basic nodes</li>
            <li key="basic-pro">Basic to Pro nodes - Costs 10 Basic nodes</li>
            <li key="light-pro">Light to Pro nodes - Costs 2 Light nodes</li>
          </ul>
          <div className="flex flex-wrap justify-between mt-4 md:mt-10 gap-2">
            <input disabled={!isPublic} placeholder="Number of Nodes" className="w-full md:w-auto" type="number" defaultValue={countUpgrade ? countUpgrade : ''} onChange={handleCountUpgrade} />
            <div className={classNames(styles.group, "flex  w-full gap-1 md:w-3/5")}>
              {tiers.map((tier1) =>
                tiers.filter((tier2) => tier1.price.lt(tier2.price)).map((tier2) =>
                  <button className="flex-1 flex flex-col items-center justify-center gap-1 md:flex-row" disabled={!isPublic || !info.approvedNodeGrid || info.nodes?.length == 0 || countUpgrade == 0} onClick={() => handleUpgrade(tier1.name, tier2.name)} key={`upgrade-${tier1.id}-${tier2.id}`}>
                    <span>{tier1.name.toUpperCase()}</span>
                    <span>&rArr;</span>
                    <span>{tier2.name.toUpperCase()}</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
        <hr className="my-10" />
        <div className={classNames(styles.swap)}>
          <div>
            <h2>Swap nodes via Multi-chain</h2>
            <p>Description multi-chain swapping</p>
          </div>
          <div className="flex flex-wrap justify-between mt-4 md:mt-10 gap-2">
            <div className={classNames(styles.group, "flex gap-1")}>
              {tiers.map((tier, index) =>
                <button className={classNames(swapTier == index ? styles.selected : "", "capitalize")} onClick={() => setSwapTier(index)} key={index}>{tier.name}</button>
              )}
              <input disabled={!isPublic} placeholder="Number of Nodes" className="w-full md:w-auto" type="number" defaultValue={countSwap ? countSwap : ''} onChange={handleCountSwap} />
            </div>
            <div className={classNames(styles.group, "flex w-full gap-1 md:w-auto")}>
              {Object.entries(chains).map(([cid, chain]: [string, any]) =>
              (Number(cid) != chainId &&
                <button key={cid} className="flex-1 flex flex-col items-center justify-center gap-1 md:flex-row" disabled={!isPublic || !info.approvedNodeGrid || info.nodes?.length == 0 || !countSwap} onClick={() => handleSwap(Number(cid))}>
                  <Image src={`/${chains[chainId].icon}.png`} height={24} width={24} />
                  <span className={styles.arrow}>&#10148;</span>
                  <Image src={`/${chain.icon}.png`} height={24} width={24} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <hr className="my-10" />
        <div className={classNames(styles.buy, "flex md:flex-row flex-col gap-5 align-center")}>
          <div>
            <h2>Create a node with $NGRID tokens to earn NodeGrid token rewards.</h2>
            <p>Rewards calculations are based on many factors, including the number of nodes, node revenue, token price, and protocol revenue, which are variable and subject to change over time.</p>
          </div>
          {/* {isPublic && <Link href="https://testnet.godex.exchange/swap?outputCurrency=0x229653dad9Eb152DFF3477a1130aB81a67FB1D7C" >
            <a target="_blank" rel="noreferrer" className={classNames(styles.link, "w-full md:w-auto")}>Buy $NGRID</a>
          </Link>} */}
        </div>
      </div>
      {address && info.nodes?.length > 0 && <div className={classNames(styles.nodes, "md:mt-10 mt-5")}>
        <div className="md:flex justify-between items-end mb-4">
          <h1>Nodes</h1>
          <div className={classNames(styles.group, "flex gap-1 mt-4 w-full md:w-auto md:mt-0")}>
            <button className={classNames(styles.small, filterTier == -1 ? styles.selected : "")} onClick={() => setFilterTier(-1)}>All</button>
            {tiers.map((tier, index) =>
              <button key={index} className={classNames(styles.small, filterTier == index ? styles.selected : "")} onClick={() => setFilterTier(index)}>{tier.name}</button>
            )}
          </div>
        </div>
        <table className="table-auto border-collapse">
          <thead>
            <tr>
              {/* <th>Title</th> */}
              <th>#</th>
              <th>Tier</th>
              <th className="hidden md:table-cell">Creation Time</th>
              <th>Limited</th>
              <th>Rewards</th>
              <th>RPC URL</th>
              <th>
                <input type="checkbox" onChange={handleCheckAll} checked={isCheckedAll()} />
              </th>
            </tr>
          </thead>
          <tbody className={`${timer}`}>
            {[...info.nodes].filter(cbFilter).sort((a: any, b: any) => {
              if (a.tierIndex > b.tierIndex) return -1
              else if (a.tierIndex == b.tierIndex && a.createdTime < b.createdTime) return -1
              return 1
            }).map((node, index) =>
              <tr key={index}>
                {/* <td>{node.title}</td> */}
                <td>{index + 1}</td>
                <td><span className="uppercase">{findTier(node.tierIndex)?.name}</span></td>
                <td className="hidden md:table-cell" >{formatTime(node.createdTime)}</td>
                <td>{formatDays(node.limitedTime)}</td>
                <td>{parseFloat(formatEther(calcRewards(node))).toFixed(5)}</td>
                <td><CopyIcon node={node.id} /></td>
                <td>
                  <input type="checkbox" checked={checked.indexOf(String(node.id)) > -1} onChange={handleCheck} value={node.id ?? ''} />
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <ReactTooltip backgroundColor="#44F1A6" effect="solid" place="top" />
        <div className={classNames(styles.group, styles.pay, "flex gap-1 w-full md:w-auto mt-4 justify-end")}>
          {info.approvedMaintenance ? (
            <>
              <button onClick={handleMonthsMinus}>-</button>
              <button disabled={!isPublic} className="flex-shrink w-full md:w-auto" onClick={handlePay}>Pay {months} month{months > 1 ? 's' : ''} ({isCheckedAll() || countChecked() == 0 ? 'All' : countChecked()})</button>
              <button onClick={handleMonthsPlus}>+</button>
            </>
          ) : (
            <button disabled={!isPublic} className="flex-shrink w-full md:w-auto" onClick={handleApproveBusd}>Approve BUSD</button>
          )}
        </div>

        <h2 className="mb-3">
          Node maintenance fees (payable in $BUSD)
        </h2>
        <ul className={classNames(styles.upgradeUl, "ml-5")}>
          {tiers.map((tier) => <li key={tier.index}><span className="capitalize">{tier.name}</span> = ${formatEther(tier.maintenanceFee)} per month</li>)}
        </ul>
      </div>}


      {/* <div className={classNames(styles.rules, "md:mt-10 mt-5")}>
        <h1>Compounding Rules</h1>
        <p>You can only compound in the same tier.</p>
        <p>You can only compound across tiers in god mode.</p>
        <p>To unlock god mode, you need at least 1 node from all the available tiers.</p>

        <hr className="my-10" />
        <div className={classNames(styles.pay)}>
          <div>
            <h1>Pay maintenance fee every month</h1>
            <p>You need to pay maintaince fees end of the month And You have time to pay upto 1 more month but if not paid for 2 months nodes will be burnt</p>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 justify-end">
            <button onClick={() => handlePay(1)}>Pay 1 Month</button>
            <button onClick={() => handlePay(2)}>Pay 2 Months</button>
          </div>
        </div>
      </div> */}


      <a id="team"></a>
      <div className="flex flex-col mt-20">
        <div className={classNames(styles.welcome, "pt-10 md:pt-20 md:flex")}>
          <div className="text-2xl md:text-5xl">Meet our <span>team members</span></div>
        </div>

        <div className={classNames(styles.blogs, "lg:flex flex-wrap justify-between gap-10 lg:pt-10")}>

          <div className="lg:flex-1 mt-20 lg:mt-0" style={{ position: "relative" }}>
            <h2 className={classNames(styles.teamName, "flex mb-4 justify-center")}>Wes</h2>
            <h3 className={classNames(styles.teamRole)}>Chief Operating Officer</h3>

            <div className="flex justify-center">
              <a rel="noreferrer" href="https://nodegrid.gitbook.io/whitepaper/constitution/meet-the-founders" target="_blank">
                <Image className={classNames(styles.teamMember)} src="/team/wes.jpg" width={350} height={350} />
              </a>
            </div>
          </div>

          <div className="lg:flex-1 mt-20 lg:mt-0" style={{ position: "relative" }}>
            <h2 className={classNames(styles.teamName, "flex mb-4 justify-center")}>Andrew</h2>
            <h3 className={classNames(styles.teamRole, styles.teamRoleDblHeight)}>Chief Human Resource Manager</h3>

            <div className="flex justify-center">
              <a rel="noreferrer" href="https://nodegrid.gitbook.io/whitepaper/constitution/meet-the-founders" target="_blank">
                <Image className={classNames(styles.teamMember)} src="/team/andrew-speedy.jpg" width={350} height={350} />
              </a>
            </div>
          </div>

          <div className="lg:flex-1 mt-20 lg:mt-0" style={{ position: "relative" }}>
            <h2 className={classNames(styles.teamName, "flex mb-4 justify-center")}>Milos</h2>
            <h3 className={classNames(styles.teamRole, styles.teamRoleDblHeight)}>Web3 Developer</h3>

            <div className="flex justify-center">
              <a rel="noreferrer" href="https://nodegrid.gitbook.io/whitepaper/constitution/meet-the-founders" target="_blank">
                <Image className={classNames(styles.teamMember)} src="/team/milos.jpg" width={350} height={350} />
              </a>
            </div>
          </div>
        </div>

        <div className={classNames(styles.blogs, "lg:flex flex-wrap justify-between gap-10 lg:pt-20")}>
          <div className="lg:flex-1 mt-20 lg:mt-0" style={{ position: "relative" }}>
            <h2 className={classNames(styles.teamName, "flex mb-4 justify-center")}>Óseo</h2>
            <h3 className={classNames(styles.teamRole, styles.teamRoleDblHeight)}>Head of Graphic Design</h3>

            <div className="flex justify-center">
              <a rel="noreferrer" href="https://nodegrid.gitbook.io/whitepaper/constitution/meet-the-founders" target="_blank">
                <Image className={classNames(styles.teamMember)} src="/team/oseo.jpg" width={350} height={350} />
              </a>
            </div>
          </div>

          <div className="lg:flex-1 mt-20 lg:mt-0" style={{ position: "relative" }}>
            <h2 className={classNames(styles.teamName, "flex mb-4 justify-center")}>Amir - ProfessorX</h2>
            <h3 className={classNames(styles.teamRole, styles.teamRoleDblHeight)}>Advisor</h3>

            <div className="flex justify-center">
              <a rel="noreferrer" href="https://nodegrid.gitbook.io/whitepaper/constitution/meet-the-founders" target="_blank">
                <Image className={classNames(styles.teamMember)} src="/team/amir.jpg" width={350} height={350} />
              </a>
            </div>
          </div>

          <div className="lg:flex-1 mt-20 lg:mt-0" style={{ position: "relative" }}>
            <h2 className={classNames(styles.teamName, "flex mb-4 justify-center")}>Hunter</h2>
            <h3 className={classNames(styles.teamRole, styles.teamRoleDblHeight)}>Project Lead</h3>

            <div className="flex justify-center">
              <a rel="noreferrer" href="https://nodegrid.gitbook.io/whitepaper/constitution/meet-the-founders" target="_blank">
                <Image className={classNames(styles.teamMember)} src="/team/hunter.jpg" width={350} height={350} />
              </a>
            </div>
          </div>


        </div>

        <div className={classNames(styles.blogs, "lg:flex flex-wrap justify-between gap-10 lg:pt-20")}>
          <div className="lg:flex-1 mt-20 lg:mt-0" style={{ position: "relative" }}>
            <h2 className={classNames(styles.teamName, "flex mb-4 justify-center")}>Max</h2>
            <h3 className={classNames(styles.teamRole, styles.teamRoleDblHeight)}>Tech Lead</h3>

            <div className="flex justify-center">
              <a rel="noreferrer" href="https://nodegrid.gitbook.io/whitepaper/constitution/meet-the-founders" target="_blank">
                <Image className={classNames(styles.teamMember)} src="/team/max.jpg" width={350} height={350} />
              </a>
            </div>
          </div>


          <div className="lg:flex-1 mt-20 lg:mt-0" style={{ position: "relative" }}>
          </div>

          <div className="lg:flex-1 mt-20 lg:mt-0" style={{ position: "relative" }}>
          </div>
        </div>


      </div>

      <div className="flex justify-center mt-10">
        <a rel="noreferrer" href="https://nodegrid.gitbook.io/whitepaper/constitution/meet-the-founders" target="_blank" className={classNames(styles.button)}>Read More About The Team</a>
      </div>
    </div >


  )
}