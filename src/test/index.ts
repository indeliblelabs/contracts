import { expect } from "chai";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "@indeliblelabs/keccak256";
import { chunk } from "lodash";
import { BigNumber, utils, Wallet } from "ethers";
import { generativeConfig } from "../scripts/build-contracts";
import { drop } from "./images/drop";
import {
  IndelibleFactory,
  IndelibleGenerative,
  TestMinterContract,
} from "../typechain";

const formatLayer = (layer: any[], maxSupply: number) => {
  const numOfTraits = layer?.length || 0;
  let rarities: number[] = [];
  let sum = 0;
  for (let i = 0; i < numOfTraits; i += 1) {
    let max = Math.ceil(maxSupply / (numOfTraits - i));
    if (max + sum > maxSupply) {
      max = Math.ceil(max / numOfTraits);
    }
    let randomNumber = Math.floor(Math.random() * max) + 1;
    if (i === numOfTraits - 1) {
      randomNumber = maxSupply - sum;
    }
    rarities.push(randomNumber);
    sum += randomNumber;
  }
  rarities = rarities.sort((a, b) => b - a);
  return layer.map((trait: any, i: number) => {
    const buffer = Buffer.from(trait.data, "base64");
    return {
      name: trait.name,
      mimetype: "image/png",
      occurrence: rarities[i],
      data: `0x${buffer.toString("hex")}`,
      hide: trait.hide || false,
      useExistingData: false,
      existingDataIndex: 0,
    };
  });
};

