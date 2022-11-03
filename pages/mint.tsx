import classNames from "classnames"
import { useEffect, useRef, useState } from "react"
import { eth } from "state/eth"
import { token } from "state/token"
import { formatEther, parseEther } from "ethers/lib/utils"
import { BigNumber } from "@ethersproject/bignumber"
import styles from "styles/Mint.module.scss"
import { toast } from "react-toastify"

export default function Mint() {
  const { address, chainId, unlock, switchChain } = eth.useContainer()
  const { info, tiers, approve, createNode, compoundNode, transferNode, claim, multicall } = token.useContainer()
  const [checked, setChecked] = useState<string[]>([])
  const [addressTransfer, setAddressTransfer] = useState('')
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

  const formatTime = (time: number) => {
    return new Date(time * 1000).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
    const tier = tiers.find((_tier) => _tier.id == node.tierIndex)
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
    const tier = tiers[0]
    if (!tier)
      return;
    setLoading(true)
    try {
      createNode(tier, 1).then(async () => {
        toast.success(`Successfully created 1 nodes!`)
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
    const tier = tiers[0]
    if (!tier)
      return;
    setLoading(true)
    try {
      compoundNode(tier, 1).then(async () => {
        toast.success(`Successfully compounded 1 nodes!`)
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

  const handleInputAddress = (e: any) => {
    const text = e.target.value
    if (text == '0' || text == '0x' || /^0x[0-9a-f]{0,40}$/i.test(text)) {
      setAddressTransfer(text)
    }
  }

  const handleTransfer = () => {
    if (addressTransfer == '') {
      toast.warning('Input address of recipient.')
      return
    }
    const selected: number[] = []
    const allChecked = countChecked() == 0
    info.nodes?.map((node: any) => {
      if (allChecked || checked.indexOf(String(node.id)) > -1) {
        selected.push(node.id)
      }
    })
    setLoading(true)
    try {
      transferNode(addressTransfer, selected).then(async () => {
        toast.success(`Successfully transfered ${selected.length} nodes!`)
        // if (address) getNodes(address).then(nodes => setNodes(nodes))
        await multicall()
        setAddressTransfer('')
        setChecked([])
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
      const checkedNew = info.nodes?.map((node: any) => String(node.id))
      setChecked([...checked, ...checkedNew])
    } else {
      setChecked([])
    }
  }

  const isCheckedAll = () => {
    if (info.nodes?.length == 0 || checked.length == 0)
      return false
    return info.nodes?.reduce((a: any, b: any) => a && checked.indexOf(String(b.id)) > -1, true)
  }

  const countChecked = () => {
    if (checked.length == 0)
      return 0
    return info.nodes?.reduce((a: any, b: any) => a + (checked.indexOf(String(b.id)) > -1 ? 1 : 0), 0)
  }

  return (
    <div className={classNames(styles.mint, loading ? "loading" : "")}>
      <div className={styles.header}>
        <h1>My Nodes</h1>
        <div>
          <h2>Mint Nodes</h2>
          <ul>
            <li>100 $POW</li>
            <li>250% APR</li>
            <li>Earn 10 $POW / DAY</li>
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
      </div>
      <div className={styles.content}>
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
        <h1>My Nodes</h1>
        <div className={styles.table}>
          <table className="table-auto border-collapse">
            <colgroup>
              <col width="40px" />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Creation Time</th>
                <th>Rewards</th>
                {
                  address && isMyChain() &&
                  <th>
                    <input type="checkbox" onChange={handleCheckAll} checked={isCheckedAll()} />
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              {address && info.nodes && [...info.nodes].sort((a: any, b: any) => {
                if (a.tierIndex > b.tierIndex) return -1
                else if (a.tierIndex == b.tierIndex && a.createdTime < b.createdTime) return -1
                return 1
              }).map((node, index) =>
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{formatTime(node.createdTime)}</td>
                  <td>{parseFloat(formatEther(calcRewards(node))).toFixed(5)}</td>
                  {
                    address && isMyChain() &&
                    <td>
                      <input type="checkbox" checked={checked.indexOf(String(node.id)) > -1} onChange={handleCheck} value={node.id ?? ''} />
                    </td>
                  }
                </tr>
              )}
            </tbody>
          </table>
          <span className={styles.footer}>
            <input placeholder="Input address" className="w-full" onChange={handleInputAddress} disabled={!address || !isMyChain() || checked.length == 0} />
            <button onClick={handleTransfer} disabled={!address || !isMyChain() || checked.length == 0}>Transfer</button>
          </span>
        </div>
      </div>
    </div>
  )
}