import { expect } from "chai";
import { ethers } from "hardhat";
import keccak256 from "@indeliblelabs/keccak256";
import { utils } from "ethers";
import {
  TEST_ADDRESS_1,
  TEST_ADDRESS_2,
  generativeConfig,
} from "./build-contracts";
import {
  IndelibleFactory,
  IndelibleGenerative,
  TestMinterContract,
} from "../typechain";

const randomOccurrences = (layer: any[], maxSupply: number) => {
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
  if (rarities.some((value) => value < 0)) {
    rarities = randomOccurrences(layer, maxSupply);
  }
  rarities = rarities.sort((a, b) => b - a);
  return rarities;
};

const formatLayer = (layer: any[], maxSupply: number) => {
  const rarities = randomOccurrences(layer, maxSupply);
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
  let generativeContract: IndelibleGenerative;

  beforeEach(async () => {
    const [owner, _, signer] = await ethers.getSigners();

    const IndelibleFactory = await ethers.getContractFactory(
      "IndelibleFactory"
    );
    factoryContract = await IndelibleFactory.deploy();

    const IndelibleGenerative = await ethers.getContractFactory(
      "IndelibleGenerative"
    );
    const indelibleGenerative = await IndelibleGenerative.deploy();

    const IndelibleSecurity = await ethers.getContractFactory(
      "IndelibleSecurity"
    );
    const indelibleSecurity = await IndelibleSecurity.deploy();

    const updateSignerAddressTxn = await indelibleSecurity.updateSignerAddress(
      signer.address
    );
    await updateSignerAddressTxn.wait();

    const updateImplementationTxn =
      await factoryContract.updateGenerativeImplementation(
        indelibleGenerative.address
      );
    await updateImplementationTxn.wait();

    const updateProContractAddressTxn =
      await factoryContract.updateIndelibleSecurity(indelibleSecurity.address);
    await updateProContractAddressTxn.wait();

    const updateCollectorFeeRecipientTxn =
      await factoryContract.updateCollectorFeeRecipient(
        "0x29FbB84b835F892EBa2D331Af9278b74C595EDf1"
      );
    await updateCollectorFeeRecipientTxn.wait();

    const updateCollectorFeeTxn = await factoryContract.updateCollectorFee(
      ethers.utils.parseEther("0.000777")
    );
    await updateCollectorFeeTxn.wait();

    const deployGenerativeContractTxn =
      await factoryContract.deployGenerativeContract(
        generativeConfig.name,
        generativeConfig.tokenSymbol,
        generativeConfig.maxSupply,
        {
          maxPerAddress: generativeConfig.maxPerAddress,
          publicMintPrice: ethers.utils.parseEther(generativeConfig.mintPrice),
          isPublicMintActive: false,
          isContractSealed: false,
          description: generativeConfig.description,
          placeholderImage: generativeConfig.placeholderImage,
        },
        {
          royaltyAddress: owner.address,
          royaltyAmount: generativeConfig.royalties,
        },
        generativeConfig.withdrawRecipients,
        false
      );

    const deployedGenerativeContract = await deployGenerativeContractTxn.wait();
    const contractAddress = deployedGenerativeContract.events?.find(
      (e) => e.event === "ContractCreated"
    )?.args?.contractAddress;
    generativeContract = IndelibleGenerative.attach(contractAddress);

    // Upload art
    await generativeContract.addLayer(
      0,
      "layer 1",
      generativeConfig.primeNumbers[0],
      formatLayer(
        require("./layers/0-lasers.json"),
        generativeConfig.maxSupply
      ),
      9
    );
    await generativeContract.addLayer(
      1,
      "layer 2",
      generativeConfig.primeNumbers[1],
      formatLayer(require("./layers/1-mouth.json"), generativeConfig.maxSupply),
      9
    );
    await generativeContract.addLayer(
      2,
      "layer 3",
      generativeConfig.primeNumbers[2],
      formatLayer(require("./layers/2-head.json"), generativeConfig.maxSupply),
      9
    );
    await generativeContract.addLayer(
      3,
      "layer 4",
      generativeConfig.primeNumbers[3],
      formatLayer(require("./layers/3-face.json"), generativeConfig.maxSupply),
      9
    );
    await generativeContract.addLayer(
      4,
      "layer 5",
      generativeConfig.primeNumbers[4],
      formatLayer(require("./layers/4-eyes.json"), generativeConfig.maxSupply),
      9
    );
    await generativeContract.addLayer(
      5,
      "layer 6",
      generativeConfig.primeNumbers[5],
      formatLayer(require("./layers/5-nose.json"), generativeConfig.maxSupply),
      9
    );
    await generativeContract.addLayer(
      6,
      "layer 7",
      generativeConfig.primeNumbers[6],
      formatLayer(require("./layers/6-shirt.json"), generativeConfig.maxSupply),
      9
    );
    await generativeContract.addLayer(
      7,
      "layer 8",
      generativeConfig.primeNumbers[7],
      formatLayer(require("./layers/7-skin.json"), generativeConfig.maxSupply),
      9
    );
    await generativeContract.addLayer(
      8,
      "layer 9",
      generativeConfig.primeNumbers[8],
      formatLayer(
        require("./layers/8-background.json"),
        generativeConfig.maxSupply
      ),
      9
    );
  });

  it("Should set new baseURI", async function () {
    const newBaseURI = "https://indelible.xyz/api/v2/";
    expect(await generativeContract.baseURI()).to.equal("");
    await generativeContract.setBaseURI(newBaseURI);
    expect(await generativeContract.baseURI()).to.equal(newBaseURI);
  });

  it("Should toggle public mint", async function () {
    expect((await generativeContract.settings()).isPublicMintActive).to.equal(
      false
    );
    await generativeContract.togglePublicMint();
    expect((await generativeContract.settings()).isPublicMintActive).to.equal(
      true
    );
  });

  it("Should revert mint if public sale is not true", async function () {
    const [, user] = await ethers.getSigners();
    await expect(generativeContract.connect(user).mint(1)).to.be.revertedWith(
      "NotAvailable()"
    );
  });

  it("Should not revert mint if public sale is not true for owner", async function () {
    const [owner] = await ethers.getSigners();
    await expect(generativeContract.connect(owner).mint(1)).to.not.revertedWith(
      "NotAvailable()"
    );
  });

  it("Should be able to airdrop", async function () {
    const [owner] = await ethers.getSigners();
    const collectorFee = await generativeContract.collectorFee();
    await generativeContract
      .connect(owner)
      .airdrop(1, ["0x2052051A0474fB0B98283b3F38C13b0B0B6a3677"], {
        value: collectorFee,
      });
    expect(
      await generativeContract.balanceOf(
        "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677"
      )
    ).to.equal(1);
  });

  it("Should mint with a signature successfully", async function () {
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const collectorRecipientBalance =
      await generativeContract.provider.getBalance(collectorRecipient);
    const mintPrice = ethers.utils.parseEther("0.15");
    const [, user, signer] = await ethers.getSigners();

    const nonce = await ethers.provider.getBlockNumber();
    const network = await ethers.provider.getNetwork();
    const flatSig = await signer.signMessage(
      keccak256(
        utils.solidityPack(
          [
            "uint256",
            "address",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
          ],
          [
            nonce,
            generativeContract.address,
            user.address,
            1, // quantity
            2, // max per wallet
            mintPrice,
            0, // collector fee
            network.chainId,
          ]
        )
      )
    );
    const sig = ethers.utils.splitSignature(flatSig);

    const mintTransaction = await generativeContract
      .connect(user)
      .signatureMint(
        { r: sig.r, s: sig.s, v: sig.v },
        nonce,
        1,
        2,
        mintPrice,
        0,
        {
          value: mintPrice,
        }
      );

    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await generativeContract.totalSupply();
    expect(eventArg[2]).to.equal(totalSupply.add(-1));
    const newCollectorRecipientBalance =
      await generativeContract.provider.getBalance(collectorRecipient);
    expect(newCollectorRecipientBalance).to.equal(collectorRecipientBalance); // did not increase after mint with owner pro holder.
    await generativeContract.setRevealSeed();

    const recentlyMintedTokenHash = await generativeContract.tokenIdToHash(
      eventArg[2]
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

  it("Should revert mint with a bad signature", async function () {
    const mintPrice = ethers.utils.parseEther("0.15");
    const [owner, user, signer] = await ethers.getSigners();

    const nonce = await ethers.provider.getBlockNumber();
    const network = await ethers.provider.getNetwork();
    const flatSig = await signer.signMessage(
      keccak256(
        utils.solidityPack(
          [
            "uint256",
            "address",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
          ],
          [
            nonce,
            owner.address,
            owner.address,
            1,
            2,
            mintPrice,
            0,
            network.chainId,
          ]
        )
      )
    );
    const sig = ethers.utils.splitSignature(flatSig);

    await expect(
      generativeContract
        .connect(user)
        .signatureMint(
          { r: sig.r, s: sig.s, v: sig.v },
          nonce,
          1,
          2,
          mintPrice,
          0,
          {
            value: mintPrice,
          }
        )
    ).to.be.revertedWith("NotAuthorized()");
  });

  it("Should withdraw correctly", async function () {
    await generativeContract.togglePublicMint();
    const mintPrice = ethers.utils.parseEther("0.15");
    const collectorFee = await generativeContract.collectorFee();
    await generativeContract.setPublicMintPrice(mintPrice);
    const mintTransaction = await generativeContract.mint(1, {
      value: mintPrice.add(collectorFee),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await generativeContract.totalSupply();
    expect(eventArg[2]).to.equal(totalSupply.add(-1));

    await generativeContract.setRevealSeed();
    // test 1 address has withdraw percentage of 40%
    const testAddress1 = utils.getAddress(TEST_ADDRESS_1);
    // test 1 address has withdraw percentage of 20%
    const testAddress2 = utils.getAddress(TEST_ADDRESS_2);
    const devWalletAddress = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const initDevBalance = await generativeContract.provider.getBalance(
      devWalletAddress
    );
    const firstBalanceTest1 = await generativeContract.provider.getBalance(
      testAddress1
    );
    const firstBalanceTest2 = await generativeContract.provider.getBalance(
      testAddress2
    );

    expect(ethers.utils.formatEther(firstBalanceTest1)).to.equal("0.0");
    expect(ethers.utils.formatEther(firstBalanceTest2)).to.equal("0.0");

    const withdraw = await generativeContract.withdraw();
    await withdraw.wait();
    const devWalletBalance = await generativeContract.provider.getBalance(
      devWalletAddress
    );
    const secondBalanceTest1 = await generativeContract.provider.getBalance(
      testAddress1
    );
    const secondBalanceTest2 = await generativeContract.provider.getBalance(
      testAddress2
    );
    const contractBalance = await generativeContract.provider.getBalance(
      generativeContract.address
    );

    expect(ethers.utils.formatEther(contractBalance)).to.equal(`0.0`);
    expect(ethers.utils.formatEther(devWalletBalance)).to.equal(
      ethers.utils.formatEther(initDevBalance)
    );
    expect(secondBalanceTest1).to.equal(
      mintPrice.div(100).mul(40) // 40%
    );
    expect(secondBalanceTest2).to.equal(
      mintPrice.div(100).mul(20) // 20%
    );
  });

  it("Should not mint successfully from another contract", async function () {
    const TestMinterContract = await ethers.getContractFactory(
      "TestMinterContract"
    );
    const minterContract: TestMinterContract =
      await TestMinterContract.deploy();

    const settings = await generativeContract.settings();
    const collectorFee = await generativeContract.collectorFee();

    await generativeContract.togglePublicMint();
    const collectionContractAddress = generativeContract.address;

    await expect(
      minterContract.executeExternalContractMint(collectionContractAddress, {
        value: settings.publicMintPrice.add(collectorFee),
      })
    ).to.be.revertedWith("NotAuthorized()");
  });

  it("Should revert mint if ether price is wrong", async function () {
    await generativeContract.togglePublicMint();
    const [, user] = await ethers.getSigners();
    const settings = await generativeContract.settings();
    const collectorFee = await generativeContract.collectorFee();
    await expect(
      generativeContract.connect(user).mint(1, {
        value: settings.publicMintPrice.add(-1).add(collectorFee),
      })
    ).to.be.revertedWith("");
  });

  it("Should mint public successfully", async function () {
    await generativeContract.togglePublicMint();
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const collectorRecipientBalance =
      await generativeContract.provider.getBalance(collectorRecipient);
    const settings = await generativeContract.settings();
    const collectorFee = await generativeContract.collectorFee();
    const mintTransaction = await generativeContract.mint(5, {
      value: settings.publicMintPrice.add(collectorFee).mul(5),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await generativeContract.totalSupply();
    expect(eventArg[2]).to.equal(totalSupply.add(-1));

    await generativeContract.setRevealSeed();

    const newCollectorRecipientBalance =
      await generativeContract.provider.getBalance(collectorRecipient);

    expect(newCollectorRecipientBalance).to.equal(
      collectorFee.mul(5).add(collectorRecipientBalance)
    ); // should not change after mint

    const recentlyMintedTokenHash = await generativeContract.tokenIdToHash(
      eventArg[2]
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
    await generativeContract.togglePublicMint();
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const collectorRecipientBalance =
      await generativeContract.provider.getBalance(collectorRecipient);
    const settings = await generativeContract.settings();
    const collectorFee = await generativeContract.collectorFee();
    let publicWallet = ethers.Wallet.createRandom();
    publicWallet = new ethers.Wallet(publicWallet.privateKey, ethers.provider);
    const tx = await generativeContract.signer.sendTransaction({
      to: publicWallet.address,
      value: utils.parseEther("0.4"),
    });
    await tx.wait();

    const mintTransaction = await generativeContract
      .connect(publicWallet)
      .mint(5, {
        value: settings.publicMintPrice.add(collectorFee).mul(5),
      });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await generativeContract.totalSupply();
    expect(eventArg[2]).to.equal(totalSupply.add(-1));

    await generativeContract.setRevealSeed();

    const newCollectorRecipientBalance =
      await generativeContract.provider.getBalance(collectorRecipient);

    expect(newCollectorRecipientBalance).to.equal(
      collectorFee.mul(5).add(collectorRecipientBalance)
    );

    const recentlyMintedTokenHash = await generativeContract.tokenIdToHash(
      eventArg[2]
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
    await generativeContract.togglePublicMint();
    const mintPrice = (await generativeContract.settings()).publicMintPrice;
    let publicWallet = ethers.Wallet.createRandom();
    publicWallet = new ethers.Wallet(publicWallet.privateKey, ethers.provider);
    const tx = await generativeContract.signer.sendTransaction({
      to: publicWallet.address,
      value: utils.parseEther("0.4"),
    });
    await tx.wait();

    await expect(
      generativeContract.connect(publicWallet).mint(5, {
        value: mintPrice.mul(5),
      })
    ).to.be.revertedWith("");
  });

  it("Should render correct token URI when layers are uploaded", async function () {
    await generativeContract.togglePublicMint();
    await generativeContract.setMaxPerAddress(0); // mint any amount
    const mintPrice = (await generativeContract.settings()).publicMintPrice;
    const collectorFee = await generativeContract.collectorFee();
    let publicWallet = ethers.Wallet.createRandom();
    publicWallet = new ethers.Wallet(publicWallet.privateKey, ethers.provider);
    const sendTxn = await generativeContract.signer.sendTransaction({
      to: publicWallet.address,
      value: mintPrice
        .add(collectorFee)
        .mul(generativeConfig.maxSupply)
        .add(utils.parseEther("10")), // for mint and gas fees
    });
    await sendTxn.wait();

    const mintTransaction = await generativeContract
      .connect(publicWallet)
      .mint(generativeConfig.maxSupply, {
        value: mintPrice.add(collectorFee).mul(generativeConfig.maxSupply),
      });
    const tx = await mintTransaction.wait();
    const events = tx.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));

    // Delayed reveal
    const tokenRes = await generativeContract.tokenURI(eventArg[2]);
    const jsonBuffer = Buffer.from(tokenRes.split(",")[1], "base64");
    const onChainJson = jsonBuffer.toString();

    expect(onChainJson).to.include("name");
    expect(onChainJson).to.include("description");
    expect(onChainJson).to.include("image");
    expect(onChainJson).to.not.include("attributes");

    const isRevealed1 = await generativeContract.isRevealed();
    expect(isRevealed1).to.equal(false);

    await generativeContract.setRevealSeed();

    const isRevealed2 = await generativeContract.isRevealed();
    expect(isRevealed2).to.equal(true);

    // Change traits with Trait Linking
    await generativeContract.setLinkedTraits([
      { traitA: [7, 0], traitB: [0, 0] },
      { traitA: [7, 1], traitB: [0, 0] },
      { traitA: [7, 2], traitB: [0, 0] },
    ]);
    const recentlyMintedTokenHashA = await generativeContract.tokenIdToHash(
      eventArg[2]
    );
    expect(recentlyMintedTokenHashA[2]).to.equal("0");
    await generativeContract.setLinkedTraits([
      { traitA: [7, 0], traitB: [0, 1] },
      { traitA: [7, 1], traitB: [0, 1] },
      { traitA: [7, 2], traitB: [0, 1] },
    ]);
    const recentlyMintedTokenHashB = await generativeContract.tokenIdToHash(
      eventArg[2]
    );
    expect(recentlyMintedTokenHashB[2]).to.equal("1");

    // ON Chain token URI response
    const tokenRes2 = await generativeContract.tokenURI(eventArg[2]);
    const jsonBuffer2 = Buffer.from(tokenRes2.split(",")[1], "base64");
    const onChainJson2 = jsonBuffer2.toString();

    expect(onChainJson2).to.include("name");
    expect(onChainJson2).to.include("description");
    expect(onChainJson2).to.include("image");
    expect(onChainJson2).to.include("attributes");

    // API token URI response
    const newBaseURI = "https://indelible.xyz/api/v2/";
    await generativeContract.setBaseURI(newBaseURI);
    await generativeContract
      .connect(publicWallet)
      .setRenderOfTokenId(eventArg[2], true);
    const tokenRes3 = await generativeContract.tokenURI(eventArg[2]);
    const jsonBuffer3 = Buffer.from(tokenRes3.split(",")[1], "base64");
    const onChainJson3 = jsonBuffer3.toString();

    expect(() => JSON.parse(onChainJson3)).to.not.throw();

    expect(onChainJson3).to.include("name");
    expect(onChainJson3).to.include("description");
    expect(onChainJson3).to.include("image");
    expect(onChainJson3).to.include("attributes");
    expect(onChainJson3).to.include("dna");

    const recentlyMintedTokenHash = await generativeContract.tokenIdToHash(
      eventArg[2]
    );
    expect(onChainJson3.split("=")[1].split("&")[0]).to.equal(
      recentlyMintedTokenHash
    );
  });
});
