// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IndelibleGenerative.sol";

contract IndelibleFactory is AccessControl {
    address private defaultOperatorFilter =
        address(0x3cc6CddA760b79bAfa08dF41ECFA224f810dCeB6);
    address private generativeImplementation;
    address private dropImplementation;

    event ContractCreated(address creator, address contractAddress);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function updateDefaultOperatorFilter(
        address newFilter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultOperatorFilter = newFilter;
    }

    function updateGenerativeImplementation(
        address newImplementation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        generativeImplementation = newImplementation;
    }

    function getOperatorFilter() external view returns (address) {
        return defaultOperatorFilter;
    }

    function getGenerativeImplementationAddress()
        external
        view
        returns (address)
    {
        return generativeImplementation;
    }

    function deployGenerativeContract(
        string memory _name,
        string memory _symbol,
        BaseSettings calldata _baseSettings,
        RoyaltySettings calldata _royaltySettings,
        WithdrawRecipient[] calldata _withdrawRecipients,
        address _proContractAddress,
        address _collectorFeeRecipient,
        uint256 _collectorFee,
        bool _registerOperatorFilter
    ) external {
        require(
            generativeImplementation != address(0),
            "Implementation not set"
        );

        address payable clone = payable(Clones.clone(generativeImplementation));
        address operatorFilter = _registerOperatorFilter
            ? defaultOperatorFilter
            : address(0);

        IndelibleGenerative(clone).initialize(
            _name,
            _symbol,
            _baseSettings,
            _royaltySettings,
            _withdrawRecipients,
            _proContractAddress,
            _collectorFeeRecipient,
            _collectorFee,
            msg.sender,
            operatorFilter
        );

        emit ContractCreated(msg.sender, clone);
    }
}
