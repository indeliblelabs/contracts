
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.13;

    import "./IndelibleERC721A.sol";

    contract IndelibleGenerative is IndelibleERC721A {
        constructor() IndelibleERC721A(
            unicode"Example & Fren ” 😃",
            unicode"EXPL😃"
        ) {
            tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
tiers.push([2000]);
            layerNames = [unicode"example1😃", unicode"example2😃", unicode"example3😃", unicode"example4😃", unicode"example5😃", unicode"example6😃", unicode"example7😃", unicode"example8😃", unicode"example9😃", unicode"example10😃", unicode"example11😃", unicode"example12😃", unicode"example13😃", unicode"example14😃", unicode"example15😃"];
            primeNumbers = [
                896353651830364561540707634717046743479841853086536248690737,
881620940286709375756927686087073151589884188606081093706959,
239439210107002209100408342483681304951633794994177274881807,
281985178301575220656442477929008459267923613534257332455929,
320078828389115961650782679700072873328499789823998523466099,
404644724038849848148120945109420144471824163937039418139293,
263743197985470588204349265269345001644610514897601719492623,
774988306700992475970790762502873362986676222144851638448617,
222880340296779472696004625829965490706697301235372335793669,
455255148896994205943326626951197024927648464365329800703251,
752418160701043808365139710144653623245409393563454484133021,
308043264033071943254647080990150144301849302687707544552767,
874778160644048956810394214801467472093537087897851981604983,
192516593828483755313857340433869706973450072701701194101197,
809964495083245361527940381794788695820367981156436813625509
            ];
            withdrawRecipients.push(WithdrawRecipient(unicode"test1",unicode"", 0x10EC407c925A95FC2Bf145Bc671A733D1fBa347E, 4000));
withdrawRecipients.push(WithdrawRecipient(unicode"test2",unicode"", 0x2052051A0474fB0B98283b3F38C13b0B0B6a3677, 2000));
          maxSupply = 2000;
          maxPerAddress = 100;
          publicMintPrice = 0.005 ether;
          merkleRoot = 0;
          allowListPrice = 0 ether;
          maxPerAllowList = 1;
          networkId = 5;
          contractData = ContractData(unicode"Example & Fren ” 😃", unicode"Example's (\"Description\")", "", "", "https://indelible.xyz", 0, "");
        }
    }
