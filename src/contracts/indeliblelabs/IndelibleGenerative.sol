// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "operator-filter-registry/src/upgradeable/OperatorFiltererUpgradeable.sol";
import "solady/src/utils/LibPRNG.sol";
import "solady/src/utils/Base64.sol";
import "solady/src/utils/SSTORE2.sol";
import "./lib/DynamicBuffer.sol";
import "./lib/HelperLib.sol";
import "./interfaces/IIndeliblePro.sol";
    
struct LinkedTraitDTO {
    uint256[] traitA;
    uint256[] traitB;
}

struct TraitDTO {
    string name;
    string mimetype;
    uint256 occurrence;
    bytes data;
    bool hide;
    bool useExistingData;
    uint256 existingDataIndex;
}

struct Trait {
    string name;
    string mimetype;
    uint256 occurrence;
    address dataPointer;
    bool hide;
}

struct Layer {
    string name;
    uint256 primeNumber;
    uint256 numberOfTraits;
}

struct BaseSettings {
    uint256 maxSupply;
    uint256 maxPerAddress;
    uint256 publicMintPrice;
    uint256 allowListPrice;
    uint256 maxPerAllowList;
    bytes32 merkleRoot;
    bool isPublicMintActive;
    bool isAllowListActive;
    bool isContractSealed;
    string baseURI;
    string placeholderImage;
    string backgroundColor;
}

struct ContractData {
    string name;
    string description;
    string image;
    string banner;
    string website;
    uint256 royalties;
    string royaltiesRecipient;
}

struct WithdrawRecipient {
    string name;
    string imageUrl;
    address recipientAddress;
    uint256 percentage;
}

