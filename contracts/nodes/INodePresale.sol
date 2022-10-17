//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface INodePresale {
  function allowance(address _account) external view returns (bool);
  function supplies(address _account) external view returns (bool);
}