import classNames from "classnames"
import { useEffect, useRef, useState } from "react"
import { eth } from "state/eth"
import { token } from "state/token"
import { formatEther } from "ethers/lib/utils"
import { formatFixed } from "@ethersproject/bignumber"
import styles from "styles/Monitor.module.scss"
import { toast } from "react-toastify"
import axios from "axios"
import Image from "next/image"

export default function Monitor() {
  const { address, chains } = eth.useContainer()
  const { info, tiers, getUnpaidNodes, burnNode, mintNode, updateWallet } = token.useContainer()
  const [nodes, setNodes] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any>({})
  const [checked, setChecked] = useState<string[]>([])
  const [listMode, setListMode] = useState('node')
  const [filter, setFilter] = useState<any>({})
  const [tierFund, setTierFund] = useState<string>('basic')
  const [countFund, setCountFund] = useState<number>(0)
  const [addresses, setAddresses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [privkey, setPrivkey] = useState('')
  const [balances, setBalances] = useState<any>({})

  const textarea = useRef<HTMLDivElement>(null)

  let isMobile = false;
  if (typeof window !== 'undefined') {
    isMobile = (window.innerWidth <= 600);
  }

  const parseError = (ex: any) => {
    if (typeof ex == 'object')
      return (ex.data?.message ?? null) ? ex.data.message.replace('execution reverted: ', '') : ex.message
    return ex
  }

  const formatTime = (time: number) => {
    return new Date(time * 1000).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatDays = (time: number) => {
    const days = Math.floor((time - new Date().getTime() / 1000) / 86400) + 30
    return <span className="text-red-500">{-days} days</span>
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
      if (listMode == 'node') {
        const checked = nodes.map(node => String(node.id))
        setChecked([...checked])
      } else if (listMode == 'account') {
        const checked = Object.keys(accounts)
        setChecked([...checked])
      }
    } else
      setChecked([])
  }

  const handleChangeFilter = (e: any) => {
    setFilter({ ...filter, [e.target.name]: e.target.value, [`checked_${listMode}_${filter.days ?? 0}`]: checked })
    setChecked(filter[`checked_${listMode}_${e.target.value ?? 0}`] ?? [])
  }

  const showList = (mode: string) => {
    setFilter({ ...filter, [`checked_${listMode}_${filter.days ?? 0}`]: checked })
    setChecked(filter[`checked_${mode}_${filter.days ?? 0}`] ?? [])
    setListMode(mode)
  }

  const handleBurn = () => {
    let nodeIds: number[] = []
    if (checked.length == 0) {
      toast.warning(`You have to check ${listMode}s to burn first.`)
      return
    }
    checked.map(chk => {
      if (listMode == 'node')
        nodeIds.push(Number(chk) + 1)
      else if (listMode == 'account')
        nodeIds = nodeIds.concat(accounts[chk].nodes)
    })
    setLoading(true)
    try {
      burnNode(nodeIds).then(async () => {
        toast.success(`Successfully burned!`)
        setChecked([])
        await loadNodes()
      }).catch(ex => {
        toast.error(parseError(ex))
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setLoading(false)
    }
  }

  const loadNodes = () => {
    setLoading(true)
    getUnpaidNodes().then(nodes => {
      setNodes(nodes)
      setAccounts(nodes.reduce((prev, cur) => {
        const days = -Math.floor((cur.limitedTime - new Date().getTime() / 1000) / 86400)
        if (prev[cur.owner]) {
          prev[cur.owner].limitedDays.push(days)
          prev[cur.owner].maxLimitedDay = Math.max(prev[cur.owner].maxLimitedDay, days)
          prev[cur.owner].minLimitedDay = Math.min(prev[cur.owner].maxLimitedDay, days)
          prev[cur.owner].nodes.push(cur.id + 1)
          prev[cur.owner].count++
        } else {
          prev[cur.owner] = {
            owner: cur.owner,
            limitedDays: [days],
            maxLimitedDay: days,
            minLimitedDay: days,
            nodes: [cur.id + 1],
            count: 1
          }
        }
        return prev
      }, {}))
    }).finally(() => setLoading(false))
  }

  const findTier = (tierIndex: number) => {
    if (tiers.length) for (const tier of tiers) {
      if (tier.id == tierIndex)
        return tier
    }
    return undefined
  }

  const handleInputAddress = (e: any) => {
    const regexp = /\b0x[\da-f]{40}\b/gi
    const content = e.target.innerText
    const matches = content.matchAll(regexp)
    const addrs = []
    for (const match of matches) {
      addrs.push(match[0])
    }
    // const match = /[\b](|0|0x|0x[\da-f]{1,4})$/i.exec(content)
    // if (match)
    //   setAddressLast(match[0])
    // console.log(match)
    setAddresses(addrs)
  }

  const handleInput = (e: any) => {
    const name = e.target.name
    const value = e.target.value
    if (name == "tierFund")
      setTierFund(value)
    else if (name == "countFund")
      setCountFund(Number(value))
    else if (name == "privkey") {
      setPrivkey(value)
    }
  }

  const handleFund = () => {
    if (addresses.length == 0) {
      toast.warning(`You have to input addresses to find first.`)
      return
    }
    setLoading(true)
    try {
      mintNode(addresses, tierFund, countFund).then(async () => {
        toast.success(`Successfully funded!`)
        if (textarea.current)
          textarea.current.innerText = ''
        setAddresses([])
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

  const handleWallet = () => {
    setLoading(true)
    try {
      updateWallet(privkey).then(async () => {
        toast.success(`Successfully updated!`)
        setPrivkey('')
        setLoading(false)
      }).catch(ex => {
        toast.error(parseError(ex))
        setPrivkey('')
        setLoading(false)
      })
    } catch (ex) {
      toast.error(parseError(ex))
      setPrivkey('')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNodes()
    getBalance()
  }, [address])

  const getBalance = () => {
    if (info.isOwner) {
      axios.get('/api/wallet').then(res => {
        setBalances(res.data)
      })
    }
  }

  // useEffect(() => {
  //   const timer = setTimeout(getBalance, 3000)
  //   // timer = setInterval(getBalance, 30000)
  //   return () => clearTimeout(timer)
  // })

  return (
    <div className={classNames(loading ? "loading" : "", "flex flex-col")}>
      <div className={styles.unpaid}>
        <h1>Burnable {listMode}s</h1>
        <div className={classNames(styles.filter, "flex flex-wrap justify-between mb-2")}>
          <div className={classNames(styles.group, "flex gap-1")}>
            <button className={listMode == 'account' ? styles.active : ''} onClick={() => showList('account')}>Account</button>
            <button className={listMode == 'node' ? styles.active : ''} onClick={() => showList('node')}>Node</button>
          </div>
          <div className={classNames(styles.group, "flex gap-1 hidden md:block")}>
            <input name="days" placeholder="Past before (days)" type="number" value={filter.days ?? ''} onChange={handleChangeFilter} />
            <button className={styles.danger} disabled={checked.length == 0} onClick={handleBurn}>Burn Selected {checked.length ? `(${checked.length})` : ''}</button>
          </div>
          <div className="md:hidden" >
            <input name="days" placeholder="Past before (days)" type="number" value={filter.days ?? ''} onChange={handleChangeFilter} className="py-1 my-3 w-full" />
            <button className={classNames(styles.danger, "w-full")} disabled={checked.length == 0} onClick={handleBurn}>Burn Selected {checked.length ? `(${checked.length})` : ''}</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-auto border-collapse">
            <thead>
              {listMode == 'node' ?
                <tr>
                  {/* <th>Title</th> */}
                  <th>#</th>
                  <th>Owner</th>
                  <th>Tier</th>
                  <th>Creation Time</th>
                  <th>Past</th>
                  <th>
                    <input type="checkbox" onChange={handleCheckAll} checked={checked.length == nodes.length} />
                  </th>
                </tr> :
                <tr>
                  <th>#</th>
                  <th>Owner</th>
                  <th>Number of Nodes</th>
                  <th>Max Past</th>
                  <th>Min Past</th>
                  <th>Avg Past</th>
                  <th>
                    <input type="checkbox" onChange={handleCheckAll} checked={checked.length == nodes.length} />
                  </th>
                </tr>
              }
            </thead>
            <tbody>
              {listMode == 'node' ?
                nodes.filter(node => {
                  const days = filter.days ?? 0
                  return Math.floor((node.limitedTime - new Date().getTime() / 1000) / 86400) + 30 <= -days
                }).sort((a: any, b: any) => {
                  if (a.limitedTime < b.limitedTime) return -1
                  return 1
                }).map((node, index) =>
                  <tr key={index}>
                    {/* <td>{node.title}</td> */}
                    <td>{index + 1}</td>
                    <td>{isMobile ? `${node.owner.substring(0, 4)}` : `${node.owner.substring(0, 10)}...${node.owner.slice(-8)}`}</td>
                    <td>{findTier(node.tierIndex)?.name?.toUpperCase()}</td>
                    <td>{formatTime(node.createdTime)}</td>
                    <td>{formatDays(node.limitedTime)}</td>
                    <td>
                      <input type="checkbox" checked={checked.indexOf(String(node.id)) > -1} onChange={handleCheck} value={node.id ?? ''} />
                    </td>
                  </tr>
                ) :
                Object.values(accounts).filter((account: any) => {
                  if (filter.days) {
                    return account.maxLimitedDays >= filter.days
                  }
                  return true
                }).sort((a: any, b: any) => {
                  if (a.maxLimitedTime < b.maxLimitedTime) return -1
                  return 1
                }).map((account: any, index) =>
                  <tr key={account.owner}>
                    {/* <td>{node.title}</td> */}
                    <td>{index + 1}</td>
                    <td>{isMobile ? `${account.owner.substring(0, 4)}` : `${account.owner.substring(0, 10)}...${account.owner.slice(-8)}`}</td>
                    <td>{account.count}</td>
                    <td><span className="text-red-500">{account.maxLimitedDay} days</span></td>
                    <td><span className="text-red-500">{account.minLimitedDay} days</span></td>
                    <td><span className="text-red-500">{account.limitedDays.reduce((a: number, b: number) => a + b) / account.count} days</span></td>
                    <td>
                      <input type="checkbox" checked={checked.indexOf(account.owner) > -1} onChange={handleCheck} value={account.owner ?? ''} />
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
      <div className={styles.mint}>
        <h1>Fund nodes</h1>
        <div className={styles.textarea} ref={textarea} contentEditable onInput={handleInputAddress} />
        <div className={classNames(styles.group, "md:flex gap-1 mt-4 mt-2 gap-4 md:block")}>
          <select name="tierFund" value={tierFund} onChange={handleInput}>
            {tiers.map(tier =>
              <option key={tier.id}>{tier.name}</option>
            )}
          </select>
          <input placeholder="Number of nodes" name="countFund" type="number" defaultValue={countFund ? countFund : ''} onChange={handleInput} />
          <button disabled={addresses.length == 0} onClick={handleFund}>Fund</button>
        </div>
      </div>
      <div className={styles.bridge}>
        <h1>Bridge wallet</h1>
        <div className={classNames(styles.textarea, "flex justify-between items-center")}>
          {info.minter}
          <div className="flex gap-4 items-center">
            {Object.entries(chains).map(([key, chain]: [string, any]) => (
              balances[key] &&
              <span key={key} className="flex gap-1 items-center">
                <Image src={`/${chain.icon}.png`} width={20} height={20} />
                <b>{parseFloat(balances[key]).toFixed(2)}</b>
              </span>
            ))}
          </div>
        </div>
        <div className={classNames(styles.group, "md:flex gap-1 mt-4 mt-2 gap-4 md:block")}>
          <input placeholder="Private key" className="w-full" name="privkey" value={privkey} onChange={handleInput} />
          <button disabled={!info.isOwner} onClick={handleWallet}>Set</button>
        </div>
      </div>
    </div >
  )
}
