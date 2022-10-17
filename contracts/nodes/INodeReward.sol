// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface INodeReward {
  function _getNodeNumberOf(address account) external view returns (uint256);
  function _getRewardAmountOf(address account) external view returns (uint256);
}