import { ethers } from "ethers" // Ethers
import Onboard from "bnc-onboard" // Onboard.js
import { useEffect, useState } from "react" // React
import { createContainer } from "unstated-next" // State management

// Types
import type {
  API,
  WalletInitOptions,
  WalletModule,
} from "bnc-onboard/dist/src/interfaces"
import type { Web3Provider } from "@ethersproject/providers"

const networkId = Number(process.env.NEXT_PUBLIC_RPC_NETWORK ?? 43113)
const wallets: (WalletModule | WalletInitOptions)[] = [
  { walletName: "metamask" },
  // {
  //   walletName: "walletConnect",
  //   networkId,
  //   rpc: {
  //     [networkId]: process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc",
  //   },
  // },
]

const chains:any = require('./chains.json')

function useEth() {
  const [address, setAddress] = useState<string | null>(null) // User address
  const [onboard, setOnboard] = useState<API | null>(null) // Onboard provider
  const [provider, setProvider] = useState<Web3Provider | null>(null) // Ethers provider
  const [chainId, setChainId] = useState<number>(Number(process.env.NEXT_PUBLIC_RPC_NETWORK))
  let lockFlag = false

  const unlock = async () => {
    if(onboard) {
      lockFlag = true
      initializeOnboard()
      const walletSelected: boolean = await onboard.walletSelect()
      if (walletSelected) {
        if(await onboard.walletCheck()==false) {
          lock()
        }
      } else
        lock()
      lockFlag = false
    }
  }

  const lock = async () => {
    setAddress(null)
    setProvider(null)
    window.localStorage.removeItem("selectedWallet")
    onboard?.walletReset()
  }

  const switchChain = async (chain:number = Number(process.env.NEXT_PUBLIC_RPC_NETWORK)) => {
    lockFlag = true
    if(onboard && address) {
      const state = onboard.getState()
      try {
        await state.wallet.provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{chainId:`0x${chain.toString(16)}`}],
        })
      } catch(ex:any) {
        if (ex.code === 4902) {
          const chainNew = chains[chain]
          await state.wallet.provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId:`0x${chain.toString(16)}`,
              chainName: chainNew.name,
              rpcUrls: [chainNew.url]
            }],
          })
        } else
          throw ex
      }
      setProvider(new ethers.providers.Web3Provider(onboard.getState().wallet.provider))
    }
    setChainId(chain)
    lockFlag = false
  }

  const initializeOnboard = () => {
    const onboard = Onboard({
      networkId: chainId,
      hideBranding: true,
      darkMode: true, 
      walletSelect: {
        heading: `Connect to PowNodes App`,
        description: `Please select a wallet to authenticate with $POW.`,
        wallets: wallets,
      },
      subscriptions: {
        address: async (address) => {
          setAddress(address)
          if (!address) {
            setProvider(null)
          }
        },
        wallet: async (wallet) => {
          if (wallet.provider) {
            const provider = new ethers.providers.Web3Provider(wallet.provider)
            setProvider(provider)
            window.localStorage.setItem("selectedWallet", wallet.name ?? "")
          } else if(!address) {
            setProvider(null)
          }
        },
        network: async (network) => {
          if(network && chainId!=network && !lockFlag) {
            // if(chains[network]==undefined)
            //   lock()
            // else {
            const state = onboard.getState()
            setProvider(new ethers.providers.Web3Provider(state.wallet.provider))
            setChainId(network)
            // }
          }
        }
      },
      walletCheck: [{ checkName: "connect" }, { checkName: "network" }],
    })
    setOnboard(onboard)
  }
  useEffect(initializeOnboard,[chainId])
  useEffect(() => {
    const previouslySelectedWallet = window.localStorage.getItem("selectedWallet")
    if (previouslySelectedWallet && onboard) {
      onboard.walletSelect(previouslySelectedWallet)
    }
  }, [onboard])
  return { address, provider, chains, chainId, unlock, lock, switchChain }
}

export const eth = createContainer(useEth)
