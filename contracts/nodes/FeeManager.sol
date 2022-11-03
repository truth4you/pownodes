//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "../Uniswap/IUniswapV2Factory.sol";
import "../Uniswap/IUniswapV2Pair.sol";
import "../Uniswap/IUniswapV2Router02.sol";
import '../common/Address.sol';
// import '../common/SafeMath.sol';
import '../common/IERC20.sol';
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// import '@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol';
import "./RouterLibrary.sol";
import "hardhat/console.sol";

interface IToken {
  function operatorFee() external view returns(uint32);
  function getAmountOut(uint256) external view returns(uint256);
}

contract FeeManager is Initializable {
  // using SafeMath for uint256;

  IERC20Upgradeable public token;
  IUniswapV2Router02 public router;
  
  address private treasury;
  address[] private operators;
  mapping (address => bool) private isOperator;
  uint256 public countOperator;

  uint32 public rateTransferFee;
  uint32 public rateRewardsPoolFee;
  uint32 public rateTreasuryFee;
  uint32 public rateOperatorFee;

  bool public enabledTransferETH;

  address public owner;
  address public manager;

  mapping(bytes32 => uint32) public rateUpgradeFee;
  uint32 public rateClaimFee;
  bool public enabledClaimFee;
  
  modifier onlyOwner() {
    require(owner == msg.sender, "FeeManager: caller is not the owner");
    _;
  }

  modifier onlyManager() {
    require(manager == msg.sender, "FeeManager: caller is not the manager");
    _;
  }

  function initialize() public initializer {
    owner = msg.sender;
  
    rateTransferFee = 0;
    rateRewardsPoolFee = 8500;  // 85% for rewards pool
    rateTreasuryFee = 1000;     // 5% for treasury
    rateOperatorFee = 500;      // 5% for team
    rateClaimFee = 3000;

    enabledTransferETH = true;
    enabledClaimFee = false;
    // setRateUpgradeFee("basic", "light", 1000);
    // setRateUpgradeFee("basic", "pro", 1500);
    // setRateUpgradeFee("light", "pro", 1000);
  }

  function ETH() public view returns (string memory) {
    uint256 chainId;
    assembly {
        chainId := chainid()
    }
    if(chainId==4002) return 'FTM';
    if(chainId==43113) return 'AVAX';
    return 'ETH';
  }

  receive() external payable {}

  function transferOwnership(address _owner) public onlyOwner {
    require(
        _owner != address(0),
        "FeeManager: new owner is the zero address"
    );
    owner = _owner;
  }

  function bindManager(address _manager) public onlyOwner {
    require(
        _manager != address(0),
        "FeeManager: new manager is the zero address"
    );
    manager = _manager;
  }

  function setTreasury(address account) public onlyOwner {
    require(treasury != account, "The same account!");
    treasury = account;
  }
  
  function setOperator(address account) public onlyOwner {
    if(isOperator[account]==false) {
      operators.push(account);
      isOperator[account] = true;
      countOperator ++;
    }
  }

  function enableTransferETH(bool _enabled) public onlyOwner {
    enabledTransferETH = _enabled;
  }

  function enableClaimFee(bool _enabled) public onlyOwner {
    enabledClaimFee = _enabled;
  }

  function removeOperator(address account) public onlyOwner {
    if(isOperator[account]==true) {
      isOperator[account] = false;
      countOperator --;
    }
  }

  function setRateRewardsPoolFee(uint32 _rateRewardsPoolFee) public onlyOwner {
    require(rateOperatorFee + rateTreasuryFee + _rateRewardsPoolFee == 10000, "Total fee must be 100%");
    rateRewardsPoolFee = _rateRewardsPoolFee;
  }

  function setRateTreasuryFee(uint32 _rateTreasuryFee) public onlyOwner {
    require(rateTreasuryFee != _rateTreasuryFee,"The same value!");
    require(rateOperatorFee + _rateTreasuryFee + rateRewardsPoolFee == 10000, "Total fee must be 100%");
    rateTreasuryFee = _rateTreasuryFee;
  }

  function setRateOperatorFee(uint32 _rateOperatorFee) public onlyOwner {
    require(rateOperatorFee != _rateOperatorFee,"The same value!");
    require(_rateOperatorFee + rateTreasuryFee + rateRewardsPoolFee == 10000, "Total fee must be 100%");
    rateOperatorFee = _rateOperatorFee;
  }
  
  function setRateTransferFee(uint32 _rateTransferFee) public onlyOwner {
    require(rateTransferFee != _rateTransferFee,"The same value!");
    rateTransferFee = _rateTransferFee;
  }

  function setRateClaimFee(uint32 _rateClaimFee) public onlyOwner {
    require(rateClaimFee != _rateClaimFee,"The same value!");
    rateClaimFee = _rateClaimFee;
  }

  function getRateUpgradeFee(string memory tierNameFrom, string memory tierNameTo) public view returns (uint32) {
    bytes32 key = keccak256(abi.encodePacked(tierNameFrom, tierNameTo));
    return rateUpgradeFee[key];
  }

  function setRateUpgradeFee(string memory tierNameFrom, string memory tierNameTo, uint32 value) public onlyOwner {
    bytes32 key = keccak256(abi.encodePacked(tierNameFrom, tierNameTo));
    rateUpgradeFee[key] = value;
  }

  function bindToken(address _token) public onlyOwner {
    token = IERC20Upgradeable(_token);
    bytes4 routerHash = bytes4(keccak256(bytes('router()')));
    (bool success, bytes memory data) = _token.call(abi.encodeWithSelector(routerHash));
    if(success)
      router = IUniswapV2Router02(abi.decode(data, (address)));
    else
      revert('Token address is invalid.');
  }

  function transferTokenToOperator(address _sender, uint256 _fee, address _token) public onlyManager {
    if(countOperator>0) {
      uint256 _feeEach = _fee / countOperator;
      uint32 j = 0;
      for (uint32 i = 0; i < operators.length; i++) {
        if (!isOperator[operators[i]]) continue;
        if (j == countOperator-1) {
          IERC20(_token).transferFrom(_sender, operators[i], _fee);
          break;
        } else {
          IERC20(_token).transferFrom(_sender, operators[i], _feeEach);
          _fee = _fee - _feeEach;
        }
        j ++;
      }
    } else {
      IERC20(_token).transferFrom(_sender, address(this), _fee);
    }
  }

  function transferFeeToOperator(uint256 _fee) public onlyManager {
    if(countOperator>0) {
      uint256 _feeEach = _fee / countOperator;
      uint32 j = 0;
      for (uint32 i = 0; i < operators.length; i++) {
        if (!isOperator[operators[i]]) continue;
        if (j == countOperator-1) {
          transferETH(operators[i], _fee);
          break;
        } else {
          transferETH(operators[i], _feeEach);
          _fee = _fee - _feeEach;
        }
        j ++;
      }
    }
  }

  function transferETHToOperator() public onlyManager payable {
    if(countOperator>0) {
      uint256 _fee = msg.value;
      uint256 _feeEach = _fee / countOperator;
      uint32 j = 0;
      for (uint32 i = 0; i < operators.length; i++) {
        if (!isOperator[operators[i]]) continue;
        if (j == countOperator-1) {
          payable(operators[i]).transfer(_fee);
          break;
        } else {
          payable(operators[i]).transfer(_feeEach);
          _fee = _fee - _feeEach;
        }
        j ++;
      }
    }
  }

  function transferFee(address _sender, uint256 _fee) public onlyManager {
    require(_fee != 0,"Transfer token amount can't zero!");
    require(treasury!=address(0),"Treasury address can't Zero!");
    require(address(router)!=address(0), "Router address must be set!");

    uint256 _feeTreasury = _fee * rateTreasuryFee / 10000;
    if(_sender!=address(this))
      token.transferFrom(_sender, address(this), _fee);
    transferETH(treasury, _feeTreasury);
    
    if (countOperator > 0) {
      uint256 _feeRewardPool = _fee * rateRewardsPoolFee / 10000;
      uint256 _feeOperator = _fee - _feeTreasury - _feeRewardPool;
      transferFeeToOperator(_feeOperator);
    }
  }

  function transferETH(address recipient, uint256 amount) public onlyManager {
    if(enabledTransferETH) {
      address[] memory path = new address[](2);
      path[0] = address(token);
      path[1] = RouterLibrary.WETH(address(router),ETH());
      token.approve(address(router), amount);

      router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        // address(router),
        // ETH(),
        amount,
        0,
        path,
        recipient,
        block.timestamp
      );
    } else
      transfer(recipient, amount);
  }

  function claimFeeRate(address account) public view returns (uint32) {
    if(!enabledClaimFee) return 0;
    uint32 elapsed = 0;
    bytes4 methodLastTimeSell = bytes4(keccak256(bytes("timeSellLast(address)")));
    (bool success, bytes memory data) = address(token).staticcall(abi.encodeWithSelector(methodLastTimeSell, account));
    if(success) {
      uint32 timeSellLast = uint32(abi.decode(data, (uint32)));
      if(timeSellLast==0) return rateClaimFee;
      elapsed = uint32(block.timestamp) - timeSellLast;
    }
    if(elapsed <= 5 days) return 5000;
    else if(elapsed <= 11 days) return 4000;
    else if(elapsed <= 17 days) return 3000;
    else if(elapsed <= 24 days) return 2000;
    else if(elapsed <= 30 days) return 1000;
    return 100;
  }

  function claim(address to, uint256 amount) public onlyManager {
    uint32 claimRate = claimFeeRate(to);
    if(claimRate>0) {
      uint256 fee = amount * claimRate / 10000;
      uint256 feeOperator = fee * IToken(address(token)).operatorFee() / 100;
      transferFeeToOperator(feeOperator);
      if(fee > feeOperator)
        token.transfer(address(token), fee - feeOperator); // for liquidity
      token.transfer(to, amount - fee);
    } else
      token.transfer(to, amount);
  }

  function transfer(address to, uint256 amount) public onlyManager {
    token.transfer(to, amount);
  }

  function transferFrom(address from, address to, uint256 amount) public onlyManager {
    token.transferFrom(from, to, amount);
  }

  function withdraw(uint256 amount) public onlyOwner {
    require(
      token.balanceOf(address(this)) >= amount,
      'Withdraw: Insufficent balance.'
    );
    token.transfer(address(msg.sender), amount);
  }

  function withdrawETH() public onlyOwner {
    uint256 amount = address(this).balance;

    (bool success, ) = payable(msg.sender).call{value: amount}("");
    require(success, "Failed to send Ether");
  }

  function getAmountETH1(uint256 _amount) public view returns (uint256) {
    if(address(token)==address(0)) return 0;
    return IToken(address(token)).getAmountOut(_amount);
  }

  function getAmountETH2(uint256 _amount) public view returns (uint256) {
    if(address(router)==address(0)) return 0;
    address[] memory path = new address[](2);
    path[0] = address(token);
    path[1] = RouterLibrary.WETH(address(router),ETH());
    uint256[] memory amountsOut = router.getAmountsOut(_amount, path);
    return amountsOut[1];
  }

  function getAmountETH(uint256 _amount) public view returns (uint256) {
    if(address(router)==address(0)) return 0;
    uint256 amount1 = getAmountETH1(_amount);
    uint256 amount2 = getAmountETH2(_amount);
    if(amount1 > amount2)
      return amount1;
    return amount2;
  }

  function getTransferFee(uint256 _amount) public view returns (uint256) {
    return _amount * rateTransferFee / 10000;
  }

  function getClaimFee(uint256 _amount) public view returns (uint256) {
    return _amount * rateClaimFee / 10000;
  }
}