describe("Indelible Generative", function () {
  let factoryContract: IndelibleFactory;
  let contract: IndelibleGenerative;
  let allowListWithUsers: string[] = [];
  let leafNodesWithUsers: Buffer[] = [];
  let merkleTreeWithUsers: MerkleTree;
  let merkleRootWithUsers: Buffer;
  let allowListWithoutUsers: string[] = [];
  let leafNodesWithoutUsers: Buffer[] = [];
  let merkleTreeWithoutUsers: MerkleTree;
  let merkleRootWithoutUsers: Buffer;

  beforeEach(async () => {
    const [owner, user, userWithMax] = await ethers.getSigners();

    const IndelibleFactory = await ethers.getContractFactory(
      "IndelibleFactory"
    );
    factoryContract = await IndelibleFactory.deploy();

    const IndelibleGenerative = await ethers.getContractFactory(
      "IndelibleGenerative"
    );
    const indelibleGenerative = await IndelibleGenerative.deploy();

    const updateImplementationTxn =
      await factoryContract.updateGenerativeImplementation(
        indelibleGenerative.address
      );
    await updateImplementationTxn.wait();

    const deployGenerativeContractTxn =
      await factoryContract.deployGenerativeContract(
        generativeConfig.name,
        generativeConfig.tokenSymbol,
        {
          maxSupply: generativeConfig.maxSupply,
          maxPerAddress: generativeConfig.maxPerAddress,
          publicMintPrice: ethers.utils.parseEther(generativeConfig.mintPrice),
          allowListPrice: ethers.utils.parseEther(
            generativeConfig.allowList.price
          ),
          maxPerAllowList: generativeConfig.allowList.maxPerAllowList,
          merkleRoot:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          tier2MerkleRoot:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          isPublicMintActive: false,
          isAllowListActive: false,
          isContractSealed: false,
          description: generativeConfig.description,
          placeholderImage: generativeConfig.placeholderImage,
          backgroundColor: "transparent",
        },
        {
          royaltyAddress: owner.address,
          royaltyAmount: generativeConfig.royalties,
        },
        generativeConfig.withdrawRecipients,
        "0x29FbB84b835F892EBa2D331Af9278b74C595EDf1",
        "0x29FbB84b835F892EBa2D331Af9278b74C595EDf1",
        ethers.utils.parseEther("0.000777"),
        false
      );

    const deployedGenerativeContract = await deployGenerativeContractTxn.wait();
    const contractAddress = deployedGenerativeContract.events?.find(
      (e) => e.event === "ContractCreated"
    )?.args?.contractAddress;
    contract = IndelibleGenerative.attach(contractAddress);

    // Upload art
    await contract.addLayer(
      0,
      "layer 1",
      generativeConfig.primeNumbers[0],
      formatLayer(
        require("./layers/0-lasers.json"),
        generativeConfig.maxSupply
      ),
      9
    );
    await contract.addLayer(
      1,
      "layer 2",
      generativeConfig.primeNumbers[1],
      formatLayer(require("./layers/1-mouth.json"), generativeConfig.maxSupply),
      9
    );
    await contract.addLayer(
      2,
      "layer 3",
      generativeConfig.primeNumbers[2],
      formatLayer(require("./layers/2-head.json"), generativeConfig.maxSupply),
      9
    );
    await contract.addLayer(
      3,
      "layer 4",
      generativeConfig.primeNumbers[3],
      formatLayer(require("./layers/3-face.json"), generativeConfig.maxSupply),
      9
    );
    await contract.addLayer(
      4,
      "layer 5",
      generativeConfig.primeNumbers[4],
      formatLayer(require("./layers/4-eyes.json"), generativeConfig.maxSupply),
      9
    );
    await contract.addLayer(
      5,
      "layer 6",
      generativeConfig.primeNumbers[5],
      formatLayer(require("./layers/5-nose.json"), generativeConfig.maxSupply),
      9
    );
    await contract.addLayer(
      6,
      "layer 7",
      generativeConfig.primeNumbers[6],
      formatLayer(require("./layers/6-shirt.json"), generativeConfig.maxSupply),
      9
    );
    await contract.addLayer(
      7,
      "layer 8",
      generativeConfig.primeNumbers[7],
      formatLayer(require("./layers/7-skin.json"), generativeConfig.maxSupply),
      9
    );
    await contract.addLayer(
      8,
      "layer 9",
      generativeConfig.primeNumbers[8],
      formatLayer(
        require("./layers/8-background.json"),
        generativeConfig.maxSupply
      ),
      9
    );

    // Allow List With Owner
    allowListWithUsers = [
      "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677",
      "0x10ec407c925a95fc2bf145bc671a733d1fba347e",
      user.address,
      `${userWithMax.address}:2`,
    ];
    leafNodesWithUsers = allowListWithUsers.map((address) => {
      if (address.includes(":")) {
        return keccak256(
          utils.solidityPack(["address", "uint256"], address.split(":"))
        );
      }
      return keccak256(address);
    });
    merkleTreeWithUsers = new MerkleTree(leafNodesWithUsers, keccak256, {
      sortPairs: true,
    });
    merkleRootWithUsers = merkleTreeWithUsers.getRoot();

    // Allow List Without User Wallet
    allowListWithoutUsers = [
      "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677",
      "0x10ec407c925a95fc2bf145bc671a733d1fba347e",
    ];

    leafNodesWithoutUsers = allowListWithoutUsers.map((address) =>
      keccak256(address)
    );
    merkleTreeWithoutUsers = new MerkleTree(leafNodesWithoutUsers, keccak256, {
      sortPairs: true,
    });
    merkleRootWithoutUsers = merkleTreeWithoutUsers.getRoot();
  });

  it("Should set new baseURI", async function () {
    const newBaseURI = "https://indelible.xyz/api/v2/";
    expect(await contract.baseURI()).to.equal("");
    await contract.setBaseURI(newBaseURI);
    expect(await contract.baseURI()).to.equal(newBaseURI);
  });

  it("Should toggle public mint", async function () {
    expect((await contract.baseSettings()).isPublicMintActive).to.equal(false);
    await contract.togglePublicMint();
    expect((await contract.baseSettings()).isPublicMintActive).to.equal(true);
  });

  it("Should toggle allow list mint", async function () {
    expect((await contract.baseSettings()).isAllowListActive).to.equal(false);
    await contract.toggleAllowListMint();
    expect((await contract.baseSettings()).isAllowListActive).to.equal(true);
  });

  it("Should revert mint if public sale is not true", async function () {
    const [, user] = await ethers.getSigners();
    await expect(contract.connect(user).mint(1, 0, [])).to.be.revertedWith(
      "NotAvailable()"
    );
  });

  it("Should not revert mint if public sale is not true for owner", async function () {
    const [owner] = await ethers.getSigners();
    await expect(contract.connect(owner).mint(1, 0, [])).to.not.revertedWith(
      "NotAvailable()"
    );
  });

  it("Should be able to airdrop", async function () {
    await contract.airdrop(1, ["0x2052051A0474fB0B98283b3F38C13b0B0B6a3677"]);
    expect(
      await contract.balanceOf("0x2052051A0474fB0B98283b3F38C13b0B0B6a3677")
    ).to.equal(1);
  });

  it("Should not mint allow list successfully - not on allow list", async function () {
    const [, user] = await ethers.getSigners();
    await contract.setMerkleRoot(merkleRootWithoutUsers);
    await contract.toggleAllowListMint();
    const mintPrice = (await contract.baseSettings()).allowListPrice;
    const merkleProof = merkleTreeWithoutUsers.getHexProof(
      keccak256(user.address)
    );
    await expect(
      contract.connect(user).mint(1, 0, merkleProof, {
        value: ethers.utils.parseEther(
          `${parseInt(mintPrice._hex) / 1000000000000000000 + 0.000777}`
        ),
      })
    ).to.be.revertedWith("InvalidInput()");
  });

  it("Should not mint allow list successfully - too many mints", async function () {
    await contract.setMerkleRoot(merkleRootWithUsers);
    await contract.toggleAllowListMint();
    await contract.setMaxPerAllowList(1);
    const mintPrice = (await contract.baseSettings()).allowListPrice;
    const [, user] = await ethers.getSigners();
    const merkleProof = merkleTreeWithUsers.getHexProof(
      keccak256(user.address)
    );
    await expect(
      contract.connect(user).mint(5, 0, merkleProof, {
        value: ethers.utils.parseEther(
          `${(parseInt(mintPrice._hex) / 1000000000000000000 + 0.000777) * 5}`
        ),
      })
    ).to.be.revertedWith("InvalidInput()");
  });

  it("Should revert if collector fee is not included for non pro with allow list", async function () {
    await contract.setMerkleRoot(merkleRootWithUsers);
    await contract.toggleAllowListMint();
    await contract.setMaxPerAllowList(5);
    const mintPrice = (await contract.baseSettings()).allowListPrice;
    const [, user] = await ethers.getSigners();
    const merkleProof = merkleTreeWithUsers.getHexProof(
      keccak256(user.address)
    );
    await expect(
      contract.connect(user).mint(1, 0, merkleProof, {
        value: ethers.utils.parseEther(
          `${parseInt(mintPrice._hex) / 1000000000000000000}`
        ),
      })
    ).to.be.revertedWith("");
  });

  it("Should mint including collector fee with allow list successfully", async function () {
    await contract.setMerkleRoot(merkleRootWithUsers);
    await contract.toggleAllowListMint();

    const mintPrice = 0.15;
    await contract.setAllowListPrice(ethers.utils.parseEther(`${mintPrice}`));
    const [, user] = await ethers.getSigners();
    const connectedContract = contract.connect(user);
    const merkleProof = merkleTreeWithUsers.getHexProof(
      keccak256(user.address)
    );
    const mintTransaction = await connectedContract.mint(1, 0, merkleProof, {
      value: ethers.utils.parseEther(`${mintPrice + 0.000777}`),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex) + 1);

    await contract.setRevealSeed();

    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const collectorRecipientBalance = await contract.provider.getBalance(
      collectorRecipient
    );
    expect(ethers.utils.formatEther(collectorRecipientBalance)).to.equal(
      "0.000777"
    );
    /**
     * Minting will always generate a randon hash which is the dna of the token.
     * So to test we can be sure it is the length we expect the current case
     * assuming 15 layers 3 digits each 15 * 3 char hash that should always be generated.
     *  */
    expect(recentlyMintedTokenHash.length).to.equal(
      generativeConfig.layers.length * 3
    );
  });

  it("Should max mint with allow list successfully", async function () {
    await contract.setMerkleRoot(merkleRootWithUsers);
    await contract.toggleAllowListMint();

    const mintPrice = 0.15;
    await contract.setAllowListPrice(ethers.utils.parseEther(`${mintPrice}`));
    const [, , userWithMax] = await ethers.getSigners();
    const connectedContract = contract.connect(userWithMax);
    const merkleProof = merkleTreeWithUsers.getHexProof(
      keccak256(
        utils.solidityPack(["address", "uint256"], [userWithMax.address, 2])
      )
    );
    const mintTransaction = await connectedContract.mint(2, 2, merkleProof, {
      value: ethers.utils.parseEther(`${(mintPrice + 0.000777) * 2}`),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex) + 1);

    await contract.setRevealSeed();

    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const collectorRecipientBalance = await contract.provider.getBalance(
      collectorRecipient
    );
    expect(ethers.utils.formatEther(collectorRecipientBalance)).to.equal(
      "0.002331"
    );
    /**
     * Minting will always generate a randon hash which is the dna of the token.
     * So to test we can be sure it is the length we expect the current case
     * assuming 15 layers 3 digits each 15 * 3 char hash that should always be generated.
     *  */
    expect(recentlyMintedTokenHash.length).to.equal(
      generativeConfig.layers.length * 3
    );
  });

  it("Should mint allow list successfully", async function () {
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const collectorRecipientBalance = await contract.provider.getBalance(
      collectorRecipient
    );
    expect(ethers.utils.formatEther(collectorRecipientBalance)).to.equal(
      "0.002331"
    ); // Since it is same context we still have the balance from previous test.
    await contract.setMerkleRoot(merkleRootWithUsers);
    await contract.toggleAllowListMint();
    const mintPrice = 0.15;
    await contract.setAllowListPrice(ethers.utils.parseEther(`${mintPrice}`));
    const [, user] = await ethers.getSigners();
    const merkleProof = merkleTreeWithUsers.getHexProof(
      keccak256(user.address)
    );
    const mintTransaction = await contract.mint(1, 0, merkleProof, {
      value: ethers.utils.parseEther(`${mintPrice}`),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex) + 1);
    expect(ethers.utils.formatEther(collectorRecipientBalance)).to.equal(
      "0.002331"
    ); // did not increase after mint with owner pro holder.
    await contract.setRevealSeed();

    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    /**
     * Minting will always generate a randon hash which is the dna of the token.
     * So to test we can be sure it is the length we expect the current case
     * assuming 15 layers 3 digits each 15 * 3 char hash that should always be generated.
     *  */
    expect(recentlyMintedTokenHash.length).to.equal(
      generativeConfig.layers.length * 3
    );
  });

  it("Should withdraw correctly", async function () {
    // const balanceInWei1 = await provider.getBalance(TEST_ADDRESS_1);
    await contract.setMerkleRoot(merkleRootWithUsers);
    await contract.toggleAllowListMint();
    const mintPrice = 0.15;
    await contract.setAllowListPrice(ethers.utils.parseEther(`${mintPrice}`));
    const [, user] = await ethers.getSigners();
    const merkleProof = merkleTreeWithUsers.getHexProof(
      keccak256(user.address)
    );
    const mintTransaction = await contract.mint(1, 0, merkleProof, {
      value: ethers.utils.parseEther(`${mintPrice}`),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex) + 1);

    await contract.setRevealSeed();
    // test 1 address has withdraw percentage of 40%
    const testAddress1 = utils.getAddress(
      `0x10ec407c925a95fc2bf145bc671a733d1fba347e`
    );
    // test 1 address has withdraw percentage of 20%
    const testAddress2 = utils.getAddress(
      `0x2052051A0474fB0B98283b3F38C13b0B0B6a3677`
    );
    const devWalletAddress = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const initDevBalance = await contract.provider.getBalance(devWalletAddress);
    const firstBalanceTest1 = await contract.provider.getBalance(testAddress1);
    const firstBalanceTest2 = await contract.provider.getBalance(testAddress2);

    expect(ethers.utils.formatEther(firstBalanceTest1)).to.equal("0.0");
    expect(ethers.utils.formatEther(firstBalanceTest2)).to.equal("0.0");

    const withdraw = await contract.withdraw();
    const txn2 = await withdraw.wait();
    const devWalletBalance = await contract.provider.getBalance(
      devWalletAddress
    );
    const secondBalanceTest1 = await contract.provider.getBalance(testAddress1);
    const secondBalanceTest2 = await contract.provider.getBalance(testAddress2);
    const contractBalance = await contract.provider.getBalance(
      contract.address
    );

    expect(ethers.utils.formatEther(contractBalance)).to.equal(`0.0`);
    expect(ethers.utils.formatEther(devWalletBalance)).to.equal(
      ethers.utils.formatEther(initDevBalance)
    );
    expect(ethers.utils.formatEther(secondBalanceTest1)).to.equal(
      `${(mintPrice * 0.4).toFixed(2)}`
    );
    expect(ethers.utils.formatEther(secondBalanceTest2)).to.equal(
      `${(mintPrice * 0.2).toFixed(2)}`
    );
  });

  it("Should not mint successfully from another contract", async function () {
    const TestMinterContract = await ethers.getContractFactory(
      "TestMinterContract"
    );
    const minterContract: TestMinterContract =
      await TestMinterContract.deploy();

    await contract.togglePublicMint();
    const collectionContractAddress = contract.address;

    await expect(
      minterContract.executeExternalContractMint(collectionContractAddress, {
        value: ethers.utils.parseEther(`${0.005 + 0.000777}`),
      })
    ).to.be.revertedWith("NotAuthorized()");
  });

  it("Should revert mint if ether price is wrong", async function () {
    await contract.togglePublicMint();
    const [, user] = await ethers.getSigners();
    await expect(
      contract.connect(user).mint(1, 0, [], {
        value: ethers.utils.parseEther("0.02"),
      })
    ).to.be.revertedWith("");
  });

  it("Should mint public successfully", async function () {
    await contract.togglePublicMint();
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const prevCollectorRecipientBalance = await contract.provider.getBalance(
      collectorRecipient
    );
    const prevStringBalance = ethers.utils.formatEther(
      prevCollectorRecipientBalance
    );
    const mintPrice = (await contract.baseSettings()).publicMintPrice;
    const mintTransaction = await contract.mint(5, 0, [], {
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

    await contract.setRevealSeed();

    const collectorRecipientBalance = await contract.provider.getBalance(
      collectorRecipient
    );
    const stringBalance = ethers.utils.formatEther(collectorRecipientBalance);

    expect(stringBalance).to.equal(`${prevStringBalance}`); // should not change after mint

    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    /**
     * Minting will always generate a randon hash which is the dna of the token.
     * So to test we can be sure it is the length we expect the current case
     * assuming 15 layers 3 digits each 15 * 3 char hash that should always be generated.
     *  */
    expect(recentlyMintedTokenHash.length).to.equal(
      generativeConfig.layers.length * 3
    );
  });

  it("Should mint public from non pro with collector fee successfully", async function () {
    await contract.togglePublicMint();
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const prevCollectorRecipientBalance = await contract.provider.getBalance(
      collectorRecipient
    );
    const prevStringBalance = ethers.utils.formatEther(
      prevCollectorRecipientBalance
    );
    const mintPrice = (await contract.baseSettings()).publicMintPrice;
    const collectorFee = await contract.collectorFee();
    let publicWallet = ethers.Wallet.createRandom();
    publicWallet = new ethers.Wallet(publicWallet.privateKey, ethers.provider);
    const tx = await contract.signer.sendTransaction({
      to: publicWallet.address,
      value: utils.parseEther("0.4"),
    });
    await tx.wait();
    const publicWalletConnectedContract = await contract.connect(publicWallet);

    const mintTransaction = await publicWalletConnectedContract.mint(5, 0, [], {
      value: ethers.utils.parseEther(
        `${
          (parseInt(mintPrice._hex) / 1000000000000000000) * 5 +
          (parseInt(collectorFee._hex) / 1000000000000000000) * 5
        }`
      ),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await contract.totalSupply();
    expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex) + 1);

    await contract.setRevealSeed();

    const collectorRecipientBalance = await contract.provider.getBalance(
      collectorRecipient
    );
    const stringBalance = ethers.utils.formatEther(collectorRecipientBalance);

    expect(stringBalance).to.equal(
      `${
        Number(prevStringBalance) +
        (parseInt(collectorFee._hex) / 1000000000000000000) * 5
      }`
    );

    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    /**
     * Minting will always generate a randon hash which is the dna of the token.
     * So to test we can be sure it is the length we expect the current case
     * assuming 15 layers 3 digits each 15 * 3 char hash that should always be generated.
     *  */
    expect(recentlyMintedTokenHash.length).to.equal(
      generativeConfig.layers.length * 3
    );
  });

  it("Should revert on mint public from non pro without collector fee", async function () {
    await contract.togglePublicMint();
    const mintPrice = (await contract.baseSettings()).publicMintPrice;
    let publicWallet = ethers.Wallet.createRandom();
    publicWallet = new ethers.Wallet(publicWallet.privateKey, ethers.provider);
    const tx = await contract.signer.sendTransaction({
      to: publicWallet.address,
      value: utils.parseEther("0.4"),
    });
    await tx.wait();
    const publicWalletConnectedContract = await contract.connect(publicWallet);

    await expect(
      publicWalletConnectedContract.mint(5, 0, [], {
        value: ethers.utils.parseEther(
          `${(parseInt(mintPrice._hex) / 1000000000000000000) * 5}`
        ),
      })
    ).to.be.revertedWith("");
  });

  it("Should render correct token URI when layers are uploaded", async function () {
    await contract.togglePublicMint();
    const mintPrice = (await contract.baseSettings()).publicMintPrice;
    const mintTransaction = await contract.mint(
      generativeConfig.maxSupply,
      0,
      [],
      {
        value: ethers.utils.parseEther(
          `${
            (parseInt(mintPrice._hex) / 1000000000000000000) *
            generativeConfig.maxSupply
          }`
        ),
      }
    );
    const tx = await mintTransaction.wait();
    const events = tx.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));

    // Delayed reveal
    const tokenRes = await contract.tokenURI(parseInt(eventArg[2].hex));
    const jsonBuffer = Buffer.from(tokenRes.split(",")[1], "base64");
    const onChainJson = jsonBuffer.toString();

    expect(onChainJson).to.include("name");
    expect(onChainJson).to.include("description");
    expect(onChainJson).to.include("image");
    expect(onChainJson).to.not.include("attributes");

    const isRevealed1 = await contract.isRevealed();
    expect(isRevealed1).to.equal(false);

    await contract.setRevealSeed();

    const isRevealed2 = await contract.isRevealed();
    expect(isRevealed2).to.equal(true);

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
    const tokenRes2 = await contract.tokenURI(parseInt(eventArg[2].hex));
    const jsonBuffer2 = Buffer.from(tokenRes2.split(",")[1], "base64");
    const onChainJson2 = jsonBuffer2.toString();

    expect(onChainJson2).to.include("name");
    expect(onChainJson2).to.include("description");
    expect(onChainJson2).to.include("image");
    expect(onChainJson2).to.include("attributes");

    // API token URI response
    const newBaseURI = "https://indelible.xyz/api/v2/";
    await contract.setBaseURI(newBaseURI);
    await contract.setRenderOfTokenId(parseInt(eventArg[2].hex), true);
    const tokenRes3 = await contract.tokenURI(parseInt(eventArg[2].hex));
    const jsonBuffer3 = Buffer.from(tokenRes3.split(",")[1], "base64");
    const onChainJson3 = jsonBuffer3.toString();

    expect(onChainJson3).to.include("name");
    expect(onChainJson3).to.include("description");
    expect(onChainJson3).to.include("image");
    expect(onChainJson3).to.include("attributes");
    expect(onChainJson3).to.include("dna");

    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    expect(onChainJson3.split("=")[1].split("&")[0]).to.equal(
      recentlyMintedTokenHash
    );
  });
});

