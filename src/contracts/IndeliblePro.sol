
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {DefaultOperatorFilterer} from "./DefaultOperatorFilterer.sol";
import "solady/src/utils/Base64.sol";
import "./SSTORE2.sol";
import "./DynamicBuffer.sol";

contract IndeliblePro is ERC721, DefaultOperatorFilterer, ReentrancyGuard, Ownable {
    using DynamicBuffer for bytes;

    IERC721 public freeMintToken;
    address internal burnAddress = 0x000000000000000000000000000000000000dEaD;

    struct ContractData {
        string name;
        string description;
        string image;
        string banner;
        string website;
        uint royalties;
        string royaltiesRecipient;
    }

    address[18] internal _chunks;

    uint private constant MAX_SUPPLY = 2000;
    bytes32 private merkleRoot;

    uint public totalFreeMinted;
    uint public totalPaidMinted;
    bool public isContractSealed;
    uint public mintPrice = 0.5 ether;
    string public baseURI = "";
    bool public isAllowListMintActive;
    bool public isPublicMintActive;
    bool public isFreeMintActive;

    ContractData public contractData = ContractData(
        "Indelible Pro",
        "Indelible Pro grants holders special access to products and services by Indelible Labs.",
        "",
        "",
        "https://indelible.xyz",
        1000,
        ""
    );

    constructor(address _freeMintTokenAddress) ERC721("IndeliblePro", "INDELIBLE") {
        freeMintToken = IERC721(_freeMintTokenAddress);
    }

    modifier whenMintActive() {
        require(isMintActive(), "Mint is not active");
        _;
    }

    modifier whenPaidMintActive() {
        require(isPublicMintActive || isAllowListMintActive, "Paid mint is not active");
        _;
    }

    modifier whenFreeMintActive() {
        require(isFreeMintActive, "Free mint is not active");
        _;
    }

    modifier whenUnsealed() {
        require(!isContractSealed, "Contract is sealed");
        _;
    }

    receive() external payable {
        require(isPublicMintActive, "Public minting is not active");
        paidMint(msg.value / mintPrice, msg.sender);
    }

    function maxSupply() public pure returns (uint) {
        return MAX_SUPPLY * 2;
    }

    function totalSupply() public view returns (uint) {
        return totalFreeMinted + totalPaidMinted;
    }

    function freeMint(uint[] calldata tokenIds)
        external
        nonReentrant
        whenFreeMintActive
        returns (uint)
    {
        require(totalFreeMinted + tokenIds.length <= MAX_SUPPLY, "All tokens are gone");

        for (uint i; i < tokenIds.length; i += 1) {
            require(!_exists(tokenIds[i]), "Token has already been claimed");

            freeMintToken.safeTransferFrom(msg.sender, burnAddress, tokenIds[i]);

            _mint(msg.sender, tokenIds[i]);
        }
            
        totalFreeMinted += tokenIds.length;

        return tokenIds[0];
    }

    function paidMint(uint count, address recipient)
        internal
        whenPaidMintActive
        returns (uint)
    {
        require(count > 0, "Invalid token count");
        require(totalPaidMinted + count <= MAX_SUPPLY, "All tokens are gone");
        if (isPublicMintActive) {
            require(msg.sender == tx.origin, "EOAs only");
        }
        if (msg.sender != owner()) {
            require(count * mintPrice == msg.value, "Incorrect amount of ether sent");
        }

        for (uint i; i < count; i += 1) {
            _mint(recipient, totalPaidMinted + 2000 + i + 1);
        }
        
        totalPaidMinted += count;

        return totalPaidMinted + 2000;
    }

    function mint(uint count, bytes32[] calldata merkleProof)
        external
        payable
        nonReentrant
        whenMintActive
        returns (uint)
    {
        if (!isPublicMintActive && msg.sender != owner()) {
            require(onAllowList(msg.sender, merkleProof), "Not on allow list");
            require(count * mintPrice == msg.value, "Incorrect amount of ether sent");
        }
        return paidMint(count, msg.sender);
    }

    function airdrop(uint count, address recipient)
        external
        payable
        nonReentrant
        whenMintActive
        returns (uint)
    {
        require(isPublicMintActive || msg.sender == owner(), "Public minting is not active");
        return paidMint(count, recipient);
    }

    function onAllowList(address addr, bytes32[] calldata merkleProof) public view returns (bool) {
        return MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encodePacked(addr)));
    }

    function isMintActive() public view returns (bool) {
        return totalFreeMinted + totalPaidMinted < maxSupply() && (isPublicMintActive || isAllowListMintActive || isFreeMintActive || msg.sender == owner());
    }

    function getImageData()
        public
        view
        returns (string memory)
    {
        bytes memory image;
        uint256 size;
        uint ptr = 0x20;
        address currentChunk;
        unchecked {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                image := mload(0x40)
            }
            for (uint i = 0; i < _chunks.length; i++) {
                currentChunk = _chunks[i];
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
        return string.concat("data:image/gif;base64,", Base64.encode(image));
    }

    function tokenIdToMetadata(uint tokenId)
        public
        pure
        returns (string memory)
    {
        bytes memory metadataBytes = DynamicBuffer.allocate(1024 * 128);
        metadataBytes.appendSafe("[");

        if (tokenId > 2000) {
            metadataBytes.appendSafe(
                abi.encodePacked(
                    '{"trait_type":"Tier","value":"1"}'
                )
            );
        } else {
            metadataBytes.appendSafe(
                abi.encodePacked(
                    '{"trait_type":"Tier","value":"2"}'
                )
            );
        }
        metadataBytes.appendSafe("]");

        return string(metadataBytes);
    }

    function tokenURI(uint tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(tokenId), "Invalid token");

        return
            string.concat(
                "data:application/json,",
                '{"name":"Indelible Pro #',
                Strings.toString(tokenId),
                '","image":"',
                getImageData(),
                '","attributes":',
                tokenIdToMetadata(tokenId),
                "}"
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

    function addChunk(uint index, bytes calldata chunk)
        public
        onlyOwner
        whenUnsealed
    {
        _chunks[index] = SSTORE2.write(chunk);
    }

    function setContractData(ContractData memory data)
        external
        onlyOwner
        whenUnsealed
    {
        contractData = data;
    }

    function setBaseURI(string memory uri) external onlyOwner {
        baseURI = uri;
    }

    function setMerkleRoot(bytes32 newMerkleRoot) external onlyOwner {
        merkleRoot = newMerkleRoot;
    }

    function toggleFreeMint() external onlyOwner {
        isFreeMintActive = !isFreeMintActive;
    }

    function toggleAllowListMint() external onlyOwner {
        isAllowListMintActive = !isAllowListMintActive;
    }

    function togglePublicMint() external onlyOwner {
        isPublicMintActive = !isPublicMintActive;
    }

    function sealContract() external whenUnsealed onlyOwner {
        isContractSealed = true;
    }

    function withdraw() external onlyOwner {
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        if (!success) revert("Failed");
    }
}
