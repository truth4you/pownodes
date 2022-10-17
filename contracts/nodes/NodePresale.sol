//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '../common/SafeMath.sol';
import '../common/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '../Uniswap/IUniswapV2Router02.sol';
import 'hardhat/console.sol';

contract NodePresale is Ownable {
    using SafeMath for uint256;

    address[] private addresses;
    mapping (address => bool) public allowance;
    mapping (address => bool) public supplies;
    uint256 public totalSupply = 0;
    uint256 public maxSupply = 150;
    uint256 public totalPlan = 0;
    uint256 public maxPlan = 200;
    uint256 public endTime = 0;
    uint256 public duration = 1 days;
    bool public started = false;
    uint256 public minVest = 1000 ether;
    uint256 public maxVest = 1000 ether;
    address public tokenVest = address(0);
    string public tokenVestSymbol = 'BNB';
    uint8 public tokenVestDecimals = 18;
    IUniswapV2Router02 router;

    function updateDuration(uint256 _duration) public onlyOwner {
        require(started==false, "Already started");
        duration = _duration;
        endTime = block.timestamp.add(_duration);
    }

    function updateEndTime(uint256 _endTime) public onlyOwner {
        require(started==false, "Already started");
        endTime = _endTime;
    }

    function updateMaxPlan(uint256 _maxPlan) public onlyOwner {
        maxPlan = _maxPlan;
    }

    function updateMaxSupply(uint256 _maxSupply) public onlyOwner {
        maxSupply = _maxSupply;
    }

    function updateMaxVest(uint256 _maxVest) public onlyOwner {
        maxVest = _maxVest;
    }

    function updateMinVest(uint256 _minVest) public onlyOwner {
        minVest = _minVest;
    }

    function updateTokenVest(address _tokenVest) public onlyOwner {
        tokenVest = _tokenVest;
        if(_tokenVest==address(0)) {
            tokenVestDecimals = 18;
            tokenVestSymbol = "BNB";
        } else {
            IERC20Metadata token = IERC20Metadata(_tokenVest);
            tokenVestSymbol = token.symbol();
            tokenVestDecimals = token.decimals();
        }
    }

    function updateRouter(address _router) public onlyOwner {
        router = IUniswapV2Router02(_router);
    }

    function start(uint256 _endTime) public onlyOwner {
        if(_endTime>block.timestamp)
            updateEndTime(_endTime);
        else if(endTime<block.timestamp)
            updateDuration(duration);
        started = true;
    }

    function allow(address[] memory _accounts) public onlyOwner {
        for(uint256 i = 0;i<_accounts.length;i++) {
            address account = _accounts[i];
            if(!allowance[account]) {
                addresses.push(account);
                allowance[account] = true;
                totalPlan ++;
            }
        }
        require(totalPlan < maxPlan, "Cannot add more addresses because of overflow MAX_PLAN.");
    }

    function deny(address[] memory _accounts) public onlyOwner {
        for(uint256 i = 0;i<_accounts.length;i++) {
            address account = _accounts[i];
            if(allowance[account] && !supplies[account]) {
                allowance[account] = false;
                totalPlan --;
            }
        }
    }

    function whitelist(bool _supplied) public view returns (address[] memory) {
        uint256 len = _supplied ? totalSupply : totalPlan;
        address[] memory accounts = new address[](len);
        if(len==0) return accounts;
        uint256 j = 0;
        for(uint256 i = 0;i<addresses.length;i++) {
            address account = addresses[i];
            if(_supplied && !supplies[account])
                continue;
            if(allowance[account]) 
                accounts[j++] = account;
        }
        return accounts;
    }

    function getCostETH() public view returns (uint256) {
        uint256 amount = minVest.mul(tokenVestDecimals).div(18);
        if(tokenVest==address(0)) 
            return amount;
        require(address(router)!=address(0), "Invalid router address.");
        address[] memory path = new address[](2);
        path[0] = router.WETH();
        path[1] = address(tokenVest);
        uint256[] memory amountsIn = router.getAmountsIn(amount, path);
        return amountsIn[0];
    }

    function vest() public payable {
        address vester = msg.sender;
        require(started==true, "Presale does not started.");
        require(block.timestamp<endTime, "Presale finished.");
        require(allowance[vester]==true, "Not allowed vester.");
        require(supplies[vester]==false, "Already vested.");
        require(totalSupply<maxSupply, "Max supply overflow.");
        if(tokenVest==address(0)) {
            require(msg.value>=minVest && msg.value<=maxVest, "Insufficient BNB value.");
            payable(owner()).transfer(msg.value);
        } else if(msg.value > 0) {
            require(msg.value>=getCostETH(), "Insufficient BNB value.");
            uint256 amountSend = maxVest.mul(tokenVestDecimals).div(18);
            address[] memory path = new address[](2);
            path[0] = router.WETH();
            path[1] = address(tokenVest);
            router.swapETHForExactTokens{value:msg.value}(
                amountSend,
                path,
                owner(),
                block.timestamp
            );
        } else {
            uint256 amountSend = maxVest.mul(tokenVestDecimals).div(18);
            IERC20 token = IERC20(tokenVest);
            require(token.balanceOf(vester)>=amountSend, "Insufficient Token balance");
            token.transferFrom(vester, owner(), amountSend);
        }
        supplies[vester] = true;
        totalSupply ++;
    }
}