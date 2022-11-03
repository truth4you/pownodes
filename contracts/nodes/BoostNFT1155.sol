// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import 'hardhat/console.sol';

struct Rarity {
  uint8 id;
  string name;
  uint32 multiplier;
  uint256 maxSupply;
  uint256 totalSupply;
  uint256 cost;
}

struct Log {
  uint8 token;
  uint256 timestamp;
  uint256 multiplier;
}

contract BoostNFT1155 is ERC1155, Ownable {
  Rarity[] public categories;
  address public currency;
  mapping(string => uint8) public nameToIndex;
  mapping(address => Log[]) private userLogs;
  mapping(uint8 => Log[]) private tokenLogs;
  
  constructor() ERC1155('https://ipfs.io/ipfs/QmNqL26bqoEkvyEpwrqSsP5KGbFEsSNFKrRMwvLQ74jR59/') {
    add('Platinum', 1 ether, 5 * 10**10, 1100);
    add('Diamond', 1 ether, 25 * 10**10, 1030);
    add('Gold', 1 ether, 70 * 10**10, 1010);
  }

  function add(
    string memory name,
    uint256 cost,
    uint256 maxSupply,
    uint32 multiplier
  ) public onlyOwner {
    uint8 id = uint8(categories.length);
    nameToIndex[name] = id;
    categories.push(Rarity({
      id: id,
      name: name,
      cost: cost,
      multiplier: multiplier,
      maxSupply: maxSupply,
      totalSupply: 0
    }));
    Log[] storage logs = tokenLogs[id];
    logs.push(Log({timestamp: block.timestamp, token: id, multiplier: multiplier}));
  }

  function set(
    string memory name,
    uint256 cost,
    uint256 maxSupply,
    uint32 multiplier
  ) public onlyOwner {
    uint8 id = nameToIndex[name];
    Rarity storage category = categories[id];
    category.cost = cost;
    category.maxSupply = maxSupply;
    category.multiplier = multiplier;
    Log[] storage logs = tokenLogs[id];
    logs.push(Log({timestamp: block.timestamp, token: id, multiplier: multiplier}));
  }

  function random(uint256 seed) internal view returns (uint8) {
    uint256 totalSupply = 0;
    for(uint8 i = 0;i<categories.length;i++) {
      totalSupply += categories[i].maxSupply - categories[i].totalSupply;
    }
    seed %= totalSupply;
    for(uint8 i = 0;i<categories.length;i++) {
      totalSupply -= categories[i].maxSupply - categories[i].totalSupply;
      if(seed >= totalSupply) return i;
    }
    return 0;
  }

  function mint(uint256 amount) public payable {
    uint256 price = 0;
    uint256[] memory amounts = new uint256[](categories.length);
    for(uint256 i = 0;i<amount;i++) {
      uint256 seed = uint256(
        keccak256(abi.encode(block.timestamp, block.difficulty, block.number, i))
      );
      uint8 id = random(seed);
      amounts[id] ++;
      price += categories[id].cost;
    }
    if(currency==address(0))
      require(msg.value >= price, "Insufficient ETH for purchase.");
    else {
      IERC20 token = IERC20(currency);
      require(token.balanceOf(msg.sender) >= price, "Insufficient Token for purchase.");
      token.transferFrom(msg.sender, owner(), price);
    }
    for(uint8 id = 0;id<categories.length;id++) {
      if(amounts[id]==0) continue;
      Rarity storage category = categories[id];
      category.totalSupply += amounts[id];
      require(category.totalSupply <= category.maxSupply,"Overflow max supply.");
      _mint(msg.sender, id, amounts[id], '');
    }
    _calcMultiplier(msg.sender);
  }

  function _calcMultiplier(address account) internal {
    Log[] storage logs = userLogs[account];
    uint256 multiplier = 1000;
    uint8 token = 0;
    for (uint8 i = 0; i < categories.length; i++) {
      Rarity storage category = categories[i];
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
      if (logs[i].timestamp <= timeTo) return one * logs[i].multiplier / 1000;
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
      multiplier += one * logsUser[i - 1].multiplier * duration / 1000;
      Log[] storage logsToken = tokenLogs[logsUser[i - 1].token];
      uint256 timeTokenEnd = timeBlockEnd;
      for (uint256 j = logsToken.length; j > 0; j--) {
        uint256 timeTokenStart = logsToken[j - 1].timestamp;
        if (timeBlockEnd < timeTokenStart) continue;
        if (timeTokenStart < timeBlockStart) timeTokenStart = timeBlockStart;
        if (timeTokenEnd > timeBlockEnd) timeTokenEnd = timeBlockEnd;
        duration = timeTokenEnd - timeTokenStart;
        if (logsUser[i - 1].multiplier > logsToken[j - 1].multiplier)
          multiplier -= one * (logsUser[i - 1].multiplier - logsToken[j - 1].multiplier) * duration / 1000;
        else if (logsUser[i - 1].multiplier < logsToken[j - 1].multiplier)
          multiplier += one * (logsToken[j - 1].multiplier - logsUser[i - 1].multiplier) * duration / 1000;
        timeTokenEnd = logsToken[j - 1].timestamp;
        if (timeBlockStart >= timeTokenEnd) break;
      }
      timeBlockEnd = timeBlockStart;
      if (timeFrom >= timeBlockEnd) break;
    }
    if (timeFrom < timeBlockEnd) {
      multiplier += one * (timeBlockEnd - timeFrom);
    }
    return multiplier / (timeTo - timeFrom);
  }

  function setMultiplier(string memory name, uint32 multiplier) public {
    uint8 id = nameToIndex[name];
    Rarity storage category = categories[id];      
    category.multiplier = multiplier;
    Log[] storage logs = tokenLogs[id];
    logs.push(Log({timestamp: block.timestamp, token: id, multiplier: multiplier}));
  }

  function uri(uint256 id) public view override returns (string memory) {
    Rarity storage category = categories[id]; 
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

  function setCurrency(address token) public {
    currency = token;
  }
}
