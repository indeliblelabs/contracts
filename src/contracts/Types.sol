// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;
    
struct LinkedTraitDTO {
    uint[] traitA;
    uint[] traitB;
}

struct TraitDTO {
    string name;
    string mimetype;
    bytes data;
    bool hide;
    bool useExistingData;
    uint existingDataIndex;
}

struct Trait {
    string name;
    string mimetype;
    bool hide;
}

struct ContractData {
    string name;
    string description;
    string image;
    string banner;
    string website;
    uint royalties;
    string royaltiesRecipient;
}

struct WithdrawRecipient {
    string name;
    string imageUrl;
    address recipientAddress;
    uint percentage;
}