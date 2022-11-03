// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import 'hardhat/console.sol';

struct Rarity {
  uint8 id;
  string name;
  uint32 multiplier;
  uint32 rarity;
}

struct Log {
  uint256 from;
  uint256 to;
  uint256 multiplier;
}

struct Token {
  uint256 id;
  string rarity;
  uint32 multiplier;
}

contract BoostNFT721 is ERC721, Ownable {
  Rarity[] public categories;
  uint256 public maxSupply = 1000;
  uint256 public totalSupply;
  uint256 public cost = 5 ether;
  address public currency;
  uint256 constant ONE = 1 ether;
  mapping(uint8 => uint256) private supplied;
  mapping(uint8 => uint256) private available;
  mapping(uint256 => uint8) public rarities;
  mapping(string => uint8) public nameToIndex;
  mapping(address => Log[]) private userLogs;
  mapping(address => uint32) public multipliers;
  
  constructor() ERC721('PowNode Booster', '#POW') {
    add('Platinum', 500, 100);
    add('Diamond', 2500, 30);
    add('Gold', 7000, 10);
  }

  function add(
    string memory name,
    uint32 rarity,
    uint32 multiplier
  ) public onlyOwner {
    uint8 id = uint8(categories.length);
    nameToIndex[name] = id;
    categories.push(Rarity({
      id: id,
      name: name,
      multiplier: multiplier,
      rarity: rarity
    }));
    available[id] = maxSupply * rarity / 10000;
  }

  function set(
    string memory name,
    uint32 rarity,
    uint32 multiplier
  ) public onlyOwner {
    uint8 id = nameToIndex[name];
    Rarity storage category = categories[id];
    category.rarity = rarity;
    category.multiplier = multiplier;
    available[id] = maxSupply * rarity / 10000 - supplied[id];
  }

  function random(uint256 seed) internal view returns (uint8) {
    seed = uint256(
      keccak256(abi.encode(block.timestamp, block.difficulty, block.number, seed))
    );
    uint256 totalCount = maxSupply - totalSupply;
    seed %= totalCount;
    for(uint8 i = 0;i < categories.length;i++) {
      totalCount -= available[i];
      if(seed >= totalCount) return i;
    }
    return 0;
  }

  function mint(uint256 amount) public payable {
    uint256 price = cost * amount;
    if(currency==address(0))
      require(msg.value >= price, "Insufficient ETH for purchase.");
    else {
      IERC20 token = IERC20(currency);
      require(token.balanceOf(msg.sender) >= price, "Insufficient Token for purchase.");
      token.transferFrom(msg.sender, owner(), price);
    }
    for(uint256 i = 0;i<amount;i++) {
      uint8 rarity = random(i);
      rarities[totalSupply] = rarity;
      _mint(msg.sender, totalSupply+i);
      available[rarity]--;
      console.log("mint", msg.sender, rarity);
    }
    totalSupply += amount;
  }

  function _update(address account, uint32 multiplier, bool positive) internal {
    if(account==address(0)) return;
    Log[] storage logs = userLogs[account];
    if(logs.length>0) {
      logs[logs.length - 1].to = block.timestamp;
    }
    if(positive)
      multipliers[account] += multiplier;
    else
      multipliers[account] -= multiplier;
    if(multipliers[account]>0)
      logs.push(Log({from:block.timestamp, to:0, multiplier:multipliers[account]}));
  }

  function _afterTokenTransfer(
    address from,
    address to,
    uint256 tokenId
  ) internal override {
    uint8 id = rarities[tokenId];
    uint32 multiplier = categories[id].multiplier;
    _update(from, multiplier, false);
    _update(to, multiplier, true);
  }

  function tokensOf(address account) public view returns (Token[] memory) {
    uint256 count = balanceOf(account);
    Token[] memory tokens = new Token[](count);
    uint256 j = 0;
    for(uint256 i = 0;i<totalSupply;i++) {
      if(ownerOf(i) == account) {
        Rarity storage rarity = categories[rarities[i]];
        tokens[j].id = i;
        tokens[j].rarity = rarity.name;
        tokens[j].multiplier = rarity.multiplier;
        j++;
      }
    }
    return tokens;
  }

  function lastMultiplier(address account) public view returns (uint256) {
    return multipliers[account] * ONE / 1000 + ONE;
  }

  function getMultiplier(
    address account,
    uint256 timeFrom,
    uint256 timeTo
  ) public view returns (uint256) {
    uint256 multiplier = 0;
    if(timeTo==timeFrom)
      return ONE;
    Log[] storage logs = userLogs[account];
    if(logs.length==0)
      return ONE;
    for (uint256 i = logs.length; i > 0; i--) {
      uint256 timeBlockFrom = logs[i - 1].from;
      uint256 timeBlockTo = logs[i - 1].to;
      if (timeBlockTo == 0) timeBlockTo = block.timestamp;
      if (timeTo < timeBlockFrom) continue;
      if (timeFrom > timeBlockTo) break;
      if (timeTo < timeBlockTo) timeBlockTo = timeTo;
      if (timeFrom > timeBlockFrom) timeBlockFrom = timeFrom;
      uint256 duration = timeBlockTo - timeBlockFrom;
      multiplier += ONE * logs[i - 1].multiplier * duration / 1000;
    }
    return ONE + multiplier / (timeTo - timeFrom);
  }
}
