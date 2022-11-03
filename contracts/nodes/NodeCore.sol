//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import '../common/IERC20.sol';
import "./INodeCore.sol";
import "./IBoostNFT.sol";
// import "hardhat/console.sol";

contract NodeCore is Initializable {
  IBoostNFT public boostNFT;

  Tier[] private tierArr;
  mapping(string => uint8) public tierMap;
  uint8 public tierTotal;
  Node[] private nodesTotal;
  mapping(address => uint256[]) private nodesOfUser;
  uint32 public countTotal;
  mapping(address => uint32) public countOfUser;
  mapping(string => uint32) public countOfTier;
  uint256 public rewardsTotal;
  mapping(address => uint256) public rewardsOfUser;

  uint32 public maxCountOfUser; // 0-Infinite

  address public feeTokenAddress;
  bool public canNodeTransfer;

  address public owner;  

  mapping(address => bool) public blacklist;
  string[] private airdrops;
  mapping(string => bytes32) public merkleRoot;
  mapping(bytes32 => bool) public airdropSupplied;

  mapping(address => uint256) public unclaimed;
  address public minter;
  address public operator;
  
  modifier onlyOwner() {
    require(owner == msg.sender, "Ownable: caller is not the owner");
    _;
  }

  modifier onlyOperator() {
    require(operator == msg.sender || address(this) == msg.sender, "Caller is not the operator");
    _;
  }

  function initialize() public initializer {
    owner = msg.sender;

    addTier('default', 100 ether, 0.12 ether, 1 days, 0, 0);

    maxCountOfUser = 0; // 0-Infinite
    canNodeTransfer = true;
  }

  function transferOwnership(address _owner) public onlyOwner {
    owner = _owner;
  }

  function setOperator(address _operator) public onlyOwner {
    operator = _operator;
  }

  function bindBooster(address _boostNFT) public onlyOwner {
    boostNFT = IBoostNFT(_boostNFT);
  }

  function tiers() public view returns (Tier[] memory) {
    Tier[] memory tiersActive = new Tier[](tierTotal);
    uint8 j = 0;
    for (uint8 i = 0; i < tierArr.length; i++) {
      Tier storage tier = tierArr[i];
      if (tierMap[tier.name] > 0) tiersActive[j++] = tier;
    }
    return tiersActive;
  }

  function addTier(
    string memory name,
    uint256 price,
    uint256 rewardsPerTime,
    uint32 claimInterval,
    uint256 maintenanceFee,
    uint32 maxPurchase
  ) public onlyOwner {
    require(price > 0, "Tier's price has to be positive.");
    require(rewardsPerTime > 0, "Tier's rewards has to be positive.");
    require(claimInterval > 0, "Tier's claim interval has to be positive.");
    tierArr.push(
      Tier({
	      id: uint8(tierArr.length),
        name: name,
        price: price,
        rewardsPerTime: rewardsPerTime,
        claimInterval: claimInterval,
        maintenanceFee: maintenanceFee,
        maxPurchase: maxPurchase
      })
    );
    tierMap[name] = uint8(tierArr.length);
    tierTotal++;
  }

  function updateTier(
    string memory tierName,
    string memory name,
    uint256 price,
    uint256 rewardsPerTime,
    uint32 claimInterval,
    uint256 maintenanceFee,
    uint32 maxPurchase
  ) public onlyOwner {
    uint8 tierId = tierMap[tierName];
    require(tierId > 0, "Tier's name is incorrect.");
    require(price > 0, "Tier's price has to be positive.");
    require(rewardsPerTime > 0, "Tier's rewards has to be positive.");
    Tier storage tier = tierArr[tierId - 1];
    tier.name = name;
    tier.price = price;
    tier.rewardsPerTime = rewardsPerTime;
    tier.claimInterval = claimInterval;
    tier.maintenanceFee = maintenanceFee;
    tier.maxPurchase = maxPurchase;
    tierMap[tierName] = 0;
    tierMap[name] = tierId;
  }

  function setTierId(string memory name, uint8 id) public onlyOwner {
    tierMap[name] = id;
  }

  function removeTier(string memory tierName) public onlyOwner {
    require(tierMap[tierName] > 0, 'Tier was already removed.');
    tierMap[tierName] = 0;
    tierTotal--;
  }

  function maxNodeIndex() public view returns (uint32) {
    return uint32(nodesTotal.length);
  }

  function setMaxCountOfUser(uint32 _count) public onlyOwner {
    maxCountOfUser = _count;
  }

  function tierOf(string memory _tier) public view returns (Tier memory) {
    uint8 tierId = tierMap[_tier];
    return tierArr[tierId-1];
  }

  function tierAt(uint8 _index) public view returns (Tier memory) {
    return tierArr[_index];
  }

  function reward(address _account) public onlyOperator returns (uint256) {
    uint256 claimableAmount = 0;
    Node[] memory nodes = filter(_account);
    for(uint32 i = 0;i<nodes.length;i++) {
      Node memory node = nodes[i];
      uint256 multiplier = 1 ether;
      if(address(boostNFT)!=address(0)) multiplier = boostNFT.getMultiplier(_account, node.claimedTime, block.timestamp); 
      Tier memory tier = tierArr[node.tierIndex];
      claimableAmount += uint256(block.timestamp - node.claimedTime)
        * tier.rewardsPerTime
        * multiplier
        / 1 ether
        / tier.claimInterval;
      update(node.id, _account, uint32(block.timestamp), 0);
    }
    if(claimableAmount > 0) {
      rewardsOfUser[_account] += claimableAmount;
      rewardsTotal += claimableAmount;
      unclaimed[_account] += claimableAmount;
    }
    return unclaimed[_account];
  }

  function claimable(address _account, bool _includeUnclaimed) public view returns (uint256) {
    uint256 claimableAmount = _includeUnclaimed ? unclaimed[_account] : 0;
    Node[] memory nodes = filter(_account);
    for(uint32 i = 0;i<nodes.length;i++) {
      Node memory node = nodes[i];
      uint256 multiplier = 1 ether;
      if(address(boostNFT)!=address(0)) multiplier = boostNFT.getMultiplier(_account, node.claimedTime, block.timestamp); 
      Tier memory tier = tierArr[node.tierIndex];
      claimableAmount += uint256(block.timestamp - node.claimedTime)
        * tier.rewardsPerTime
        * multiplier
        / 1 ether
        / tier.claimInterval;
    }
    return claimableAmount;
  }

  function claim(address _account) public onlyOperator returns (uint256) {
    return claim(_account, 0);
  }

  function claim(address _account, uint256 _amount) public onlyOperator returns (uint256) {
    reward(_account);
    uint256 claimableAmount = unclaimed[_account];
    require(claimableAmount > 0, 'No claimable tokens.');
    if(_amount==0) {
      unclaimed[_account] = 0;
      return claimableAmount;
    }
    require(claimableAmount >= _amount, 'Insufficient claimable tokens.');
    unclaimed[_account] -= _amount;
    return _amount;
  }

  function insert(
    string memory _tier,
    address _account,
    string memory _title,
    int32 _limitedTimeOffset
  ) public onlyOperator {
    if(maxCountOfUser > 0)
      require(countOfUser[_account]<maxCountOfUser, "Exceed of max count");
    uint8 tierId = tierMap[_tier];
    Tier storage tier = tierArr[tierId-1];
    if(tier.maxPurchase > 0)
      require(count(_account,_tier)<tier.maxPurchase, "Exceed of max count");
    uint32 nodeId = uint32(nodesTotal.length);
    nodesTotal.push(
      Node({
        id: nodeId,
        tierIndex: tierId - 1,
        title: _title,
        owner: _account,
        multiplier: 1 ether,
        createdTime: uint32(block.timestamp),
        claimedTime: uint32(block.timestamp),
        limitedTime: uint32(uint256(int(block.timestamp)+_limitedTimeOffset))
      })
    );
    uint256[] storage nodeIndice = nodesOfUser[_account];
    nodeIndice.push(nodeId + 1);
    countTotal++;
    countOfTier[_tier]++;
    countOfUser[_account]++;
  }

  function hide(uint32 _id) public onlyOperator {
    Node storage node = nodesTotal[_id];
    uint256[] storage nodeIndice = nodesOfUser[node.owner];
    for(uint32 i = 0;i<nodeIndice.length;i++) {
      if(nodeIndice[i]==node.id+1) {
        nodeIndice[i] = 0;
        break;
      }
    }
  }

  function update(
    uint32 _id,
    address _account,
    uint32 _claimedTime,
    uint32 _limitedTime
  ) public onlyOperator {
    Node storage node = nodesTotal[_id];
    if(_claimedTime>0 && node.claimedTime!=_claimedTime) node.claimedTime = _claimedTime;
    if(_limitedTime>0 && node.limitedTime!=_limitedTime) node.limitedTime = _limitedTime;
    if(_account!=address(0) && node.owner!=_account) {
      if(maxCountOfUser > 0)
        require(countOfUser[_account]<maxCountOfUser, "Exceed of max count");
      Tier storage tier = tierArr[node.tierIndex];
      if(tier.maxPurchase > 0)
        require(count(_account,tier.name)<tier.maxPurchase, "Exceed of max count");
      countOfUser[node.owner]--;
      countOfUser[_account]++;
      hide(_id);
      node.owner = _account;
      nodesOfUser[_account].push(_id + 1);
    }
  }

  function burn(uint32 _id) public onlyOperator {
    Node storage node = nodesTotal[_id];
    hide(_id);
    Tier storage tier = tierArr[node.tierIndex];
    countOfUser[node.owner]--;
    countTotal--;
    countOfTier[tier.name]--;
    node.owner = address(0);
  }

  function select(uint32 _id) public view returns (Node memory) {
    return nodesTotal[_id];
  }

  function count() public view returns (uint32) {
    return countTotal;
  }

  function count(address _account) public view returns (uint32) {
    return countOfUser[_account];
  }

  function count(string memory _tier) public view returns (uint32) {
    return countOfTier[_tier];
  }
  
  function count(address _account, string memory _tier) public view returns (uint32) {
    return count(_account, tierMap[_tier]);
  }

  function count(address _account, uint8 _tierId) public view returns (uint32) {
    uint256 total = nodesOfUser[_account].length;
    if(_account==address(0)) total = nodesTotal.length;
    uint32 length = 0;
    for(uint32 i = 0;i<total;i++) {
      uint256 index = i;
      if(_account!=address(0)) {
        if(nodesOfUser[_account][i]==0) continue;
        index = nodesOfUser[_account][i] - 1;
      }
      if(nodesTotal[index].owner!=_account) continue;
      if(_tierId!=0 && _tierId-1!=nodesTotal[index].tierIndex) continue;
      length++;
    }
    return length;
  }

  function filter(address _account) public view returns (Node[] memory) {
    return filter(_account,'',0);
  }

  function filter(address _account, string memory _tier) public view returns (Node[] memory) {
    return filter(_account,_tier,0);
  }

  function filter(address _account, string memory _tier, uint32 _count) public view returns (Node[] memory) {
    uint32 length = count(_account, _tier);
    if(length==0) return new Node[](0);
    Node[] memory nodes = new Node[](length);
    uint256 total = nodesOfUser[_account].length;
    uint8 tierId = tierMap[_tier];
    if(_account==address(0)) total = nodesTotal.length;
    uint32 j = 0;
    for(uint32 i = 0;i<total;i++) {
      uint256 index = i;
      if(_account!=address(0)) {
        if(nodesOfUser[_account][i]==0) continue;
        index = nodesOfUser[_account][i] - 1;
      }
      if(nodesTotal[index].owner!=_account) continue;
      if(tierId!=0 && tierId-1!=nodesTotal[index].tierIndex) continue;
      nodes[j++] = nodesTotal[index];
      if(_count!=0 && j==_count) break;
    }
    return nodes;
  }

  function outdated() public view returns (Node[] memory) {
    uint32 length = 0;
    uint256 total = nodesTotal.length;
    for(uint32 i = 0;i<total;i++) {
      if(nodesTotal[i].owner==address(0)) continue;
      if(nodesTotal[i].limitedTime>block.timestamp) continue;
      length++;
    }
    if(length==0) return new Node[](0);
    Node[] memory nodes = new Node[](length);
    uint32 j = 0;
    for(uint32 i = 0;i<total;i++) {
      if(nodesTotal[i].owner==address(0)) continue;
      if(nodesTotal[i].limitedTime>block.timestamp) continue;
      nodes[j++] = nodesTotal[i];
    }
    return nodes;
  }

  function withdraw(address _to) public onlyOwner {
    payable(_to).transfer(address(this).balance);
  }
  
  function withdraw(address _token, address _to) external onlyOwner() {
    IERC20(_token).transfer(_to, IERC20(_token).balanceOf(address(this)));
  }
}