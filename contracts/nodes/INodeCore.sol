// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

struct Tier {
  uint8 id;
  string name;
  uint256 price;
  uint256 rewardsPerTime;
  uint32 claimInterval;
  uint256 maintenanceFee;
  uint32 maxPurchase;
}

struct Node {
  uint32 id;
  uint8 tierIndex;
  string title;
  address owner;
  uint32 createdTime;
  uint32 claimedTime;
  uint32 limitedTime;
  uint256 multiplier;
}

interface INodeCore {
  function insert(
    string memory _tier,
    address _account,
    string memory _title,
    int32 limitedTimeOffset
  ) external;

  function hide(uint32 _id) external;

  function burn(uint32 _id) external;

  function select(uint32 _id) external view returns (Node memory);

  function update(
    uint32 _id,
    address _account,
    uint32 _claimedTime,
    uint32 _limitedTime
  ) external;

  function count() external view returns (uint32);

  function count(address _account) external view returns (uint32);
  
  function count(string memory _tier) external view returns (uint32);
  
  function count(address _account, string memory _tier) external view returns (uint32);

  function count(address _account, uint8 _tier) external view returns (uint32);

  function filter(address _account) external view returns (Node[] memory);

  function filter(address _account, string memory _tier) external view returns (Node[] memory);

  function filter(address _account, string memory _tier, uint32 _count) external view returns (Node[] memory);

  function outdated() external view returns (Node[] memory);

  function tierOf(string memory _tier) external view returns (Tier memory);

  function tierAt(uint8 _index) external view returns (Tier memory);

  function reward(address _account) external returns (uint256);

  function claim(address _account) external returns (uint256);

  function claim(address _account, uint256 _amount) external returns (uint256);

  function claimable(address _account, bool _includeUnclaimed) external view returns (uint256);

  function rewardsTotal() external view returns (uint256);

  function rewardsOfUser(address _account) external view returns (uint256);
}