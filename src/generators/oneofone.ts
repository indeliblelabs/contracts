import { sanitizeString } from "./utils";

interface ContractBuilderProps {
  name: string;
  tokenSymbol: string;
  mintPrice: string;
  description: string;
  maxSupply: number;
  maxPerAddress: number;
  networkId: number;
  royalties: number;
  royaltiesRecipient: string;
  image: string;
  banner: string;
  website: string;
  allowList?: {
    price: string;
    maxPerAllowList: number;
  };
  contractName?: string;
  backgroundColor?: string;
}

export const generateContract = ({
  name,
  tokenSymbol,
  mintPrice,
  description,
  maxPerAddress,
  networkId,
  royalties,
  royaltiesRecipient,
  image,
  banner,
  website,
  allowList,
  contractName = "Indelible",
  backgroundColor = "transparent",
}: ContractBuilderProps) => `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.17;

    import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
    import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
    import "@openzeppelin/contracts/access/Ownable.sol";
    import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
    import "@openzeppelin/contracts/utils/Address.sol";
    import "@openzeppelin/contracts/utils/Strings.sol";
    import "@openzeppelin/contracts/utils/Counters.sol";
    import "operator-filter-registry/src/DefaultOperatorFilterer.sol";
    import "solady/src/utils/Base64.sol";
    import "solady/src/utils/SSTORE2.sol";
    import "./lib/DynamicBuffer.sol";
    import "./lib/HelperLib.sol";
    import "./lib/Bytecode.sol";

    contract ${contractName} is ERC721, DefaultOperatorFilterer, ReentrancyGuard, Ownable {
        using HelperLib for uint;
        using DynamicBuffer for bytes;
        using Counters for Counters.Counter;
        
        struct Token {
            address[] chunks;
            string[][] traits;
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

        mapping(uint => Token) internal _tokens;
        mapping(uint => bool) internal _renderTokenOffChain;

        uint private constant DEVELOPER_FEE = 250; // of 10,000 = 2.5%
        string private backgroundColor = "${backgroundColor}";

        Counters.Counter public totalSupply;
        bool public isContractSealed;
        uint public publicMintPrice = ${mintPrice} ether;
        string public baseURI = "";
        bool public isPublicMintActive;
        ${
          allowList
            ? `
        bytes32 private merkleRoot;
        uint public allowListPrice = ${allowList.price} ether;
        uint public maxPerAllowList = ${allowList.maxPerAllowList};
        bool public isAllowListActive;
        `
            : ""
        }
        ContractData public contractData = ContractData(unicode"${sanitizeString(
          name
        )}", unicode"${sanitizeString(
  description
)}", "${image}", "${banner}", "${website}", ${royalties}, "${royaltiesRecipient}");

        constructor() ERC721(unicode"${sanitizeString(
          name
        )}", unicode"${sanitizeString(tokenSymbol)}") {
        }

        modifier whenMintActive() {
            require(isMintActive(), "Minting is not active");
            _;
        }

        modifier whenUnsealed() {
            require(!isContractSealed, "Contract is sealed");
            _;
        }

        ${
          allowList
            ? "function mint(uint64 _tokenId, bytes32[] calldata merkleProof)"
            : "function mint(uint64 _tokenId)"
        }
            external
            payable
            nonReentrant
            whenMintActive
            returns (uint)
        {
            ${
              allowList
                ? `
            if (isPublicMintActive) {
                require(publicMintPrice == msg.value, "Incorrect amount of ether sent");
            } else {
                if (msg.sender != owner()) {
                    require(onAllowList(msg.sender, merkleProof), "Not on allow list");
                }
                require(allowListPrice == msg.value, "Incorrect amount of ether sent");
            }
            `
                : `
            require(publicMintPrice == msg.value, "Incorrect amount of ether sent");
            `
            }

            totalSupply.increment();
            _mint(msg.sender, _tokenId);

            return _tokenId;
        }

        function isMintActive() public view returns (bool) {
            ${
              allowList
                ? "return isPublicMintActive || isAllowListActive;"
                : "return isPublicMintActive;"
            }
        }

        function tokenIdToImage(uint _tokenId)
            public
            view
            returns (string memory)
        {
            require(_tokens[_tokenId].chunks.length > 0, "Invalid token");

            bytes memory image;
            address[] storage chunks = _tokens[_tokenId].chunks;
            uint256 size;
            uint ptr = 0x20;
            address currentChunk;
            unchecked {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    image := mload(0x40)
                }
                for (uint i = 0; i < chunks.length; i++) {
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
            return string.concat("data:image/avif;base64,", Base64.encode(image));
        }

        function tokenIdToMetadata(uint _tokenId)
            public
            view
            returns (string memory)
        {
            bytes memory metadataBytes = DynamicBuffer.allocate(1024 * 128);
            metadataBytes.appendSafe("[");

            for (uint i = 0; i < _tokens[_tokenId].traits.length; i++) {
                metadataBytes.appendSafe(
                    abi.encodePacked(
                        '{"trait_type":"',
                        _tokens[_tokenId].traits[i][0],
                        '","value":"',
                        _tokens[_tokenId].traits[i][1],
                        '"}'
                    )
                );
                
                if (i == _tokens[_tokenId].traits.length - 1) {
                    metadataBytes.appendSafe("]");
                } else {
                    metadataBytes.appendSafe(",");
                }
            }

            return string(metadataBytes);
        }

        ${
          allowList
            ? `
        function onAllowList(address addr, bytes32[] calldata merkleProof) public view returns (bool) {
            return MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encodePacked(addr)));
        }
        `
            : ""
        }

        function tokenURI(uint _tokenId)
            public
            view
            override
            returns (string memory)
        {
            require(_exists(_tokenId), "Invalid token");
            require(_tokens[_tokenId].chunks.length > 0, "Invalid token");

            return
                string.concat(
                    "data:application/json,",
                    '{"name":"#',
                    Strings.toString(_tokenId),
                    '","image":"',
                    tokenIdToImage(_tokenId),
                    '","attributes":[{"trait_type":"Tier","value":"1"}]}'
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
                            Strings.toString(contractData.royalties),
                            ',"fee_recipient":"',
                            contractData.royaltiesRecipient,
                            '"}'
                        )
                    )
                )
            );
        }

        function addToken(uint _tokenId, uint _numOfChunks, string[][] memory _traits)
            public
            onlyOwner
            whenUnsealed
        {
            address[] memory _chunks = new address[](_numOfChunks);
            _tokens[_tokenId] = Token(_chunks, _traits);
        }

        function addChunk(uint _tokenId, uint _chunkIndex, bytes calldata _chunk)
            public
            onlyOwner
            whenUnsealed
        {
            _tokens[_tokenId].chunks[_chunkIndex] = SSTORE2.write(_chunk);
        }

        function getToken(uint _tokenId)
            public
            view
            returns (Token memory)
        {
            return _tokens[_tokenId];
        }

        function setContractData(ContractData memory _contractData) external onlyOwner whenUnsealed {
            contractData = _contractData;
        }

        function setBaseURI(string memory _baseURI) external onlyOwner {
            baseURI = _baseURI;
        }

        function setBackgroundColor(string memory _backgroundColor) external onlyOwner whenUnsealed {
            backgroundColor = _backgroundColor;
        }

        function setRenderOfTokenId(uint _tokenId, bool _renderOffChain) external {
            require(msg.sender == ownerOf(_tokenId), "Only the token owner can set the render method");
            _renderTokenOffChain[_tokenId] = _renderOffChain;
        }

        ${
          allowList
            ? `
        function setMerkleRoot(bytes32 newMerkleRoot) external onlyOwner {
            merkleRoot = newMerkleRoot;
        }

        function setMaxPerAllowList(uint _maxPerAllowList) external onlyOwner {
            maxPerAllowList = _maxPerAllowList;
        }

        function toggleAllowListMint() external onlyOwner {
            isAllowListActive = !isAllowListActive;
        }
        `
            : ""
        }

        function togglePublicMint() external onlyOwner {
            isPublicMintActive = !isPublicMintActive;
        }

        function sealContract() external whenUnsealed onlyOwner {
            isContractSealed = true;
        }

        function withdraw() external onlyOwner nonReentrant {
            uint balance = address(this).balance;
            uint amount = (balance * (10000 - DEVELOPER_FEE)) / 10000;
    
            address payable receiver = payable(owner());
            address payable dev = payable(0x29FbB84b835F892EBa2D331Af9278b74C595EDf1);
    
            Address.sendValue(receiver, amount);
            Address.sendValue(dev, balance - amount);
        }
    }
`;
