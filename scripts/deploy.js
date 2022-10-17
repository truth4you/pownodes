const { ethers } = require("hardhat")
const { deploy, deployProxy, upgradeProxy } = require('./utils')
const fs = require('fs')

async function main() {
  const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

  let addrTreasury = "0x388f90C29a5eb9214dBc58bbcF48cB83e45ef1eC"
  let addrOperator = "0x388f90C29a5eb9214dBc58bbcF48cB83e45ef1eC"
  let addrRouter = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3"
  let addrBUSD = "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7"
  let addrOwner = owner.address

  console.log("Deploying the contracts with %s on %s",owner.address,network.name)

  // const NodeLibrary = await deploy("NodeLibrary")
  const NodeGrid = await deployProxy("NodeGrid")
  const NFT = await deploy("BoostNFT")
  const FeeManager = await deployProxy("FeeManager")
  const NodeManager = await deployProxy("NodeManager", [FeeManager.address, NFT.address])

  const WETH = await deploy("WETH")
  const BUSD = await deploy("BEP20Token")
  const Factory = await deploy("PancakeFactory",WETH.address)
  const path = './contracts/Uniswap/Router.sol'
  const content = fs.readFileSync(path)
  fs.writeFileSync(path,content.toString('utf8').replace(/[\da-f]{64}/mi,String(await Factory.INIT_CODE_PAIR_HASH()).slice(2)))
  const Router = await deploy("PancakeRouter", Factory.address, WETH.address)
  const Multicall = await deploy("Multicall")
  addrRouter = Router.address
  addrTreasury = addr3.address
  addrOperator = addr4.address
  addrBUSD = BUSD.address
  await (await NodeGrid.transferOwnership(addrOwner)).wait()
  await (await NodeGrid.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
  await (await Router.addLiquidityETH(NodeGrid.address, ethers.utils.parseEther("70000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+100 ,{ value: ethers.utils.parseEther("430") })).wait()
  await (await BUSD.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
  await (await Router.addLiquidityETH(BUSD.address, ethers.utils.parseEther("100000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+100 ,{ value: ethers.utils.parseEther("1000") })).wait()
  await (await NodeGrid.updateRouter(Router.address)).wait()  

  await (await NodeGrid.setNodeManagerAddress(NodeManager.address)).wait()  
  await (await NodeGrid.setExcludedFromFee(FeeManager.address)).wait()
  await (await NodeGrid.setOperator(addrOperator)).wait()

  await (await NodeManager.setPayTokenAddress(addrBUSD)).wait()
  await (await NodeManager.bindFeeManager(FeeManager.address)).wait()
  await (await NodeManager.bindBoostNFT(NFT.address)).wait()
  await (await NodeManager.setMinter(addr2.address)).wait()

  await (await FeeManager.bindManager(NodeManager.address)).wait()
  await (await FeeManager.bindToken(NodeGrid.address)).wait()  
  await (await FeeManager.setTreasury(addrTreasury)).wait()
  await (await FeeManager.setOperator(addrOperator)).wait()
  
  await (await NodeManager.transferOwnership(addrOwner)).wait()
  await (await FeeManager.transferOwnership(addrOwner)).wait()
  await (await NFT.transferOwnership(addrOwner)).wait()

  const addresses = {
    CONTRACT_NODEGRID: NodeGrid.address,
    CONTRACT_NODEMANAGER: NodeManager.address,
    CONTRACT_FEEMANAGER: FeeManager.address,
    CONTRACT_BOOST: NFT.address,    
    CONTRACT_MULTICALL: Multicall.address,    
  }
  fs.writeFileSync(`${__dirname}/../state/address-${network.config.chainId}.json`, JSON.stringify(addresses))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
