const { ethers, network } = require("hardhat")
const { upgradeProxy } = require('../utils')
const fs = require('fs')

async function main() {
  const [owner] = await ethers.getSigners();

  const jsonFile = `${__dirname}/../../state/address-${network.config.chainId}.json`
  const addresses = require(jsonFile)

  console.log("Deploying the contracts with %s on %s", owner.address,network.name)
  let balance = await owner.getBalance()
  console.log("Account balance:", ethers.utils.formatEther(balance))

  await upgradeProxy("FeeManager", addresses.CONTRACT_FEEMANAGER)
  
  balance = balance.sub(await owner.getBalance())
  console.log("Spent Gas:", ethers.utils.formatEther(balance))
  
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
