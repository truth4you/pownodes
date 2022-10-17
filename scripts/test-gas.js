const { expect } = require("chai")
const { ethers, waffle, upgrades } = require("hardhat")
const fs = require('fs')

let owner, addr1, addr2, addrs;
let NodeGrid, NodeManager, NodePresale, FeeManager, BoostNFT, Router, BUSD, WETH;

const sleep = async (ms) => {
  return new Promise(resolve => setTimeout(resolve,ms))
}
const deploy = async (contractName,...args)=>{
    const factory = await ethers.getContractFactory(contractName)
    const contract = await factory.deploy(...args)
    await contract.deployed()
    console.log(contractName, contract.address)
    return contract
}
const deployProxy = async (contractName,args)=>{
    const factory = await ethers.getContractFactory(contractName)
    const contract = await upgrades.deployProxy(factory,args)
    await contract.deployed()
    console.log(contractName, contract.address)
    return contract
}
const upgradeProxy = async (contractName, contractAddress)=>{
    const factory = await ethers.getContractFactory(contractName)
    const contract = await upgrades.upgradeProxy(contractAddress, factory)
    await contract.deployed()
    console.log(contractName, contract.address)
    return contract
}
const toTimestamp = (date) => parseInt(date==undefined?new Date():new Date(date)/1000)
const setBlockTime = async (date)=>{
  await network.provider.send("evm_setNextBlockTimestamp", [parseInt(date==undefined?new Date():new Date(date)/1000)] )
  await network.provider.send("evm_mine") 
}

describe("Test total", () => {
  it("Deploy", async () => {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    NodeGrid = await deployProxy("NodeGrid")
    await(await NodeGrid.transferOwnership(owner.address)).wait()
    BoostNFT = await deploy("BoostNFT")
    FeeManager = await deployProxy("FeeManager")
    NodeManager = await deployProxy("NodeManager",[FeeManager.address, BoostNFT.address])
    NodePresale = await deploy("NodePresale")
    WETH = await deploy("WETH")
    BUSD = await deploy("BEP20Token")
    const Factory = await deploy("PancakeFactory",WETH.address)
    const path = './contracts/Uniswap/Router.sol'
    const content = fs.readFileSync(path)
    fs.writeFileSync(path,content.toString('utf8').replace(/[\da-f]{64}/mi,String(await Factory.INIT_CODE_PAIR_HASH()).slice(2)))
    Router = await deploy("PancakeRouter", Factory.address, WETH.address)
    const Multicall = await deploy("Multicall")

    await (await NodeGrid.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
    await (await Router.addLiquidityETH(NodeGrid.address, ethers.utils.parseEther("1000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+100 ,{ value: ethers.utils.parseEther("1000") })).wait()
    await (await BUSD.approve(NodeManager.address, ethers.utils.parseEther("100000000"))).wait()
    
    await (await NodeManager.bindFeeManager(FeeManager.address)).wait()
    await (await NodeManager.bindBoostNFT(BoostNFT.address)).wait()
    await (await NodeManager.setPayTokenAddress(BUSD.address)).wait()
    
    await (await NodeGrid.updateRouter(Router.address)).wait()  
    await (await NodeGrid.setNodeManagerAddress(NodeManager.address)).wait()  
    
    await (await NodePresale.updateTokenVest(BUSD.address)).wait()
    await (await NodePresale.allow([addr1.address,addr2.address,addrs[5].address])).wait()
    
    await (await FeeManager.setTreasury(addrs[3].address)).wait()
    await (await FeeManager.setOperator(addrs[4].address)).wait()
    await (await FeeManager.bindManager(NodeManager.address)).wait()
    await (await FeeManager.bindToken(NodeGrid.address)).wait()  

    await (await NodeGrid.setExcludedFromFee(FeeManager.address)).wait()

    await (await NodeGrid.transfer(FeeManager.address, ethers.utils.parseEther("100000"))).wait()

    console.log("Treasury Balance:", ethers.utils.formatEther(await waffle.provider.getBalance(addrs[3].address)))
    console.log("Token price1:", ethers.utils.formatEther(await FeeManager.getAmountETH1(ethers.utils.parseEther("1000"))))
    console.log("Token price2:", ethers.utils.formatEther(await FeeManager.getAmountETH2(ethers.utils.parseEther("1000"))))
  })
  describe("Node Create", () => {
    it('approve as addr1', async () => {
      await (await NodeGrid.transfer(addr1.address, ethers.utils.parseEther("1000"))).wait()
      await (await NodeGrid.connect(addr1).approve(FeeManager.address, ethers.utils.parseEther("1000000000"))).wait()
      expect(await NodeGrid.allowance(addr1.address, FeeManager.address),'allowance').to.equal(ethers.utils.parseEther("1000000000"))
    })
    it('approve as addr2', async () => {
      await (await NodeGrid.transfer(addr2.address, ethers.utils.parseEther("1000"))).wait()
      await (await NodeGrid.connect(addr2).approve(FeeManager.address, ethers.utils.parseEther("1000000000"))).wait()
      expect(await NodeGrid.allowance(addr2.address, FeeManager.address),'allowance').to.equal(ethers.utils.parseEther("1000000000"))
    })
    it("create basic 5 for addr1", async ()=>{
      await setBlockTime("2022-05-01")
      await (await NodeManager.connect(addr1).create("basic","Node1 - BASIC",20)).wait()
      expect(await NodeManager.countTotal()).to.equal(20)
    })
    it("claimable tokens", async()=>{
      await setBlockTime("2022-05-25")
      console.log(await NodeManager.claimable(addr1.address))
    })
  })
  describe("Claim", () => {
    it("claim for addr1", async()=>{
      await setBlockTime("2022-06-25")
      const tx = await (await NodeManager.connect(addr1).claim()).wait()
      console.log(tx.gasUsed)
    })
  })
})