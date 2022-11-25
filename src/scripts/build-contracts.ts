import fs from "fs-extra";
import * as generative from "../templates/generative";
import * as oneofone from "../templates/oneofone";

export const TEST_ADDRESS_1 = `0x10ec407c925a95fc2bf145bc671a733d1fba347e`;
export const TEST_ADDRESS_2 = `0x2052051A0474fB0B98283b3F38C13b0B0B6a3677`;
const buildGenerativeContracts = async () => {
  const contractAllowList = generative.generateContract({
    name: "Example & Fren ” 😃", // test special characters and unicode
    tokenSymbol: "EXPL😃",
    mintPrice: "0.005",
    description: 'Example\'s ("Description")',
    maxSupply: 2000,
    layers: [
      { name: "example1😃", tiers: [2000] },
      { name: "example2😃", tiers: [2000] },
      { name: "example3😃", tiers: [2000] },
      { name: "example4😃", tiers: [2000] },
      { name: "example5😃", tiers: [2000] },
      { name: "example6😃", tiers: [2000] },
      { name: "example7😃", tiers: [2000] },
      { name: "example8😃", tiers: [2000] },
      { name: "example9😃", tiers: [2000] },
      { name: "example10😃", tiers: [2000] },
      { name: "example11😃", tiers: [2000] },
      { name: "example12😃", tiers: [2000] },
      { name: "example13😃", tiers: [2000] },
      { name: "example14😃", tiers: [2000] },
      { name: "example15😃", tiers: [2000] },
    ],
    maxPerAddress: 100,
    networkId: 5,
    royalties: 0,
    royaltiesRecipient: "",
    image: "",
    banner: "",
    website: "https://indelible.xyz",
    withdrawRecipients: [
      { name: "test1", imageUrl: "", percentage: 40, address: TEST_ADDRESS_1 },
      { name: "test2", imageUrl: "", percentage: 20, address: TEST_ADDRESS_2 },
    ],
    allowList: {
      maxPerAllowList: 1,
      price: "0",
    },
    contractName: "IndelibleGenerative",
    primeNumbers: [
      "896353651830364561540707634717046743479841853086536248690737",
      "881620940286709375756927686087073151589884188606081093706959",
      "239439210107002209100408342483681304951633794994177274881807",
      "281985178301575220656442477929008459267923613534257332455929",
      "320078828389115961650782679700072873328499789823998523466099",
      "404644724038849848148120945109420144471824163937039418139293",
      "263743197985470588204349265269345001644610514897601719492623",
      "774988306700992475970790762502873362986676222144851638448617",
      "222880340296779472696004625829965490706697301235372335793669",
      "455255148896994205943326626951197024927648464365329800703251",
      "752418160701043808365139710144653623245409393563454484133021",
      "308043264033071943254647080990150144301849302687707544552767",
      "874778160644048956810394214801467472093537087897851981604983",
      "192516593828483755313857340433869706973450072701701194101197",
      "809964495083245361527940381794788695820367981156436813625509",
    ],
  });
  await fs.writeFile(
    "./src/contracts/IndelibleGenerative.sol",
    contractAllowList
  );
};

buildGenerativeContracts();

const buildOneOfOneContracts = async () => {
  const contract = oneofone.generateContract({
    name: "Example & Fren ” 😃", // test special characters and unicode
    tokenSymbol: "EXPL😃",
    mintPrice: "0.005",
    description: 'Example\'s ("Description")',
    maxSupply: 100,
    maxPerAddress: 100,
    networkId: 5,
    royalties: 0,
    royaltiesRecipient: "",
    image: "",
    banner: "",
    website: "https://indelible.xyz",
    contractName: "IndelibleOneOfOne",
  });
  await fs.writeFile("./src/contracts/IndelibleOneOfOne.sol", contract);
};

buildOneOfOneContracts();
