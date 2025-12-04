// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract ZamaFHEPackage is SepoliaConfig {
    struct EncryptedPackageData {
        uint256 id;
        euint32 encryptedName;
        euint32 encryptedVersion;
        euint32 encryptedDescription;
        uint256 timestamp;
    }

    struct DecryptedPackageData {
        string name;
        string version;
        string description;
        bool isRevealed;
    }

    uint256 public packageCount;
    mapping(uint256 => EncryptedPackageData) public encryptedPackages;
    mapping(uint256 => DecryptedPackageData) public decryptedPackages;

    mapping(string => euint32) private encryptedVersionCount;
    string[] private versionList;

    mapping(uint256 => uint256) private requestToPackageId;

    event PackageSubmitted(uint256 indexed id, uint256 timestamp);
    event DecryptionRequested(uint256 indexed id);
    event PackageDecrypted(uint256 indexed id);

    modifier onlyContributor(uint256 packageId) {
        _;
    }

    function submitEncryptedPackage(
        euint32 encryptedName,
        euint32 encryptedVersion,
        euint32 encryptedDescription
    ) public {
        packageCount += 1;
        uint256 newId = packageCount;

        encryptedPackages[newId] = EncryptedPackageData({
            id: newId,
            encryptedName: encryptedName,
            encryptedVersion: encryptedVersion,
            encryptedDescription: encryptedDescription,
            timestamp: block.timestamp
        });

        decryptedPackages[newId] = DecryptedPackageData({
            name: "",
            version: "",
            description: "",
            isRevealed: false
        });

        emit PackageSubmitted(newId, block.timestamp);
    }

    function requestPackageDecryption(uint256 packageId) public onlyContributor(packageId) {
        EncryptedPackageData storage pkg = encryptedPackages[packageId];
        require(!decryptedPackages[packageId].isRevealed, "Already decrypted");

        bytes32[] memory ciphertexts = new bytes32[](3);
        ciphertexts[0] = FHE.toBytes32(pkg.encryptedName);
        ciphertexts[1] = FHE.toBytes32(pkg.encryptedVersion);
        ciphertexts[2] = FHE.toBytes32(pkg.encryptedDescription);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptPackage.selector);
        requestToPackageId[reqId] = packageId;

        emit DecryptionRequested(packageId);
    }

    function decryptPackage(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 packageId = requestToPackageId[requestId];
        require(packageId != 0, "Invalid request");

        EncryptedPackageData storage ePkg = encryptedPackages[packageId];
        DecryptedPackageData storage dPkg = decryptedPackages[packageId];
        require(!dPkg.isRevealed, "Already decrypted");

        FHE.checkSignatures(requestId, cleartexts, proof);

        string[] memory results = abi.decode(cleartexts, (string[]));

        dPkg.name = results[0];
        dPkg.version = results[1];
        dPkg.description = results[2];
        dPkg.isRevealed = true;

        if (!FHE.isInitialized(encryptedVersionCount[dPkg.version])) {
            encryptedVersionCount[dPkg.version] = FHE.asEuint32(0);
            versionList.push(dPkg.version);
        }
        encryptedVersionCount[dPkg.version] = FHE.add(
            encryptedVersionCount[dPkg.version],
            FHE.asEuint32(1)
        );

        emit PackageDecrypted(packageId);
    }

    function getDecryptedPackage(uint256 packageId) public view returns (
        string memory name,
        string memory version,
        string memory description,
        bool isRevealed
    ) {
        DecryptedPackageData storage pkg = decryptedPackages[packageId];
        return (pkg.name, pkg.version, pkg.description, pkg.isRevealed);
    }

    function getEncryptedVersionCount(string memory version) public view returns (euint32) {
        return encryptedVersionCount[version];
    }

    function requestVersionCountDecryption(string memory version) public {
        euint32 count = encryptedVersionCount[version];
        require(FHE.isInitialized(count), "Version not found");

        bytes32[] memory ciphertexts = new bytes32[](1);
        ciphertexts[0] = FHE.toBytes32(count);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptVersionCount.selector);
        requestToPackageId[reqId] = bytes32ToUint(keccak256(abi.encodePacked(version)));
    }

    function decryptVersionCount(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 versionHash = requestToPackageId[requestId];
        string memory version = getVersionFromHash(versionHash);

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 count = abi.decode(cleartexts, (uint32));
    }

    function bytes32ToUint(bytes32 b) private pure returns (uint256) {
        return uint256(b);
    }

    function getVersionFromHash(uint256 hash) private view returns (string memory) {
        for (uint i = 0; i < versionList.length; i++) {
            if (bytes32ToUint(keccak256(abi.encodePacked(versionList[i]))) == hash) {
                return versionList[i];
            }
        }
        revert("Version not found");
    }
}