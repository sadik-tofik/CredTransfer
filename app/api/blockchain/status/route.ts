import { NextResponse } from 'next/server';
import { getNetworkStatus, getWalletBalance } from '@/lib/blockchain';

export async function GET() {
  try {
    const [networkStatus, balance] = await Promise.all([
      getNetworkStatus(),
      getWalletBalance(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...networkStatus,
        wallet_balance_eth: balance,
        contract_address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
        network: process.env.NEXT_PUBLIC_ETHEREUM_NETWORK || 'sepolia',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Blockchain service unavailable' }, { status: 503 });
  }
}
