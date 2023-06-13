
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../extensions/ERC1155X.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "operator-filter-registry/src/DefaultOperatorFilterer.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "solady/src/utils/Base64.sol";
import "solady/src/utils/SSTORE2.sol";
import "./lib/DynamicBuffer.sol";
import "./lib/HelperLib.sol";
import "./lib/Bytecode.sol";
import "./interfaces/IIndeliblePro.sol";

contract IndelibleDrop is ERC1155X, DefaultOperatorFilterer, ReentrancyGuard, Ownable {
    using HelperLib for uint;
    using DynamicBuffer for bytes;
    
    struct Drop {
        address[] chunks;
        string[][] traits;
        string mimetype;
        uint publicMintPrice;
        uint allowListPrice;
        uint maxSupply;
        uint maxPerAddress;
        uint maxPerAllowList;
        bool isPublicMintActive;
        bool isAllowListActive;
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

    struct WithdrawRecipient {
        string name;
        string imageUrl;
        address recipientAddress;
        uint percentage;
    }

    mapping(uint => Drop) internal drops;

    address payable private immutable COLLECTOR_FEE_RECIPIENT = payable(0x29FbB84b835F892EBa2D331Af9278b74C595EDf1);
    uint public constant COLLECTOR_FEE = 0.000777 ether;
    uint private constant MAX_BATCH_MINT = 20;
    bytes32 private constant TIER_2_MERKLE_ROOT = 0;

    address private indelibleProContractAddress = 0xf3DAEb3772B00dFB3BBb1Ad4fB3494ea6b9Be4fE;

    string public name = unicode"Example & Fren ” 😃";
    string public symbol = unicode"EXPL😃";
    bool public isContractSealed;
    bytes32 private merkleRoot = 0;
    bool public isAllowListActive;
    ContractData public contractData = ContractData(unicode"Example & Fren ” 😃", unicode"Example's (\"Description\")", "", "", "https://indelible.xyz", 0, "");
    WithdrawRecipient[] public withdrawRecipients;

    constructor() ERC1155("") {
        
    }

    modifier whenUnsealed() {
        require(!isContractSealed, "Contract is sealed");
        _;
    }

    function handleMint(uint id, uint count, address recipient) internal {
        // uint totalMinted = _totalMinted();
        require(count > 0, "Invalid token count");
        // require(totalMinted + count <= maxSupply, "All tokens are gone");
        uint mintPrice = drops[id].isPublicMintActive ? drops[id].publicMintPrice : drops[id].allowListPrice;
        bool shouldCheckProHolder = count * (mintPrice + COLLECTOR_FEE) != msg.value;

        if (drops[id].isPublicMintActive && msg.sender != owner()) {
            if (shouldCheckProHolder) {
                require(checkProHolder(msg.sender), "Missing collector's fee.");
                require(count * drops[id].publicMintPrice == msg.value, "Incorrect amount of ether sent");
            } else {
                require(count * (drops[id].publicMintPrice + COLLECTOR_FEE) == msg.value, "Incorrect amount of ether sent");
            }
            require(balanceOf(msg.sender, id) + count <= drops[id].maxPerAddress, "Exceeded max mints allowed");
            require(msg.sender == tx.origin, "EOAs only");
        }
        
        _mint(recipient, id, count, "");

        if (!shouldCheckProHolder && COLLECTOR_FEE > 0) {
            handleCollectorFee(count);
        }
    }

    function handleCollectorFee(uint count) internal {
        uint256 totalFee = COLLECTOR_FEE * count;
        (bool sent, ) = COLLECTOR_FEE_RECIPIENT.call{value: totalFee}("");
        require(sent, "Failed to send collector fee");
    }

    function mint(uint id, uint count, bytes32[] calldata merkleProof)
        external
        payable
        nonReentrant
    {
        if (!drops[id].isPublicMintActive && msg.sender != owner()) {
            bool shouldCheckProHolder = count * (drops[id].allowListPrice + COLLECTOR_FEE) != msg.value;
            if (shouldCheckProHolder) {
                require(checkProHolder(msg.sender), "Missing collector's fee.");
                require(count * drops[id].allowListPrice == msg.value, "Incorrect amount of ether sent");
            } else {
                require(count * (drops[id].allowListPrice + COLLECTOR_FEE) == msg.value, "Incorrect amount of ether sent");
            }
            require(onAllowList(msg.sender, merkleProof), "Not on allow list");
            require(balanceOf(msg.sender, id) + count <= drops[id].maxPerAllowList, "Exceeded max mints allowed");
        }
        handleMint(id, count, msg.sender);
    }

    function checkProHolder(address collector) public view returns (bool) {
        IIndeliblePro proContract = IIndeliblePro(indelibleProContractAddress);
        uint256 tokenCount = proContract.balanceOf(collector);
        return tokenCount > 0;
    }

    function airdrop(uint id, uint count, address[] calldata recipients)
        external
        payable
        nonReentrant
    {
        require(drops[id].isPublicMintActive || msg.sender == owner(), "Public minting is not active");
        
        for (uint i = 0; i < recipients.length; i++) {
            handleMint(id, count, recipients[i]);
        }
    }

    function dropIdToFile(uint id)
        public
        view
        returns (string memory)
    {
        require(drops[id].chunks.length > 0, "Invalid token");

        bytes memory image;
        address[] storage chunks = drops[id].chunks;
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
        return string.concat("data:", drops[id].mimetype, ";base64,", Base64.encode(image));
    }

    function dropIdToMetadata(uint id)
        public
        view
        returns (string memory)
    {
        bytes memory metadataBytes = DynamicBuffer.allocate(1024 * 128);
        metadataBytes.appendSafe("[");

        for (uint i = 0; i < drops[id].traits.length; i++) {
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

    function onAllowList(address addr, bytes32[] calldata merkleProof) public view returns (bool) {
        return MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encodePacked(addr)));
    }

    function uri(uint256 id)
        public
        view
        override
        returns (string memory)
    {
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

    function addDrop(uint id, Drop memory drop)
        public
        onlyOwner
        whenUnsealed
    {
        drops[id] = drop;
    }

    function getDrop(uint id)
        public
        view
        returns (Drop memory)
    {
        return drops[id];
    }

    function addChunk(uint id, uint chunkIndex, bytes calldata chunk)
        public
        onlyOwner
        whenUnsealed
    {
        drops[id].chunks[chunkIndex] = SSTORE2.write(chunk);
    }

    function getChunk(uint id, uint chunkIndex) external view returns (bytes memory) {
        return SSTORE2.read(drops[id].chunks[chunkIndex]);
    }

    function setContractData(ContractData memory _contractData) external onlyOwner whenUnsealed {
        contractData = _contractData;
    }

    function setMerkleRoot(bytes32 newMerkleRoot) external onlyOwner {
        merkleRoot = newMerkleRoot;
    }

    function setMaxPerAddress(uint id, uint max) external onlyOwner {
        drops[id].maxPerAddress = max;
    }

    function setMaxPerAllowList(uint id, uint max) external onlyOwner {
        drops[id].maxPerAllowList = max;
    }

    function toggleAllowListMint(uint id) external onlyOwner {
        drops[id].isAllowListActive = !drops[id].isAllowListActive;
    }

    function togglePublicMint(uint id) external onlyOwner {
        drops[id].isPublicMintActive = !drops[id].isPublicMintActive;
    }

    function sealContract() external whenUnsealed onlyOwner {
        isContractSealed = true;
    }

    function withdraw() external onlyOwner nonReentrant {
        uint balance = address(this).balance;
        uint amount = balance;
        uint distAmount = 0;
        uint totalDistributionPercentage = 0;

        address payable receiver = payable(owner());

        if (withdrawRecipients.length > 0) {
            for (uint i = 0; i < withdrawRecipients.length; i++) {
                totalDistributionPercentage = totalDistributionPercentage + withdrawRecipients[i].percentage;
                address payable currRecepient = payable(withdrawRecipients[i].recipientAddress);
                distAmount = (amount * (10000 - withdrawRecipients[i].percentage)) / 10000;

                Address.sendValue(currRecepient, amount - distAmount);
            }
        }
        balance = address(this).balance;
        Address.sendValue(receiver, balance);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, uint256 amount, bytes memory data)
        public
        override
        onlyAllowedOperator(from)
    {
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
