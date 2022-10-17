import { eth } from "state/eth" // ETH state provider
import { ethers } from "ethers" // Ethers
import { Contract, Provider, setMulticallAddress } from "ethers-multicall"
import { useEffect, useState } from "react" // React
import { createContainer } from "unstated-next" // State management
import { BigNumber } from "@ethersproject/bignumber"
import axios from "axios"
import keccak256 from "keccak256"; // Keccak256 hashing
import MerkleTree from "merkletreejs"; // MerkleTree.js

const airdrop = require("../airdrop/data.json")

const NodeManagerABI = require("abi/NodeManager.json")
const NodePresaleABI = require("abi/NodePresale.json")
const FeeManagerABI = require("abi/FeeManager.json")
const ERC20ABI = require("abi/ERC20.json")
const BoostNFTABI = require("abi/BoostNFT.json")
// const MulticallABI = require("abi/Multicall.json")
const UINT256_MAX = '1000000000000000000000000000000000000000000000000000000000000000'

let contractNodeManager: ethers.Contract
let contractNodeGrid: ethers.Contract
let contractFeeManager: ethers.Contract
let contractBoostNFT: ethers.Contract
let contractBUSD: ethers.Contract
let TOKEN_PRESALE: string
let TOKEN_MAINTENANCE: string

const merkleTree : any = {}
const airdrops: any[] = []

function generateLeaf(address: string, tier: string, amount: string): Buffer {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "string", "uint32"], [address, tier, amount])
      .slice(2),
    "hex"
  );
}

