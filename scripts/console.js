const { ethers, network } = require("hardhat")
const { getAt, deploy, deployProxy, upgradeProxy } = require('./utils')
const fs = require('fs')

async function main() {
  const [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

  await deploy("Sample")
  // const F1 = await deployProxy("FeeManagerOld")
  // await (await F1.setTreasury(owner.address))
  // console.log(await F1.treasury())
  // const F2 = await upgradeProxy("FeeManager",F1.address)
  // console.log(await F2.treasury())

  // for(let i = 0;i<10;i++) {
  //   const addr = addrs[parseInt(Math.random()*3)]
  //   await (await NodeModel.insert('basic',addr.address,0)).wait()
  //   let deleted = false
  //   if(Math.random()>0.5) {
  //     await (await NodeModel.burn(i+1)).wait()
  //     deleted = true
  //   }
  //   console.log(addr.address, deleted)
  // }
  // console.log(await NodeModel.count(addrs[0].address,'basic'),await NodeModel.countOfUser(addrs[0].address))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
