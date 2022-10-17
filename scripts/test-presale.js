const { ethers, waffle } = require("hardhat")
const { deploy, deployProxy, upgradeProxy } = require('./utils')
const fs = require('fs')

let owner, addr1, addr2, addr3, addrs;
let NodePresale, Router, BUSD, WETH;

describe("Test Presale", () => {
    it("Deploy", async () => {
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

        WETH = await deploy("WETH")
        BUSD = await deploy("BEP20Token")
        const Factory = await deploy("PancakeFactory", false, WETH.address)
        const path = './contracts/Uniswap/Router.sol'
        const content = fs.readFileSync(path)
        fs.writeFileSync(path,content.toString('utf8').replace(/[\da-f]{64}/mi,String(await Factory.INIT_CODE_PAIR_HASH()).slice(2)))
        Router = await deploy("PancakeRouter", false, Factory.address, WETH.address)

        NodePresale = await deploy("NodePresale")
        await (await NodePresale.updateTokenVest(BUSD.address)).wait()
        await (await NodePresale.updateRouter(Router.address)).wait()
    })
    it("Add Liquidity", async () => {
        await (await BUSD.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
        await (await Router.addLiquidityETH(BUSD.address, ethers.utils.parseEther("1000000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+100 ,{ value: ethers.utils.parseEther("1000") })).wait()
    })
    it("Add Whitelist", async () => {
        await (await NodePresale.allow([addr1.address,addr2.address,addr3.address])).wait()
    })
    it("Remove Whitelist", async () => {
        await (await NodePresale.deny([addr3.address])).wait()
    })
    it("Remove start", async () => {
        await (await NodePresale.start(0)).wait()
    })
    it("Send with BUSD", async () => {
        await (await BUSD.transfer(addr1.address, ethers.utils.parseEther("10000"))).wait()
        await (await BUSD.connect(addr1).approve(NodePresale.address, ethers.utils.parseEther("100000000"))).wait()
        console.log("BUSD Balance:", ethers.utils.formatEther(await BUSD.balanceOf(addr1.address)))
        console.log("BUSD Balance:", ethers.utils.formatEther(await BUSD.balanceOf(owner.address)))
        await (await NodePresale.connect(addr1).vest()).wait()
        console.log("BUSD Balance:", ethers.utils.formatEther(await BUSD.balanceOf(addr1.address)))
        console.log("BUSD Balance:", ethers.utils.formatEther(await BUSD.balanceOf(owner.address)))
    })
    it("Send with BNB", async () => {
        console.log("ETH Balance:", ethers.utils.formatEther(await waffle.provider.getBalance(addr2.address)))
        console.log("BUSD Balance:", ethers.utils.formatEther(await BUSD.balanceOf(owner.address)))
        const amount = await NodePresale.getCostETH()
        await (await NodePresale.connect(addr2).vest({value:amount})).wait()
        console.log("ETH Balance:", ethers.utils.formatEther(await waffle.provider.getBalance(addr2.address)))
        console.log("BUSD Balance:", ethers.utils.formatEther(await BUSD.balanceOf(owner.address)))
    })
})