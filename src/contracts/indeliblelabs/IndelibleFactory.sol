// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IndelibleGenerative.sol";
import "./IndelibleDrop721.sol";

contract IndelibleFactory is AccessControl {
    address private defaultOperatorFilter =
        address(0x3cc6CddA760b79bAfa08dF41ECFA224f810dCeB6);
    address private generativeImplementation;
    address private drop721Implementation;

    address private indelibleSecurity;
    address private collectorFeeRecipient;
    uint256 private collectorFee;

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

    function updateDrop721Implementation(
        address newImplementation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        drop721Implementation = newImplementation;
    }

    function updateIndelibleSecurity(
        address newIndelibleSecurity
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        indelibleSecurity = newIndelibleSecurity;
    }

    function updateCollectorFeeRecipient(
        address newCollectorFeeRecipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        collectorFeeRecipient = newCollectorFeeRecipient;
    }

    function updateCollectorFee(
        uint256 newCollectorFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        collectorFee = newCollectorFee;
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
        uint _maxSupply,
        Settings calldata _baseSettings,
        RoyaltySettings calldata _royaltySettings,
        WithdrawRecipient[] calldata _withdrawRecipients,
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
            _maxSupply,
            _baseSettings,
            _royaltySettings,
            _withdrawRecipients,
            indelibleSecurity,
            collectorFeeRecipient,
            collectorFee,
            msg.sender,
            operatorFilter
        );

        emit ContractCreated(msg.sender, clone);
    }

    function deployDrop721Contract(
        string memory _name,
        string memory _symbol,
        DropSettings calldata _settings,
        RoyaltySettings calldata _royaltySettings,
        WithdrawRecipient[] calldata _withdrawRecipients,
        bool _registerOperatorFilter
    ) external {
        require(drop721Implementation != address(0), "Implementation not set");

        address payable clone = payable(Clones.clone(drop721Implementation));
        address operatorFilter = _registerOperatorFilter
            ? defaultOperatorFilter
            : address(0);

        IndelibleDrop721(clone).initialize(
            _name,
            _symbol,
            _settings,
            _royaltySettings,
            _withdrawRecipients,
            indelibleSecurity,
            collectorFeeRecipient,
            collectorFee,
            msg.sender,
            operatorFilter
        );

        emit ContractCreated(msg.sender, clone);
    }
}