for(const label in airdrop) {
  const { tier, amount } = airdrop[label]
  airdrops.push({
    label, tier, amount
  })
  merkleTree[label] = new MerkleTree(
    airdrop[label].addresses.map((addr: string) => generateLeaf(addr, tier, amount)),
    keccak256,
    { sortPairs: true }
  )
}

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
    const { CONTRACT_NODEGRID, CONTRACT_NODEMANAGER, CONTRACT_FEEMANAGER, CONTRACT_BOOST } = require(`./address-${chainId}.json`)
    contractNodeManager = getContract(CONTRACT_NODEMANAGER, NodeManagerABI)
    //contractPresale = getContract(CONTRACT_NODEPRESALE, NodePresaleABI)
    contractFeeManager = getContract(CONTRACT_FEEMANAGER, FeeManagerABI)
    contractNodeGrid = getContract(CONTRACT_NODEGRID, ERC20ABI)
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

  const getUpgradeFee = async (tierFrom:string, tierTo:string, count:number) : Promise<any>=>{
    var fees = await contractNodeManager.getUpgradeFee(tierFrom,tierTo,count);
    return fees[0] as string;
  }

  const getUnpaidNodes = async () : Promise<any[]>=>{
    if(!contractNodeManager)
      loadContracts()
    return await contractNodeManager.unpaidNodes()
  }

  const createNode = async (tier:string, count:number)=>{
    await(await contractNodeManager.create(tier, '', count)).wait()
  }

  const compoundNode = async (tier:string, count:number)=>{
    await(await contractNodeManager.compound(tier, '', count)).wait()
  }

  const transferNode = async (tier:string, count:number, account:string)=>{
    await(await contractNodeManager.transfer(tier, count, account)).wait()
  }

  const upgradeNode = async (tierFrom:string, tierTo:string, count:number)=>{
    const fees = await contractNodeManager.getUpgradeFee(tierFrom,tierTo, count)
    let value = fees[0]
    if(value.gt(info.balanceETH)) {
      const gasPrice = (await provider?.getGasPrice()) ?? 1
      const gas = await contractNodeManager.estimateGas.upgrade(tierFrom, tierTo, count, {value})
      value = info.balanceETH.sub(gas.mul(gasPrice).mul(2))
    }
    await(await contractNodeManager.upgrade(tierFrom, tierTo, count, {value})).wait()
  }

  const swapNode = async (targetChainId: number, tierName: string, count: number) => {
    if(!provider)
      throw new Error("Connect first!")
    const res1 = await axios.post('/api/swap?estimate',{
      sourceChainId: chainId, targetChainId, account: address, tierName, count
    })
    if(!res1.data.success)
      throw new Error(res1.data.message)
    await contractNodeManager.swapIn(targetChainId, tierName, count, res1.data.signature, { value: res1.data.gas })
    const res2 = await axios.post('/api/swap',{
      sourceChainId: chainId, targetChainId, account: address
    })
    if(!res2.data.success)
      throw new Error(res2.data.message)
  }

  const burnNode = async (nodes:number[])=>{
    await(await contractNodeManager.burnNodes(nodes)).wait()
  }

  const claim = async ()=>{
    await(await contractNodeManager.claim()).wait()
  }

  const pay = async (months:number,nodes:number[],fee:BigNumber)=>{
    if(TOKEN_MAINTENANCE==undefined || TOKEN_MAINTENANCE=="0x0000000000000000000000000000000000000000")
      await(await contractNodeManager.pay(months,nodes,{value:fee.toString()})).wait()
    else
      await(await contractNodeManager.pay(months,nodes)).wait()
  }

  const mintNode = async (accounts:string[],tierName:string,count:number)=>{
    await(await contractNodeManager.mint(accounts,tierName,'',count)).wait()
  }

  const allowance = async () : Promise<boolean>=>{
    if(address) {
      const allowance = await contractNodeGrid.allowance(address, contractNodeManager.address)
      if(allowance==undefined) return false
      return allowance.gt(0)
    }
    return false
  }
  const allowanceBusd = async () : Promise<boolean>=>{
    if(address) {
      const allowance = await contractBUSD.allowance(address, contractNodeManager.address)
      if(allowance==undefined) return false
      return allowance.gt(0)
    }
    return false
  }

  const approve = async () => {
    const tx = await contractNodeGrid.approve(contractFeeManager.address, UINT256_MAX)
    await tx.wait()
  }

  const approveBUSD = async () => {
    if(!TOKEN_MAINTENANCE) return
    if(!contractBUSD)
      contractBUSD = getContract(TOKEN_MAINTENANCE, ERC20ABI)
    const tx = await contractBUSD.approve(contractFeeManager.address, UINT256_MAX)
    await tx.wait()
  }

  const claimAirdrop = async (label: string): Promise<void> => {
    if (!address) {
      throw new Error("Not Authenticated");
    }
    const formattedAddress: string = ethers.utils.getAddress(address);
    const { tier, amount } = airdrop[label]
    const leaf: Buffer = generateLeaf(formattedAddress, tier, amount);
    const proof: string[] = merkleTree[label].getHexProof(leaf);
    const tx = await contractNodeManager.claimAirdrop(label, tier, amount, proof);
    await tx.wait(1);
  }

  const updateWallet = async (key: string): Promise<void> => {
    if(!provider) throw new Error("Connect first!")
    if(!/^[a-f0-9]{64}$/i.test(key)) throw new Error("Invalid private key!")
    const signer = provider.getSigner();
    const msg = ethers.utils
      .solidityKeccak256(["string"],["wallet"])
      .slice(2)
    const sign = await signer.signMessage(msg)
    const res = await axios.post(`/api/wallet`,{ chainId, sign, key })
    if(!res.data.success) throw new Error(res.data.message)
  }

  const multicall = async (restart:boolean = false) => {
    try {
      const { CONTRACT_NODEGRID, CONTRACT_NODEMANAGER, CONTRACT_FEEMANAGER, CONTRACT_BOOST, CONTRACT_MULTICALL } = require(`./address-${chainId}.json`)
      const chain = chains[chainId]
      if(CONTRACT_MULTICALL!="0x0") await setMulticallAddress(chainId,CONTRACT_MULTICALL)
      const Multicall = new Provider(new ethers.providers.JsonRpcProvider(chain.url), chainId)
      await Multicall.init()
      const NodeManager = new Contract(
        CONTRACT_NODEMANAGER,
        NodeManagerABI
      )
      const FeeManager = new Contract(
        CONTRACT_FEEMANAGER,
        FeeManagerABI
      )
      const NodeGrid = new Contract(
        CONTRACT_NODEGRID,
        ERC20ABI
      )
      const BoostNFT = new Contract(
        CONTRACT_BOOST,
        BoostNFTABI
      )
      const TokenMaintenance = TOKEN_MAINTENANCE && !restart ? new Contract(
        TOKEN_MAINTENANCE,
        ERC20ABI
      ) : undefined
      const calls = []
      calls.push(NodeManager.feeTokenAddress())
      calls.push(NodeManager.tiers())
      calls.push(NodeManager.canNodeTransfer())
      calls.push(NodeManager.countTotal())
      calls.push(NodeManager.rewardsTotal())
      calls.push(FeeManager.rateTransferFee())
      calls.push(FeeManager.rateRewardsPoolFee())
      calls.push(FeeManager.rateClaimFee())
      calls.push(FeeManager.rateOperatorFee())
      calls.push(NodeManager.maxCountOfUser())
      calls.push(NodeManager.minter())
      
      if(address) {
        calls.push(NodeManager.nodes(address))
        calls.push(Multicall.getEthBalance(address))
        calls.push(NodeGrid.balanceOf(address))
        calls.push(NodeGrid.allowance(address,FeeManager.address))
        if(TokenMaintenance) {
          calls.push(TokenMaintenance.balanceOf(address))
          // calls.push(TokenMaintenance.decimals())
          calls.push(TokenMaintenance.allowance(address,FeeManager.address))
        }
        
        calls.push(NodeManager.countOfUser(address))
        calls.push(NodeManager.unclaimed(address))
        calls.push(NodeManager.owner())

        calls.push(BoostNFT.getLastMultiplier(address, Math.floor(new Date().getTime()/1000)))
        // for(const label in airdrop) {
        //   const { tier, amount } = airdrop[label]
        //   calls.push(NodeManager.canAirdrop(address, tier, amount))
        // }
      }
      tiers.map(tier=>{
        calls.push(NodeManager.countOfTier(tier.name))
      })
      const ret = await Multicall.all(calls)
      // console.log(ret)
      let index = 0
      TOKEN_MAINTENANCE = ret[index++]
      const _tiers = ret[index++]
      info.canNodeTransfer = ret[index++]
      info.countTotal = ret[index++]
      info.rewardsTotal = ret[index++]
      info.transferFee = ret[index++]
      info.rewardsPoolFee = ret[index++]
      info.claimFee = ret[index++]
      info.operatorFee = ret[index++]
      info.maxCountOfUser = ret[index++]
      info.minter = ret[index++]

      if(address) {
        info.nodes = ret[index++]
        info.balanceETH = ret[index++]
        info.balanceNodeGrid = ret[index++]
        info.approvedNodeGrid = BigNumber.from(ret[index++]).gt(0)
        if(TokenMaintenance) {
          info.balanceMaintenance = ret[index++]
          // info.decimalsMaintenance = ret[index++]
          info.approvedMaintenance = BigNumber.from(ret[index++]).gt(0)
        }
        info.countOfUser = ret[index++]
        info.unclaimed = ret[index++]
        info.isOwner = ret[index++].toLowerCase()==address.toLowerCase()
        info.multiplier = ret[index++]
        // for(const label in airdrop) {
        //   const { addresses } = airdrop[label]
        //   info[`canAirdrop${label}`] = ret[index++] && addresses.indexOf(address.toLowerCase())!=-1
        // }
      }
      tiers.map((tier)=>{
        info[`countOfTier${tier.name}`] = ret[index++]
      })
      setTiers(_tiers)
      setInfo({...info})
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
    if(provider) loadContracts()
  }, [provider])

  useEffect(() => {
    multicall(true)
  }, [chainId])
  
  return {
    info, 
    tiers, 
    getTiers, 
    allowance, 
    allowanceBusd,
    approve, 
    approveBUSD,
    getNodes, 
    getUnpaidNodes,
    mintNode,
    createNode, 
    compoundNode, 
    transferNode, 
    upgradeNode, 
    swapNode,
    burnNode,
    pay, 
    claim, 
    multicall,
    getMultiplier,
    claimAirdrop,
    updateWallet,
    airdrops
  }
}

export const token = createContainer(useToken)
