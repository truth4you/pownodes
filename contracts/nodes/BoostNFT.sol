// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import 'hardhat/console.sol';

struct Category {
  uint8 id;
  string name;
  uint256 multiplier;
  uint256 maxSupply;
  uint256 totalSupply;
  uint256 cost;
  address token;
}

struct Log {
  uint256 timestamp;
  uint8 token;
  uint256 multiplier;
}

contract BoostNFT is ERC1155, Ownable {
  using SafeMath for uint256;
  Category[] public categories;
  uint8 public categoryLength;
  mapping(string => uint8) public nameToIndex;
  mapping(address => Log[]) private userLogs;
  mapping(uint8 => Log[]) private tokenLogs;
  
  constructor() ERC1155('https://ipfs.io/ipfs/QmNqL26bqoEkvyEpwrqSsP5KGbFEsSNFKrRMwvLQ74jR59/') {
    add('gold', 10**10, 0.01 ether, 2000, address(0));
    add('silver', 10**10, 0.008 ether, 1500, address(0));
    add('titanium', 10**10, 0.006 ether, 1300, address(0));
    add('copper', 10**10, 0.004 ether, 1200, address(0));
    add('wooden', 10**10, 0.002 ether, 1100, address(0));
  }

  function add(
    string memory name,
    uint256 maxSupply,
    uint256 cost,
    uint32 multiplier,
    address token
  ) public onlyOwner {
    nameToIndex[name] = categoryLength;
    categories.push(Category({
      id: categoryLength,
      name: name,
      multiplier: multiplier,
      maxSupply: maxSupply,
      totalSupply: 0,
      cost: cost,
      token: token
    }));
    Log[] storage logs = tokenLogs[categoryLength];
    logs.push(Log({timestamp: block.timestamp, token: categoryLength, multiplier: multiplier}));
    categoryLength++;
  }

  function set(
    string memory name,
    uint256 maxSupply,
    uint256 cost,
    uint32 multiplier,
    address token
  ) public onlyOwner {
    uint8 id = nameToIndex[name];
    Category storage category = categories[id];
    category.maxSupply = maxSupply;
    category.cost = cost;
    category.multiplier = multiplier;
    category.token= token;
    Log[] storage logs = tokenLogs[id];
    logs.push(Log({timestamp: block.timestamp, token: id, multiplier: multiplier}));
  }

  function mint(
    string memory name,
    uint256 amount
  ) public payable {
    uint8 id = nameToIndex[name];
    require(id<categoryLength, "Invalid token index.");
    Category storage category = categories[uint8(id)];
    category.totalSupply = category.totalSupply.add(amount);
    require(category.totalSupply<=category.maxSupply,"Overflow max supply.");
    uint256 price = category.cost.mul(amount);
    if(category.token==address(0))
      require(msg.value >= price, "Insufficient ETH for purchase.");
    else {
      IERC20 token = IERC20(category.token);
      require(token.balanceOf(msg.sender) >= price, "Insufficient Token for purchase.");
      token.transferFrom(msg.sender, owner(), price);
    }
    _mint(msg.sender, id, amount, '');
    _calcMultiplier(msg.sender);
  }

  function _calcMultiplier(address account) internal {
    Log[] storage logs = userLogs[account];
    uint256 multiplier = 1000;
    uint8 token = 0;
    for (uint8 i = 0; i < categories.length; i++) {
      Category storage category = categories[i];
      if (balanceOf(account, category.id) > 0 && multiplier < category.multiplier) {
        token = category.id;
        multiplier = category.multiplier;
      }
    }
    if (logs.length==0 || logs[logs.length - 1].multiplier != multiplier) {
      logs.push(Log({timestamp: block.timestamp, token: token, multiplier: multiplier}));
    }
  }

  function _safeTransferFrom(
    address from,
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) internal override {
    super._safeTransferFrom(from, to, id, amount, data);

    _calcMultiplier(from);
    _calcMultiplier(to);
  }

  function getLastMultiplier(address account, uint256 timeTo) public view returns (uint256) {
    Log[] storage logs = userLogs[account];
    uint256 one = 1 ether;
    if(logs.length==0)
      return one;
    for (uint256 i = logs.length - 1; i >= 0; i--) {
      if (logs[i].timestamp <= timeTo) return one.mul(logs[i].multiplier).div(1000);
    }
    return one;
  }

  function getMultiplier(
    address account,
    uint256 timeFrom,
    uint256 timeTo
  ) public view returns (uint256) {
    uint256 multiplier = 0;
    uint256 timeBlockEnd = timeTo;
    uint256 one = 1 ether;
    if(timeTo==timeFrom)
      return one;
    Log[] storage logsUser = userLogs[account];
    if(logsUser.length==0)
      return one;
    for (uint256 i = logsUser.length; i > 0; i--) {
      uint256 timeBlockStart = logsUser[i - 1].timestamp > timeFrom
        ? logsUser[i - 1].timestamp
        : timeFrom;
      if (timeTo < timeBlockStart) continue;
      uint256 duration = timeBlockEnd - timeBlockStart;
      multiplier = one.mul(logsUser[i - 1].multiplier).mul(duration).div(1000).add(multiplier);
      Log[] storage logsToken = tokenLogs[logsUser[i - 1].token];
      uint256 timeTokenEnd = timeBlockEnd;
      for (uint256 j = logsToken.length; j > 0; j--) {
        uint256 timeTokenStart = logsToken[j - 1].timestamp;
        if (timeBlockEnd < timeTokenStart) continue;
        if (timeTokenStart < timeBlockStart) timeTokenStart = timeBlockStart;
        if (timeTokenEnd > timeBlockEnd) timeTokenEnd = timeBlockEnd;
        duration = timeTokenEnd - timeTokenStart;
        if (logsUser[i - 1].multiplier > logsToken[j - 1].multiplier)
          multiplier = multiplier.sub(
            one.mul(logsUser[i - 1].multiplier - logsToken[j - 1].multiplier).mul(duration).div(1000)
          );
        else if (logsUser[i - 1].multiplier < logsToken[j - 1].multiplier)
          multiplier = multiplier.add(
            one.mul(logsToken[j - 1].multiplier - logsUser[i - 1].multiplier).mul(duration).div(1000)
          );
        timeTokenEnd = logsToken[j - 1].timestamp;
        if (timeBlockStart >= timeTokenEnd) break;
      }
      timeBlockEnd = timeBlockStart;
      if (timeFrom >= timeBlockEnd) break;
    }
    if (timeFrom < timeBlockEnd) {
      multiplier = multiplier.add(one.mul(timeBlockEnd.sub(timeFrom)));
    }
    return multiplier.div(timeTo.sub(timeFrom));
  }

  function setMultiplier(string memory name, uint256 multiplier) public {
    uint8 id = nameToIndex[name];
    Category storage category = categories[id];      
    category.multiplier = multiplier;
    Log[] storage logs = tokenLogs[id];
    logs.push(Log({timestamp: block.timestamp, token: id, multiplier: multiplier}));
  }

  function uri(uint256 id) public view override returns (string memory) {
    Category storage category = categories[id]; 
    bytes memory name = bytes(category.name);
    require(name.length > 0, 'Invalid token id.');
    string memory _uri = super.uri(id);
    return string(bytes.concat(bytes(_uri), name, bytes('.json')));
  }

  function getBalanceOf(address account, string memory name) public view returns (uint256) {
    uint256 id = uint256(nameToIndex[name]);
    require(id < categories.length, 'Invalid token name.');
    return balanceOf(account, id);
  }
}
