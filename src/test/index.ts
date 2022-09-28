import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "@indeliblelabs/keccak256";
import {
  IndelibleAllowList,
  IndelibleNoAllowList,
  IndelibleOneOfOne,
  TestMinterContract,
} from "../typechain";
import { token1 } from "./images/1";
import { chunk } from "lodash";
import { TEST_ADDRESS_1 } from "scripts/build-contracts";
import { utils } from "ethers";

const formatLayer = (layer: any) =>
  layer.map((trait: any) => {
    const buffer = Buffer.from(trait.data, "base64");
    return {
      name: trait.name,
      mimetype: "image/png",
      data: `0x${buffer.toString("hex")}`,
      useExistingData: false,
      existingDataIndex: 0,
    };
  });

describe("Indelible with Allow List", function () {
  let contract: IndelibleAllowList;
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
      "IndelibleAllowList"
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
    const mintPrice = 0.15;
    await contract.setAllowListPrice(ethers.utils.parseEther(`${mintPrice}`));
    const mintTransaction = await contract.mint(1, merkleProofWithOwner, {
      value: ethers.utils.parseEther(`${mintPrice}`),
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

  it("Should withdraw correctly", async function () {
    // const balanceInWei1 = await provider.getBalance(TEST_ADDRESS_1);
    await contract.setMerkleRoot(merkleRootWithOwner);
    await contract.toggleAllowListMint();
    const mintPrice = 0.15;
    const ownerBalance1 = await contract.provider.getBalance(ownerAddress);
    const initialOwnerBalance = ethers.utils.formatEther(ownerBalance1);
    await contract.setAllowListPrice(ethers.utils.parseEther(`${mintPrice}`));
    const mintTransaction = await contract.mint(1, merkleProofWithOwner, {
      value: ethers.utils.parseEther(`${mintPrice}`),
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
    // test 1 address has withdraw percentage of 40%
    const testAddress1 = utils.getAddress(
      `0x10ec407c925a95fc2bf145bc671a733d1fba347e`
    );
    // test 1 address has withdraw percentage of 20%
    const testAddress2 = utils.getAddress(
      `0x2052051A0474fB0B98283b3F38C13b0B0B6a3677`
    );
    const firstBalanceTest1 = await contract.provider.getBalance(testAddress1);
    const firstBalanceTest2 = await contract.provider.getBalance(testAddress2);
    expect(ethers.utils.formatEther(firstBalanceTest1)).to.equal("0.0");
    expect(ethers.utils.formatEther(firstBalanceTest2)).to.equal("0.0");

    const withdraw = await contract.withdraw();
    const txn2 = await withdraw.wait();
    const totalInWalletMinusDev = mintPrice * 0.975;
    const devWalletAddress = utils.getAddress(
      `0xEA208Da933C43857683C04BC76e3FD331D7bfdf7`
    );
    const devWalletBalance = await contract.provider.getBalance(
      devWalletAddress
    );
    const ownerBalance2 = await contract.provider.getBalance(ownerAddress);
    const secondBalanceTest1 = await contract.provider.getBalance(testAddress1);
    const secondBalanceTest2 = await contract.provider.getBalance(testAddress2);
    const contractBalance = await contract.provider.getBalance(
      contract.address
    );

    expect(ethers.utils.formatEther(contractBalance)).to.equal(`0.0`);
    expect(ethers.utils.formatEther(devWalletBalance)).to.equal(
      `${(mintPrice * 0.025).toFixed(5)}`
    );
    expect(ethers.utils.formatEther(secondBalanceTest1)).to.equal(
      `${(totalInWalletMinusDev * 0.4).toFixed(4)}`
    );
    expect(ethers.utils.formatEther(secondBalanceTest2)).to.equal(
      `${(totalInWalletMinusDev * 0.2).toFixed(5)}`
    );
  });

  it("Should mint successfully with receive()", async function () {
    await contract.togglePublicMint();

    const [owner] = await ethers.getSigners();
    const transactionHash = await owner.sendTransaction({
      to: contract.address,
      value: ethers.utils.parseEther("0.01"), // mint price is 0.005 so should mint 2
    });

    const txn = await transactionHash.wait();
    // 0.01 at 0.005 mint price is 2 tokens
    expect(txn.logs.length).to.equal(2);
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
        {
          name: "example",
          mimetype: "image/png",
          data: "test",
          useExistingData: false,
          existingDataIndex: 0,
        },
      ])
    ).to.be.revertedWith("Traits size does not much tiers for this index");
  });

  it("Should be able to change contract data", async function () {
    let _contractData = await contract.contractData();
    expect(_contractData.name).to.equal("Example & Fren ” 😃");
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

    // Change traits with Trait Linking
    await contract.setLinkedTraits([
      { traitA: [7, 0], traitB: [0, 0] },
      { traitA: [7, 1], traitB: [0, 0] },
      { traitA: [7, 2], traitB: [0, 0] },
    ]);
    const recentlyMintedTokenHashA = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    expect(recentlyMintedTokenHashA[2]).to.equal("0");
    await contract.setLinkedTraits([
      { traitA: [7, 0], traitB: [0, 1] },
      { traitA: [7, 1], traitB: [0, 1] },
      { traitA: [7, 2], traitB: [0, 1] },
    ]);
    const recentlyMintedTokenHashB = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    expect(recentlyMintedTokenHashB[2]).to.equal("1");

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

  it("Should mint successfully with receive()", async function () {
    await contract.togglePublicMint();

    const [owner] = await ethers.getSigners();
    const transactionHash = await owner.sendTransaction({
      to: contract.address,
      value: ethers.utils.parseEther("0.01"), // mint price is 0.005 so should mint 2
    });

    const txn = await transactionHash.wait();
    // 0.01 at 0.005 mint price is 2 tokens
    expect(txn.logs.length).to.equal(2);
  });

  it("Should not mint successfully from another contract", async function () {
    const TestMinterContract = await ethers.getContractFactory(
      "TestMinterContract"
    );
    const minterContract: TestMinterContract =
      await TestMinterContract.deploy();

    await contract.togglePublicMint();
    const mintPrice = await contract.publicMintPrice();
    const collectionContractAddress = await contract.address;

    expect(
      minterContract.executeExternalContractMint(collectionContractAddress, {
        value: ethers.utils.parseEther(
          `${parseInt(mintPrice._hex) / 1000000000000000000}`
        ),
      })
    ).to.be.revertedWith("EOAs only");
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

  it("Should withdraw correctly", async function () {
    // const balanceInWei1 = await provider.getBalance(TEST_ADDRESS_1);
    await contract.togglePublicMint();
    const mintPrice = await contract.publicMintPrice();
    const mintTransaction = await contract.mint(5, {
      value: ethers.utils.parseEther(
        `${(parseInt(mintPrice._hex) / 1000000000000000000) * 5}`
      ),
    });
    const totalInWallet = 0.005 * 5;

    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex) + 1);

    const currentContractBalance = await contract.provider.getBalance(
      contract.address
    );

    // test 1 address has withdraw percentage of 40%
    const testAddress1 = utils.getAddress(
      `0x10ec407c925a95fc2bf145bc671a733d1fba347e`
    );
    // test 1 address has withdraw percentage of 20%
    const testAddress2 = utils.getAddress(
      `0x2052051A0474fB0B98283b3F38C13b0B0B6a3677`
    );
    const firstBalanceTest1 = await contract.provider.getBalance(testAddress1);
    const firstBalanceTest2 = await contract.provider.getBalance(testAddress2);
    // from prev test
    expect(ethers.utils.formatEther(firstBalanceTest1)).to.equal("0.0585");
    // from prev test
    expect(ethers.utils.formatEther(firstBalanceTest2)).to.equal("0.02925");
    const devWalletAddress = utils.getAddress(
      `0xEA208Da933C43857683C04BC76e3FD331D7bfdf7`
    );
    const prevDevWalletBalance = await contract.provider.getBalance(
      devWalletAddress
    );
    const withdraw = await contract.withdraw();
    const txn2 = await withdraw.wait();
    const totalInWalletMinusDev = totalInWallet * 0.975;
    const devWalletBalance = await contract.provider.getBalance(
      devWalletAddress
    );
    const owner = await contract.owner();
    const ownerBalance2 = await contract.provider.getBalance(owner);
    const secondBalanceTest1 = await contract.provider.getBalance(testAddress1);
    const secondBalanceTest2 = await contract.provider.getBalance(testAddress2);
    const contractBalance = await contract.provider.getBalance(
      contract.address
    );
    expect(ethers.utils.formatEther(contractBalance)).to.equal(`0.0`);
    expect(ethers.utils.formatEther(devWalletBalance)).to.equal(
      `${
        Number(totalInWallet * 0.025) +
        Number(ethers.utils.formatEther(prevDevWalletBalance))
      }`
    );
    expect(ethers.utils.formatEther(secondBalanceTest1)).to.equal(
      `${totalInWalletMinusDev * 0.4 + 0.0585}`
    );
    expect(ethers.utils.formatEther(secondBalanceTest2)).to.equal(
      `${totalInWalletMinusDev * 0.2 + 0.02925}`
    );
  });

  it("Should revert add trait when size dont match tier of same index", async function () {
    expect(
      contract.addLayer(0, [
        {
          name: "example",
          mimetype: "image/png",
          data: "test",
          useExistingData: false,
          existingDataIndex: 0,
        },
      ])
    ).to.be.revertedWith("Traits size does not much tiers for this index");
  });

  it("Should be able to change contract data", async function () {
    let _contractData = await contract.contractData();
    expect(_contractData.name).to.equal("Example & Fren ” 😃");
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

describe("Indelible 1/1", function () {
  let contract: IndelibleOneOfOne;

  beforeEach(async () => {
    const IndelibleLabContreactTest = await ethers.getContractFactory(
      "IndelibleOneOfOne"
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
    const mintTransaction = await contract.mint(1, {
      value: ethers.utils.parseEther(
        `${parseInt(mintPrice._hex) / 1000000000000000000}`
      ),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex));
  });

  it("Should revert add trait when size dont match tier of same index", async function () {
    expect(contract.addToken(1, 2, [["Test", "Pass"]])).to.be.revertedWith(
      "Traits size does not much tiers for this index"
    );
  });

  it("Should be able to change contract data", async function () {
    let _contractData = await contract.contractData();
    expect(_contractData.name).to.equal("Example & Fren ” 😃");
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
    const chunks = chunk(Buffer.from(token1, "ascii"), 14380);
    await contract.addToken(0, chunks.length, [["Test", "Pass"]]);
    for (let i = 0; i < chunks.length; i += 1) {
      await contract.addChunk(0, i, chunks[i]);
    }
    const mintPrice = await contract.publicMintPrice();
    const mintTransaction = await contract.mint(0, {
      value: ethers.utils.parseEther(
        `${parseInt(mintPrice._hex) / 1000000000000000000}`
      ),
    });
    const tx = await mintTransaction.wait();
    const events = tx.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));

    // // ON Chain token URI response
    // const tokenRes = await contract.tokenURI(parseInt(eventArg[2].hex));
    // const jsonBuffer = Buffer.from(tokenRes.split(",")[1], "base64");
    // const onChainJson = jsonBuffer.toString();

    // expect(onChainJson).to.include("name");
    // expect(onChainJson).to.include("description");
    // expect(onChainJson).to.include("image");
    // expect(onChainJson).to.include("attributes");

    // // API token URI response
    // const newBaseURI = "https://indeliblelabs.io/api/v2/";
    // await contract.setBaseURI(newBaseURI);
    // await contract.setRenderOfTokenId(parseInt(eventArg[2].hex), true);
    // const tokenRes2 = await contract.tokenURI(parseInt(eventArg[2].hex));
    // const jsonBuffer2 = Buffer.from(tokenRes2.split(",")[1], "base64");
    // const onChainJson2 = jsonBuffer2.toString();

    // expect(onChainJson2).to.include("name");
    // expect(onChainJson2).to.include("description");
    // expect(onChainJson2).to.include("image");
    // expect(onChainJson2).to.include("attributes");
    // expect(onChainJson2).to.include("dna");
    // const token = await contract.getToken(parseInt(eventArg[2].hex));
    // console.log(token);
    // const image = await contract.tokenIdToImage(parseInt(eventArg[2].hex));
    // console.log(image);
  });
});
