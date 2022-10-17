const { ethers, network } = require("hardhat")
const { getAt, deploy, deployProxy, upgradeProxy } = require('./utils')

async function main() {
  const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

  console.log("Deploying the contracts with %s on %s",owner.address,network.name)

  const NodeLibrary = await deploy("NodeLibrary")
  const NFT = await deploy("BoostNFT")
  const FeeManager = await deployProxy("FeeManager")
  const NodeManager = await deployProxy("NodeManager", [FeeManager.address, NFT.address], {NodeLibrary:NodeLibrary.address})
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
