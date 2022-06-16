import { expect } from "chai";
import { ethers } from "hardhat";
import { IndelibleERC721A } from "../typechain";

const traitData =
  "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";

const formatLayer = (numberOfLayers: number) =>
  Array.from(Array(numberOfLayers).keys()).map((_, index) => {
    const buffer = Buffer.from(traitData, "base64");
    return {
      name: `Trait ${index}`,
      mimetype: "image/png",
      data: `0x${buffer.toString("hex")}`,
    };
  });

describe("IndelibleERC721A", function () {
  let contract: IndelibleERC721A;

  beforeEach(async () => {
    const IndelibleLabContreactTest = await ethers.getContractFactory(
      "IndelibleERC721A"
    );
    contract = await IndelibleLabContreactTest.deploy();
  });

  it("Should return isPublicMintActive false", async function () {
    expect(await contract.isPublicMintActive()).to.equal(false);
  });

  it("Should set new baseURI", async function () {
    const newBaseURI = "https://indeliblelabs.io/api/v2/";
    expect(await contract.baseURI()).to.equal("");
    await contract.changeBaseURI(newBaseURI);
    expect(await contract.baseURI()).to.equal(newBaseURI);
  });

  it("Should toggle isMintingPaused", async function () {
    expect(await contract.isMintingPaused()).to.equal(true);
    await contract.toggleMinting();
    expect(await contract.isMintingPaused()).to.equal(false);
  });

  it("Should revert mint if public sale is not true", async function () {
    expect(contract.mint(1)).to.be.revertedWith("Public sale not open");
  });

  it("Should revert mint if ether price is wrong", async function () {
    await contract.toggleMinting();
    expect(
      contract.mint(1, {
        value: ethers.utils.parseEther("0.02"),
      })
    ).to.be.revertedWith("Incorrect amount of ether sent");
  });

  it("Should mint successfully", async function () {
    await contract.toggleMinting();
    const mintPrice = await contract.mintPrice();
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
    expect(recentlyMintedTokenHash.length).to.equal(15 * 3);
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
    expect(_contractData.name).to.equal("Example & Fren ” 😃");
    expect(_contractData.description).to.equal('Example\'s ("Description")');
    expect(_contractData.image).to.equal("");
    expect(_contractData.banner).to.equal("");
    expect(_contractData.website).to.equal("https://indeliblelabs.io");
    expect(_contractData.royalties).to.equal(0);
    expect(_contractData.royaltiesRecipient).to.equal("");
    await contract.changeContractData({
      name: "OnChainKevin",
      description: "On-chain forever",
      image: "test",
      banner: "banner",
      website: "https://app.indeliblelabs.io",
      royalties: 500,
      royaltiesRecipient: "0xHirsch",
    });
    _contractData = await contract.contractData();
    expect(_contractData.name).to.equal("OnChainKevin");
    expect(_contractData.description).to.equal("On-chain forever");
    expect(_contractData.image).to.equal("test");
    expect(_contractData.banner).to.equal("banner");
    expect(_contractData.website).to.equal("https://app.indeliblelabs.io");
    expect(_contractData.royalties).to.equal(500);
    expect(_contractData.royaltiesRecipient).to.equal("0xHirsch");
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
    await contract.toggleMinting();
    await contract.addLayer(0, formatLayer(2));
    await contract.addLayer(1, formatLayer(2));
    await contract.addLayer(2, formatLayer(2));
    await contract.addLayer(3, formatLayer(2));
    await contract.addLayer(4, formatLayer(2));
    await contract.addLayer(5, formatLayer(2));
    await contract.addLayer(6, formatLayer(2));
    await contract.addLayer(7, formatLayer(2));
    await contract.addLayer(8, formatLayer(2));
    await contract.addLayer(9, formatLayer(2));
    await contract.addLayer(10, formatLayer(2));
    await contract.addLayer(11, formatLayer(2));
    await contract.addLayer(12, formatLayer(2));
    await contract.addLayer(13, formatLayer(2));
    await contract.addLayer(14, formatLayer(2));
    const mintPrice = await contract.mintPrice();
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
    await contract.changeBaseURI(newBaseURI);
    await contract.changeRenderOfTokenId(parseInt(eventArg[2].hex), true);
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