// describe("Indelible 1/1", function () {
//   let contract: IndelibleDrop;

//   beforeEach(async () => {
//     const IndelibleDropContractTest = await ethers.getContractFactory(
//       "IndelibleDrop"
//     );
//     contract = await IndelibleDropContractTest.deploy();
//   });

//   // it("Should return isMintActive false", async function () {
//   //   expect(await contract.isPublicMintActive()).to.equal(false);
//   // });

//   // it("Should toggle public mint", async function () {
//   //   expect(await contract.isMintActive()).to.equal(false);
//   //   await contract.togglePublicMint();
//   //   expect(await contract.isMintActive()).to.equal(true);
//   //   await contract.togglePublicMint();
//   // });

//   it("Should revert mint if public sale is not true", async function () {
//     expect(contract.mint(1, 1, [])).to.be.revertedWith("Minting is not active");
//   });

//   // it("Should revert mint if ether price is wrong", async function () {
//   //   await contract.togglePublicMint(1);
//   //   expect(
//   //     contract.mint(1, {
//   //       value: ethers.utils.parseEther("0.02"),
//   //     })
//   //   ).to.be.revertedWith("Incorrect amount of ether sent");
//   // });

//   // it("Should mint successfully", async function () {
//   //   await contract.togglePublicMint();
//   //   const mintPrice = await contract.publicMintPrice();
//   //   const mintTransaction = await contract.mint(1, {
//   //     value: ethers.utils.parseEther(
//   //       `${parseInt(mintPrice._hex) / 1000000000000000000}`
//   //     ),
//   //   });
//   //   const txn = await mintTransaction.wait();
//   //   const events = txn.events;
//   //   const eventArg =
//   //     events && JSON.parse(JSON.stringify(events[events.length - 1].args));
//   //   const totalSupply = await contract.totalSupply();
//   //   expect(totalSupply.toNumber()).to.equal(parseInt(eventArg[2].hex));
//   // });

