// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IndelibleContract {
    function mint(uint256 count, uint256 max, bytes32[] calldata merkleProof) external payable returns (uint);
}

contract TestMinterContract {
  address public contractToMint;

  function executeExternalContractMint(address toMint) external payable returns (bool) {
    if (toMint == address(0)) {
      return false;
    }

    IndelibleContract collectionContract = IndelibleContract(toMint);
    bytes32[] memory merkleProof;
    uint tokens = collectionContract.mint{value: msg.value}(1, 0, merkleProof);
    if (tokens >= 0) {
      return true;
    }
    return false;
  }
}
