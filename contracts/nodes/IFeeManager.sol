//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "../Uniswap/IUniswapV2Router02.sol";
import '../common/Address.sol';
import '../common/SafeMath.sol';
import '../common/IERC20.sol';
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IFeeManager {
  function transferTokenToOperator(address _sender, uint256 _fee, address _token) external;
  function transferFeeToOperator(uint256 _fee) external;
  function transferETHToOperator() payable external;
  function transferFee(address _sender, uint256 _fee) external;
  function transferETH(address _recipient, uint256 _amount) external;
  function claim(address to, uint256 amount) external;
  function transfer(address to, uint256 amount) external;
  function transferFrom(address from, address to, uint256 amount) external;
  function getAmountETH(uint256 _amount) external view returns (uint256);
  function getTransferFee(uint256 _amount) external view returns (uint256);
  function getClaimFee(uint256 _amount) external view returns (uint256);
  function getRateUpgradeFee(string memory tierNameFrom, string memory tierNameTo) external view returns (uint32);
}
