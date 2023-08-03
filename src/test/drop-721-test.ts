import { expect } from "chai";
import { ethers } from "hardhat";
import keccak256 from "@indeliblelabs/keccak256";
import { utils } from "ethers";
import { TEST_ADDRESS_3, TEST_ADDRESS_4, dropConfig } from "./build-contracts";
import {
  IndelibleDrop721,
  IndelibleFactory,
  TestMinterContract,
} from "../typechain";
import { chunk } from "lodash";
import { drop } from "./images/drop";

describe("Indelible Drop721", function () {
  let factoryContract: IndelibleFactory;
  let drop721Contract: IndelibleDrop721;

  beforeEach(async () => {
    const [owner, _, signer] = await ethers.getSigners();

    const IndelibleFactory = await ethers.getContractFactory(
      "IndelibleFactory"
    );
    factoryContract = await IndelibleFactory.deploy();

    const IndelibleDrop721 = await ethers.getContractFactory(
      "IndelibleDrop721"
    );
    const indelibleDrop721 = await IndelibleDrop721.deploy();

    const IndelibleSecurity = await ethers.getContractFactory(
      "IndelibleSecurity"
    );
    const indelibleSecurity = await IndelibleSecurity.deploy();

    const updateSignerAddressTxn = await indelibleSecurity.updateSignerAddress(
      signer.address
    );
    await updateSignerAddressTxn.wait();

    const updateImplementationTxn =
      await factoryContract.updateDrop721Implementation(
        indelibleDrop721.address
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

    const deployDrop721ContractTxn =
      await factoryContract.deployDrop721Contract(
        dropConfig.name,
        dropConfig.tokenSymbol,
        {
          publicMintPrice: ethers.utils.parseEther(dropConfig.mintPrice),
          maxPerAddress: dropConfig.maxPerAddress,
          isPublicMintActive: false,
          mintEnd: 0,
          description: dropConfig.description,
          isContractSealed: false,
        },
        {
          royaltyAddress: owner.address,
          royaltyAmount: dropConfig.royalties,
        },
        dropConfig.withdrawRecipients,
        false
      );

    const deployedDrop721Contract = await deployDrop721ContractTxn.wait();
    const contractAddress = deployedDrop721Contract.events?.find(
      (e) => e.event === "ContractCreated"
    )?.args?.contractAddress;
    drop721Contract = IndelibleDrop721.attach(contractAddress);

    // Upload art
    const chunks = chunk(Buffer.from(drop, "base64"), 14000);
    await drop721Contract.setTraits([{ traitType: "name", value: "hello" }]);
    await drop721Contract.setMimetype("image/png");
    for (let i = 0; i < chunks.length; i += 1) {
      await drop721Contract.addChunk(i, chunks[i], chunks.length);
    }
  });

  it("Should set new baseURI", async function () {
    const newBaseURI = "https://indelible.xyz/api/v2/";
    expect(await drop721Contract.baseURI()).to.equal("");
    await drop721Contract.setBaseURI(newBaseURI);
    expect(await drop721Contract.baseURI()).to.equal(newBaseURI);
  });

  it("Should toggle public mint", async function () {
    expect((await drop721Contract.settings()).isPublicMintActive).to.equal(
      false
    );
    await drop721Contract.togglePublicMint();
    expect((await drop721Contract.settings()).isPublicMintActive).to.equal(
      true
    );
  });

  it("Should set mint end", async function () {
    expect((await drop721Contract.settings()).mintEnd).to.equal(0);
    const now = Math.floor(Date.now() / 1000);
    await drop721Contract.setMintEnd(now);
    expect((await drop721Contract.settings()).mintEnd).to.equal(now);
  });

  it("Should revert mint if public sale is not true", async function () {
    const [, user] = await ethers.getSigners();
    await expect(drop721Contract.connect(user).mint(1)).to.be.revertedWith(
      "NotAvailable()"
    );
  });

  it("Should not revert mint if public sale is not true for owner", async function () {
    const [owner] = await ethers.getSigners();
    await expect(drop721Contract.connect(owner).mint(1)).to.not.revertedWith(
      "NotAvailable()"
    );
  });

  it("Should be able to airdrop", async function () {
    const [owner] = await ethers.getSigners();
    const collectorFee = await drop721Contract.collectorFee();
    await drop721Contract
      .connect(owner)
      .airdrop(1, ["0x2052051A0474fB0B98283b3F38C13b0B0B6a3677"], {
        value: collectorFee,
      });
    expect(
      await drop721Contract.balanceOf(
        "0x2052051A0474fB0B98283b3F38C13b0B0B6a3677"
      )
    ).to.equal(1);
  });

  it("Should mint with a signature successfully", async function () {
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const collectorRecipientBalance = await drop721Contract.provider.getBalance(
      collectorRecipient
    );
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
            drop721Contract.address,
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

    const mintTransaction = await drop721Contract
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
    const totalSupply = await drop721Contract.totalSupply();
    expect(eventArg[2]).to.equal(totalSupply.add(-1));
    const newCollectorRecipientBalance =
      await drop721Contract.provider.getBalance(collectorRecipient);
    expect(newCollectorRecipientBalance).to.equal(collectorRecipientBalance); // did not increase after mint with owner pro holder.
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
      drop721Contract
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
    await drop721Contract.togglePublicMint();
    const mintPrice = ethers.utils.parseEther("0.15");
    const collectorFee = await drop721Contract.collectorFee();
    await drop721Contract.setPublicMintPrice(mintPrice);
    const mintTransaction = await drop721Contract.mint(1, {
      value: mintPrice.add(collectorFee),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await drop721Contract.totalSupply();
    expect(eventArg[2]).to.equal(totalSupply.add(-1));

    // test 1 address has withdraw percentage of 40%
    const testAddress1 = utils.getAddress(TEST_ADDRESS_3);
    // test 1 address has withdraw percentage of 20%
    const testAddress2 = utils.getAddress(TEST_ADDRESS_4);
    const devWalletAddress = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const initDevBalance = await drop721Contract.provider.getBalance(
      devWalletAddress
    );
    const firstBalanceTest1 = await drop721Contract.provider.getBalance(
      testAddress1
    );
    const firstBalanceTest2 = await drop721Contract.provider.getBalance(
      testAddress2
    );

    expect(ethers.utils.formatEther(firstBalanceTest1)).to.equal("0.0");
    expect(ethers.utils.formatEther(firstBalanceTest2)).to.equal("0.0");

    const withdraw = await drop721Contract.withdraw();
    await withdraw.wait();
    const devWalletBalance = await drop721Contract.provider.getBalance(
      devWalletAddress
    );
    const secondBalanceTest1 = await drop721Contract.provider.getBalance(
      testAddress1
    );
    const secondBalanceTest2 = await drop721Contract.provider.getBalance(
      testAddress2
    );
    const contractBalance = await drop721Contract.provider.getBalance(
      drop721Contract.address
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

    const settings = await drop721Contract.settings();
    const collectorFee = await drop721Contract.collectorFee();

    await drop721Contract.togglePublicMint();
    const collectionContractAddress = drop721Contract.address;

    await expect(
      minterContract.executeExternalContractMint(collectionContractAddress, {
        value: settings.publicMintPrice.add(collectorFee),
      })
    ).to.be.revertedWith("NotAuthorized()");
  });

  it("Should revert mint if ether price is wrong", async function () {
    await drop721Contract.togglePublicMint();
    const [, user] = await ethers.getSigners();
    const settings = await drop721Contract.settings();
    const collectorFee = await drop721Contract.collectorFee();
    await expect(
      drop721Contract.connect(user).mint(1, {
        value: settings.publicMintPrice.add(-1).add(collectorFee),
      })
    ).to.be.revertedWith("");
  });

  it("Should mint public successfully", async function () {
    await drop721Contract.togglePublicMint();
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const collectorRecipientBalance = await drop721Contract.provider.getBalance(
      collectorRecipient
    );
    const settings = await drop721Contract.settings();
    const collectorFee = await drop721Contract.collectorFee();
    const mintTransaction = await drop721Contract.mint(5, {
      value: settings.publicMintPrice.add(collectorFee).mul(5),
    });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await drop721Contract.totalSupply();
    expect(eventArg[2]).to.equal(totalSupply.add(-1));

    const newCollectorRecipientBalance =
      await drop721Contract.provider.getBalance(collectorRecipient);

    expect(newCollectorRecipientBalance).to.equal(
      collectorFee.mul(5).add(collectorRecipientBalance)
    ); // should not change after mint
  });

  it("Should mint public from non pro with collector fee successfully", async function () {
    await drop721Contract.togglePublicMint();
    const collectorRecipient = utils.getAddress(
      `0x29FbB84b835F892EBa2D331Af9278b74C595EDf1`
    );
    const collectorRecipientBalance = await drop721Contract.provider.getBalance(
      collectorRecipient
    );
    const settings = await drop721Contract.settings();
    const collectorFee = await drop721Contract.collectorFee();
    let publicWallet = ethers.Wallet.createRandom();
    publicWallet = new ethers.Wallet(publicWallet.privateKey, ethers.provider);
    const tx = await drop721Contract.signer.sendTransaction({
      to: publicWallet.address,
      value: utils.parseEther("0.4"),
    });
    await tx.wait();

    const mintTransaction = await drop721Contract
      .connect(publicWallet)
      .mint(5, {
        value: settings.publicMintPrice.add(collectorFee).mul(5),
      });
    const txn = await mintTransaction.wait();
    const events = txn.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));
    const totalSupply = await drop721Contract.totalSupply();
    expect(eventArg[2]).to.equal(totalSupply.add(-1));

    const newCollectorRecipientBalance =
      await drop721Contract.provider.getBalance(collectorRecipient);

    expect(newCollectorRecipientBalance).to.equal(
      collectorFee.mul(5).add(collectorRecipientBalance)
    );
  });

  it("Should revert on mint public from non pro without collector fee", async function () {
    await drop721Contract.togglePublicMint();
    const mintPrice = (await drop721Contract.settings()).publicMintPrice;
    let publicWallet = ethers.Wallet.createRandom();
    publicWallet = new ethers.Wallet(publicWallet.privateKey, ethers.provider);
    const tx = await drop721Contract.signer.sendTransaction({
      to: publicWallet.address,
      value: utils.parseEther("0.4"),
    });
    await tx.wait();

    await expect(
      drop721Contract.connect(publicWallet).mint(5, {
        value: mintPrice.mul(5),
      })
    ).to.be.revertedWith("");
  });
});
