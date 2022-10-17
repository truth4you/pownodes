const { ethers, network } = require("hardhat")
const { deploy, deployProxy } = require('../utils')

async function main() {
  const [owner] = await ethers.getSigners();

  let addrRouter = "0x10ED43C718714eb63d5aA57B78B54704E256024E"
  let addrTreasury = "0x388f90C29a5eb9214dBc58bbcF48cB83e45ef1eC"
  let addrOperator = "0x388f90C29a5eb9214dBc58bbcF48cB83e45ef1eC"
  let addrOwner = "0xd1c977aaf2d77d46d50461cd8adf00bde4d5a41e"
  let addrBUSD = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"

  console.log("Deploying the contracts with %s on %s",owner.address,network.name)

  const NodeGrid = await deployProxy("NodeGrid")
  const NFT = await deploy("BoostNFT")
  const FeeManager = await deployProxy("FeeManager")
  const NodeManager = await deployProxy("NodeManager", [FeeManager.address, NFT.address])

  const addresses = {
    CONTRACT_NODEGRID: NodeGrid.address,
    CONTRACT_NODEMANAGER: NodeManager.address,
    CONTRACT_FEEMANAGER: FeeManager.address,
    CONTRACT_BOOST: NFT.address,    
    CONTRACT_MULTICALL: "0x0",    
  }
  
  await (await NodeGrid.setNodeManagerAddress(NodeManager.address)).wait()  
  await (await NodeGrid.setExcludedFromFee(FeeManager.address)).wait()
  await (await NodeGrid.setOperator(addrOperator)).wait()

  await (await NodeManager.setPayTokenAddress(addrBUSD)).wait()
  await (await NodeManager.bindFeeManager(FeeManager.address)).wait()
  await (await NodeManager.bindBoostNFT(NFT.address)).wait()
  
  await (await FeeManager.bindManager(NodeManager.address)).wait()
  // await (await FeeManager.bindToken(NodeGrid.address)).wait()  
  await (await FeeManager.setTreasury(addrTreasury)).wait()
  await (await FeeManager.setOperator(addrOperator)).wait()
  
  await (await NodeGrid.transferOwnership(addrOwner)).wait()
  await (await NodeManager.transferOwnership(addrOwner)).wait()
  await (await FeeManager.transferOwnership(addrOwner)).wait()
  await (await NFT.transferOwnership(addrOwner)).wait()

  fs.writeFileSync(`${__dirname}/../state/address-${network}.json`, JSON.stringify(addresses))
  // fs.writeFileSync(`../state/address.json`, JSON.stringify(addresses))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
