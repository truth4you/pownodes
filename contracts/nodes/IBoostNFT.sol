// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IBoostNFT {
    function getMultiplier(address, uint256, uint256) external view returns (uint256);
    function lastMultiplier(address) external view returns (uint256);
}