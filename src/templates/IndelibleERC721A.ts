import { sanitizeString } from "../utils";

interface ContractBuilderProps {
  name: string;
  tokenSymbol: string;
  mintPrice: string;
  description: string;
  maxTokens: number;
  numberOfLayers: number;
  layerNames: string[];
  maxMintPerAddress: number;
  tiers: number[][];
}

export const generateContract = ({
  name,
  tokenSymbol,
  mintPrice,
  description,
  maxTokens,
  numberOfLayers,
  layerNames,
  maxMintPerAddress,
  tiers,
}: ContractBuilderProps) => `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.4;

    import "erc721a/contracts/ERC721A.sol";
    import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
    import "@openzeppelin/contracts/access/Ownable.sol";
    import "@openzeppelin/contracts/utils/Base64.sol";
    import "./SSTORE2.sol";
    import "./DynamicBuffer.sol";
    import "./HelperLib.sol";
    import "./Types.sol";

    contract IndelibleERC721A is ERC721A, ReentrancyGuard, Ownable {
        using HelperLib for uint256;
        using DynamicBuffer for bytes;

        mapping(uint256 => bytes) internal _tokenIdToRandomBytes;
        mapping(uint256 => address[]) internal _traitDataPointers;
        mapping(uint256 => mapping(uint256 => Trait)) internal _traitDetails;

        uint256 private constant MAX_TOKENS = ${maxTokens};
        uint256 private constant NUM_LAYERS = ${numberOfLayers};
        uint256 private constant MAX_BATCH_MINT = 20;
        uint256[][NUM_LAYERS] private TIERS;
        string[] private LAYER_NAMES = [${layerNames
          .map((layerName) => `unicode"${sanitizeString(layerName)}"`)
          .join(", ")}];

        uint256 public maxPerAddress = ${maxMintPerAddress};
        uint256 public mintPrice = ${mintPrice} ether;
        string public baseURI = "";
        bool public isMintingPaused = true;
        bool public useBaseURI = false;

        constructor() ERC721A(unicode"${sanitizeString(
          name
        )}", unicode"${sanitizeString(tokenSymbol)}") {
            ${tiers
              .map((tier, index) => {
                return `TIERS[${index}] = [${tier}];`;
              })
              .join("\n")}
        }

        modifier whenPublicMintActive() {
            require(isPublicMintActive(), "Public sale not open");
            _;
        }

        function rarityGen(uint256 _randinput, uint256 _rarityTier)
            internal
            view
            returns (string memory)
        {
            uint256 currentLowerBound = 0;
            for (uint256 i = 0; i < TIERS[_rarityTier].length; i++) {
                uint256 thisPercentage = TIERS[_rarityTier][i];
                if (
                    _randinput >= currentLowerBound &&
                    _randinput < currentLowerBound + thisPercentage
                ) return _toString(i);
                currentLowerBound = currentLowerBound + thisPercentage;
            }

            revert();
        }

        function hashFromRandomBytes(
            bytes memory _randomBytes,
            uint256 _tokenId,
            uint256 _startingTokenId
        ) internal view returns (string memory) {
            require(_exists(_tokenId), "Invalid token");
            // This will generate a NUM_LAYERS * 2 character string.
            bytes memory hashBytes = DynamicBuffer.allocate(NUM_LAYERS * 3);

            for (uint256 i = 0; i < NUM_LAYERS; i++) {
                uint256 _randinput = uint256(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                string(_randomBytes),
                                _tokenId,
                                _startingTokenId,
                                _tokenId * i
                            )
                        )
                    ) % MAX_TOKENS
                );

                string memory rarity = rarityGen(_randinput, i);

                if (HelperLib.parseInt(rarity) < 10) {
                    hashBytes.appendSafe("0");
                }
                hashBytes.appendSafe(bytes(rarity));
            }

            return string(hashBytes);
        }

        function mint(uint256 _count) external payable nonReentrant whenPublicMintActive returns (uint256) {
            uint256 totalMinted = _totalMinted();
            require(totalMinted + _count <= MAX_TOKENS, "All tokens are gone");
            require(_count * mintPrice == msg.value, "Incorrect amount of ether sent");
            require(balanceOf(msg.sender) + _count <= maxPerAddress, "Exceeded max mints allowed.");

            uint256 batchCount = _count / MAX_BATCH_MINT;
            uint256 remainder = _count % MAX_BATCH_MINT;

            bytes memory randomBytes = abi.encodePacked(
                tx.gasprice + block.number + block.timestamp + block.difficulty,
                blockhash(block.number - 1),
                msg.sender
            );

            for (uint256 i = 0; i < batchCount; i++) {
                if (i == 0) {
                    _tokenIdToRandomBytes[totalMinted] = randomBytes;
                } else {
                    _tokenIdToRandomBytes[totalMinted + (i * MAX_BATCH_MINT)] = randomBytes;
                }
        
                _mint(msg.sender, MAX_BATCH_MINT);
            }

            if (remainder > 0) {
                if (batchCount == 0) {
                    _tokenIdToRandomBytes[totalMinted] = randomBytes;
                } else {
                    _tokenIdToRandomBytes[totalMinted + (batchCount * MAX_BATCH_MINT)] = randomBytes;
                }

                _mint(msg.sender, remainder);
            }

            return totalMinted;
        }

        function isPublicMintActive() public view returns (bool) {
            return _totalMinted() < MAX_TOKENS && isMintingPaused == false;
        }

        function hashToSVG(string memory _hash)
            public
            view
            returns (string memory)
        {
            uint256 thisTraitIndex;
            
            bytes memory svgBytes = DynamicBuffer.allocate(1024 * 128);
            svgBytes.appendSafe(
                abi.encodePacked(
                    '<svg class="styles-',
                    string(_hash),
                    '" width="1200" height="1200" version="1.1" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><style>.styles-',
                    string(_hash),
                    "{background-image:url("
                )
            );

            for (uint256 i = 0; i < NUM_LAYERS - 1; i++) {
                thisTraitIndex = HelperLib.parseInt(
                    HelperLib._substring(_hash, (i * 2), (i * 2) + 2)
                );
                svgBytes.appendSafe(
                    abi.encodePacked(
                        "data:",
                        _traitDetails[i][thisTraitIndex].mimetype,
                        ";base64,",
                        Base64.encode(SSTORE2.read(_traitDataPointers[i][thisTraitIndex])),
                        "),url("
                    )
                );
            }

            thisTraitIndex = HelperLib.parseInt(
                HelperLib._substring(_hash, (NUM_LAYERS * 2) - 2, NUM_LAYERS * 2)
            );

            svgBytes.appendSafe(
                abi.encodePacked(
                    "data:",
                    _traitDetails[NUM_LAYERS - 1][thisTraitIndex].mimetype,
                    ";base64,",
                    Base64.encode(SSTORE2.read(_traitDataPointers[NUM_LAYERS - 1][thisTraitIndex])),
                    ");background-repeat:no-repeat;background-size:contain;background-position:center;image-rendering:-webkit-optimize-contrast;-ms-interpolation-mode:nearest-neighbor;image-rendering:-moz-crisp-edges;image-rendering:pixelated;}</style></svg>"
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

            for (uint256 i = 0; i < NUM_LAYERS; i++) {
                uint256 thisTraitIndex = HelperLib.parseInt(
                    HelperLib._substring(_hash, (i * 2), (i * 2) + 2)
                );
                metadataBytes.appendSafe(
                    abi.encodePacked(
                        '{"trait_type":"',
                        LAYER_NAMES[i],
                        '","value":"',
                        _traitDetails[i][thisTraitIndex].name,
                        '"}'
                    )
                );
                
                if (i == NUM_LAYERS - 1) {
                    metadataBytes.appendSafe("]");
                } else {
                    metadataBytes.appendSafe(",");
                }
            }

            return string(metadataBytes);
        }

        function tokenURI(uint256 _tokenId)
            public
            view
            override
            returns (string memory)
        {
            require(_exists(_tokenId), "Invalid token");
            require(_traitDataPointers[0].length > 0,  "Traits have not been added");

            string memory tokenHash = tokenIdToHash(_tokenId);

            bytes memory jsonBytes = DynamicBuffer.allocate(1024 * 128);
            jsonBytes.appendSafe(unicode"{\\"name\\":\\"${sanitizeString(
              name,
              true
            )} #");

            jsonBytes.appendSafe(
                abi.encodePacked(
                    _toString(_tokenId),
                    unicode"\\",\\"description\\":\\"${sanitizeString(
                      description,
                      true
                    )}\\","
                )
            );

            if (useBaseURI) {
                jsonBytes.appendSafe(
                    abi.encodePacked(
                        '"image":"',
                        baseURI,
                        _toString(_tokenId),
                        "?dna=",
                        tokenHash,
                        '",'
                    )
                );
            } else {
                jsonBytes.appendSafe(
                    abi.encodePacked(
                        '"image_data":"',
                        hashToSVG(tokenHash),
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

            return string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(jsonBytes)
                )
            );
        }

        function tokenIdToHash(uint256 _tokenId)
            public
            view
            returns (string memory)
        {
            // decrement to find first token in batch
            for (uint256 i = 0; i < MAX_BATCH_MINT; i++) {
                if (_tokenIdToRandomBytes[_tokenId - i].length == 0) {
                    continue;
                }
                return hashFromRandomBytes(_tokenIdToRandomBytes[_tokenId - i], _tokenId, _tokenId - i);
            }
            revert();
        }

        function traitDetails(uint256 _layerIndex, uint256 _traitIndex)
            public
            view
            returns (Trait memory)
        {
            return _traitDetails[_layerIndex][_traitIndex];
        }

        function traitData(uint256 _layerIndex, uint256 _traitIndex)
            public
            view
            returns (string memory)
        {
            return string(SSTORE2.read(_traitDataPointers[_layerIndex][_traitIndex]));
        }

        function addLayer(uint256 _layerIndex, TraitDTO[] memory traits)
            public
            onlyOwner
        {
            require(TIERS[_layerIndex].length == traits.length, "Traits size does not match tiers for this index");
            require(traits.length < 100, "There cannot be over 99 traits per layer");
            address[] memory dataPointers = new address[](traits.length);
            for (uint256 i = 0; i < traits.length; i++) {
                dataPointers[i] = SSTORE2.write(traits[i].data);
                _traitDetails[_layerIndex][i] = Trait(traits[i].name, traits[i].mimetype);
            }
            _traitDataPointers[_layerIndex] = dataPointers;
            return;
        }

        function addTrait(uint256 _layerIndex, uint256 _traitIndex, TraitDTO memory trait)
            public
            onlyOwner
        {
            require(_traitIndex < 99, "There cannot be over 99 traits per layer");
            _traitDetails[_layerIndex][_traitIndex] = Trait(trait.name, trait.mimetype);
            address[] memory dataPointers = _traitDataPointers[_layerIndex];
            dataPointers[_traitIndex] = SSTORE2.write(trait.data);
            _traitDataPointers[_layerIndex] = dataPointers;
            return;
        }

        function changeMaxPerAddress(uint256 _maxPerAddress) external onlyOwner {
            maxPerAddress = _maxPerAddress;
        }

        function changeBaseURI(string memory _baseURI) external onlyOwner {
            baseURI = _baseURI;
        }

        function toggleUseBaseURI() external onlyOwner {
            useBaseURI = !useBaseURI;
        }

        function toggleMinting() external onlyOwner {
            isMintingPaused = !isMintingPaused;
        }

        function withdraw() external onlyOwner nonReentrant {
            (bool success,) = msg.sender.call{value : address(this).balance}("");
            require(success, "Withdrawal failed");
        }
    }
`;
