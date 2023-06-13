// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

struct WithdrawRecipient {
    address recipientAddress;
    uint256 percentage;
}

struct RoyaltySettings {
    address royaltyAddress;
    uint96 royaltyAmount;
}

struct Signature {
    bytes32 r;
    bytes32 s;
    uint8 v;
}

error NotAvailable();
error NotAuthorized();
error InvalidInput();
