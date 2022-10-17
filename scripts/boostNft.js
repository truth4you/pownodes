const { expect } = require("chai")
const { ethers, upgrades } = require("hardhat")
const fs = require('fs')

const toTimestamp = (date) => parseInt(date==undefined?new Date():new Date(date)/1000)
const setBlockTime = async (date)=>{
  await network.provider.send("evm_setNextBlockTimestamp", [toTimestamp(date)] )
  await network.provider.send("evm_mine") 
}

describe("NFT", ()=>{
  let owner, addr1, addr2, addrs;
  let NFT;

  describe("Deploy", () => {
    it("Deploy", async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
            
        const BoostNFT = await ethers.getContractFactory("BoostNFT");
        NFT = await BoostNFT.deploy();
        await NFT.deployed();
        console.log("NFT", NFT.address)
    })
        
    it("send NFT1", async () => {
        setBlockTime("2022-03-05 00:00:00")
        await(await NFT.setApprovalForAll(addr1.address, true)).wait()
        await(await NFT.safeTransferFrom(owner.address, addr1.address, 3, 1,[])).wait()
    })

    // it("send NFT2", async () => {
    //     setBlockTime("2022-03-08 00:00:00")
    //     await(await NFT.safeTransferFrom(owner.address, addr1.address, 2, 1,[])).wait()
    // })

    // it("send NFT3", async () => {
    //     setBlockTime("2022-03-10 00:00:00")
    //     await(await NFT.connect(addr1).setApprovalForAll(addr2.address, true)).wait()
    //     await(await NFT.connect(addr1).safeTransferFrom(addr1.address, addr2.address, 2, 1,[])).wait()
    // })
    // it("send NFT4", async () => {
    //     setBlockTime("2022-03-12 00:00:00")
    //     await(await NFT.connect(addr1).safeTransferFrom(addr1.address, addr2.address, 3, 1,[])).wait()
    // })
    // it("get Multiplier", async () => {
    //   console.log("addr1 02-28 ~ 03-05", ethers.utils.formatEther(await NFT.getMultiplier(addr1.address, toTimestamp("2022-02-28 00:00:02"), toTimestamp("2022-03-05 00:00:02"))))
    //   console.log("addr1 03-05 ~ 03-08", ethers.utils.formatEther(await NFT.getMultiplier(addr1.address, toTimestamp("2022-03-05 00:00:02"), toTimestamp("2022-03-08 00:00:02"))))
    //   // console.log("addr1 03-08 ~ 03-10", ethers.utils.formatEther(await NFT.getMultiplier(addr1.address, toTimestamp("2022-03-08 00:00:02"), toTimestamp("2022-03-10 00:00:02"))))
    //   // console.log("addr1 03-10 ~ 03-13", ethers.utils.formatEther(await NFT.getMultiplier(addr1.address, toTimestamp("2022-03-10 00:00:02"), toTimestamp("2022-03-13 00:00:02"))))
    //   // console.log("addr1 02-28 ~ 03-13", ethers.utils.formatEther(await NFT.getMultiplier(addr1.address, toTimestamp("2022-02-28 00:00:02"), toTimestamp("2022-03-13 00:00:02"))))
    //   // console.log("1", ethers.utils.formatEther(await NFT.getMultiplier(addr2.address, toTimestamp("2022-02-28"), toTimestamp("2022-03-13"))))
    //   // console.log("1", ethers.utils.formatEther(await NFT.getMultiplier(addrs[3].address, toTimestamp("2022-02-28"), toTimestamp("2022-03-13"))))
    // })
  })

})