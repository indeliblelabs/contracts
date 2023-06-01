// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "operator-filter-registry/src/upgradeable/DefaultOperatorFiltererUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "solady/src/utils/Base64.sol";
import "solady/src/utils/SSTORE2.sol";
import "./lib/DynamicBuffer.sol";
import "./lib/HelperLib.sol";
import "./lib/Bytecode.sol";
import "./interfaces/IIndeliblePro.sol";

struct Drop {
    address[] chunks;
    string[][] traits;
    string mimetype;
    uint256 publicMintPrice;
    uint256 allowListPrice;
    uint256 maxSupply;
    uint256 totalSupply;
    uint256 maxPerAddress;
    uint256 maxPerAllowList;
    bool isPublicMintActive;
    bool isAllowListActive;
    bytes32 merkleRoot;
}

struct ContractSettings {
    string name;
    string description;
    string image;
    string banner;
    string website;
}

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

contract IndelibleDrop is
    ERC1155Upgradeable,
    OwnableUpgradeable,
    ERC2981Upgradeable,
    OperatorFiltererUpgradeable,
    ReentrancyGuardUpgradeable
{
    using HelperLib for uint256;
    using DynamicBuffer for bytes;

    mapping(uint256 => Drop) internal drops;
    mapping(uint256 => mapping(address => uint256)) internal numberMinted;

    address private indelibleSigner;
    address payable private collectorFeeRecipient;
    uint256 public collectorFee;

    string public name;
    string public symbol;
    bool public isAllowListActive;
    WithdrawRecipient[] public withdrawRecipients;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        ContractSettings calldata _contractSettings,
        RoyaltySettings calldata _royaltySettings,
        WithdrawRecipient[] calldata _withdrawRecipients,
        address _indelibleSigner,
        address _collectorFeeRecipient,
        uint256 _collectorFee,
        address _deployer,
        address _operatorFilter
    ) public initializer {
        __ERC1155_init();
        __Ownable_init();

        baseSettings = _baseSettings;
        maxSupply = _maxSupply;
        collectorFeeRecipient = payable(_collectorFeeRecipient);
        collectorFee = _collectorFee;
        indelibleSigner = _indelibleSigner;

        for (uint256 i = 0; i < _withdrawRecipients.length; ) {
            withdrawRecipients.push(_withdrawRecipients[i]);
            unchecked {
                ++i;
            }
        }

        // reveal art if no placeholder is set
        if (bytes(_baseSettings.placeholderImage).length == 0) {
            revealSeed = uint256(
                keccak256(
                    abi.encodePacked(
                        tx.gasprice,
                        block.number,
                        block.timestamp,
                        block.difficulty,
                        blockhash(block.number - 1),
                        msg.sender
                    )
                )
            );
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

    function handleMint(
        uint256 id,
        uint256 quantity,
        address recipient,
        uint256 totalCollectorFee
    ) internal {
        if (
            quantity < 1 ||
            drops[id].totalSupply + quantity > drops[id].maxSupply
        ) {
            revert InvalidInput();
        }

        if (msg.sender != tx.origin) {
            revert NotAuthorized();
        }

        numberMinted[id][recipient] += quantity;

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
    ) external payable nonReentrant {
        Drop memory drop = drops[id];

        if (
            !drop.isPublicMintActive &&
            !drop.isAllowListActive &&
            msg.sender != owner()
        ) {
            revert NotAuthorized();
        }

        uint256 mintPrice = drop.isPublicMintActive
            ? drop.publicMintPrice
            : drop.allowListPrice;

        if (quantity * (mintPrice + collectorFee) != msg.value) {
            revert InvalidInput();
        }

        if (msg.sender != owner()) {
            uint256 maxPerAddress = drop.isPublicMintActive
                ? drop.maxPerAddress
                : drop.maxPerAllowList;
            if (!drop.isPublicMintActive && max > 0) {
                maxPerAddress = max;
            }
            if (
                (!drop.isPublicMintActive &&
                    !onAllowList(msg.sender, max, merkleProof)) ||
                (maxPerAddress > 0 &&
                    numberMinted[id][msg.sender] + quantity > maxPerAddress)
            ) {
                revert InvalidInput();
            }
        }

        handleMint(quantity, msg.sender, quantity * collectorFee);
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
                msg.sender,
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
                _numberMinted(msg.sender) + _quantity > _maxPerAddress) ||
            latestBlockNumber[msg.sender] >= _nonce ||
            block.number > _nonce + 40
        ) revert InvalidInput();

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

    function airdrop(
        uint256 quantity,
        address[] calldata recipients
    ) external payable nonReentrant onlyOwner {
        if (quantity * collectorFee != msg.value) {
            revert InvalidInput();
        }

        for (uint256 i = 0; i < recipients.length; i++) {
            handleMint(quantity, recipients[i], quantity * collectorFee);
        }
    }

    function dropIdToFile(uint256 id) public view returns (string memory) {
        require(drops[id].chunks.length > 0, "Invalid token");

        bytes memory image;
        address[] storage chunks = drops[id].chunks;
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
                drops[id].mimetype,
                ";base64,",
                Base64.encode(image)
            );
    }

    function dropIdToMetadata(uint256 id) public view returns (string memory) {
        bytes memory metadataBytes = DynamicBuffer.allocate(1024 * 128);
        metadataBytes.appendSafe("[");

        for (uint256 i = 0; i < drops[id].traits.length; i++) {
            metadataBytes.appendSafe(
                abi.encodePacked(
                    '{"trait_type":"',
                    drops[id].traits[i][0],
                    '","value":"',
                    drops[id].traits[i][1],
                    '"}'
                )
            );

            if (i == drops[id].traits.length - 1) {
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
                MerkleProof.verify(
                    merkleProof,
                    drops[id].merkleRoot,
                    keccak256(abi.encodePacked(addr, max))
                );
        }
        return
            MerkleProof.verify(
                merkleProof,
                drops[id].merkleRoot,
                keccak256(abi.encodePacked(addr))
            ) ||
            MerkleProof.verify(
                merkleProof,
                baseSettings.tier2MerkleRoot,
                keccak256(abi.encodePacked(addr))
            );
    }

    function uri(uint256 id) public view override returns (string memory) {
        require(drops[id].chunks.length > 0, "Invalid token");

        return
            string.concat(
                "data:application/json,",
                '{"name":"#',
                Strings.toString(id),
                '","image":"',
                dropIdToFile(id),
                '","attributes":',
                dropIdToMetadata(id),
                "}"
            );
    }

    function contractURI() public view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        abi.encodePacked(
                            '{"name":"',
                            contractData.name,
                            '","description":"',
                            contractData.description,
                            '","image":"',
                            contractData.image,
                            '","banner":"',
                            contractData.banner,
                            '","external_link":"',
                            contractData.website,
                            '","seller_fee_basis_points":',
                            Strings.toString(contractData.royalties),
                            ',"fee_recipient":"',
                            contractData.royaltiesRecipient,
                            '"}'
                        )
                    )
                )
            );
    }

    function addDrop(uint256 id, Drop memory drop) public onlyOwner {
        drops[id] = drop;
    }

    function getDrop(uint256 id) public view returns (Drop memory) {
        return drops[id];
    }

    function addChunk(
        uint256 id,
        uint256 chunkIndex,
        bytes calldata chunk
    ) public onlyOwner {
        drops[id].chunks[chunkIndex] = SSTORE2.write(chunk);
    }

    function getChunk(
        uint256 id,
        uint256 chunkIndex
    ) external view returns (bytes memory) {
        return SSTORE2.read(drops[id].chunks[chunkIndex]);
    }

    function setContractData(
        ContractData memory _contractData
    ) external onlyOwner {
        contractData = _contractData;
    }

    function setMerkleRoot(bytes32 newMerkleRoot) external onlyOwner {
        merkleRoot = newMerkleRoot;
    }

    function setMaxPerAddress(uint256 id, uint256 max) external onlyOwner {
        drops[id].maxPerAddress = max;
    }

    function setMaxPerAllowList(uint256 id, uint256 max) external onlyOwner {
        drops[id].maxPerAllowList = max;
    }

    function toggleAllowListMint(uint256 id) external onlyOwner {
        drops[id].isAllowListActive = !drops[id].isAllowListActive;
    }

    function togglePublicMint(uint256 id) external onlyOwner {
        drops[id].isPublicMintActive = !drops[id].isPublicMintActive;
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

                Address.sendValue(currRecepient, amount - distAmount);
            }
        }
        balance = address(this).balance;
        Address.sendValue(receiver, balance);
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
