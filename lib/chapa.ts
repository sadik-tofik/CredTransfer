import axios from 'axios';

export interface ChapaPaymentRequest {
  amount: string;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  tx_ref: string;
  callback_url: string;
  return_url: string;
  customization?: {
    title?: string;
    description?: string;
    logo?: string;
  };
  meta?: {
    [key: string]: any;
  };
}

export interface ChapaPaymentResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    checkout_url: string;
    tx_ref: string;
    amount: string;
    currency: string;
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    created_at: string;
    updated_at: string;
  };
}

export interface ChapaVerificationResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    status: 'success' | 'pending' | 'failed' | 'cancelled';
    reference: string;
    amount: string;
    currency: string;
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    payment_method: string;
    created_at: string;
    updated_at: string;
    meta?: {
      [key: string]: any;
    };
  };
}

export class ChapaPayment {
  private secretKey: string;
  private publicKey: string;
  private baseUrl: string;

  constructor(secretKey: string, publicKey: string, isTest: boolean = true) {
    this.secretKey = secretKey;
    this.publicKey = publicKey;
    this.baseUrl = isTest ? 'https://api.chapa.co/v1' : 'https://api.chapa.co/v1';
  }

  /**
   * Initialize a payment transaction
   */
  async initializePayment(paymentData: ChapaPaymentRequest): Promise<ChapaPaymentResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/transaction/initialize`, paymentData, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Chapa payment initialization error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to initialize payment');
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyTransaction(tx_ref: string): Promise<ChapaVerificationResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/transaction/verify/${tx_ref}`, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Chapa transaction verification error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to verify transaction');
    }
  }

  /**
   * Create a payment request with default CredTransfer settings
   */
  createPaymentRequest(
    amount: number,
    email: string,
    firstName: string,
    lastName: string,
    txRef: string,
    callbackUrl: string,
    returnUrl: string,
    phoneNumber?: string
  ): ChapaPaymentRequest {
    return {
      amount: amount.toString(),
      currency: 'ETB',
      email,
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber,
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: {
        title: 'CredTransfer Document Transfer',
        description: 'Secure document transfer service fee',
      },
      meta: {
        service: 'credtransfer',
        purpose: 'document_transfer',
      },
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, webhookSecret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }
}

// Create and export Chapa instance
export const chapa = new ChapaPayment(
  process.env.CHAPA_SECRET_KEY!,
  process.env.CHAPA_PUBLIC_KEY!,
  true // Test mode
);