//   it("Should revert add trait when size dont match tier of same index", async function () {
//     expect(
//       contract.addDrop(1, {
//         chunks: Array.from(
//           { length: 5 },
//           () => "0x0000000000000000000000000000000000000000"
//         ),
//         traits: [["Test", "Pass"]],
//         mimetype: "",
//         publicMintPrice: 1,
//         allowListPrice: 1,
//         maxSupply: 1,
//         maxPerAddress: 1,
//         maxPerAllowList: 1,
//         isPublicMintActive: false,
//         isAllowListActive: false,
//       })
//     ).to.be.revertedWith("Traits size does not much tiers for this index");
//   });

//   it("Should be able to change contract data", async function () {
//     let _contractData = await contract.contractData();
//     expect(_contractData.name).to.equal("Example & Fren ” 😃");
//     expect(_contractData.description).to.equal('Example\'s ("Description")');
//     expect(_contractData.image).to.equal("");
//     expect(_contractData.banner).to.equal("");
//     expect(_contractData.website).to.equal("https://indelible.xyz");
//     expect(_contractData.royalties).to.equal(0);
//     expect(_contractData.royaltiesRecipient).to.equal("");
//     await contract.setContractData({
//       name: "OnChainKevin",
//       description: "On-chain forever",
//       image: "test",
//       banner: "banner",
//       website: "https://app.indelible.xyz",
//       royalties: 500,
//       royaltiesRecipient: "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677",
//     });
//     _contractData = await contract.contractData();
//     expect(_contractData.name).to.equal("OnChainKevin");
//     expect(_contractData.description).to.equal("On-chain forever");
//     expect(_contractData.image).to.equal("test");
//     expect(_contractData.banner).to.equal("banner");
//     expect(_contractData.website).to.equal("https://app.indelible.xyz");
//     expect(_contractData.royalties).to.equal(500);
//     expect(_contractData.royaltiesRecipient).to.equal(
//       "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677"
//     );
//     const contractURIRes = await contract.contractURI();
//     const jsonBuffer = Buffer.from(contractURIRes.split(",")[1], "base64");
//     const onChainJson = jsonBuffer.toString();
//     expect(onChainJson).to.include("name");
//     expect(onChainJson).to.include("description");
//     expect(onChainJson).to.include("image");
//     expect(onChainJson).to.include("banner");
//     expect(onChainJson).to.include("external_link");
//     expect(onChainJson).to.include("seller_fee_basis_points");
//     expect(onChainJson).to.include("fee_recipient");
//   });

