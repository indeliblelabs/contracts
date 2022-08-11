
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.4;

    import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
    import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
    import "@openzeppelin/contracts/access/Ownable.sol";
    import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
    import "@openzeppelin/contracts/utils/Base64.sol";
    import "@openzeppelin/contracts/utils/Address.sol";
    import "@openzeppelin/contracts/utils/Strings.sol";
    import "@openzeppelin/contracts/utils/Counters.sol";
    import "./SSTORE2.sol";
    import "./DynamicBuffer.sol";
    import "./HelperLib.sol";

    contract IndelibleOneOfOne is ERC721, ReentrancyGuard, Ownable {
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
        string private backgroundColor = "transparent";

        Counters.Counter public totalSupply;
        bool public isContractSealed;
        uint public publicMintPrice = 0.005 ether;
        string public baseURI = "";
        bool public isPublicMintActive;
        
        ContractData public contractData = ContractData(unicode"Example & Fren ” 😃", unicode"Example's (\"Description\")", "", "", "https://indeliblelabs.io", 0, "");

        constructor() ERC721(unicode"Example & Fren ” 😃", unicode"EXPL😃") {
        }

        modifier whenMintActive() {
            require(isMintActive(), "Minting is not active");
            _;
        }

        modifier whenUnsealed() {
            require(!isContractSealed, "Contract is sealed");
            _;
        }

        function mint(uint64 _tokenId)
            external
            payable
            nonReentrant
            whenMintActive
            returns (uint)
        {
            
            require(publicMintPrice == msg.value, "Incorrect amount of ether sent");
            

            totalSupply.increment();
            _mint(msg.sender, _tokenId);

            return _tokenId;
        }

        function isMintActive() public view returns (bool) {
            return isPublicMintActive;
        }

        function tokenIdToImage(uint _tokenId)
            public
            view
            returns (string memory)
        {
            require(_tokens[_tokenId].chunks.length > 0, "Invalid token");
            bytes memory imageBytes = DynamicBuffer.allocate(14400 * _tokens[_tokenId].chunks.length);

            for (uint i = 0; i < _tokens[_tokenId].chunks.length; i++) {
                if (_tokens[_tokenId].chunks[i] != address(0)) {
                    imageBytes.appendSafe(
                        SSTORE2.read(_tokens[_tokenId].chunks[i])
                    );
                }
            }

            return string(imageBytes);
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

        

        function tokenURI(uint _tokenId)
            public
            view
            override
            returns (string memory)
        {
            require(_exists(_tokenId), "Invalid token");
            require(_tokens[_tokenId].chunks.length > 0, "Invalid token");

            bytes memory jsonBytes = DynamicBuffer.allocate(11000 * _tokens[_tokenId].chunks.length);

            jsonBytes.appendSafe(unicode"{\"name\":\"Example & Fren ” 😃 #");

            jsonBytes.appendSafe(
                abi.encodePacked(
                    Strings.toString(_tokenId),
                    "\",\"description\":\"",
                    contractData.description,
                    "\","
                )
            );

            if (bytes(baseURI).length > 0 && _renderTokenOffChain[_tokenId]) {
                jsonBytes.appendSafe(
                    abi.encodePacked(
                        '"image":"',
                        baseURI,
                        Strings.toString(_tokenId),
                        '?network=rinkeby",'
                    )
                );
            } else {
                jsonBytes.appendSafe(
                    abi.encodePacked(
                        '"image":"',
                        tokenIdToImage(_tokenId),
                        '",'
                    )
                );
            }

            jsonBytes.appendSafe(
                abi.encodePacked(
                    '"attributes":',
                    tokenIdToMetadata(_tokenId),
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
            return;
        }

        function addChunk(uint _tokenId, uint _chunkIndex, bytes memory _chunk)
            public
            onlyOwner
            whenUnsealed
        {
            _tokens[_tokenId].chunks[_chunkIndex] = SSTORE2.write(_chunk);
            return;
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
            address payable dev = payable(0xEA208Da933C43857683C04BC76e3FD331D7bfdf7);
    
            Address.sendValue(receiver, amount);
            Address.sendValue(dev, balance - amount);
        }
    }
