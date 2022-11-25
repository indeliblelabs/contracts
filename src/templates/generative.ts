import { ethers } from "ethers";
import { sanitizeString } from "../utils";

interface ContractBuilderProps {
  name: string;
  tokenSymbol: string;
  mintPrice: string;
  description: string;
  maxSupply: number;
  layers: { name: string; tiers: number[] }[];
  maxPerAddress: number;
  royalties: number;
  royaltiesRecipient: string;
  image: string;
  banner: string;
  website: string;
  withdrawRecipients?: {
    name?: string;
    imageUrl?: string;
    percentage: number;
    address: string;
  }[];
  allowList?: {
    price: string;
    maxPerAllowList: number;
    merkleRoot?: number;
  };
  contractName?: string;
  backgroundColor?: string;
  primeNumbers: string[];
  networkId?: number;
}

export const generateContract = ({
  name,
  tokenSymbol,
  mintPrice,
  description,
  maxSupply,
  layers,
  maxPerAddress,
  royalties,
  royaltiesRecipient,
  image,
  banner,
  website,
  allowList,
  withdrawRecipients = [],
  contractName = "Indelible",
  primeNumbers = [],
  networkId,
}: ContractBuilderProps) => `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.13;

    import "./IndelibleERC721A.sol";

    contract ${contractName} is IndelibleERC721A {
        constructor() IndelibleERC721A(
            unicode"${sanitizeString(name)}",
            unicode"${sanitizeString(tokenSymbol)}"
        ) {
            ${layers
              .map((layer) => {
                return `tiers.push([${layer.tiers}]);`;
              })
              .join("\n")}
            layerNames = [${layers
              .map((layer) => `unicode"${sanitizeString(layer.name)}"`)
              .join(", ")}];
            primeNumbers = [
                ${primeNumbers
                  .map((primeNumber) => {
                    return primeNumber;
                  })
                  .join(",\n")}
            ];
            ${
              withdrawRecipients.length > 0
                ? withdrawRecipients
                    .map((recipient) => {
                      const {
                        name = "",
                        imageUrl = "",
                        address,
                        percentage,
                      } = recipient;
                      const recipientAddress = ethers.utils.getAddress(address);
                      return `withdrawRecipients.push(WithdrawRecipient(unicode"${name}",unicode"${imageUrl}", ${recipientAddress}, ${
                        percentage * 100
                      }));`;
                    })
                    .join("\n")
                : ""
            }
          maxSupply = ${maxSupply};
          maxPerAddress = ${maxPerAddress};
          publicMintPrice = ${mintPrice} ether;
          merkleRoot = ${allowList?.merkleRoot || 0};
          allowListPrice = ${allowList?.price || 0} ether;
          maxPerAllowList = ${allowList?.maxPerAllowList || 0};
          networkId = ${networkId || 1};
          contractData = ContractData(unicode"${sanitizeString(
            name
          )}", unicode"${sanitizeString(
  description
)}", "${image}", "${banner}", "${website}", ${royalties}, "${royaltiesRecipient}");
        }
    }
`;
