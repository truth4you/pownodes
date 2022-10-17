const fs = require('fs')
const ethers = require('ethers')
const axios = require('axios')
const config = require('/state/chains.json')
const NodeManagerABI = require("/abi/NodeManager.json")
const PRIVATE_KEY = process.env.PRIVATE_KEY
// const tmp = require('os').tmpdir()
// const homedir = require('os').homedir()
// const PRIVATE_KEY = ""

export default async function handler(req, res) {
    if(req.method=="POST") {
        try {
            const { CONTRACT_NODEMANAGER } = require(`/state/address-${req.body.targetChainId}.json`)
            const cfgSrc = config[req.body.sourceChainId]
            const cfgDst = config[req.body.targetChainId]
            const providerDst = new ethers.providers.JsonRpcProvider(cfgDst.url)
            // console.log(PRIVATE_KEY)
            // if(!fs.existsSync(`${homedir}/priv.key`)) throw new Error("Bridge wallet error!")
            // const PRIVATE_KEY = fs.readFileSync(`${homedir}/priv.key`,{encoding:'latin1', flag:'r'})
            if(!PRIVATE_KEY) throw new Error("Bridge wallet error!")
            const wallet = new ethers.Wallet(PRIVATE_KEY, providerDst)
            const NodeManager = new ethers.Contract(
                CONTRACT_NODEMANAGER,
                NodeManagerABI,
                wallet
            )
            if(req.query.estimate!==undefined) {
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
                const { CONTRACT_NODEMANAGER } = require(`/state/address-${req.body.sourceChainId}.json`)
                const providerSrc = new ethers.providers.JsonRpcProvider(cfgSrc.url)
                // providerSrc.on({
                //     address: CONTRACT_NODEMANAGER,
                //     topics: [
                //         ethers.utils.id("SwapIn(address,uint32,string,uint32,int32)"),
                //     ]
                // },async (log) => {
                //     console.log(log)
                // })
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
            res.json({success:false,message:ex.message})
        }
    }
}