import { expect } from "chai";
import { ethers } from "hardhat";
import { chunk } from "lodash";
import { drop } from "./images/drop";
import {
  IndelibleDrop,
  IndelibleFactory,
  IndelibleGenerative,
  TestMinterContract,
} from "../typechain";
import MerkleTree from "merkletreejs";
import { generativeConfig } from "./build-contracts";

describe("Indelible Drop", function () {
  let factoryContract: IndelibleFactory;
  let contract: IndelibleDrop;
  const allowListWithUsers: string[] = [];
  const leafNodesWithUsers: Buffer[] = [];
  let merkleTreeWithUsers: MerkleTree;
  let merkleRootWithUsers: Buffer;
  const allowListWithoutUsers: string[] = [];
  const leafNodesWithoutUsers: Buffer[] = [];
  let merkleTreeWithoutUsers: MerkleTree;
  let merkleRootWithoutUsers: Buffer;

  beforeEach(async () => {
    const [owner, user, userWithMax] = await ethers.getSigners();

    const IndelibleFactory = await ethers.getContractFactory(
      "IndelibleFactory"
    );
    factoryContract = await IndelibleFactory.deploy();

    const IndelibleDrop = await ethers.getContractFactory("IndelibleDrop");
    const indelibleDrop = await IndelibleDrop.deploy();

    const updateImplementationTxn =
      await factoryContract.updateDropImplementation(indelibleDrop.address);
    await updateImplementationTxn.wait();

    const updateProContractAddressTxn =
      await factoryContract.updateIndelibleSigner(owner.address);
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
      await factoryContract.deployDropContract(
        generativeConfig.name,
        generativeConfig.tokenSymbol,
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
    contract = IndelibleDrop.attach(contractAddress);

    const chunks = chunk(Buffer.from(drop, "base64"), 14000);
    await contract.addToken({
      chunks: Array.from(
        { length: chunks.length },
        () => "0x0000000000000000000000000000000000000000"
      ),
      traits: [["Test", "Pass"]],
      mimetype: "image/png",
      name: "Test 1",
      description: "Description 1",
      maxSupply: 1000,
      totalMinted: 0,
      tier2MerkleRoot: ethers.utils.hexZeroPad("0x", 32),
      settings: {
        mintPrice: 1,
        maxPerAddress: 1,
        mintStart: 0,
        mintEnd: 0,
        merkleRoot: ethers.utils.hexZeroPad("0x", 32),
      },
    });
    for (let i = 0; i < chunks.length; i += 1) {
      await contract.addChunk(0, i, chunks[i]);
    }
  });

  it("Should return isMintActive true", async function () {
    expect(await contract.isMintActive(0)).to.equal(true);
  });

  it("Should return isMintActive false", async function () {
    const [, user] = await ethers.getSigners();
    expect(await contract.connect(user).isMintActive(0)).to.equal(false);
  });

  it("Should toggle mint", async function () {
    const [owner, user] = await ethers.getSigners();
    expect(await contract.connect(user).isMintActive(0)).to.equal(false);
    await (
      await contract.connect(owner).setTokenSettings(0, {
        mintPrice: 0,
        maxPerAddress: 1,
        mintStart: Math.floor(Date.now() / 1000),
        mintEnd: 0,
        merkleRoot: ethers.utils.hexZeroPad("0x", 32),
      })
    ).wait();
    expect(await contract.connect(user).isMintActive(0)).to.equal(true);
    await (
      await contract.connect(owner).setTokenSettings(0, {
        mintPrice: 0,
        maxPerAddress: 1,
        mintStart: 0,
        mintEnd: 0,
        merkleRoot: ethers.utils.hexZeroPad("0x", 32),
      })
    ).wait();
    expect(await contract.connect(user).isMintActive(0)).to.equal(false);
  });

  it("Should revert mint if mint is not active", async function () {
    const [, user] = await ethers.getSigners();
    await expect(contract.connect(user).mint(0, 1, 0, [])).to.be.revertedWith(
      "NotAuthorized()"
    );
  });

  it("Should revert mint if ether price is wrong", async function () {
    const [, user] = await ethers.getSigners();
    await contract.setTokenSettings(0, {
      mintPrice: ethers.utils.parseEther("0.02"),
      maxPerAddress: 10,
      mintStart: 1,
      mintEnd: 0,
      merkleRoot: ethers.utils.hexZeroPad("0x", 32),
    });
    await expect(
      contract.connect(user).mint(0, 1, 0, [], {
        value: ethers.utils.parseEther("0.01"),
      })
    ).to.be.revertedWith("InvalidInput()");
  });

  it("Should mint successfully", async function () {
    const [, user] = await ethers.getSigners();
    const token = await contract.getToken(0);
    const collectorFee = await contract.collectorFee();
    await contract.setTokenSettings(0, {
      mintPrice: ethers.utils.parseEther("0.02"),
      maxPerAddress: 10,
      mintStart: 1,
      mintEnd: 0,
      merkleRoot: ethers.utils.hexZeroPad("0x", 32),
    });
    await (
      await contract.connect(user).mint(0, 1, 0, [], {
        value: ethers.utils.parseEther("0.02").add(collectorFee),
      })
    ).wait();
    const tokenAfter = await contract.getToken(0);
    expect(token.totalMinted.add(1)).to.equal(tokenAfter.totalMinted);
  });

  it("Should render correct token URI when layer are uploaded", async function () {
    await contract.setTokenSettings(0, {
      mintPrice: 0,
      maxPerAddress: 1,
      mintStart: Math.floor(Date.now() / 1000),
      mintEnd: 0,
      merkleRoot: ethers.utils.hexZeroPad("0x", 32),
    });
    const token = await contract.getToken(0);
    const collectorFee = await contract.collectorFee();
    const mintTransaction = await contract.mint(0, 1, 0, [], {
      value: token.settings.mintPrice.add(collectorFee),
    });
    await mintTransaction.wait();

    // ON Chain token URI response
    const tokenRes = await contract.uri(0);

    const onChainJson = tokenRes.split("data:application/json,")[1];

    expect(onChainJson).to.include("name");
    expect(onChainJson).to.include("description");
    expect(onChainJson).to.include("image");
    expect(onChainJson).to.include("attributes");
  });
});
