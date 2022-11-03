import { eth } from "state/eth" // ETH state provider
import { ethers } from "ethers" // Ethers
import { Contract, Provider, setMulticallAddress } from "ethers-multicall"
import { useEffect, useState } from "react" // React
import { createContainer } from "unstated-next" // State management
import { BigNumber } from "@ethersproject/bignumber"

const NodeManagerABI = require("abi/NodeManager.json")
const NodeCoreABI = require("abi/NodeCore.json")
const FeeManagerABI = require("abi/FeeManager.json")
const BoostNFTABI = require("abi/BoostNFT.json")
const ERC20ABI = require("abi/ERC20.json")
const UINT256_MAX = '1000000000000000000000000000000000000000000000000000000000000000'

let contractNodeManager: ethers.Contract
let contractPow: ethers.Contract
let contractFeeManager: ethers.Contract
let contractBoostNFT: ethers.Contract
let contractBUSD: ethers.Contract
let TOKEN_MAINTENANCE: string

function useToken() {
  const { address, provider, chains, chainId } = eth.useContainer()
  // const defaultProvider = new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL)
  const [tiers, setTiers] = useState<any[]>([])
  const [info, setInfo] = useState<any>({})

  const getContract = (address: string, abi: any) => {
    return new ethers.Contract(
      address,
      abi,
      provider?.getSigner()
    )
  }

  const loadContracts = async () => {
    const { CONTRACT_POW, CONTRACT_NODEMANAGER, CONTRACT_FEEMANAGER, CONTRACT_BOOST } = require(`./address-${chainId}.json`)
    contractNodeManager = getContract(CONTRACT_NODEMANAGER, NodeManagerABI)
    //contractPresale = getContract(CONTRACT_NODEPRESALE, NodePresaleABI)
    contractFeeManager = getContract(CONTRACT_FEEMANAGER, FeeManagerABI)
    contractPow = getContract(CONTRACT_POW, ERC20ABI)
    contractBoostNFT = getContract(CONTRACT_BOOST, BoostNFTABI)
  }
  
  const getMultiplier = async (timeTo:Date) : Promise<BigNumber>=>{
    return await contractBoostNFT.getLastMultiplier(address, Math.floor(timeTo.getTime()/1000))
  }

  const getTiers = async () : Promise<any[]>=>{
    return await contractNodeManager.tiers()
  }

  const getNodes = async (account:string) : Promise<any[]>=>{
    return await contractNodeManager.nodes(account)
  }

  const getUnpaidNodes = async () : Promise<any[]>=>{
    if(!contractNodeManager)
      loadContracts()
    return await contractNodeManager.unpaidNodes()
  }

  const createNode = async (count:number)=>{
    if(!contractNodeManager)
      loadContracts()
    console.log("create", count)
    await(await contractNodeManager.create('default', '', count)).wait()
  }

  const compoundNode = async (count:number)=>{
    if(!contractNodeManager)
      loadContracts()
    await(await contractNodeManager.compound('default', '', count)).wait()
  }

  const transferNode = async (account:string, ids:number[])=>{
    if(!contractNodeManager)
      loadContracts()
    await(await contractNodeManager.transfer(account, ids)).wait()
  }

  const burnNode = async (nodes:number[])=>{
    if(!contractNodeManager)
      loadContracts()
    await(await contractNodeManager.burnNodes(nodes)).wait()
  }

  const claim = async ()=>{
    if(!contractNodeManager)
      loadContracts()
    await(await contractNodeManager.claim()).wait()
  }

  const mintNFT = async ()=>{
    if(!contractBoostNFT)
      loadContracts()
    await(await contractBoostNFT.mint(1, {value:ethers.utils.parseEther(String(5))})).wait()
  }

  const allowance = async () : Promise<boolean>=>{
    if(address) {
      if(!contractPow)
        loadContracts()
      const allowance = await contractPow.allowance(address, contractNodeManager.address)
      if(allowance==undefined) return false
      return allowance.gt(0)
    }
    return false
  }

  const approve = async () => {
    if(!contractPow)
      loadContracts()
    const tx = await contractPow.approve(contractFeeManager.address, UINT256_MAX)
    await tx.wait()
  }

  const ethPrice = async () => {
    const contractChainlink = new ethers.Contract(
      '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
      [{"inputs":[],"name":"latestAnswer","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"}],
      new ethers.providers.JsonRpcProvider("https://mainnet.ethereumpow.org") 
    )
    return Number(ethers.utils.formatUnits(await contractChainlink.latestAnswer(),8))
  }

  const multicall = async () => {
    try {
      const chainId = Number(process.env.NEXT_PUBLIC_RPC_NETWORK)
      const { CONTRACT_POW, CONTRACT_NODECORE, CONTRACT_NODEMANAGER, CONTRACT_FEEMANAGER, CONTRACT_MULTICALL, CONTRACT_BOOST } = require(`./address-${chainId}.json`)
      const chain = chains[chainId]
      if(CONTRACT_MULTICALL!="0x0") await setMulticallAddress(chainId,CONTRACT_MULTICALL)
      const Multicall = new Provider(new ethers.providers.JsonRpcProvider(chain.url), chainId)
      await Multicall.init()
      const NodeManager = new Contract(
        CONTRACT_NODEMANAGER,
        NodeManagerABI
      )
      const NodeCore = new Contract(
        CONTRACT_NODECORE,
        NodeCoreABI
      )
      const FeeManager = new Contract(
        CONTRACT_FEEMANAGER,
        FeeManagerABI
      )
      const Pow = new Contract(
        CONTRACT_POW,
        ERC20ABI
      )
      const BoostNFT = new Contract(
        CONTRACT_BOOST,
        BoostNFTABI
      )
      const calls = []
      calls.push(NodeCore.tiers())
      calls.push(NodeManager.canNodeTransfer())
      calls.push(NodeManager.countTotal())
      calls.push(NodeManager.rewardsTotal())
      calls.push(FeeManager.rateTransferFee())
      calls.push(FeeManager.rateRewardsPoolFee())
      calls.push(FeeManager.rateClaimFee())
      calls.push(FeeManager.rateOperatorFee())
      // calls.push(NodeManager.maxCountOfUser())
      calls.push(NodeManager.minter())
      
      if(address) {
        calls.push(NodeManager.nodes(address))
        calls.push(Multicall.getEthBalance(address))
        calls.push(Pow.balanceOf(address))
        calls.push(Pow.allowance(address,FeeManager.address))
        
        calls.push(NodeManager.countOfUser(address))
        calls.push(NodeManager.claimable(address, true))
        calls.push(NodeManager.owner())

        calls.push(BoostNFT.lastMultiplier(address))
        calls.push(BoostNFT.tokensOf(address))
      }
      // tiers.map(tier=>{
      //   calls.push(NodeManager.countOfTier(tier.name))
      // })
      const ret = await Multicall.all(calls)
      // console.log(ret)
      let index = 0
      const _tiers = ret[index++]
      info.canNodeTransfer = ret[index++]
      info.countTotal = ret[index++]
      info.rewardsTotal = ret[index++]
      info.transferFee = ret[index++]
      info.rewardsPoolFee = ret[index++]
      info.claimFee = ret[index++]
      info.operatorFee = ret[index++]
      // info.maxCountOfUser = ret[index++]
      info.minter = ret[index++]

      if(address) {
        info.nodes = ret[index++]
        info.balanceETH = ret[index++]
        info.balancePow = ret[index++]
        info.approved = BigNumber.from(ret[index++]).gt(0)
        // if(TokenMaintenance) {
        //   info.balanceMaintenance = ret[index++]
        //   // info.decimalsMaintenance = ret[index++]
        //   info.approvedMaintenance = BigNumber.from(ret[index++]).gt(0)
        // }
        info.countOfUser = ret[index++]
        info.unclaimed = ret[index++]
        info.isOwner = ret[index++].toLowerCase()==address.toLowerCase()

        info.multiplier = ret[index++]
        info.boosters = ret[index++]
        // for(const label in airdrop) {
        //   const { addresses } = airdrop[label]
        //   info[`canAirdrop${label}`] = ret[index++] && addresses.indexOf(address.toLowerCase())!=-1
        // }
      }
      // tiers.map((tier)=>{
      //   info[`countOfTier${tier.name}`] = ret[index++]
      // })
      // console.log(info.nodes)
      setTiers(_tiers)
      const priceETH = await ethPrice()
      setInfo({...info, priceETH})
    } catch(ex) {
      console.log(ex)
    }
  }

  useEffect(() => {
    let timer : NodeJS.Timer
    timer = setInterval(()=>multicall(), 3000)
    return ()=>clearInterval(timer)
  })

  useEffect(() => {
    multicall()
  }, [chainId])
  
  return {
    info, 
    tiers, 
    getTiers, 
    allowance, 
    approve, 
    getNodes, 
    getUnpaidNodes,
    createNode, 
    compoundNode, 
    transferNode, 
    burnNode,
    claim, 
    multicall,
    getMultiplier,
    mintNFT
  }
}

export const token = createContainer(useToken)
