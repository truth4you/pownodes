const express = require('express')
// const next = require('next')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs')
const ethers = require('ethers')
const NodeManagerABI = require("../abi/NodeManager.json")
const { default: axios } = require('axios')
let minter = ""
const config = require('../state/chains.json')

app.use(cors({
    origin: '*'
}))
app.use(bodyParser.json())

app.get('/api/wallet', async (req,res) => {
    const balances = {}
    for(let chainId in config) {
        const provider = new ethers.providers.JsonRpcProvider(config[chainId].url)
        if(!minter) {
            const { CONTRACT_NODEMANAGER } = require(`../state/address-${chainId}.json`)
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
})
app.post('/api/wallet', async (req,res)=>{
    const chainId = req.body.chainId
    const { CONTRACT_NODEMANAGER } = require(`../state/address-${chainId}.json`)
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
        if(wallet.address==minter) {
            fs.writeFileSync(`${__dirname}/../state/privkey.json`,`"${req.body.key}"`)
            res.json({success:true})
        } else
            res.json({success:false,message:"Invalid private key."})
    } else
        res.json({success:false,message:"Invalid administrator."})
})
app.post('/api/swap',async (req,res)=>{
    try {
        const { CONTRACT_NODEMANAGER } = require(`../state/address-${req.body.targetChainId}.json`)
        const cfgSrc = config[req.body.sourceChainId]
        const cfgDst = config[req.body.targetChainId]
        const providerDst = new ethers.providers.JsonRpcProvider(cfgDst.url)
        const PRIVATE_KEY = require("../state/privkey.json")
        if(!PRIVATE_KEY) throw new Error("Bridge wallet error!")
        const wallet = new ethers.Wallet(PRIVATE_KEY, providerDst)
        const NodeManager = new ethers.Contract(
            CONTRACT_NODEMANAGER,
            NodeManagerABI,
            wallet
        )
        if(req.query.estimate!==undefined) {
            console.log(req.body.targetChainId, CONTRACT_NODEMANAGER)
            NodeManager.estimateGas.swapOut(req.body.account,req.body.tierName,req.body.count,0)
            .then(async (gas)=>{
                const gasPrice = await providerDst.getGasPrice()
                const prices = await axios.get("https://api.coingecko.com/api/v3/simple/price",{
                    params:{
                        ids:[cfgSrc.coin,cfgDst.coin].join(","),
                        vs_currencies:"usd"
                    }
                })
                const gasAmount = gas.mul(gasPrice).mul(prices.data[cfgDst.coin].usd*1000*2).div(prices.data[cfgSrc.coin].usd*1000)
                const msg = ethers.utils.arrayify(ethers.utils.solidityKeccak256(["uint32", "uint256"], [req.body.targetChainId, gasAmount.toString()]))
                const signature = await wallet.signMessage(msg)
                res.json({success:true, gas: gasAmount.toString(), signature })
            }).catch((e)=>{
                if(e.body) {
                    const ex = JSON.parse(e.body)
                    res.json({success:false,message:ex.error.message})
                } else
                    res.json({success:false,message:e.message})
            })
        } else {
            const { CONTRACT_NODEMANAGER } = require(`../state/address-${req.body.sourceChainId}.json`)
            console.log(req.body.sourceChainId, CONTRACT_NODEMANAGER)
            const providerSrc = new ethers.providers.JsonRpcProvider(cfgSrc.url)
            providerSrc.on({
                address: CONTRACT_NODEMANAGER,
                topics: [
                    ethers.utils.id("SwapIn(address,uint32,string,uint32,int32)"),
                ]
            },async (log) => {
                console.log(log)
            })
            providerSrc.once({
                address: CONTRACT_NODEMANAGER,
                topics: [
                    ethers.utils.id("SwapIn(address,uint32,string,uint32,int32)"),
                    ethers.utils.hexZeroPad(req.body.account,32),
                    ethers.utils.hexZeroPad(req.body.targetChainId,32)
                ]
            },async (log) => {
                const [tierName, amount, limitedTime] = ethers.utils.defaultAbiCoder.decode(
                    ['string', 'uint32', 'int32'],
                    log.data
                )
                const tx = await NodeManager.swapOut(req.body.account,tierName,amount,limitedTime)
                res.json({success:true, hash:tx.transactionHash})
            })
            setTimeout(() => res.json({success:false,message:'Timeout'}), 60000)
        }
    } catch(ex) {
        console.log(ex)
        res.json({success:false,message:ex.message})
    }
})
const port = process.env.PORT || 3000
// const server = next({ dev:false, port })
// const handler = server.getRequestHandler()
// server.prepare().then(() => {
//     app.all('*', (req, res) => {
//         return handler(req, res)
//     })
app.listen(port)
// })