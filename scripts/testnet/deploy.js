const { ethers, network } = require("hardhat")
const { deploy, deployProxy, getAt, sleep } = require('../utils')
const fs = require('fs')

async function main() {
  const [owner] = await ethers.getSigners();

  let addrTreasury = "0x388f90C29a5eb9214dBc58bbcF48cB83e45ef1eC"
  let addrOperator = "0x388f90C29a5eb9214dBc58bbcF48cB83e45ef1eC"
  let addrOwner = "0x84cAE31E38Dc2f7932a725Da6daE87f732635974"
  let addrRouter = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3" //bsc
  if(network.name=="avx-testnet") {
    addrRouter = "0x5db0735cf88F85E78ed742215090c465979B5006" //avx
    addrBUSD = "0x08a978a0399465621e667C49CD54CC874DC064Eb" //avx
    tokenPostfix = "Avax"
  } else if(network.name=="ftm-testnet") {
    addrRouter = "0xa6ad18c2ac47803e193f75c3677b14bf19b94883" //ftm
    addrBUSD = "0x08a978a0399465621e667C49CD54CC874DC064Eb" //ftm
  }
  console.log("Deploying the contracts with %s on %s",owner.address,network.name)
  let balance = await owner.getBalance()
  console.log("Account balance:", ethers.utils.formatEther(balance))

  const deployed = false
  const jsonFile = `${__dirname}/../../state/address-${network.config.chainId}.json`
  const addresses = deployed ? require(jsonFile) : {}

  const Multicall = deployed ? await getAt("Multicall", addresses.CONTRACT_MULTICALL) : await deploy("Multicall")
  const Token = deployed ? await getAt("PowToken", addresses.CONTRACT_POW) : await deployProxy("PowToken")
  const FeeManager = deployed ? await getAt("FeeManager", addresses.CONTRACT_FEEMANAGER) : await deployProxy("FeeManager")
  const NodeCore = deployed ? await getAt("NodeCore", addresses.CONTRACT_NODECORE) : await deployProxy("NodeCore")
  const NodeManager = deployed ? await getAt("NodeManager", addresses.CONTRACT_NODEMANAGER) : await deployProxy("NodeManager", [NodeCore.address, FeeManager.address])

  if(!deployed) {
    addresses.CONTRACT_POW = Token.address
    addresses.CONTRACT_NODEMANAGER = NodeManager.address
    addresses.CONTRACT_FEEMANAGER = FeeManager.address
    addresses.CONTRACT_NODECORE = NodeCore.address   
    addresses.CONTRACT_MULTICALL = Multicall.address
    
    fs.writeFileSync(jsonFile, JSON.stringify(addresses))
  }

  await (await NodeCore.setOperator(NodeManager.address)).wait();

  // await (await Token.setTreasury(addrTreasury)).wait();
  await (await Token.setOperator(addrOperator)).wait();
  await (await Token.setNodeManagerAddress(NodeManager.address)).wait()  
  await (await Token.setExcludedFromFee(addrOwner)).wait()
  await (await Token.setExcludedFromFee(FeeManager.address)).wait()
  await (await Token.transferOwnership(addrOwner)).wait()
  await (await Token.transfer(FeeManager.address, ethers.utils.parseEther("750000"))).wait()
  
  await (await FeeManager.bindManager(NodeManager.address)).wait()
  await (await FeeManager.setTreasury(addrTreasury)).wait()
  await (await FeeManager.setOperator(addrOperator)).wait()
  
  console.log("Token.transferOwnership")
  
  if(network.name=="avx-testnet") {
    const Router = await getAt("IJoeRouter02", addrRouter)
    await (await Token.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
    console.log("Token.approve")
    await (await Router.addLiquidityAVAX(Token.address, ethers.utils.parseEther("150000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+2000 ,{ value: ethers.utils.parseEther("0.5") })).wait()
    console.log("Router.addLiquidityETH")
    await (await Token.updateRouter(Router.address)).wait()
    console.log("Token.updateRouter")
  } else {
    const Router = await getAt("PancakeRouter", addrRouter)
    await (await Token.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
    console.log("Token.approve")
    await (await Router.addLiquidityETH(Token.address, ethers.utils.parseEther("70000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+2000 ,{ value: ethers.utils.parseEther("0.5") })).wait()
    console.log("Router.addLiquidityETH")
    await (await Token.updateRouter(Router.address)).wait()
    console.log("Token.updateRouter")
  }

  await (await FeeManager.bindToken(Token.address)).wait()  

  
  
  // await (await Token.setNodeManagerAddress(NodeManager.address)).wait()  
  // console.log("Token.setNodeManagerAddress")
  // await (await Token.setExcludedFromFee(FeeManager.address)).wait()
  // console.log("Token.setExcludedFromFee")
  // await (await Token.setOperator(addrOperator)).wait()
  // console.log("Token.setOperator")
  
  // await (await NodeManager.bindFeeManager(FeeManager.address)).wait()
  // console.log("NodeManager.bindFeeManager")
  // await (await NodeManager.bindBoostNFT(NFT.address)).wait()
  // console.log("NodeManager.bindBoostNFT")
  // await (await NodeManager.setMinter(owner.address)).wait()
  // console.log("Token.setMinter")
  
  // await (await FeeManager.bindManager(NodeManager.address)).wait()
  // console.log("FeeManager.bindManager")
  // await (await FeeManager.bindToken(Token.address)).wait()  
  // console.log("FeeManager.bindToken")
  // await (await FeeManager.setTreasury(addrTreasury)).wait()
  // console.log("FeeManager.setTreasury")
  // await (await FeeManager.setOperator(addrOperator)).wait()
  // console.log("FeeManager.setOperator")
  
  // await (await NodeManager.transferOwnership(addrOwner)).wait()
  // console.log("NodeManager.transferOwnership")
  // await (await NFT.transferOwnership(addrOwner)).wait()
  // console.log("NFT.transferOwnership")

  balance = balance.sub(await owner.getBalance())
  console.log("Spent Gas:", ethers.utils.formatEther(balance))
  
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
