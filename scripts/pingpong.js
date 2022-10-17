const { ethers } = require("hardhat")
const { deploy, deployProxy, upgradeProxy } = require('./utils')
const fs = require('fs')

async function main() {
    const chainIds = {
        "bsc-testnet": 10002,
        "ftm-testnet": 10012,
        "avx-testnet": 10006
    }
    const endpoints = {
        "bsc-testnet": "0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1",
        "ftm-testnet": "0x7dcAD72640F835B0FA36EFD3D6d3ec902C7E5acf",
        "avx-testnet": "0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706"
    }
    const [owner] = await ethers.getSigners();
    console.log("Deploying the contracts with %s on %s",owner.address,network.name)
    const PingPong = await deploy("PingPong", endpoints[network.name])
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
