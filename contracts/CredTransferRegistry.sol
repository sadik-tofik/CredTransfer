// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CredTransferRegistry
 * @author Jimma University - CredTransfer Team
 * @notice Blockchain registry for academic credential verification
 * @dev Stores SHA-256 document hashes with metadata for immutable verification
 */
contract CredTransferRegistry {
    // ============================================================
    // STATE VARIABLES
    // ============================================================

    address public immutable owner;
    mapping(address => bool) public registrars;
    uint256 public totalDocuments;

    struct DocumentMetadata {
        string graduateId;
        uint256 timestamp;
        string documentType;
        bool exists;
        bool revoked;
        address storedBy;
    }

    mapping(bytes32 => DocumentMetadata) private documents;

    // ============================================================
    // EVENTS
    // ============================================================

    event DocumentHashed(
        bytes32 indexed documentHash,
        string graduateId,
        string documentType,
        address indexed storedBy,
        uint256 timestamp
    );

    event DocumentRevoked(
        bytes32 indexed documentHash,
        address indexed revokedBy,
        uint256 timestamp
    );

    event RegistrarAdded(address indexed registrar, address indexed addedBy);
    event RegistrarRemoved(address indexed registrar, address indexed removedBy);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "CredTransfer: Only owner allowed");
        _;
    }

    modifier onlyRegistrar() {
        require(
            registrars[msg.sender] || msg.sender == owner,
            "CredTransfer: Only authorized registrar allowed"
        );
        _;
    }

    modifier hashExists(bytes32 _documentHash) {
        require(documents[_documentHash].exists, "CredTransfer: Document hash not found");
        _;
    }

    modifier hashNotExists(bytes32 _documentHash) {
        require(!documents[_documentHash].exists, "CredTransfer: Document hash already registered");
        _;
    }

    modifier hashNotRevoked(bytes32 _documentHash) {
        require(!documents[_documentHash].revoked, "CredTransfer: Document has been revoked");
        _;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor() {
        owner = msg.sender;
        registrars[msg.sender] = true;
        emit RegistrarAdded(msg.sender, msg.sender);
    }

    // ============================================================
    // REGISTRAR MANAGEMENT
    // ============================================================

    /**
     * @notice Add a new authorized registrar
     * @param _registrar Address of the new registrar
     */
    function addRegistrar(address _registrar) external onlyOwner {
        require(_registrar != address(0), "CredTransfer: Invalid address");
        require(!registrars[_registrar], "CredTransfer: Already a registrar");
        registrars[_registrar] = true;
        emit RegistrarAdded(_registrar, msg.sender);
    }

    /**
     * @notice Remove an authorized registrar
     * @param _registrar Address of the registrar to remove
     */
    function removeRegistrar(address _registrar) external onlyOwner {
        require(_registrar != owner, "CredTransfer: Cannot remove owner");
        registrars[_registrar] = false;
        emit RegistrarRemoved(_registrar, msg.sender);
    }

    // ============================================================
    // DOCUMENT MANAGEMENT
    // ============================================================

    /**
     * @notice Store a document hash on the blockchain
     * @param _documentHash SHA-256 hash of the document (as bytes32)
     * @param _graduateId University student ID of the graduate
     * @param _documentType Type of document (diploma, transcript, fee_clearance)
     */
    function storeDocumentHash(
        bytes32 _documentHash,
        string calldata _graduateId,
        string calldata _documentType
    ) external onlyRegistrar hashNotExists(_documentHash) {
        require(bytes(_graduateId).length > 0, "CredTransfer: Graduate ID cannot be empty");
        require(bytes(_documentType).length > 0, "CredTransfer: Document type cannot be empty");

        documents[_documentHash] = DocumentMetadata({
            graduateId: _graduateId,
            timestamp: block.timestamp,
            documentType: _documentType,
            exists: true,
            revoked: false,
            storedBy: msg.sender
        });

        totalDocuments++;

        emit DocumentHashed(
            _documentHash,
            _graduateId,
            _documentType,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Revoke a document hash (mark as invalid)
     * @param _documentHash SHA-256 hash of the document to revoke
     */
    function revokeDocumentHash(bytes32 _documentHash)
        external
        onlyRegistrar
        hashExists(_documentHash)
        hashNotRevoked(_documentHash)
    {
        documents[_documentHash].revoked = true;
        emit DocumentRevoked(_documentHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Verify if a document hash is valid
     * @param _documentHash SHA-256 hash to verify
     * @return exists Whether the hash is registered
     * @return revoked Whether the document has been revoked
     * @return graduateId The student ID associated with the document
     * @return timestamp When the hash was stored
     * @return documentType Type of the document
     */
    function verifyDocument(bytes32 _documentHash)
        external
        view
        returns (
            bool exists,
            bool revoked,
            string memory graduateId,
            uint256 timestamp,
            string memory documentType
        )
    {
        DocumentMetadata storage doc = documents[_documentHash];
        return (
            doc.exists,
            doc.revoked,
            doc.graduateId,
            doc.timestamp,
            doc.documentType
        );
    }

    /**
     * @notice Get full document metadata
     * @param _documentHash SHA-256 hash of the document
     */
    function getDocumentMetadata(bytes32 _documentHash)
        external
        view
        returns (DocumentMetadata memory)
    {
        return documents[_documentHash];
    }

    /**
     * @notice Batch verify multiple document hashes
     * @param _hashes Array of document hashes to verify
     * @return results Array of existence status
     * @return revocationStatus Array of revocation status
     */
    function batchVerify(bytes32[] calldata _hashes)
        external
        view
        returns (bool[] memory results, bool[] memory revocationStatus)
    {
        results = new bool[](_hashes.length);
        revocationStatus = new bool[](_hashes.length);

        for (uint256 i = 0; i < _hashes.length; i++) {
            results[i] = documents[_hashes[i]].exists;
            revocationStatus[i] = documents[_hashes[i]].revoked;
        }

        return (results, revocationStatus);
    }
}
