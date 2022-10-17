//SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

interface ITradeable {
    function balanceOf(address _owner, uint256 _tierIndex) external view returns (uint32);
    
    function balanceOf(address _owner, string memory _tierName) external view returns (uint32);

    function setApprovalForAll(address _operator, bool _approved) external;

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tierIndex,
        uint32 _amount
    ) external;
    
    function safeTransferFrom(
        address _from,
        address _to,
        string memory _tierName,
        uint32 _amount
    ) external;

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] calldata _ids
    ) external;

    function ownerOf(uint256 _id) external view returns (address _owner);

    function approve(address _approved, uint256 _id) external;
}