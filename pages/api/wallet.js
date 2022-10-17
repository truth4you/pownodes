const fs = require('fs')
const ethers = require('ethers')
// const tmp = require('os').tmpdir()
const homedir = require('os').homedir()
const config = require('/state/chains.json')
const NodeManagerABI = require("/abi/NodeManager.json")

let minter = ""

export default async function handler(req, res) {
    if(req.method=="GET") {
        const balances = {}
        for(let chainId in config) {
            const provider = new ethers.providers.JsonRpcProvider(config[chainId].url)
            if(!minter) {
                const { CONTRACT_NODEMANAGER } = require(`/state/address-${chainId}.json`)
                const NodeManager = new ethers.Contract(
                    CONTRACT_NODEMANAGER,
                    NodeManagerABI,
                    provider
                )
                minter = await NodeManager.minter()
            }
            balances[chainId] = ethers.utils.formatEther(await provider.getBalance(minter))
        }
        res.json(balances)
    } else if(req.method=="POST") {
        const chainId = req.body.chainId
        const { CONTRACT_NODEMANAGER } = require(`/state/address-${chainId}.json`)
        const provider = new ethers.providers.JsonRpcProvider(config[chainId].url)
        const NodeManager = new ethers.Contract(
            CONTRACT_NODEMANAGER,
            NodeManagerABI,
            provider
        )
        const owner = await NodeManager.owner()
        const msg = ethers.utils
        .solidityKeccak256(["string"],["wallet"])
        .slice(2)
        if(owner==ethers.utils.verifyMessage(msg,req.body.sign)) {
            const minter = await NodeManager.minter()
            const wallet = new ethers.Wallet(req.body.key)
            if(wallet.address.toLowerCase()==minter.toLowerCase()) {
                fs.writeFileSync(`${homedir}/priv.key`,req.body.key)
                res.json({success:true})
            } else
                res.json({success:false,message:"Invalid private key."})
        } else
            res.json({success:false,message:"Invalid administrator."})
    }
}