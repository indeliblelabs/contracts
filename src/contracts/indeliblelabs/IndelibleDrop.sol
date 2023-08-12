// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "operator-filter-registry/src/upgradeable/DefaultOperatorFiltererUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "solady/src/utils/Base64.sol";
import "solady/src/utils/SSTORE2.sol";
import "./lib/DynamicBuffer.sol";
import "./lib/HelperLib.sol";
import "./lib/Bytecode.sol";
import "./ICommon.sol";

struct TokenSettings {
    uint256 mintPrice;
    uint256 maxPerAddress;
    uint256 mintStart;
    uint256 mintEnd;
    bytes32 merkleRoot;
}

struct Token {
    address[] chunks;
    string[][] traits;
    string mimetype;
    string name;
    string description;
    uint256 maxSupply;
    uint256 totalMinted;
    bytes32 tier2MerkleRoot;
    TokenSettings settings;
}

contract IndelibleDrop is
    ERC1155Upgradeable,
    OwnableUpgradeable,
    ERC2981Upgradeable,
    OperatorFiltererUpgradeable,
    ReentrancyGuardUpgradeable
{
    using HelperLib for uint256;
    using DynamicBuffer for bytes;

    mapping(uint256 => Token) internal tokens;
    mapping(uint256 => mapping(address => uint256)) internal numberMinted;
    mapping(address => uint256) private latestBlockNumber;

    address private indelibleSigner;
    address payable private collectorFeeRecipient;
    uint256 public collectorFee;

    string public name;
    string public symbol;
    uint256 public numberOfTokens;
    WithdrawRecipient[] public withdrawRecipients;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        RoyaltySettings calldata _royaltySettings,
        WithdrawRecipient[] calldata _withdrawRecipients,
        address _indelibleSigner,
        address _collectorFeeRecipient,
        uint256 _collectorFee,
        address _deployer,
        address _operatorFilter
    ) public initializer {
        __ERC1155_init("");
        __Ownable_init();

        name = _name;
        symbol = _symbol;
        collectorFeeRecipient = payable(_collectorFeeRecipient);
        collectorFee = _collectorFee;
        indelibleSigner = _indelibleSigner;

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

        transferOwnership(_deployer);

        OperatorFiltererUpgradeable.__OperatorFilterer_init(
            _operatorFilter,
            _operatorFilter == address(0) ? false : true // only subscribe if a filter is provided
        );
    }

    modifier whenMintActive(uint256 id) {
        if (
            (tokens[id].totalMinted >= tokens[id].maxSupply ||
                !isMintActive(id))
        ) {
            revert NotAuthorized();
        }
        _;
    }

    function handleMint(
        uint256 id,
        uint256 quantity,
        address recipient,
        uint256 totalCollectorFee
    ) internal {
        if (
            quantity < 1 ||
            tokens[id].totalMinted + quantity > tokens[id].maxSupply
        ) {
            revert InvalidInput();
        }

        if (msg.sender != tx.origin) {
            revert NotAuthorized();
        }

        numberMinted[id][recipient] += quantity;
        tokens[id].totalMinted += quantity;

        _mint(recipient, id, quantity, "");

        if (totalCollectorFee > 0) {
            sendCollectorFee(totalCollectorFee);
        }
    }

    function mint(
        uint256 id,
        uint256 quantity,
        uint256 max,
        bytes32[] calldata merkleProof
    ) external payable nonReentrant whenMintActive(id) {
        Token memory token = tokens[id];

        if (quantity * (token.settings.mintPrice + collectorFee) != msg.value) {
            revert InvalidInput();
        }

        if (msg.sender != owner()) {
            bool isAllowListActive = token.settings.merkleRoot != bytes32(0);
            uint256 maxPerAddress = token.settings.maxPerAddress;
            if (isAllowListActive && max > 0) {
                maxPerAddress = max;
            }
            if (
                (isAllowListActive &&
                    !onAllowList(id, msg.sender, max, merkleProof)) ||
                (maxPerAddress > 0 &&
                    numberMinted[id][msg.sender] + quantity > maxPerAddress)
            ) {
                revert InvalidInput();
            }
        }

        handleMint(id, quantity, msg.sender, quantity * collectorFee);
    }

    function signatureMint(
        Signature calldata signature,
        uint256 _id,
        uint256 _nonce,
        uint256 _quantity,
        uint256 _maxPerAddress,
        uint256 _mintPrice,
        uint256 _collectorFee
    ) external payable nonReentrant whenMintActive(_id) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _nonce,
                address(this),
                msg.sender,
                _id,
                _quantity,
                _maxPerAddress,
                _mintPrice,
                _collectorFee
            )
        );

        if (verifySignature(messageHash, signature) != indelibleSigner)
            revert NotAuthorized();
        if (
            (_maxPerAddress > 0 &&
                numberMinted[_id][msg.sender] + _quantity > _maxPerAddress) ||
            latestBlockNumber[msg.sender] >= _nonce ||
            block.number > _nonce + 40
        ) revert InvalidInput();

        handleMint(_id, _quantity, msg.sender, _quantity * _collectorFee);
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

    function airdrop(
        uint256 id,
        uint256 quantity,
        address[] calldata recipients
    ) external payable nonReentrant onlyOwner whenMintActive(id) {
        if (quantity * collectorFee != msg.value) {
            revert InvalidInput();
        }

        for (uint256 i = 0; i < recipients.length; i++) {
            handleMint(id, quantity, recipients[i], quantity * collectorFee);
        }
    }

    function isMintActive(uint256 id) public view returns (bool) {
        if (id >= numberOfTokens) {
            revert InvalidInput();
        }
        Token memory token = tokens[id];
        return
            (token.settings.mintStart > 0 &&
                block.timestamp > token.settings.mintStart &&
                (token.settings.mintEnd == 0 ||
                    block.timestamp < token.settings.mintEnd)) ||
            msg.sender == owner();
    }

    function tokenIdToFile(uint256 id) public view returns (string memory) {
        if (id >= numberOfTokens) {
            revert InvalidInput();
        }

        bytes memory image;
        address[] storage chunks = tokens[id].chunks;
        uint256 size;
        uint256 ptr = 0x20;
        address currentChunk;
        unchecked {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                image := mload(0x40)
            }
            for (uint256 i = 0; i < chunks.length; i++) {
                currentChunk = chunks[i];
                size = Bytecode.codeSize(currentChunk) - 1;
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    extcodecopy(currentChunk, add(image, ptr), 1, size)
                }
                ptr += size;
            }

            // solhint-disable-next-line no-inline-assembly
            assembly {
                mstore(0x40, add(image, and(add(ptr, 0x1f), not(0x1f))))
                mstore(image, sub(ptr, 0x20))
            }
        }
        return
            string.concat(
                "data:",
                tokens[id].mimetype,
                ";base64,",
                Base64.encode(image)
            );
    }

    function tokenIdToMetadata(uint256 id) public view returns (string memory) {
        bytes memory metadataBytes = DynamicBuffer.allocate(1024 * 128);
        metadataBytes.appendSafe("[");

        for (uint256 i = 0; i < tokens[id].traits.length; i++) {
            metadataBytes.appendSafe(
                abi.encodePacked(
                    '{"trait_type":"',
                    tokens[id].traits[i][0],
                    '","value":"',
                    tokens[id].traits[i][1],
                    '"}'
                )
            );

            if (i == tokens[id].traits.length - 1) {
                metadataBytes.appendSafe("]");
            } else {
                metadataBytes.appendSafe(",");
            }
        }

        return string(metadataBytes);
    }

    function onAllowList(
        uint256 id,
        address addr,
        uint256 max,
        bytes32[] calldata merkleProof
    ) public view returns (bool) {
        if (max > 0) {
            return
                MerkleProofUpgradeable.verify(
                    merkleProof,
                    tokens[id].settings.merkleRoot,
                    keccak256(abi.encodePacked(addr, max))
                );
        }
        return
            MerkleProofUpgradeable.verify(
                merkleProof,
                tokens[id].settings.merkleRoot,
                keccak256(abi.encodePacked(addr))
            ) ||
            MerkleProofUpgradeable.verify(
                merkleProof,
                tokens[id].tier2MerkleRoot,
                keccak256(abi.encodePacked(addr))
            );
    }

    function uri(uint256 id) public view override returns (string memory) {
        if (id >= numberOfTokens) {
            revert InvalidInput();
        }
        Token memory token = tokens[id];

        return
            string.concat(
                "data:application/json,",
                '{"name":"#',
                Strings.toString(id),
                '","description":"',
                token.description,
                '","image":"',
                tokenIdToFile(id),
                '","attributes":',
                tokenIdToMetadata(id),
                "}"
            );
    }

    function addToken(Token memory token) public onlyOwner {
        if (token.maxSupply < 1 || token.totalMinted > 0) {
            revert InvalidInput();
        }
        tokens[numberOfTokens] = token;
        ++numberOfTokens;
    }

    function getToken(uint256 id) public view returns (Token memory) {
        if (id >= numberOfTokens) {
            revert InvalidInput();
        }
        return tokens[id];
    }

    function addChunk(
        uint256 id,
        uint256 chunkIndex,
        bytes calldata chunk
    ) public onlyOwner {
        if (id >= numberOfTokens) {
            revert InvalidInput();
        }
        tokens[id].chunks[chunkIndex] = SSTORE2.write(chunk);
    }

    function getChunk(
        uint256 id,
        uint256 chunkIndex
    ) external view returns (bytes memory) {
        if (id >= numberOfTokens) {
            revert InvalidInput();
        }
        return SSTORE2.read(tokens[id].chunks[chunkIndex]);
    }

    function setTokenSettings(
        uint256 id,
        TokenSettings calldata settings
    ) external onlyOwner {
        if (id >= numberOfTokens) {
            revert InvalidInput();
        }
        tokens[id].settings = settings;
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
        override(ERC1155Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setApprovalForAll(
        address operator,
        bool approved
    ) public override onlyAllowedOperatorApproval(operator) {
        super.setApprovalForAll(operator, approved);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data
    ) public override onlyAllowedOperator(from) {
        super.safeTransferFrom(from, to, tokenId, amount, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override onlyAllowedOperator(from) {
        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }
}
