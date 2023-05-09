/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { ethers } from "ethers";
import {
  FactoryOptions,
  HardhatEthersHelpers as HardhatEthersHelpersBase,
} from "@nomiclabs/hardhat-ethers/types";

import * as Contracts from ".";

declare module "hardhat/types/runtime" {
  interface HardhatEthersHelpers extends HardhatEthersHelpersBase {
    getContractFactory(
      name: "OwnableUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.OwnableUpgradeable__factory>;
    getContractFactory(
      name: "IERC2981Upgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC2981Upgradeable__factory>;
    getContractFactory(
      name: "Initializable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.Initializable__factory>;
    getContractFactory(
      name: "ReentrancyGuardUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ReentrancyGuardUpgradeable__factory>;
    getContractFactory(
      name: "ERC2981Upgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC2981Upgradeable__factory>;
    getContractFactory(
      name: "ContextUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ContextUpgradeable__factory>;
    getContractFactory(
      name: "ERC165Upgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC165Upgradeable__factory>;
    getContractFactory(
      name: "IERC165Upgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC165Upgradeable__factory>;
    getContractFactory(
      name: "AccessControl",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.AccessControl__factory>;
    getContractFactory(
      name: "IAccessControl",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IAccessControl__factory>;
    getContractFactory(
      name: "Ownable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.Ownable__factory>;
    getContractFactory(
      name: "ERC1155",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC1155__factory>;
    getContractFactory(
      name: "IERC1155MetadataURI",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC1155MetadataURI__factory>;
    getContractFactory(
      name: "IERC1155",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC1155__factory>;
    getContractFactory(
      name: "IERC1155Receiver",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC1155Receiver__factory>;
    getContractFactory(
      name: "ERC721",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC721__factory>;
    getContractFactory(
      name: "IERC721Metadata",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC721Metadata__factory>;
    getContractFactory(
      name: "IERC721",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC721__factory>;
    getContractFactory(
      name: "IERC721Receiver",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC721Receiver__factory>;
    getContractFactory(
      name: "ERC165",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC165__factory>;
    getContractFactory(
      name: "IERC165",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC165__factory>;
    getContractFactory(
      name: "ERC1155X",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC1155X__factory>;
    getContractFactory(
      name: "ERC721AX",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC721AX__factory>;
    getContractFactory(
      name: "ERC721X",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC721X__factory>;
    getContractFactory(
      name: "IndelibleDrop",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IndelibleDrop__factory>;
    getContractFactory(
      name: "IndelibleFactory",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IndelibleFactory__factory>;
    getContractFactory(
      name: "IndelibleGenerative",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IndelibleGenerative__factory>;
    getContractFactory(
      name: "IIndeliblePro",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IIndeliblePro__factory>;
    getContractFactory(
      name: "Bytecode",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.Bytecode__factory>;
    getContractFactory(
      name: "IndelibleContract",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IndelibleContract__factory>;
    getContractFactory(
      name: "TestMinterContract",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.TestMinterContract__factory>;
    getContractFactory(
      name: "ERC721AIERC721ReceiverUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC721AIERC721ReceiverUpgradeable__factory>;
    getContractFactory(
      name: "ERC721AUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC721AUpgradeable__factory>;
    getContractFactory(
      name: "ERC721AQueryableUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC721AQueryableUpgradeable__factory>;
    getContractFactory(
      name: "IERC721AQueryableUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC721AQueryableUpgradeable__factory>;
    getContractFactory(
      name: "IERC721AUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC721AUpgradeable__factory>;
    getContractFactory(
      name: "ERC721AIERC721Receiver",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC721AIERC721Receiver__factory>;
    getContractFactory(
      name: "ERC721A",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC721A__factory>;
    getContractFactory(
      name: "IERC721A",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC721A__factory>;
    getContractFactory(
      name: "DefaultOperatorFilterer",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.DefaultOperatorFilterer__factory>;
    getContractFactory(
      name: "IOperatorFilterRegistry",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IOperatorFilterRegistry__factory>;
    getContractFactory(
      name: "OperatorFilterer",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.OperatorFilterer__factory>;
    getContractFactory(
      name: "OperatorFiltererUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.OperatorFiltererUpgradeable__factory>;
    getContractFactory(
      name: "SSTORE2",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.SSTORE2__factory>;

    getContractAt(
      name: "OwnableUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.OwnableUpgradeable>;
    getContractAt(
      name: "IERC2981Upgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC2981Upgradeable>;
    getContractAt(
      name: "Initializable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.Initializable>;
    getContractAt(
      name: "ReentrancyGuardUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ReentrancyGuardUpgradeable>;
    getContractAt(
      name: "ERC2981Upgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC2981Upgradeable>;
    getContractAt(
      name: "ContextUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ContextUpgradeable>;
    getContractAt(
      name: "ERC165Upgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC165Upgradeable>;
    getContractAt(
      name: "IERC165Upgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC165Upgradeable>;
    getContractAt(
      name: "AccessControl",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.AccessControl>;
    getContractAt(
      name: "IAccessControl",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IAccessControl>;
    getContractAt(
      name: "Ownable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.Ownable>;
    getContractAt(
      name: "ERC1155",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC1155>;
    getContractAt(
      name: "IERC1155MetadataURI",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC1155MetadataURI>;
    getContractAt(
      name: "IERC1155",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC1155>;
    getContractAt(
      name: "IERC1155Receiver",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC1155Receiver>;
    getContractAt(
      name: "ERC721",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC721>;
    getContractAt(
      name: "IERC721Metadata",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC721Metadata>;
    getContractAt(
      name: "IERC721",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC721>;
    getContractAt(
      name: "IERC721Receiver",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC721Receiver>;
    getContractAt(
      name: "ERC165",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC165>;
    getContractAt(
      name: "IERC165",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC165>;
    getContractAt(
      name: "ERC1155X",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC1155X>;
    getContractAt(
      name: "ERC721AX",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC721AX>;
    getContractAt(
      name: "ERC721X",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC721X>;
    getContractAt(
      name: "IndelibleDrop",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IndelibleDrop>;
    getContractAt(
      name: "IndelibleFactory",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IndelibleFactory>;
    getContractAt(
      name: "IndelibleGenerative",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IndelibleGenerative>;
    getContractAt(
      name: "IIndeliblePro",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IIndeliblePro>;
    getContractAt(
      name: "Bytecode",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.Bytecode>;
    getContractAt(
      name: "IndelibleContract",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IndelibleContract>;
    getContractAt(
      name: "TestMinterContract",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.TestMinterContract>;
    getContractAt(
      name: "ERC721AIERC721ReceiverUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC721AIERC721ReceiverUpgradeable>;
    getContractAt(
      name: "ERC721AUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC721AUpgradeable>;
    getContractAt(
      name: "ERC721AQueryableUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC721AQueryableUpgradeable>;
    getContractAt(
      name: "IERC721AQueryableUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC721AQueryableUpgradeable>;
    getContractAt(
      name: "IERC721AUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC721AUpgradeable>;
    getContractAt(
      name: "ERC721AIERC721Receiver",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC721AIERC721Receiver>;
    getContractAt(
      name: "ERC721A",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC721A>;
    getContractAt(
      name: "IERC721A",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC721A>;
    getContractAt(
      name: "DefaultOperatorFilterer",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.DefaultOperatorFilterer>;
    getContractAt(
      name: "IOperatorFilterRegistry",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IOperatorFilterRegistry>;
    getContractAt(
      name: "OperatorFilterer",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.OperatorFilterer>;
    getContractAt(
      name: "OperatorFiltererUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.OperatorFiltererUpgradeable>;
    getContractAt(
      name: "SSTORE2",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.SSTORE2>;

    // default types
    getContractFactory(
      name: string,
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<ethers.ContractFactory>;
    getContractFactory(
      abi: any[],
      bytecode: ethers.utils.BytesLike,
      signer?: ethers.Signer
    ): Promise<ethers.ContractFactory>;
    getContractAt(
      nameOrAbi: string | any[],
      address: string,
      signer?: ethers.Signer
    ): Promise<ethers.Contract>;
  }
}
