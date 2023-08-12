// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IndelibleGenerative.sol";
import "./IndelibleOpenEdition.sol";

contract IndelibleFactory is AccessControl {
    address private defaultOperatorFilter =
        address(0x3cc6CddA760b79bAfa08dF41ECFA224f810dCeB6);
    address private generativeImplementation;
    address private openEditionImplementation;

    address private indelibleSecurity;
    address private collectorFeeRecipient;
    uint256 private collectorFee;
    uint256 private signatureLifespan = 40;

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

    function updateOpenEditionImplementation(
        address newImplementation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        openEditionImplementation = newImplementation;
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

    function updateSignatureLifespan(
        uint256 newSignatureLifespan
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        signatureLifespan = newSignatureLifespan;
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
        Settings calldata _settings,
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
            _settings,
            _royaltySettings,
            _withdrawRecipients,
            FactorySettings(
                indelibleSecurity,
                collectorFeeRecipient,
                collectorFee,
                msg.sender,
                operatorFilter,
                signatureLifespan
            )
        );

        emit ContractCreated(msg.sender, clone);
    }

    function deployOpenEditionContract(
        string memory _name,
        string memory _symbol,
        OpenEditionSettings calldata _settings,
        RoyaltySettings calldata _royaltySettings,
        WithdrawRecipient[] calldata _withdrawRecipients,
        bool _registerOperatorFilter
    ) external {
        require(
            openEditionImplementation != address(0),
            "Implementation not set"
        );

        address payable clone = payable(
            Clones.clone(openEditionImplementation)
        );
        address operatorFilter = _registerOperatorFilter
            ? defaultOperatorFilter
            : address(0);

        IndelibleOpenEdition(clone).initialize(
            _name,
            _symbol,
            _settings,
            _royaltySettings,
            _withdrawRecipients,
            FactorySettings(
                indelibleSecurity,
                collectorFeeRecipient,
                collectorFee,
                msg.sender,
                operatorFilter,
                signatureLifespan
            )
        );

        emit ContractCreated(msg.sender, clone);
    }
}