contract IndelibleGenerative is
    ERC721AQueryableUpgradeable,
    OwnableUpgradeable,
    ERC2981Upgradeable,
    OperatorFiltererUpgradeable,
    ReentrancyGuardUpgradeable
{
    using HelperLib for uint256;
    using DynamicBuffer for bytes;
    using LibPRNG for *;

    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    mapping(uint256 => Layer) private layers;
    mapping(uint256 => mapping(uint256 => Trait)) private traits;
    mapping(uint256 => mapping(uint256 => uint256[])) private linkedTraits;
    mapping(uint256 => bool) private renderTokenOffChain;
    
    uint256 private constant MAX_BATCH_MINT = 20;
    
    address payable private collectorFeeRecipient;
    uint256 public collectorFee;
    bytes32 private tier2MerkleRoot;
    
    bool private shouldWrapSVG = true;
    address private proContractAddress;
    uint256 private revealSeed;
    uint256 private numberOfLayers;
    
    BaseSettings public baseSettings;
    ContractData public contractData;
    WithdrawRecipient[] public withdrawRecipients;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        ContractData calldata _contractData,
        BaseSettings calldata _baseSettings,
        address _proContractAddress,
        address _collectorFeeRecipient,
        uint256 _collectorFee,
        bytes32 _tier2MerkleRoot,
        address _deployer,
        address _operatorFilter
    ) public initializerERC721A initializer {
        __ERC721A_init(_name, _symbol);
        __Ownable_init();

        contractData = _contractData;
        baseSettings = _baseSettings;
        proContractAddress = _proContractAddress;
        collectorFeeRecipient = payable(_collectorFeeRecipient);
        collectorFee = _collectorFee;
        tier2MerkleRoot = _tier2MerkleRoot;

        // reveal art if no placeholder is set
        if (bytes(_baseSettings.placeholderImage).length == 0) {
            revealSeed = uint256(
                keccak256(
                    abi.encodePacked(
                        tx.gasprice,
                        block.number,
                        block.timestamp,
                        block.prevrandao,
                        blockhash(block.number - 1),
                        msg.sender
                    )
                )
            );
        }

        transferOwnership(_deployer);

        OperatorFiltererUpgradeable.__OperatorFilterer_init(
            _operatorFilter,
            _operatorFilter == address(0) ? false : true // only subscribe if a filter is provided
        );
    }

    modifier whenMintActive() {
        require(isMintActive(), "Minting is not active");
        _;
    }

    modifier whenUnsealed() {
        require(!baseSettings.isContractSealed, "Contract is sealed");
        _;
    }

    receive() external payable {
        require(baseSettings.isPublicMintActive, "Public minting is not active");
        handleMint(msg.value / baseSettings.publicMintPrice, msg.sender);
    }

    function rarityGen(uint256 layerIndex, uint256 randomInput)
        internal
        view
        returns (uint256)
    {
        uint256 currentLowerBound = 0;
        for (uint256 i = 0; i < layers[layerIndex].numberOfTraits; i++) {
            uint256 thisPercentage = traits[layerIndex][i].occurrence;
            if (
                randomInput >= currentLowerBound &&
                randomInput < currentLowerBound + thisPercentage
            ) return i;
            currentLowerBound = currentLowerBound + thisPercentage;
        }

        revert("Trait not found");
    }

    function getTokenDataId(uint256 tokenId) internal view returns (uint256) {
        uint256[] memory indices = new uint256[](baseSettings.maxSupply);

        unchecked {
            for (uint256 i; i < baseSettings.maxSupply; i += 1) {
                indices[i] = i;
            }
        }

        LibPRNG.PRNG memory prng;
        prng.seed(revealSeed);
        prng.shuffle(indices);

        return indices[tokenId];
    }

    function tokenIdToHash(
        uint256 tokenId
    ) public view returns (string memory) {
        require(revealSeed != 0, "Collection has not revealed");
        require(_exists(tokenId), "Invalid token");
        bytes memory hashBytes = DynamicBuffer.allocate(numberOfLayers * 4);
        uint256 tokenDataId = getTokenDataId(tokenId);

        uint256[] memory hash = new uint256[](numberOfLayers);
        bool[] memory modifiedLayers = new bool[](numberOfLayers);
        uint256 traitSeed = revealSeed % baseSettings.maxSupply;

        for (uint256 i = 0; i < numberOfLayers; i++) {
            uint256 traitIndex = hash[i];
            if (modifiedLayers[i] == false) {
                uint256 traitRangePosition = ((tokenDataId + i + traitSeed) * layers[i].primeNumber) % baseSettings.maxSupply;
                traitIndex = rarityGen(i, traitRangePosition);
                hash[i] = traitIndex;
            }

            if (linkedTraits[i][traitIndex].length > 0) {
                hash[linkedTraits[i][traitIndex][0]] = linkedTraits[i][traitIndex][1];
                modifiedLayers[linkedTraits[i][traitIndex][0]] = true;
            }
        }

        for (uint256 i = 0; i < hash.length; i++) {
            if (hash[i] < 10) {
                hashBytes.appendSafe("00");
            } else if (hash[i] < 100) {
                hashBytes.appendSafe("0");
            }
            if (hash[i] > 999) {
                hashBytes.appendSafe("999");
            } else {
                hashBytes.appendSafe(bytes(_toString(hash[i])));
            }
        }

        return string(hashBytes);
    }

    function handleMint(uint256 count, address recipient) internal whenMintActive {
        uint256 totalMinted = _totalMinted();
        require(count > 0, "Invalid token count");
        require(totalMinted + count <= baseSettings.maxSupply, "All tokens are gone");
        uint256 mintPrice = baseSettings.isPublicMintActive ? baseSettings.publicMintPrice : baseSettings.allowListPrice;
        bool shouldCheckProHolder = count * (mintPrice + collectorFee) != msg.value;

        if (baseSettings.isPublicMintActive && msg.sender != owner()) {
            if (shouldCheckProHolder) {
                require(checkProHolder(msg.sender), "Missing collector's fee.");
                require(count * baseSettings.publicMintPrice == msg.value, "Incorrect amount of ether sent");
            } else {
                require(count * (baseSettings.publicMintPrice + collectorFee) == msg.value, "Incorrect amount of ether sent");
            }
            require(_numberMinted(msg.sender) + count <= baseSettings.maxPerAddress, "Exceeded max mints allowed");
            require(msg.sender == tx.origin, "EOAs only");
        }

        uint256 batchCount = count / MAX_BATCH_MINT;
        uint256 remainder = count % MAX_BATCH_MINT;

        for (uint256 i = 0; i < batchCount; i++) {
            _mint(recipient, MAX_BATCH_MINT);
        }

        if (remainder > 0) {
            _mint(recipient, remainder);
        }

        if (!shouldCheckProHolder && collectorFee > 0) {
            handleCollectorFee(count);
        }
    }

    function handleCollectorFee(uint256 count) internal {
        uint256 totalFee = collectorFee * count;
        (bool sent, ) = collectorFeeRecipient.call{value: totalFee}("");
        require(sent, "Failed to send collector fee");
    }

    function mint(uint256 count, uint256 max, bytes32[] calldata merkleProof)
        external
        payable
        nonReentrant
        whenMintActive
    {
        if (!baseSettings.isPublicMintActive && msg.sender != owner()) {
            bool shouldCheckProHolder = count * (baseSettings.allowListPrice + collectorFee) != msg.value;
            if (shouldCheckProHolder) {
                require(checkProHolder(msg.sender), "Missing collector's fee.");
                require(count * baseSettings.allowListPrice == msg.value, "Incorrect amount of ether sent");
            } else {
                require(count * (baseSettings.allowListPrice + collectorFee) == msg.value, "Incorrect amount of ether sent");
            }
            require(onAllowList(msg.sender, max, merkleProof), "Not on allow list");
            uint256 _maxPerAllowList = max > 0 ? max : baseSettings.maxPerAllowList;
            require(_numberMinted(msg.sender) + count <= _maxPerAllowList, "Exceeded max mints allowed");
        }
        handleMint(count, msg.sender);
    }

    function checkProHolder(address collector) public view returns (bool) {
        IIndeliblePro proContract = IIndeliblePro(proContractAddress);
        uint256 tokenCount = proContract.balanceOf(collector);
        return tokenCount > 0;
    }

    function airdrop(uint256 count, address[] calldata recipients)
        external
        payable
        nonReentrant
        whenMintActive
    {
        require(baseSettings.isPublicMintActive || msg.sender == owner(), "Public minting is not active");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            handleMint(count, recipients[i]);
        }
    }

    function isMintActive() public view returns (bool) {
        return _totalMinted() < baseSettings.maxSupply && (baseSettings.isPublicMintActive || baseSettings.isAllowListActive || msg.sender == owner());
    }

    function hashToSVG(string memory _hash)
        public
        view
        returns (string memory)
    {
        uint256 thisTraitIndex;
        
        bytes memory svgBytes = DynamicBuffer.allocate(1024 * 128);
        svgBytes.appendSafe('<svg width="1200" height="1200" viewBox="0 0 1200 1200" version="1.2" xmlns="http://www.w3.org/2000/svg" style="background-color:');
        svgBytes.appendSafe(
            abi.encodePacked(
                baseSettings.backgroundColor,
                ";background-image:url("
            )
        );

        for (uint256 i = 0; i < numberOfLayers - 1; i++) {
            thisTraitIndex = HelperLib.parseInt(
                HelperLib._substring(_hash, (i * 3), (i * 3) + 3)
            );
            svgBytes.appendSafe(
                abi.encodePacked(
                    "data:",
                    traits[i][thisTraitIndex].mimetype,
                    ";base64,",
                    Base64.encode(SSTORE2.read(traits[i][thisTraitIndex].dataPointer)),
                    "),url("
                )
            );
        }

        thisTraitIndex = HelperLib.parseInt(
            HelperLib._substring(_hash, (numberOfLayers * 3) - 3, numberOfLayers * 3)
        );
            
        svgBytes.appendSafe(
            abi.encodePacked(
                "data:",
                traits[numberOfLayers - 1][thisTraitIndex].mimetype,
                ";base64,",
                Base64.encode(SSTORE2.read(traits[numberOfLayers - 1][thisTraitIndex].dataPointer)),
                ');background-repeat:no-repeat;background-size:contain;background-position:center;image-rendering:-webkit-optimize-contrast;-ms-interpolation-mode:nearest-neighbor;image-rendering:-moz-crisp-edges;image-rendering:pixelated;"></svg>'
            )
        );

        return string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                Base64.encode(svgBytes)
            )
        );
    }

    function hashToMetadata(string memory _hash)
        public
        view
        returns (string memory)
    {
        bytes memory metadataBytes = DynamicBuffer.allocate(1024 * 128);
        metadataBytes.appendSafe("[");
        bool afterFirstTrait;

        for (uint256 i = 0; i < numberOfLayers; i++) {
            uint256 thisTraitIndex = HelperLib.parseInt(
                HelperLib._substring(_hash, (i * 3), (i * 3) + 3)
            );
            if (traits[i][thisTraitIndex].hide == false) {
                if (afterFirstTrait) {
                    metadataBytes.appendSafe(",");
                }
                metadataBytes.appendSafe(
                    abi.encodePacked(
                        '{"trait_type":"',
                        layers[i].name,
                        '","value":"',
                        traits[i][thisTraitIndex].name,
                        '"}'
                    )
                );
                if (afterFirstTrait == false) {
                    afterFirstTrait = true;
                }
            }

            if (i == numberOfLayers - 1) {
                metadataBytes.appendSafe("]");
            }
        }

        return string(metadataBytes);
    }

    function onAllowList(address addr, uint256 max, bytes32[] calldata merkleProof) public view returns (bool) {
        if (max > 0) {
            return MerkleProof.verify(merkleProof, baseSettings.merkleRoot, keccak256(abi.encodePacked(addr, max)));
        }
        return MerkleProof.verify(merkleProof, baseSettings.merkleRoot, keccak256(abi.encodePacked(addr))) || MerkleProof.verify(merkleProof, tier2MerkleRoot, keccak256(abi.encodePacked(addr)));
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(IERC721AUpgradeable, ERC721AUpgradeable)
        returns (string memory)
    {
        require(_exists(tokenId), "Invalid token");

        bytes memory jsonBytes = DynamicBuffer.allocate(1024 * 128);

        jsonBytes.appendSafe(
            abi.encodePacked(
                '{"name":"',
                contractData.name,
                " #",
                _toString(tokenId),
                '","description":"',
                contractData.description,
                '",'
            )
        );

        if (revealSeed == 0) {
            jsonBytes.appendSafe(
                abi.encodePacked(
                    '"image":"',
                    baseSettings.placeholderImage,
                    '"}'
                )
            );
        } else {
            string memory tokenHash = tokenIdToHash(tokenId);
            
            if (bytes(baseSettings.baseURI).length > 0 && renderTokenOffChain[tokenId]) {
                jsonBytes.appendSafe(
                    abi.encodePacked(
                        '"image":"',
                        baseSettings.baseURI,
                        _toString(tokenId),
                        "?dna=",
                        tokenHash,
                        '&networkId=',
                        block.chainid,
                        '",'
                    )
                );
            } else {
                string memory svgCode = "";
                if (shouldWrapSVG) {
                    string memory svgString = hashToSVG(tokenHash);
                    svgCode = string(
                        abi.encodePacked(
                            "data:image/svg+xml;base64,",
                            Base64.encode(
                                abi.encodePacked(
                                    '<svg width="100%" height="100%" viewBox="0 0 1200 1200" version="1.2" xmlns="http://www.w3.org/2000/svg"><image width="1200" height="1200" href="',
                                    svgString,
                                    '"></image></svg>'
                                )
                            )
                        )
                    );
                } else {
                    svgCode = hashToSVG(tokenHash);
                }

                jsonBytes.appendSafe(
                    abi.encodePacked(
                        '"image_data":"',
                        svgCode,
                        '",'
                    )
                );
            }

            jsonBytes.appendSafe(
                abi.encodePacked(
                    '"attributes":',
                    hashToMetadata(tokenHash),
                    "}"
                )
            );
        }

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(jsonBytes)
            )
        );
    }

    function contractURI()
        public
        view
        returns (string memory)
    {
        return string(
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
                        _toString(contractData.royalties),
                        ',"fee_recipient":"',
                        contractData.royaltiesRecipient,
                        '"}'
                    )
                )
            )
        );
    }

    function isRevealed()
        public
        view
        returns (bool)
    {
        return revealSeed != 0;
    }

    function tokenIdToSVG(uint256 tokenId)
        public
        view
        returns (string memory)
    {
        return revealSeed == 0 ? baseSettings.placeholderImage : hashToSVG(tokenIdToHash(tokenId));
    }

    function traitDetails(uint256 layerIndex, uint256 traitIndex)
        public
        view
        returns (Trait memory)
    {
        return traits[layerIndex][traitIndex];
    }

    function traitData(uint256 layerIndex, uint256 traitIndex)
        public
        view
        returns (bytes memory)
    {
        return SSTORE2.read(traits[layerIndex][traitIndex].dataPointer);
    }

    function getLinkedTraits(uint256 layerIndex, uint256 traitIndex)
        public
        view
        returns (uint256[] memory)
    {
        return linkedTraits[layerIndex][traitIndex];
    }

    function addLayer(uint256 layerIndex, Layer calldata layer, TraitDTO[] calldata _traits, uint256 _numberOfLayers)
        public
        onlyOwner
        whenUnsealed
    {
        layers[layerIndex] = layer;
        numberOfLayers = _numberOfLayers;
        for (uint256 i = 0; i < _traits.length; i++) {
            address dataPointer;
            if (_traits[i].useExistingData) {
                dataPointer = traits[layerIndex][_traits[i].existingDataIndex].dataPointer;
            } else {
                dataPointer = SSTORE2.write(_traits[i].data);
            }
            traits[layerIndex][i] = Trait(
                _traits[i].name,
                _traits[i].mimetype,
                _traits[i].occurrence,
                dataPointer,
                _traits[i].hide
            );
        }
        return;
    }

    function addTrait(uint256 layerIndex, uint256 traitIndex, TraitDTO calldata _trait)
        public
        onlyOwner
        whenUnsealed
    {
        address dataPointer;
        if (_trait.useExistingData) {
            dataPointer = traits[layerIndex][traitIndex].dataPointer;
        } else {
            dataPointer = SSTORE2.write(_trait.data);
        }
        traits[layerIndex][traitIndex] = Trait(
            _trait.name,
            _trait.mimetype,
            _trait.occurrence,
            dataPointer,
            _trait.hide
        );
        return;
    }

    function setLinkedTraits(LinkedTraitDTO[] calldata _linkedTraits)
        public
        onlyOwner
        whenUnsealed
    {
        for (uint256 i = 0; i < _linkedTraits.length; i++) {
            linkedTraits[_linkedTraits[i].traitA[0]][_linkedTraits[i].traitA[1]] = [
                _linkedTraits[i].traitB[0],
                _linkedTraits[i].traitB[1]
            ];
        }
    }

    function setContractData(ContractData calldata data) external onlyOwner whenUnsealed {
        contractData = data;
    }

    function setMaxPerAddress(uint256 maxPerAddress) external onlyOwner {
        baseSettings.maxPerAddress = maxPerAddress;
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        baseSettings.baseURI = uri;

        emit BatchMetadataUpdate(0, baseSettings.maxSupply - 1);
    }

    function setBackgroundColor(string calldata backgroundColor) external onlyOwner whenUnsealed {
        baseSettings.backgroundColor = backgroundColor;
    }

    function setRenderOfTokenId(uint256 tokenId, bool renderOffChain) external {
        require(msg.sender == ownerOf(tokenId), "Not token owner");
        renderTokenOffChain[tokenId] = renderOffChain;

        emit MetadataUpdate(tokenId);
    }

    function setMerkleRoot(bytes32 merkleRoot) external onlyOwner {
        baseSettings.merkleRoot = merkleRoot;
    }

    function setMaxPerAllowList(uint256 maxPerAllowList) external onlyOwner {
        baseSettings.maxPerAllowList = maxPerAllowList;
    }

    function setAllowListPrice(uint256 allowListPrice) external onlyOwner {
        baseSettings.allowListPrice = allowListPrice;
    }

    function setPublicMintPrice(uint256 publicMintPrice) external onlyOwner {
        baseSettings.publicMintPrice = publicMintPrice;
    }

    function setPlaceholderImage(string calldata placeholderImage) external onlyOwner {
        baseSettings.placeholderImage = placeholderImage;
    }

    function setRevealSeed() external onlyOwner {
        require(revealSeed == 0, "Reveal seed is already set");
        revealSeed = uint256(
            keccak256(
                abi.encodePacked(
                    tx.gasprice,
                    block.number,
                    block.timestamp,
                    block.prevrandao,
                    blockhash(block.number - 1),
                    msg.sender
                )
            )
        );

        emit BatchMetadataUpdate(0, baseSettings.maxSupply - 1);
    }

    function toggleAllowListMint() external onlyOwner {
        baseSettings.isAllowListActive = !baseSettings.isAllowListActive;
    }

    function toggleWrapSVG() external onlyOwner {
        shouldWrapSVG = !shouldWrapSVG;
    }

    function togglePublicMint() external onlyOwner {
        baseSettings.isPublicMintActive = !baseSettings.isPublicMintActive;
    }

    function sealContract() external whenUnsealed onlyOwner {
        baseSettings.isContractSealed = true;
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        uint256 amount = balance;
        uint256 distAmount = 0;
        uint256 totalDistributionPercentage = 0;

        address payable receiver = payable(owner());

        if (withdrawRecipients.length > 0) {
            for (uint256 i = 0; i < withdrawRecipients.length; i++) {
                totalDistributionPercentage = totalDistributionPercentage + withdrawRecipients[i].percentage;
                address payable currRecepient = payable(withdrawRecipients[i].recipientAddress);
                distAmount = (amount * (10000 - withdrawRecipients[i].percentage)) / 10000;

                Address.sendValue(currRecepient, amount - distAmount);
            }
        }
        balance = address(this).balance;
        Address.sendValue(receiver, balance);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(IERC721AUpgradeable, ERC721AUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            ERC721AUpgradeable.supportsInterface(interfaceId) ||
            ERC2981Upgradeable.supportsInterface(interfaceId);
    }

    function transferFrom(address from, address to, uint256 tokenId)
        public
        payable
        override(IERC721AUpgradeable, ERC721AUpgradeable)
        onlyAllowedOperator(from)
    {
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId)
        public
        payable
        override(IERC721AUpgradeable, ERC721AUpgradeable)
        onlyAllowedOperator(from)
    {
        super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data)
        public
        payable
        override(IERC721AUpgradeable, ERC721AUpgradeable)
        onlyAllowedOperator(from)
    {
        super.safeTransferFrom(from, to, tokenId, data);
    }
}