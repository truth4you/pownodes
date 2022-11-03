// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import './BoostNFT721.sol';

contract BoostNFT is BoostNFT721 {
  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    return string(abi.encode("https://ipfs.io/ipfs/QmNqL26bqoEkvyEpwrqSsP5KGbFEsSNFKrRMwvLQ74jR59/", tokenId, ".json"));
  }
}
