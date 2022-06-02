import { expect } from "chai";
import { ethers } from "hardhat";
import { IndelibleERC721A } from "../typechain";

const formatLayer = (layer: any) =>
  layer.map((trait: any) => {
    const buffer = Buffer.from(trait.data, "base64");
    return {
      name: trait.name,
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
     * assuming 9 traits 2 digits each 9 * 2 = 18 char hash that should always be generated.
     *  */
    expect(recentlyMintedTokenHash.length).to.equal(18);
  });

  it("Should toggle useBaseURI to true", async function () {
    expect(await contract.useBaseURI()).to.equal(false);
    await contract.toggleUseBaseURI();
    expect(await contract.useBaseURI()).to.equal(true);
  });

  it("Should revert add trait when size dont match tier of same index", async function () {
    expect(
      contract.addLayer(0, [
        { name: "example", mimetype: "image/png", data: "test" },
      ])
    ).to.be.revertedWith("Traits size does not much tiers for this index");
  });

  it("Should render correct token URI when layer are uploaded", async function () {
    await contract.toggleMinting();
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
    await contract.addTrait(
      8,
      0,
      formatLayer(require("./layers/8-background.json"))[0]
    );
    expect(await contract.useBaseURI()).to.equal(false);
    const mintPrice = await contract.mintPrice();
    const mintTransaction = await contract.mint(5, {
      value: ethers.utils.parseEther(
        `${(parseInt(mintPrice._hex) / 1000000000000000000) * 5}`
      ),
    });
    const tx = await mintTransaction.wait();
    const events = tx.events;
    const eventArg =
      events && JSON.parse(JSON.stringify(events[events.length - 1].args));

    // ON Chain token URI response
    const tokenRes = await contract.tokenURI(parseInt(eventArg[2].hex));
    const jsonBuffer = Buffer.from(tokenRes.split(",")[1], "base64");
    const onChainJson = jsonBuffer.toString("ascii");

    expect(onChainJson).to.include("name");
    expect(onChainJson).to.include("description");
    expect(onChainJson).to.include("image");
    expect(onChainJson).to.include("attributes");

    // API token URI response
    await contract.toggleUseBaseURI();
    const apiTokenRes = await contract.tokenURI(parseInt(eventArg[2].hex));
    expect(apiTokenRes).to.include("dna");
    const recentlyMintedTokenHash = await contract.tokenIdToHash(
      parseInt(eventArg[2].hex)
    );
    expect(apiTokenRes.split("=")[1]).to.equal(recentlyMintedTokenHash);
  });
});