//   it("Should render correct token URI when layer are uploaded", async function () {
//     const chunks = chunk(Buffer.from(drop, "base64"), 14000);
//     console.log(
//       Array.from(
//         { length: chunks.length },
//         () => "0x0000000000000000000000000000000000000000"
//       )
//     );
//     await contract.addDrop(0, {
//       chunks: Array.from(
//         { length: chunks.length },
//         () => "0x0000000000000000000000000000000000000000"
//       ),
//       traits: [["Test", "Pass"]],
//       mimetype: "image/png",
//       publicMintPrice: 1,
//       allowListPrice: 1,
//       maxSupply: 1,
//       maxPerAddress: 1,
//       maxPerAllowList: 1,
//       isPublicMintActive: false,
//       isAllowListActive: false,
//     });
//     for (let i = 0; i < chunks.length; i += 1) {
//       await contract.addChunk(0, i, chunks[i]);
//     }
//     await contract.togglePublicMint(0);
//     const mintPrice = (await contract.getDrop(0)).publicMintPrice;
//     const mintTransaction = await contract.mint(0, 1, [], {
//       value: mintPrice,
//     });
//     await mintTransaction.wait();

//     // ON Chain token URI response
//     const tokenRes = await contract.uri(0);

//     console.log(tokenRes.split("data:application/json,")[1]);

//     // expect(onChainJson).to.include("name");
//     // expect(onChainJson).to.include("description");
//     // expect(onChainJson).to.include("image");
//     // expect(onChainJson).to.include("attributes");

//     // API token URI response
//     // const newBaseURI = "https://indelible.xyz/api/v2/";
//     // await contract.setBaseURI(newBaseURI);
//     // await contract.setRenderOfTokenId(parseInt(eventArg[2].hex), true);
//     // const tokenRes2 = await contract.tokenURI(parseInt(eventArg[2].hex));
//     // const jsonBuffer2 = Buffer.from(tokenRes2.split(",")[1], "base64");
//     // const onChainJson2 = jsonBuffer2.toString();

//     // expect(onChainJson2).to.include("name");
//     // expect(onChainJson2).to.include("description");
//     // expect(onChainJson2).to.include("image");
//     // expect(onChainJson2).to.include("attributes");
//     // expect(onChainJson2).to.include("dna");
//     // const token = await contract.getToken(parseInt(eventArg[2].hex));
//     // console.log(token);
//     // const image = await contract.tokenIdToImage(parseInt(eventArg[2].hex));
//     // console.log(image);
//   });
// });
