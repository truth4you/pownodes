const { ethers, network } = require("hardhat")
const { deploy, deployProxy, getAt, sleep } = require('../utils')
const fs = require('fs')

async function main() {
  const [owner] = await ethers.getSigners();

  let addrTreasury = "0x388f90C29a5eb9214dBc58bbcF48cB83e45ef1eC"
  let addrOperator = "0x388f90C29a5eb9214dBc58bbcF48cB83e45ef1eC"
  let addrOwner = "0x84cAE31E38Dc2f7932a725Da6daE87f732635974"
  let addrRouter = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3" //bsc
  let addrBUSD = "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7" //bsc
  let tokenPostfix = ""
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

  const NodeGrid = await deployProxy(`NodeGrid${tokenPostfix}`)
  const NFT = await deploy("BoostNFT")
  const FeeManager = await deployProxy(`FeeManager${tokenPostfix}`)
  const NodeManager = await deployProxy("NodeManager", [FeeManager.address, NFT.address])
  const Multicall = await deploy("Multicall")

  await (await NodeGrid.transferOwnership(addrOwner)).wait()
  console.log("NodeGrid.transferOwnership")
  
  if(network.name=="avx-testnet") {
    const Router = await getAt("IJoeRouter02", addrRouter)
    await (await NodeGrid.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
    console.log("NodeGrid.approve")
    await (await Router.addLiquidityAVAX(NodeGrid.address, ethers.utils.parseEther("70000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+2000 ,{ value: ethers.utils.parseEther("0.5") })).wait()
    console.log("Router.addLiquidityETH")
    await (await NodeGrid.updateRouter(Router.address)).wait()
    console.log("NodeGrid.updateRouter")
  } else {
    const Router = await getAt("PancakeRouter", addrRouter)
    await (await NodeGrid.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
    console.log("NodeGrid.approve")
    await (await Router.addLiquidityETH(NodeGrid.address, ethers.utils.parseEther("70000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+2000 ,{ value: ethers.utils.parseEther("0.5") })).wait()
    console.log("Router.addLiquidityETH")
    await (await NodeGrid.updateRouter(Router.address)).wait()
    console.log("NodeGrid.updateRouter")
  }

  const addresses = {
    CONTRACT_NODEGRID: NodeGrid.address,
    CONTRACT_NODEMANAGER: NodeManager.address,
    CONTRACT_FEEMANAGER: FeeManager.address,
    CONTRACT_BOOST: NFT.address,    
    CONTRACT_MULTICALL: Multicall.address,    
  }
  
  await (await NodeGrid.setNodeManagerAddress(NodeManager.address)).wait()  
  console.log("NodeGrid.setNodeManagerAddress")
  await (await NodeGrid.setExcludedFromFee(FeeManager.address)).wait()
  console.log("NodeGrid.setExcludedFromFee")
  await (await NodeGrid.setOperator(addrOperator)).wait()
  console.log("NodeGrid.setOperator")
  
  await (await NodeManager.setPayTokenAddress(addrBUSD)).wait()
  console.log("NodeManager.setPayTokenAddress")
  await (await NodeManager.bindFeeManager(FeeManager.address)).wait()
  console.log("NodeManager.bindFeeManager")
  await (await NodeManager.bindBoostNFT(NFT.address)).wait()
  console.log("NodeManager.bindBoostNFT")
  await (await NodeManager.setMinter(owner.address)).wait()
  console.log("NodeGrid.setMinter")
  
  await (await FeeManager.bindManager(NodeManager.address)).wait()
  console.log("FeeManager.bindManager")
  await (await FeeManager.bindToken(NodeGrid.address)).wait()  
  console.log("FeeManager.bindToken")
  await (await FeeManager.setTreasury(addrTreasury)).wait()
  console.log("FeeManager.setTreasury")
  await (await FeeManager.setOperator(addrOperator)).wait()
  console.log("FeeManager.setOperator")
  
  // await (await NodeManager.transferOwnership(addrOwner)).wait()
  // console.log("NodeManager.transferOwnership")
  // await (await NFT.transferOwnership(addrOwner)).wait()
  // console.log("NFT.transferOwnership")

  balance = balance.sub(await owner.getBalance())
  console.log("Spent Gas:", ethers.utils.formatEther(balance))
  fs.writeFileSync(`${__dirname}/../../state/address-${network.config.chainId}.json`, JSON.stringify(addresses))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
