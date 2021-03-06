import { expect } from "chai";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "@indeliblelabs/keccak256";
import { IndelibleERC721A, IndelibleNoAllowList } from "../typechain";

const formatLayer = (layer: any) =>
  layer.map((trait: any) => {
    const buffer = Buffer.from(trait.data, "base64");
    return {
      name: trait.name,
      mimetype: "image/png",
      data: `0x${buffer.toString("hex")}`,
    };
  });

describe("Indelible with Allow List", function () {
  let contract: IndelibleERC721A;
  let ownerAddress: string;
  let allowListWithOwner: string[] = [];
  let leafNodesWithOwner: Buffer[] = [];
  let merkleTreeWithOwner: MerkleTree;
  let merkleRootWithOwner: Buffer;
  let merkleProofWithOwner: string[];
  let allowListWithoutOwner: string[] = [];
  let leafNodesWithoutOwner: Buffer[] = [];
  let merkleTreeWithoutOwner: MerkleTree;
  let merkleRootWithoutOwner: Buffer;
  let merkleProofWithoutOwner: string[];

  beforeEach(async () => {
    const IndelibleLabContreactTest = await ethers.getContractFactory(
      "IndelibleERC721A"
    );
    contract = await IndelibleLabContreactTest.deploy();
    ownerAddress = await contract.owner();

    // Allow List With Owner
    allowListWithOwner = [
      "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677",
      "0x10ec407c925a95fc2bf145bc671a733d1fba347e",
      ownerAddress,
    ];
    leafNodesWithOwner = allowListWithOwner.map((address) =>
      keccak256(address)
    );
    merkleTreeWithOwner = new MerkleTree(leafNodesWithOwner, keccak256, {
      sortPairs: true,
    });
    merkleRootWithOwner = merkleTreeWithOwner.getRoot();
    merkleProofWithOwner = merkleTreeWithOwner.getHexProof(
      keccak256(ownerAddress)
    );

    // Allow List Without Owner
    allowListWithoutOwner = [
      "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677",
      "0x10ec407c925a95fc2bf145bc671a733d1fba347e",
      ownerAddress,
    ];
    leafNodesWithoutOwner = allowListWithoutOwner.map((address) =>
      keccak256(address)
    );
    merkleTreeWithoutOwner = new MerkleTree(leafNodesWithoutOwner, keccak256, {
      sortPairs: true,
    });
    merkleRootWithoutOwner = merkleTreeWithoutOwner.getRoot();
    merkleProofWithoutOwner = merkleTreeWithoutOwner.getHexProof(
      keccak256(ownerAddress)
    );
  });

  it("Should return isMintActive false", async function () {
    expect(await contract.isMintActive()).to.equal(false);
  });

  it("Should set new baseURI", async function () {
    const newBaseURI = "https://indeliblelabs.io/api/v2/";
    expect(await contract.baseURI()).to.equal("");
    await contract.setBaseURI(newBaseURI);
    expect(await contract.baseURI()).to.equal(newBaseURI);
  });

  it("Should toggle public mint", async function () {
    expect(await contract.isMintActive()).to.equal(false);
    await contract.togglePublicMint();
    expect(await contract.isMintActive()).to.equal(true);
  });

  it("Should toggle allow list mint", async function () {
    expect(await contract.isMintActive()).to.equal(false);
    await contract.toggleAllowListMint();
    expect(await contract.isMintActive()).to.equal(true);
  });

  it("Should revert mint if public sale is not true", async function () {
    expect(contract.mint(1, [])).to.be.revertedWith("Minting is not active");
  });

  it("Should not mint allow list successfully - not on allow list", async function () {
    await contract.setMerkleRoot(merkleRootWithoutOwner);
    await contract.toggleAllowListMint();
    const mintPrice = await contract.allowListPrice();
    expect(
      contract.mint(5, merkleProofWithoutOwner, {
        value: ethers.utils.parseEther(
          `${(parseInt(mintPrice._hex) / 1000000000000000000) * 5}`
        ),
      })
    ).to.be.revertedWith("Not on allow list");
  });

  it("Should not mint allow list successfully - too many mints", async function () {
    await contract.setMerkleRoot(merkleRootWithOwner);
    await contract.toggleAllowListMint();
    const mintPrice = await contract.allowListPrice();
    expect(
      contract.mint(5, merkleProofWithOwner, {
        value: ethers.utils.parseEther(
          `${(parseInt(mintPrice._hex) / 1000000000000000000) * 5}`
        ),
      })
    ).to.be.revertedWith("Exceeded max mints allowed");
  });

  it("Should mint allow list successfully", async function () {
    await contract.setMerkleRoot(merkleRootWithOwner);
    await contract.toggleAllowListMint();
    const mintPrice = await contract.allowListPrice();
    const mintTransaction = await contract.mint(1, merkleProofWithOwner, {
      value: ethers.utils.parseEther(
        `${(parseInt(mintPrice._hex) / 1000000000000000000) * 1}`
      ),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex) + 1);
    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    expect(contract.tokenURI(parseInt(eventArg[2].hex))).to.be.revertedWith(
      "Traits have not been added"
    );
    /**
     * Minting will always generate a randon hash which is the dna of the token.
     * So to test we can be sure it is the length we expect the current case
     * assuming 15 layers 3 digits each 15 * 3 char hash that should always be generated.
     *  */
    expect(recentlyMintedTokenHash.length).to.equal(9 * 3);
  });

  it("Should revert mint if ether price is wrong", async function () {
    await contract.togglePublicMint();
    expect(
      contract.mint(1, [], {
        value: ethers.utils.parseEther("0.02"),
      })
    ).to.be.revertedWith("Incorrect amount of ether sent");
  });

  it("Should mint public successfully", async function () {
    await contract.togglePublicMint();
    const mintPrice = await contract.publicMintPrice();
    const mintTransaction = await contract.mint(5, [], {
      value: ethers.utils.parseEther(
        `${(parseInt(mintPrice._hex) / 1000000000000000000) * 5}`
      ),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex) + 1);
    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    expect(contract.tokenURI(parseInt(eventArg[2].hex))).to.be.revertedWith(
      "Traits have not been added"
    );
    /**
     * Minting will always generate a randon hash which is the dna of the token.
     * So to test we can be sure it is the length we expect the current case
     * assuming 15 layers 3 digits each 15 * 3 char hash that should always be generated.
     *  */
    expect(recentlyMintedTokenHash.length).to.equal(9 * 3);
  });

  it("Should revert add trait when size dont match tier of same index", async function () {
    expect(
      contract.addLayer(0, [
        { name: "example", mimetype: "image/png", data: "test" },
      ])
    ).to.be.revertedWith("Traits size does not much tiers for this index");
  });

  it("Should be able to change contract data", async function () {
    let _contractData = await contract.contractData();
    expect(_contractData.name).to.equal("Example & Fren ??? ????");
    expect(_contractData.description).to.equal('Example\'s ("Description")');
    expect(_contractData.image).to.equal("");
    expect(_contractData.banner).to.equal("");
    expect(_contractData.website).to.equal("https://indeliblelabs.io");
    expect(_contractData.royalties).to.equal(0);
    expect(_contractData.royaltiesRecipient).to.equal("");
    await contract.setContractData({
      name: "OnChainKevin",
      description: "On-chain forever",
      image: "test",
      banner: "banner",
      website: "https://app.indeliblelabs.io",
      royalties: 500,
      royaltiesRecipient: "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677",
    });
    _contractData = await contract.contractData();
    expect(_contractData.name).to.equal("OnChainKevin");
    expect(_contractData.description).to.equal("On-chain forever");
    expect(_contractData.image).to.equal("test");
    expect(_contractData.banner).to.equal("banner");
    expect(_contractData.website).to.equal("https://app.indeliblelabs.io");
    expect(_contractData.royalties).to.equal(500);
    expect(_contractData.royaltiesRecipient).to.equal(
      "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677"
    );
    const contractURIRes = await contract.contractURI();
    const jsonBuffer = Buffer.from(contractURIRes.split(",")[1], "base64");
    const onChainJson = jsonBuffer.toString();
    expect(onChainJson).to.include("name");
    expect(onChainJson).to.include("description");
    expect(onChainJson).to.include("image");
    expect(onChainJson).to.include("banner");
    expect(onChainJson).to.include("external_link");
    expect(onChainJson).to.include("seller_fee_basis_points");
    expect(onChainJson).to.include("fee_recipient");
  });

  it("Should render correct token URI when layer are uploaded", async function () {
    await contract.togglePublicMint();
    await contract.addLayer(0, formatLayer(require("./layers/0-lasers.json")));
    await contract.addLayer(1, formatLayer(require("./layers/1-mouth.json")));
    await contract.addLayer(2, formatLayer(require("./layers/2-head.json")));
    await contract.addLayer(3, formatLayer(require("./layers/3-face.json")));
    await contract.addLayer(4, formatLayer(require("./layers/4-eyes.json")));
    await contract.addLayer(5, formatLayer(require("./layers/5-nose.json")));
    await contract.addLayer(6, formatLayer(require("./layers/6-shirt.json")));
    await contract.addLayer(7, formatLayer(require("./layers/7-skin.json")));
    await contract.addLayer(
      8,
      formatLayer(require("./layers/8-background.json"))
    );
    const mintPrice = await contract.publicMintPrice();
    const mintTransaction = await contract.mint(50, [], {
      value: ethers.utils.parseEther(
        `${(parseInt(mintPrice._hex) / 1000000000000000000) * 50}`
      ),
    });
    const tx = await mintTransaction.wait();
    const events = tx.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));

    // ON Chain token URI response
    const tokenRes = await contract.tokenURI(parseInt(eventArg[2].hex));
    const jsonBuffer = Buffer.from(tokenRes.split(",")[1], "base64");
    const onChainJson = jsonBuffer.toString();

    expect(onChainJson).to.include("name");
    expect(onChainJson).to.include("description");
    expect(onChainJson).to.include("image");
    expect(onChainJson).to.include("attributes");

    // API token URI response
    const newBaseURI = "https://indeliblelabs.io/api/v2/";
    await contract.setBaseURI(newBaseURI);
    await contract.setRenderOfTokenId(parseInt(eventArg[2].hex), true);
    const tokenRes2 = await contract.tokenURI(parseInt(eventArg[2].hex));
    const jsonBuffer2 = Buffer.from(tokenRes2.split(",")[1], "base64");
    const onChainJson2 = jsonBuffer2.toString();

    expect(onChainJson2).to.include("name");
    expect(onChainJson2).to.include("description");
    expect(onChainJson2).to.include("image");
    expect(onChainJson2).to.include("attributes");
    expect(onChainJson2).to.include("dna");

    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    expect(onChainJson2.split("=")[1].split("&")[0]).to.equal(
      recentlyMintedTokenHash
    );
  });
});

