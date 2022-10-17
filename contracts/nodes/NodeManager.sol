//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import '../common/IERC20.sol';
import "./IFeeManager.sol";
import "./INodeCore.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// import "hardhat/console.sol";

library MerkleProof {
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        return processProof(proof, leaf) == root;
    }
    
    function processProof(bytes32[] memory proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash;
    }
}

contract NodeManager is Initializable {
  IFeeManager public feeManager;
  INodeCore public core;

  address public feeTokenAddress;
  bool public canNodeTransfer;
  mapping(address => mapping(address => bool)) public allowances;
  mapping(address => bool) public blacklist;

  address public owner;  
  address public minter;
  
  modifier onlyOwner() {
    require(owner == msg.sender, "Ownable: caller is not the owner");
    _;
  }

  event NodeCreated(address indexed, string, uint32);
  event NodeUpdated(address indexed, string, string, uint32);
  event NodeTransfered(address, address, uint32);
  event SwapIn(address indexed, uint32 indexed, string, uint32, int32);
  event SwapOut(address, uint32, uint32, string, uint32);

  function initialize(address _core, address _feeManager) public initializer {
    owner = msg.sender;

    bindCore(_core);
    bindFeeManager(_feeManager);

    canNodeTransfer = true;
  }

  function transferOwnership(address _owner) public onlyOwner {
    owner = _owner;
  }

  function bindFeeManager(address _feeManager) public onlyOwner {
    feeManager = IFeeManager(_feeManager);
  }

  function bindCore(address _core) public onlyOwner {
    core = INodeCore(_core);
  }

  function setMinter(address _minter) public onlyOwner {
    minter = _minter;
  }

  function setPayTokenAddress(address _tokenAddress) public onlyOwner {
    feeTokenAddress = _tokenAddress;
  }

  function setCanNodeTransfer(bool _canNodeTransfer) public onlyOwner {
    canNodeTransfer = _canNodeTransfer;
  }
  
  function burnedNodes() public view returns (Node[] memory) {
    return core.filter(address(0));
  }

  function nodes(address _account) public view returns (Node[] memory) {
    return core.filter(_account);
  }

  function checkHasNodes(address _account) public view returns (bool) {
    return core.count(_account) > 0;
  }

  function countOfUser(address _account) public view returns (uint32) {
    return core.count(_account);
  }

  function countOfTier(string memory _tier) public view returns (uint32) {
    return core.count(_tier);
  }

  function countTotal() public view returns (uint32) {
    return core.count();
  }

  function countOfNodes(address _account, string memory _tier) public view returns (uint32) {
    return core.count(_account, _tier);
  }

  function balanceOf(address _owner, string memory _tier) public view returns (uint32) {
    return core.count(_owner, _tier);
  }

  function balanceOf(address _owner, uint256 _tierIndex) public view returns (uint32) {
    return core.count(_owner, uint8(_tierIndex));
  }

  function ownerOf(uint256 _id) public view returns (address) {
    require(_id>0, "Invalid node index."); //
    Node memory node = core.select(uint32(_id));
    return node.owner;
  }

  function setApprovalForAll(address _operator, bool _approved) public {
    allowances[msg.sender][_operator] = _approved;
  }

  function _create(
    address _account,
    string memory _tier,
    string memory _title,
    uint32 _count,
    int32 _limitedTimeOffset
  ) private returns (uint256) {
    require(!blacklist[_account],"Invalid wallet");
    for (uint32 i = 0; i < _count; i++) {
      core.insert(_tier, _account, _title, _limitedTimeOffset);
    }
    return core.tierOf(_tier).price * _count;
  }

  function mint(
    address[] memory _accounts,
    string memory _tier,
    string memory _title,
    uint32 _count
  ) public onlyOwner {
    require(_accounts.length>0, "Empty account list.");
    for(uint256 i = 0;i<_accounts.length;i++) {
      _create(_accounts[i], _tier, _title, _count, 0);
    }
  }

  function create(
    string memory _tier,
    string memory _title,
    uint32 _count
  ) public {
    uint256 amount = _create(msg.sender, _tier, _title, _count, 0);
    feeManager.transferFee(msg.sender, amount);
    emit NodeCreated(
      msg.sender,
      _tier,
      _count
    );
  }

  function compound(
    string memory _tier,
    string memory _title,
    uint32 _count
  ) public {
    uint256 amount = _create(msg.sender, _tier, _title, _count, 0);
    core.claim(msg.sender, amount);
    feeManager.transferFee(address(feeManager), amount);
    emit NodeCreated(
      msg.sender,
      _tier,
      _count
    );
  }

  function claim() public {
    require(!blacklist[msg.sender],"Invalid wallet");
    uint256 amount = core.claim(msg.sender);
    feeManager.claim(address(msg.sender), amount);
  }

  // function claimable() public view returns(uint256) {
  //   return core.claimable(msg.sender);
  // }

  function claimable(address _account, bool _includeUnclaimed) public view returns(uint256) {
    return core.claimable(_account, _includeUnclaimed);    
  }

  function rewardsTotal() public view returns(uint256) {
    return core.rewardsTotal();
  }

  function rewardsOfUser(address _account) public view returns (uint256) {
    return core.rewardsOfUser(_account);
  }

  // function upgrade(
  //   string memory _tierFrom,
  //   string memory _tierTo,
  //   uint32 _count
  // ) public payable {
  //   Tier memory tierFrom = core.tierOf(_tierFrom);
  //   Tier memory tierTo = core.tierOf(_tierTo);
  //   require(tierTo.price > tierFrom.price, 'Unable to downgrade.');
  //   uint32 countNeeded = uint32(_count * tierTo.price / tierFrom.price);
  //   core.reward(msg.sender);
  //   Node[] memory nodesTotal = core.filter(msg.sender, _tierFrom);
  //   int32 limitedTime = 0;
  //   uint32 countUpgrade = 0;
  //   for(uint32 i = 0;i<nodesTotal.length;i++) {
  //     Node memory node = nodesTotal[i];
  //     core.burn(node.id + 1);
  //     limitedTime += int32(int32(node.limitedTime) - int(block.timestamp));
  //     countUpgrade++;
  //     if(countUpgrade==countNeeded) break;
  //   }
  //   if(countUpgrade<countNeeded) {
  //     uint256 price = tierFrom.price * (countNeeded - countUpgrade);
  //     feeManager.transferFee(msg.sender, price);
  //   }
  //   _create(msg.sender, _tierTo, '', _count, int32(int(limitedTime) / int32(countNeeded)));
  //   uint256 feeETH = 0;
  //   uint256 feeToken = 0;
  //   (feeETH, feeToken) = getUpgradeFee(_tierFrom, _tierTo, _count);
  //   // require(amountUpgradeFee<=msg.value, "Insufficient ETH for upgrade fee");
  //   if(msg.value >= feeETH) {
  //     feeManager.transferETHToOperator{value:feeETH}();
  //     if(msg.value > feeETH)
  //       payable(msg.sender).transfer(msg.value - feeETH);
  //   } else {
  //     feeManager.transferETHToOperator{value:msg.value}();
  //     uint256 fee = feeToken - (feeETH - msg.value) * feeToken / feeETH;
  //     feeManager.transferFeeToOperator(fee);
  //   }
  //   emit NodeUpdated(msg.sender, _tierFrom, _tierTo, _count);
  // }

  // function getUpgradeFee(string memory _tierFrom, string memory _tierTo, uint32 _count) public view returns (uint256, uint256) {
  //   Tier memory tier = core.tierOf(_tierTo);
  //   uint32 rateFee = feeManager.getRateUpgradeFee(_tierFrom, _tierTo);
  //   if(rateFee==0) return (0, 0);
  //   uint256 amountToken = tier.price * _count * rateFee / 10000;
  //   return (feeManager.getAmountETH(amountToken), amountToken);
  // }

  function transfer(
    string memory _tier,
    uint32 _count,
    address _to
  ) public {
    transferFrom(msg.sender, _to, _tier, _count);
  }

  function transferFrom(
    address _from,
    address _to,
    string memory _tier,
    uint32 _count
  ) public {
    require(canNodeTransfer==true,'Node transfer unavailable!');
    require(!blacklist[_from] && !blacklist[_to],"Invalid wallet");
    if(_from!=msg.sender)
      require(!allowances[_from][msg.sender], "Not approved.");
    Tier memory tier = core.tierOf(_tier);
    Node[] memory nodesTotal = core.filter(msg.sender, _tier);
    uint256 claimableAmount = core.reward(msg.sender);
    uint32 countTransfer = 0;
    for (uint32 i = 0; i < nodesTotal.length; i++) {
      Node memory node = nodesTotal[i];
      if (node.limitedTime + 30 days < block.timestamp) continue;
      core.update(node.id + 1, _to, 0, 0);
      countTransfer++;
      if(countTransfer==_count) break;
    }
    require(countTransfer == _count, 'Not enough nodes to transfer.');
    uint256 fee = feeManager.getTransferFee(tier.price * _count);
    // if (count >= 10) fee = fee.mul(10000 - discountPer10).div(10000);
    if (fee > claimableAmount)
      feeManager.transferFrom(
        address(msg.sender),
        address(this),
        fee - claimableAmount
      );
    else if (fee < claimableAmount) {
      core.claim(msg.sender,fee);
    }
    emit NodeTransfered(msg.sender, _to, _count);
  }

  function burnUser(address _account) public onlyOwner {
    Node[] memory nodesTotal = core.filter(_account);
    for (uint32 i = 0; i < nodesTotal.length; i++) {
      Node memory node = nodesTotal[i];
      core.burn(node.id+1);
    }
  }

  function burnNodes(uint256[] memory _indice) public onlyOwner {
    for (uint32 i = 0; i < _indice.length; i++) {
      core.burn(uint32(_indice[i]));
    }
  }

  // function pay(uint8 _months, uint256[] memory _indice) public payable {
  //   require(_months > 0 && _months <= 12, 'Invalid number of months.');
  //   uint256 fee = 0;
  //   if(_indice.length==0) {
  //     Node[] memory nodesTotal = core.filter(msg.sender);
  //     for (uint32 i = 0; i < nodesTotal.length; i++) {
  //       Node memory node = nodesTotal[i];
  //       Tier memory tier = core.tierAt(node.tierIndex);
  //       core.update(node.id+1, node.owner, 0, node.limitedTime + _months * uint32(30 days));
  //       fee += tier.maintenanceFee * _months;
  //     }
  //   } else {
  //     for (uint32 i = 0; i < _indice.length; i++) {
  //       Node memory node = core.select(uint32(_indice[i])+1);
  //       Tier memory tier = core.tierAt(node.tierIndex);
  //       core.update(node.id+1, node.owner, 0, node.limitedTime + _months * uint32(30 days));
  //       fee += tier.maintenanceFee * _months;
  //     }
  //   }
  //   if(feeTokenAddress==address(0)) { 
  //     // pay with ETH
  //     require(fee == msg.value,"Invalid Fee amount");
  //     feeManager.transferETHToOperator{value:fee}();
  //   } else {
  //     // pay with stable coin BUSD
  //     require(fee < IERC20(feeTokenAddress).balanceOf(msg.sender),"Insufficient BUSD amount");
  //     feeManager.transferTokenToOperator(msg.sender, fee, feeTokenAddress);
  //   }
  // }

  // function unpaidNodes() public onlyOwner view returns (Node[] memory) {
  //   return core.outdated();
  // }

  function addBlacklist(address _account) public onlyOwner {
    blacklist[_account] = true;
  }

  function removeBlacklist(address _account) public onlyOwner {
    blacklist[_account] = false;
  }

  /*function getAirdrops() public view returns (string[] memory) {
    uint256 _len = airdrops.length;
    for (uint32 i = 0; i < airdrops.length; i++) {
      if(uint256(merkleRoot[airdrops[i]])==0) _len--;
    }
    string[] memory _airdrops = new string[](_len);
    for (uint32 i = 0; i < airdrops.length; i++) {
      _airdrops[i] = airdrops[i];
    }
    return _airdrops;
  }

  function setAirdrop(string memory _name, bytes32 _root) public onlyOwner {
    merkleRoot[_name] = _root;

  }

  function canAirdrop(address _account, string memory _tier, uint32 _amount) public view returns (bool) {
    bytes32 leaf = keccak256(abi.encodePacked(_account, _tier, _amount));
    return !airdropSupplied[leaf];
  }

  function claimAirdrop(string memory _name, string memory _tier, uint32 _amount, bytes32[] calldata _merkleProof) public {
    bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _tier, _amount));
    bool valid = MerkleProof.verify(_merkleProof, merkleRoot[_name], leaf);
    require(valid, "Invalid airdrop address.");
    require(!airdropSupplied[leaf], "Already claimed.");
    _create(msg.sender, _tier, '', _amount, 0);   
    airdropSupplied[leaf] = true;
  }*/

  function swapIn(uint32 _chainId, string memory _tier, uint32 _amount, bytes memory _sig) public payable {
    bytes32 r;
    bytes32 s;
    uint8 v;
    assembly {
      r := mload(add(_sig, 32))
      s := mload(add(_sig, 64))
      v := byte(0, mload(add(_sig, 96)))
    }
    bytes32 message = keccak256(abi.encodePacked(
      "\x19Ethereum Signed Message:\n32",
      keccak256(abi.encodePacked(_chainId, msg.value))
    ));
    require(ecrecover(message, v, r, s)==minter, "Insufficient gas fee.");
    Node[] memory nodesTotal = core.filter(msg.sender, _tier, _amount);
    require(nodesTotal.length==_amount, 'Insufficient node amount.');
    core.reward(msg.sender);
    int32 limitedTime = 0;
    for(uint32 i = 0;i<_amount;i++) {
      Node memory node = nodesTotal[i];
      limitedTime += int32(int32(node.limitedTime) - int(block.timestamp));
      core.burn(node.id + 1);
    }
    if(msg.value > 0)
      payable(minter).transfer(msg.value);
    emit SwapIn(msg.sender, _chainId, _tier, _amount, int32(int(limitedTime) / int32(_amount)));
  }

  function swapOut(address _account, string memory _tier, uint32 _amount, int32 _limitedTimeOffset) public {
    require(msg.sender==minter, "Only minter can call swap.");
    _create(_account, _tier, '', _amount, _limitedTimeOffset);
  }

  function withdraw(address _to) public onlyOwner {
    payable(_to).transfer(address(this).balance);
  }
  
  function withdraw(address _token, address _to) external onlyOwner() {
    IERC20(_token).transfer(_to, IERC20(_token).balanceOf(address(this)));
  }
}