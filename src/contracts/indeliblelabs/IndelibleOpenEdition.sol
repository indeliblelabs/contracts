// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "operator-filter-registry/src/upgradeable/OperatorFiltererUpgradeable.sol";
import "solady/src/utils/LibPRNG.sol";
import "solady/src/utils/Base64.sol";
import "solady/src/utils/SSTORE2.sol";
import "./lib/DynamicBuffer.sol";
import "./lib/HelperLib.sol";
import "./lib/Bytecode.sol";
import "./interfaces/IIndelibleSecurity.sol";
import "./ICommon.sol";

struct OpenEditionSettings {
    uint256 maxPerAddress;
    uint256 publicMintPrice;
    uint256 mintStart;
    uint256 mintEnd;
    bool isContractSealed;
    string description;
}

contract IndelibleOpenEdition is
    ERC721AUpgradeable,
    OwnableUpgradeable,
    ERC2981Upgradeable,
    OperatorFiltererUpgradeable,
    ReentrancyGuardUpgradeable
{
    using HelperLib for string;
    using DynamicBuffer for bytes;
    using LibPRNG for LibPRNG.PRNG;

    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    mapping(uint256 => address) private chunks;
    mapping(address => uint256) private latestBlockNumber;
    uint256 numberOfChunks;
    uint256 numberOfTraits;
    string private mimetype;
    uint256 private signatureLifespan;

    address private indelibleSecurity;
    address payable private collectorFeeRecipient;
    uint256 public collectorFee;

    string public imageUrl;
    string public animationUrl;
    OpenEditionSettings public settings;
    WithdrawRecipient[] public withdrawRecipients;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        OpenEditionSettings calldata _settings,
        RoyaltySettings calldata _royaltySettings,
        WithdrawRecipient[] calldata _withdrawRecipients,
        FactorySettings calldata _factorySettings
    ) public initializerERC721A initializer {
        __ERC721A_init(_name, _symbol);
        __Ownable_init();

        settings = _settings;
        collectorFeeRecipient = payable(_factorySettings.collectorFeeRecipient);
        collectorFee = _factorySettings.collectorFee;
        indelibleSecurity = _factorySettings.indelibleSecurity;
        signatureLifespan = _factorySettings.signatureLifespan;

        for (uint256 i = 0; i < _withdrawRecipients.length; ) {
            withdrawRecipients.push(_withdrawRecipients[i]);
            unchecked {
                ++i;
            }
        }

        _setDefaultRoyalty(
            _royaltySettings.royaltyAddress,
            _royaltySettings.royaltyAmount
        );

        transferOwnership(_factorySettings.deployer);

        OperatorFiltererUpgradeable.__OperatorFilterer_init(
            _factorySettings.operatorFilter,
            _factorySettings.operatorFilter == address(0) ? false : true // only subscribe if a filter is provided
        );
    }

    modifier whenUnsealed() {
        if (settings.isContractSealed) {
            revert NotAuthorized();
        }
        _;
    }

    function handleMint(
        uint256 quantity,
        address recipient,
        uint256 totalCollectorFee
    ) internal {
        if (
            quantity < 1 ||
            (settings.mintEnd > 0 && block.timestamp > settings.mintEnd)
        ) {
            revert InvalidInput();
        }

        if (msg.sender != tx.origin) {
            revert NotAuthorized();
        }

        uint256 batchQuantity = quantity / 20;
        uint256 remainder = quantity % 20;

        for (uint256 i = 0; i < batchQuantity; i++) {
            _mint(recipient, 20);
        }

        if (remainder > 0) {
            _mint(recipient, remainder);
        }

        if (totalCollectorFee > 0) {
            sendCollectorFee(totalCollectorFee);
        }
    }

    function publicMint(uint256 quantity, address to) internal {
        bool isMintActive = (settings.mintStart != 0 &&
            settings.mintStart <= block.timestamp &&
            (settings.mintEnd == 0 || block.timestamp < settings.mintEnd));

        if (msg.sender != owner() && !isMintActive) {
            revert NotAvailable();
        }

        bool hasCorrectValue = msg.sender == owner()
            ? quantity * collectorFee == msg.value
            : quantity * (settings.publicMintPrice + collectorFee) == msg.value;
        bool hasCorrectQuantity = settings.maxPerAddress == 0 ||
            _numberMinted(to) + quantity <= settings.maxPerAddress;

        if (
            (msg.sender != owner() && !hasCorrectQuantity) || !hasCorrectValue
        ) {
            revert InvalidInput();
        }

        handleMint(quantity, to, quantity * collectorFee);
    }

    function mint(uint256 quantity) external payable nonReentrant {
        publicMint(quantity, msg.sender);
    }

    function airdrop(
        uint256 quantity,
        address to
    ) external payable nonReentrant {
        publicMint(quantity, to);
    }

    function airdrop(
        uint256 quantity,
        address[] calldata to
    ) external payable nonReentrant {
        for (uint256 i = 0; i < to.length; i++) {
            publicMint(quantity, to[i]);
        }
    }

    function signatureMint(
        Signature calldata signature,
        uint256 _nonce,
        uint256 _quantity,
        uint256 _maxPerAddress,
        uint256 _mintPrice,
        uint256 _collectorFee
    ) external payable nonReentrant {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _nonce,
                address(this),
                msg.sender,
                _quantity,
                _maxPerAddress,
                _mintPrice,
                _collectorFee,
                block.chainid
            )
        );

        IIndelibleSecurity securityContract = IIndelibleSecurity(
            indelibleSecurity
        );
        address signerAddress = securityContract.signerAddress();

        if (verifySignature(messageHash, signature) != signerAddress) {
            revert NotAuthorized();
        }

        bool hasCorrectValue = _quantity * (_mintPrice + _collectorFee) ==
            msg.value;
        bool hasCorrectQuantity = _maxPerAddress == 0 ||
            _numberMinted(msg.sender) + _quantity <= _maxPerAddress;
        bool hasCorrectNonce = _nonce > latestBlockNumber[msg.sender] &&
            _nonce + signatureLifespan > block.number;

        if (!hasCorrectValue || !hasCorrectQuantity || !hasCorrectNonce) {
            revert InvalidInput();
        }

        handleMint(_quantity, msg.sender, _quantity * _collectorFee);
    }

    function verifySignature(
        bytes32 messageHash,
        Signature calldata signature
    ) public pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes memory prefixedMessage = abi.encodePacked(prefix, messageHash);
        bytes32 hashedMessage = keccak256(prefixedMessage);
        return ecrecover(hashedMessage, signature.v, signature.r, signature.s);
    }

    function sendCollectorFee(uint256 totalFee) internal {
        (bool sent, ) = collectorFeeRecipient.call{value: totalFee}("");
        if (!sent) {
            revert NotAuthorized();
        }
    }

    function getMedia() public view returns (string memory) {
        bytes memory media;
        uint256 size;
        uint256 ptr = 0x20;
        address currentChunk;
        unchecked {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                media := mload(0x40)
            }
            for (uint256 i = 0; i < numberOfChunks; i++) {
                currentChunk = chunks[i];
                size = Bytecode.codeSize(currentChunk) - 1;
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    extcodecopy(currentChunk, add(media, ptr), 1, size)
                }
                ptr += size;
            }

            // solhint-disable-next-line no-inline-assembly
            assembly {
                mstore(0x40, add(media, and(add(ptr, 0x1f), not(0x1f))))
                mstore(media, sub(ptr, 0x20))
            }
        }
        return
            string.concat("data:", mimetype, ";base64,", Base64.encode(media));
    }

    function tokenMediaData() internal view returns (string memory) {
        bool hasImage = bytes(imageUrl).length > 0;
        bool hasAnimation = bytes(animationUrl).length > 0;
        bool hasMediaOnchain = numberOfChunks > 0;
        if (hasImage && hasAnimation) {
            return
                string(
                    abi.encodePacked(
                        '","image":"',
                        imageUrl,
                        '","animation_url":"',
                        animationUrl
                    )
                );
        }
        if (hasImage) {
            return
                string(
                    abi.encodePacked(
                        '","image":"',
                        imageUrl,
                        hasMediaOnchain
                            ? string(
                                abi.encodePacked(
                                    '","animation_url":"',
                                    getMedia()
                                )
                            )
                            : ""
                    )
                );
        }
        if (hasAnimation) {
            return
                string(
                    abi.encodePacked(
                        hasMediaOnchain
                            ? string(
                                abi.encodePacked('","image":"', getMedia())
                            )
                            : "",
                        '","animation_url":"',
                        animationUrl
                    )
                );
        }
        if (hasMediaOnchain) {
            return string(abi.encodePacked('","image":"', getMedia()));
        }

        return "";
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        if (!_exists(tokenId)) {
            revert InvalidInput();
        }

        return
            string.concat(
                'data:application/json,{"name":"',
                name(),
                " #",
                _toString(tokenId),
                '","description":"',
                settings.description,
                tokenMediaData(),
                '","properties":[{"trait_type":"name","value":"',
                name(),
                '"},{"trait_type":"number","value":',
                _toString(tokenId),
                "}]}"
            );
    }

    function didMintEnd() public view returns (bool) {
        return settings.mintEnd > 0 && block.timestamp > settings.mintEnd;
    }

    function addChunk(
        uint256 chunkIndex,
        bytes calldata chunk,
        uint256 total
    ) public whenUnsealed onlyOwner {
        chunks[chunkIndex] = SSTORE2.write(chunk);
        numberOfChunks = total;
    }

    function getChunk(uint256 chunkIndex) external view returns (bytes memory) {
        return SSTORE2.read(chunks[chunkIndex]);
    }

    function setMimetype(
        string calldata _mimetype
    ) external whenUnsealed onlyOwner {
        mimetype = _mimetype;
    }

    function setMaxPerAddress(uint256 maxPerAddress) external onlyOwner {
        settings.maxPerAddress = maxPerAddress;
    }

    function setImageUrl(string calldata url) external onlyOwner {
        imageUrl = url;

        if (_totalMinted() > 0) {
            emit BatchMetadataUpdate(0, _totalMinted() - 1);
        }
    }

    function setAnimationUrl(string calldata url) external onlyOwner {
        animationUrl = url;

        if (_totalMinted() > 0) {
            emit BatchMetadataUpdate(0, _totalMinted() - 1);
        }
    }

    function setPublicMintPrice(uint256 publicMintPrice) external onlyOwner {
        settings.publicMintPrice = publicMintPrice;
    }

    function setMintStart(uint256 mintStart) external whenUnsealed onlyOwner {
        settings.mintStart = mintStart;
    }

    function setMintEnd(uint256 mintEnd) external whenUnsealed onlyOwner {
        settings.mintEnd = mintEnd;
    }

    function sealContract() external whenUnsealed onlyOwner {
        settings.isContractSealed = true;
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        uint256 amount = balance;
        uint256 distAmount = 0;
        uint256 totalDistributionPercentage = 0;

        address payable receiver = payable(owner());

        if (withdrawRecipients.length > 0) {
            for (uint256 i = 0; i < withdrawRecipients.length; i++) {
                totalDistributionPercentage =
                    totalDistributionPercentage +
                    withdrawRecipients[i].percentage;
                address payable currRecepient = payable(
                    withdrawRecipients[i].recipientAddress
                );
                distAmount =
                    (amount * (10000 - withdrawRecipients[i].percentage)) /
                    10000;

                AddressUpgradeable.sendValue(
                    currRecepient,
                    amount - distAmount
                );
            }
        }
        balance = address(this).balance;
        AddressUpgradeable.sendValue(receiver, balance);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC721AUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            ERC721AUpgradeable.supportsInterface(interfaceId) ||
            ERC2981Upgradeable.supportsInterface(interfaceId);
    }

    function setApprovalForAll(
        address operator,
        bool approved
    ) public override onlyAllowedOperatorApproval(operator) {
        super.setApprovalForAll(operator, approved);
    }

    function approve(
        address operator,
        uint256 tokenId
    ) public payable override onlyAllowedOperatorApproval(operator) {
        super.approve(operator, tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public payable override onlyAllowedOperator(from) {
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public payable override onlyAllowedOperator(from) {
        super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public payable override onlyAllowedOperator(from) {
        super.safeTransferFrom(from, to, tokenId, data);
    }
}
