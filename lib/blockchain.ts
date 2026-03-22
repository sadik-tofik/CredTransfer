import { ethers } from 'ethers';

// Contract ABI (minimal for our use case)
const CONTRACT_ABI = [
  'function storeDocumentHash(bytes32 _documentHash, string memory _graduateId, string memory _documentType) external',
  'function revokeDocumentHash(bytes32 _documentHash) external',
  'function verifyDocument(bytes32 _documentHash) external view returns (bool exists, bool revoked, string memory graduateId, uint256 timestamp, string memory documentType)',
  'function addRegistrar(address _registrar) external',
  'function removeRegistrar(address _registrar) external',
  'function owner() external view returns (address)',
  'function registrars(address) external view returns (bool)',
  'event DocumentHashed(bytes32 indexed documentHash, string graduateId, uint256 timestamp)',
  'event DocumentRevoked(bytes32 indexed documentHash)',
];

let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const rpcUrl = process.env.ETHEREUM_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.era.zksync.dev';
    provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: 300,
      name: 'zkSync-sepolia'
    });
  }
  return provider;
}

function getWallet(): ethers.Wallet {
  if (!wallet) {
    const prov = getProvider();
    const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('ETHEREUM_PRIVATE_KEY not found in environment variables');
    }
    wallet = new ethers.Wallet(privateKey, prov);
  }
  return wallet;
}

function getContract(): ethers.Contract {
  if (!contract) {
    const w = getWallet();
    contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!, CONTRACT_ABI, w);
  }
  return contract;
}

// Read-only contract for verification (doesn't need private key)
function getReadOnlyContract(): ethers.Contract {
  const provider = getProvider();
  return new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!, CONTRACT_ABI, provider);
}

// Convert file hash string to bytes32
export function hashToBytes32(hash: string): string {
  // If already 0x prefixed 64 hex chars, use as-is
  if (hash.startsWith('0x') && hash.length === 66) return hash;
  // Otherwise treat as hex string
  const cleanHash = hash.startsWith('0x') ? hash.slice(2) : hash;
  return '0x' + cleanHash.padStart(64, '0');
}

// Store document hash on blockchain with retry logic
export async function storeDocumentHash(
  documentHash: string,
  graduateId: string,
  documentType: string
): Promise<{ success: boolean; txHash?: string; blockNumber?: number; error?: string }> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const c = getContract();
      const bytes32Hash = hashToBytes32(documentHash);

      // Estimate gas
      const gasEstimate = await c.storeDocumentHash.estimateGas(bytes32Hash, graduateId, documentType);
      const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100); // 20% buffer

      const tx = await c.storeDocumentHash(bytes32Hash, graduateId, documentType, {
        gasLimit,
      });

      const receipt = await tx.wait(1); // Wait for 1 confirmation

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      lastError = error as Error;
      console.error(`Blockchain attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Failed to store document hash on blockchain',
  };
}

// Verify document on blockchain
export async function verifyDocumentOnChain(documentHash: string): Promise<{
  exists: boolean;
  revoked: boolean;
  graduateId: string;
  timestamp: number;
  documentType: string;
} | null> {
  try {
    const c = getReadOnlyContract(); // Use read-only contract
    const bytes32Hash = hashToBytes32(documentHash);

    const [exists, revoked, graduateId, timestamp, documentType] = await c.verifyDocument(bytes32Hash);

    return {
      exists,
      revoked,
      graduateId,
      timestamp: Number(timestamp),
      documentType,
    };
  } catch (error) {
    console.error('Blockchain verification error:', error);
    return null;
  }
}

// Revoke document hash on blockchain
export async function revokeDocumentHash(
  documentHash: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const c = getContract();
    const bytes32Hash = hashToBytes32(documentHash);

    const gasEstimate = await c.revokeDocumentHash.estimateGas(bytes32Hash);
    const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);

    const tx = await c.revokeDocumentHash(bytes32Hash, { gasLimit });
    const receipt = await tx.wait(1);

    return { success: true, txHash: receipt.hash };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Get wallet balance (for monitoring)
export async function getWalletBalance(): Promise<string> {
  try {
    const w = getWallet();
    const balance = await w.provider!.getBalance(w.address);
    return ethers.formatEther(balance);
  } catch {
    return '0';
  }
}

// Check network status
export async function getNetworkStatus(): Promise<{
  connected: boolean;
  network?: string;
  blockNumber?: number;
}> {
  try {
    const prov = getProvider();
    const network = await prov.getNetwork();
    const blockNumber = await prov.getBlockNumber();

    return {
      connected: true,
      network: network.name,
      blockNumber,
    };
  } catch {
    return { connected: false };
  }
}