describe("Indelible without Allow List", function () {
  let contract: IndelibleNoAllowList;

  beforeEach(async () => {
    const IndelibleLabContreactTest = await ethers.getContractFactory(
      "IndelibleNoAllowList"
    );
    contract = await IndelibleLabContreactTest.deploy();
  });

  it("Should return isMintActive false", async function () {
    expect(await contract.isMintActive()).to.equal(false);
  });

  it("Should set new baseURI", async function () {
    const newBaseURI = "https://indeliblelabs.io/api/v2/";
    expect(await contract.baseURI()).to.equal("");
    await contract.setBaseURI(newBaseURI);
    expect(await contract.baseURI()).to.equal(newBaseURI);
  });

  it("Should toggle public mint", async function () {
    expect(await contract.isMintActive()).to.equal(false);
    await contract.togglePublicMint();
    expect(await contract.isMintActive()).to.equal(true);
    await contract.togglePublicMint();
  });

  it("Should revert mint if public sale is not true", async function () {
    expect(contract.mint(1)).to.be.revertedWith("Minting is not active");
  });

  it("Should revert mint if ether price is wrong", async function () {
    await contract.togglePublicMint();
    expect(
      contract.mint(1, {
        value: ethers.utils.parseEther("0.02"),
      })
    ).to.be.revertedWith("Incorrect amount of ether sent");
  });

  it("Should mint successfully", async function () {
    await contract.togglePublicMint();
    const mintPrice = await contract.publicMintPrice();
    const mintTransaction = await contract.mint(5, {
      value: ethers.utils.parseEther(
        `${(parseInt(mintPrice._hex) / 1000000000000000000) * 5}`
      ),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex) + 1);
    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    expect(contract.tokenURI(parseInt(eventArg[2].hex))).to.be.revertedWith(
      "Traits have not been added"
    );
    /**
     * Minting will always generate a randon hash which is the dna of the token.
     * So to test we can be sure it is the length we expect the current case
     * assuming 15 layers 3 digits each 15 * 3 char hash that should always be generated.
     *  */
    expect(recentlyMintedTokenHash.length).to.equal(9 * 3);
  });

  it("Should revert add trait when size dont match tier of same index", async function () {
    expect(
      contract.addLayer(0, [
        { name: "example", mimetype: "image/png", data: "test" },
      ])
    ).to.be.revertedWith("Traits size does not much tiers for this index");
  });

  it("Should be able to change contract data", async function () {
    let _contractData = await contract.contractData();
    expect(_contractData.name).to.equal("Example & Fren ??? ????");
    expect(_contractData.description).to.equal('Example\'s ("Description")');
    expect(_contractData.image).to.equal("");
    expect(_contractData.banner).to.equal("");
    expect(_contractData.website).to.equal("https://indeliblelabs.io");
    expect(_contractData.royalties).to.equal(0);
    expect(_contractData.royaltiesRecipient).to.equal("");
    await contract.setContractData({
      name: "OnChainKevin",
      description: "On-chain forever",
      image: "test",
      banner: "banner",
      website: "https://app.indeliblelabs.io",
      royalties: 500,
      royaltiesRecipient: "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677",
    });
    _contractData = await contract.contractData();
    expect(_contractData.name).to.equal("OnChainKevin");
    expect(_contractData.description).to.equal("On-chain forever");
    expect(_contractData.image).to.equal("test");
    expect(_contractData.banner).to.equal("banner");
    expect(_contractData.website).to.equal("https://app.indeliblelabs.io");
    expect(_contractData.royalties).to.equal(500);
    expect(_contractData.royaltiesRecipient).to.equal(
      "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677"
    );
    const contractURIRes = await contract.contractURI();
    const jsonBuffer = Buffer.from(contractURIRes.split(",")[1], "base64");
    const onChainJson = jsonBuffer.toString();
    expect(onChainJson).to.include("name");
    expect(onChainJson).to.include("description");
    expect(onChainJson).to.include("image");
    expect(onChainJson).to.include("banner");
    expect(onChainJson).to.include("external_link");
    expect(onChainJson).to.include("seller_fee_basis_points");
    expect(onChainJson).to.include("fee_recipient");
  });

  it("Should render correct token URI when layer are uploaded", async function () {
    await contract.togglePublicMint();
    await contract.addLayer(0, formatLayer(require("./layers/0-lasers.json")));
    await contract.addLayer(1, formatLayer(require("./layers/1-mouth.json")));
    await contract.addLayer(2, formatLayer(require("./layers/2-head.json")));
    await contract.addLayer(3, formatLayer(require("./layers/3-face.json")));
    await contract.addLayer(4, formatLayer(require("./layers/4-eyes.json")));
    await contract.addLayer(5, formatLayer(require("./layers/5-nose.json")));
    await contract.addLayer(6, formatLayer(require("./layers/6-shirt.json")));
    await contract.addLayer(7, formatLayer(require("./layers/7-skin.json")));
    await contract.addLayer(
      8,
      formatLayer(require("./layers/8-background.json"))
    );
    const mintPrice = await contract.publicMintPrice();
    const mintTransaction = await contract.mint(50, {
      value: ethers.utils.parseEther(
        `${(parseInt(mintPrice._hex) / 1000000000000000000) * 50}`
      ),
    });
    const tx = await mintTransaction.wait();
    const events = tx.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));

    // ON Chain token URI response
    const tokenRes = await contract.tokenURI(parseInt(eventArg[2].hex));
    const jsonBuffer = Buffer.from(tokenRes.split(",")[1], "base64");
    const onChainJson = jsonBuffer.toString();

    expect(onChainJson).to.include("name");
    expect(onChainJson).to.include("description");
    expect(onChainJson).to.include("image");
    expect(onChainJson).to.include("attributes");

    // API token URI response
    const newBaseURI = "https://indeliblelabs.io/api/v2/";
    await contract.setBaseURI(newBaseURI);
    await contract.setRenderOfTokenId(parseInt(eventArg[2].hex), true);
    const tokenRes2 = await contract.tokenURI(parseInt(eventArg[2].hex));
    const jsonBuffer2 = Buffer.from(tokenRes2.split(",")[1], "base64");
    const onChainJson2 = jsonBuffer2.toString();

    expect(onChainJson2).to.include("name");
    expect(onChainJson2).to.include("description");
    expect(onChainJson2).to.include("image");
    expect(onChainJson2).to.include("attributes");
    expect(onChainJson2).to.include("dna");

    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    expect(onChainJson2.split("=")[1].split("&")[0]).to.equal(
      recentlyMintedTokenHash
    );
  });
});
