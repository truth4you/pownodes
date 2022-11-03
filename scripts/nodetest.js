const { expect } = require("chai")
const { ethers } = require("hardhat")
const { deploy, deployProxy } = require("./utils")
const fs = require('fs')

const toTimestamp = (date) => parseInt(date==undefined?new Date():new Date(date)/1000)
const setBlockTime = async (date)=>{
  await network.provider.send("evm_setNextBlockTimestamp", [parseInt(date==undefined?new Date():new Date(date)/1000)] )
  await network.provider.send("evm_mine") 
}

describe("NodeManager", ()=>{
  let owner, addr1, addr2, addrs;
  let Token, NodeCore, NodeManager, FeeManager, Router, NFT;

  describe("Deploy", () => {
    it("Deploy", async () => {
      [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
      const addrTreasury = addrs[3].address
      const addrOperator = addrs[4].address

      const WETH = await deploy("WETH")
      const Factory = await deploy("PancakeFactory", WETH.address)
      const path = './contracts/Uniswap/Router.sol'
      const content = fs.readFileSync(path)
      fs.writeFileSync(path,content.toString('utf8').replace(/[\da-f]{64}/mi,String(await Factory.INIT_CODE_PAIR_HASH()).slice(2)))
      Router = await deploy("PancakeRouter", Factory.address, WETH.address)
      const Multicall = await deploy("Multicall")

      Token = await deployProxy("PowToken")
      FeeManager = await deployProxy("FeeManager")
      NodeCore = await deployProxy("NodeCore")
      NodeManager = await deployProxy("NodeManager", [NodeCore.address, FeeManager.address])
      NFT = await deploy("BoostNFT")
      await (await NodeCore.bindBooster(NFT.address)).wait()
      await (await NodeCore.setOperator(NodeManager.address)).wait();

      // await (await Token.setTreasury(addrTreasury)).wait();
      await (await Token.setOperator(addrOperator)).wait();
      await (await Token.setNodeManagerAddress(NodeManager.address)).wait()  
      await (await Token.setExcludedFromFee(FeeManager.address)).wait()
      await (await Token.transferOwnership(owner.address)).wait()
      await (await Token.transfer(FeeManager.address, ethers.utils.parseEther("750000"))).wait()

      await (await FeeManager.bindManager(NodeManager.address)).wait()
      await (await FeeManager.setTreasury(addrTreasury)).wait()
      await (await FeeManager.setOperator(addrOperator)).wait()
    })
    
    it("Add Liquidity", async ()=>{
      await (await Token.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
      await (await Router.addLiquidityETH(Token.address, ethers.utils.parseEther("150000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+100 ,{ value: ethers.utils.parseEther("150") })).wait()
      await (await Token.updateRouter(Router.address)).wait()
      await (await FeeManager.bindToken(Token.address)).wait()  
    })    
  })
  
  return
  
  describe("NFT", () => {

    // it("set NFT address on NodeManager contract", async () => {
    //   await(await NodeManager.setNFTAddress(NFT.address)).wait()
    // })
    it("mint NFT", async () => {
      setBlockTime("2022-12-01")
      await(await NFT.connect(addr1).mint(5, {value:ethers.utils.parseEther("25")})).wait()
      await(await NFT.connect(addr2).mint(3, {value:ethers.utils.parseEther("15")})).wait()
      console.log(addr1.address, ethers.utils.formatEther(await NFT.lastMultiplier(addr1.address)))
      console.log(addr1.address, ethers.utils.formatEther(await NFT.lastMultiplier(addr2.address)))

      setBlockTime("2022-12-02")
      await(await NFT.connect(addr2).transferFrom(addr2.address, addr1.address, 5)).wait()
      console.log(addr1.address, ethers.utils.formatEther(await NFT.lastMultiplier(addr1.address)))
      console.log(addr1.address, ethers.utils.formatEther(await NFT.lastMultiplier(addr2.address)))

      await showMultiplier("2022-12-01", "2022-12-25")

      console.log(await NFT.tokensOf(addr1.address))
    })

    const showMultiplier = async (from, to) => {
      setBlockTime(to)
      console.log(addr1.address, `${from} ~ ${to}`, ethers.utils.formatEther(await NFT.getMultiplier(addr1.address, toTimestamp(from), toTimestamp(to))))
      console.log(addr2.address, `${from} ~ ${to}`, ethers.utils.formatEther(await NFT.getMultiplier(addr2.address, toTimestamp(from), toTimestamp(to))))
    }

    return
     
    it("send NFT1", async () => {
        setBlockTime("2022-12-05")
        await(await NFT.setApprovalForAll(addr1.address, true)).wait()
        await(await NFT.safeTransferFrom(owner.address, addr1.address, 0, 1,[])).wait()
    })
    it("send NFT2", async () => {
        setBlockTime("2022-12-08")
        // await(await NFT.connect(addr1).safeTransferFrom(addr1.address, addr2.address, 0, 1,[])).wait()
        await(await NFT.setApprovalForAll(addrs[3].address, true)).wait()
        // await(await NFT.safeTransferFrom(owner.address, addrs[3].address, 2, 1,[])).wait()
    })
    it("send NFT3", async () => {
        setBlockTime("2022-12-10")
        await(await NFT.setApprovalForAll(addrs[2].address, true)).wait()
        await(await NFT.safeTransferFrom(owner.address, addr2.address, 0, 1,[])).wait()
        await(await NFT.setApprovalForAll(addrs[3].address, true)).wait()
        await(await NFT.safeTransferFrom(owner.address, addrs[3].address, 1, 1,[])).wait()
    })
    it("send NFT4", async () => {
        setBlockTime("2022-12-12")
        await(await NFT.setApprovalForAll(addrs[2].address, true)).wait()
        await(await NFT.safeTransferFrom(owner.address, addr2.address, 0, 1,[])).wait()
        
        await(await NFT.connect(addrs[3]).safeTransferFrom(addrs[3].address, addrs[2].address, 1, 1,[])).wait()
    })
    it("get Multiplier", async () => {
        const multi1 = await NFT.getMultiplier(addr1.address, toTimestamp("2022-02-28"), toTimestamp("2022-03-20"))
        console.log("1.1",ethers.utils.formatEther(multi1))
        const multi11 = await NFT.getMultiplier(addr1.address, toTimestamp("2022-02-28"), toTimestamp("2022-03-13"))
        const multi12 = await NFT.getLastMultiplier(addr1.address, toTimestamp("2022-03-13"));
        console.log("1.2", multi11.toString(), multi12,(multi11*(toTimestamp("2022-03-13")-toTimestamp("2022-02-28"))+(toTimestamp("2022-03-20")-toTimestamp("2022-03-13"))*multi12)/(toTimestamp("2022-03-20")-toTimestamp("2022-02-28")))
        const multi2 = await NFT.getMultiplier(addr2.address, toTimestamp("2022-02-28"), toTimestamp("2022-03-13"))
        console.log("2",multi2/1000000000000000000)
        const multi3 = await NFT.getMultiplier(addrs[3].address, toTimestamp("2022-02-28"), toTimestamp("2022-03-13"))
        console.log("3", multi3/1000000000000000000)
    })
  })

  return

  // describe("Tier Action", () => {
  //   // it("add(new)", async ()=>{
  //   //   await (await NodeManager.addTier("new","7250000000000000000","250000000000000000",86400)).wait()
  //   // })
  //   // let tiers
  //   // it("tiers.length==4", async ()=>{
  //   //   tiers = await NodeManager.tiers()
  //   //   expect(tiers.length).to.equal(4)
  //   // })
  //   // it("tier[3].name==new", async ()=>{
  //   //   expect(tiers[3].name).to.equal("new")
  //   // })
  //   // it("update(new=>extra)", async ()=>{
  //   //   await (await NodeManager.updateTier("new","extra","1350000000000000000","250000000000000000",86400)).wait()
  //   // })
  //   // it("tiers.length==4", async ()=>{
  //   //   tiers = await NodeManager.tiers()
  //   //   expect(tiers.length).to.equal(4)
  //   // })
  //   // it("tier[3].name==extra", async ()=>{
  //   //   expect(tiers[3].name).to.equal("extra")
  //   // })
  //   // it("remove(basic)", async ()=>{
  //   //   await (await NodeManager.removeTier("basic")).wait()
  //   //   expect(await NodeManager.tierTotal()).to.equal(3)
  //   // })
  //   // it("tiers.length==3", async ()=>{
  //   //   tiers = await NodeManager.tiers()
  //   //   expect(tiers.length).to.equal(3)
  //   // })
  //   // it("tier[0].name==light", async ()=>{
  //   //   expect(tiers[0].name).to.equal("light")
  //   // })
  // })

  describe("Node Create", () => {
    it("send tokens", async()=>{
      await (await Token.transfer(addr1.address, ethers.utils.parseEther("500"))).wait()
      expect(await Token.balanceOf(addr1.address)).to.equal(ethers.utils.parseEther("500"))
      await (await Token.transfer(addr2.address, ethers.utils.parseEther("500"))).wait()
      expect(await Token.balanceOf(addr2.address)).to.equal(ethers.utils.parseEther("500"))
    })
    it("approve", async ()=>{
      await (await Token.connect(addr1).approve(FeeManager.address,ethers.utils.parseEther("500"))).wait()
      expect(await Token.allowance(addr1.address,FeeManager.address)).to.equal(ethers.utils.parseEther("500"))
      await (await Token.connect(addr2).approve(FeeManager.address,ethers.utils.parseEther("500"))).wait()
      expect(await Token.allowance(addr2.address,FeeManager.address)).to.equal(ethers.utils.parseEther("500"))
    })
    it("create 2 nodes for addr1", async ()=>{
      await setBlockTime("2022-11-01")
      await (await NodeManager.connect(addr1).create("default","first",2)).wait()
    })
    it("create 3 nodes for addr2", async ()=>{
      await setBlockTime("2022-11-02")
      await (await NodeManager.connect(addr2).create("default","second",3)).wait()
    })
    it("count of nodes", async ()=>{
      expect(await NodeManager.countOfUser(addr1.address)).to.equal(2)
      expect(await NodeManager.countOfUser(addr2.address)).to.equal(3)
      expect(await NodeManager.countOfTier("default")).to.equal(5)
      expect(await NodeManager.countTotal()).to.equal(5)
    })
    it("claimable tokens", async()=>{
      await setBlockTime("2022-11-12")
      console.log("claimable tokens for addr1",ethers.utils.formatEther(await NodeManager.claimable(addr1.address, true)))
      console.log("claimable tokens for addr2",ethers.utils.formatEther(await NodeManager.claimable(addr2.address, true)))
    })
    it("get nodes of addr1", async()=>{
      const nodes = await NodeManager.nodes(addr1.address)
      expect(nodes.length).to.equal(2)
      expect(nodes[0].title).to.equal('first')
    })
    it("get nodes of addr2", async()=>{
      const nodes = await NodeManager.nodes(addr2.address)
      expect(nodes.length).to.equal(3)
      expect(nodes[2].title).to.equal('second')
    })
  })
  describe("Node Compound", () => {
    it("compound 1 for addr1", async()=>{
      await setBlockTime("2022-11-20")
      await (await NodeManager.connect(addr1).compound("default", "third", 1)).wait()
      expect(await NodeManager.countTotal()).to.equal(6)
    })
  })
  describe("Claim", () => {
    it("claim for addr1", async()=>{
      await setBlockTime("2022-11-25")
      console.log("claimable tokens for addr1",ethers.utils.formatEther(await NodeManager.claimable(addr1.address, true)))
      console.log("claimable tokens for addr1(+)",ethers.utils.formatEther(await NodeManager.claimable(addr1.address, false)))
      const bal1 = await Token.balanceOf(addr1.address)
      await (await NodeManager.connect(addr1).claim()).wait()
      const bal2 = await Token.balanceOf(addr1.address)
      console.log(ethers.utils.formatEther(bal1), ethers.utils.formatEther(bal2))
    })
    it("get rewards of addr1", async()=>{
      console.log(ethers.utils.formatEther(await NodeManager.rewardsOfUser(addr1.address)))
      console.log(ethers.utils.formatEther(await Token.balanceOf(addr1.address)))
    })
    it("get rewards of total", async()=>{
      console.log("rewardsTotal",ethers.utils.formatEther(await NodeManager.rewardsTotal()))
      console.log(ethers.utils.formatEther(await Token.balanceOf(FeeManager.address)))
    })
  })
  describe("Node Transfer", () => {
    it("transfer 1 from addr1 to addr2", async()=>{
      await (await NodeManager.connect(addr1).transfer(addr2.address, [0])).wait()
      expect(await NodeManager.countOfUser(addr1.address)).to.equal(2)
      expect(await NodeManager.countOfUser(addr2.address)).to.equal(4)
      expect(await NodeManager.countTotal()).to.equal(6)
    })
  })
  describe("Node Burn", () => {
    it("burn for nodes", async()=>{
      await (await NodeManager.burnNodes([1,2])).wait()
      expect(await NodeManager.countOfUser(addr1.address)).to.equal(1)
      expect(await NodeManager.countOfUser(addr2.address)).to.equal(3)
      expect(await NodeManager.countOfTier("default")).to.equal(4)
      expect(await NodeManager.countTotal()).to.equal(4)
      console.log(await NodeManager.nodes(addr1.address))
    })
    it("burn for addr2", async()=>{
      await (await NodeManager.burnUser(addr2.address)).wait()
      expect(await NodeManager.countOfUser(addr2.address)).to.equal(0)
      expect(await NodeManager.countOfTier("default")).to.equal(1)
      expect(await NodeManager.countTotal()).to.equal(1)
    })
  })


})



  
