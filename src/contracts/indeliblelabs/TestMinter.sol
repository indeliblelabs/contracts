// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IndelibleContract {
    function mint(uint256 count) external payable returns (uint);
}

contract TestMinterContract {
    address public contractToMint;

    function executeExternalContractMint(
        address toMint
    ) external payable returns (bool) {
        if (toMint == address(0)) {
            return false;
        }

        IndelibleContract collectionContract = IndelibleContract(toMint);
        uint tokens = collectionContract.mint{value: msg.value}(1);
        if (tokens >= 0) {
            return true;
        }
        return false;
    }
}
