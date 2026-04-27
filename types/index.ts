// ============================================================
// CREDTRANSFER - Core Type Definitions
// ============================================================

export type UserRole = 'graduate' | 'registrar' | 'admin';

export type DocumentType = 'diploma' | 'transcript' | 'fee_clearance' | 'other';

export type DocumentStatus = 'active' | 'revoked' | 'pending' | 'expired';

export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'completed';

export type PaymentMethod = 'chapa' | 'telebirr' | 'bank_transfer' | 'cbe_birr';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export type VerificationResult = 'verified' | 'invalid' | 'suspicious' | 'revoked';

// ============================================================
// USER TYPES
// ============================================================

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Graduate {
  id: string;
  user_id: string;
  student_id: string;
  graduation_year?: number;
  department?: string;
  fee_cleared: boolean;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Registrar {
  id: string;
  user_id: string;
  employee_id: string;
  department?: string;
  permissions: {
    upload: boolean;
    approve: boolean;
    reports: boolean;
    manage_graduates: boolean;
  };
  created_at: string;
  user?: User;
}

// ============================================================
// DOCUMENT TYPES
// ============================================================

export interface Document {
  id: string;
  graduate_id: string;
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  file_hash: string;
  blockchain_tx_hash?: string;
  blockchain_block?: number;
  status: DocumentStatus;
  uploaded_by: string;
  uploaded_at: string;
  expires_at?: string;
  graduate?: Graduate;
  uploader?: User;
}

export interface DocumentWithGraduate extends Document {
  graduate: Graduate & { user: User };
}

// ============================================================
// TRANSFER TYPES
// ============================================================

export interface TransferRequest {
  id: string;
  graduate_id: string;
  document_id: string;
  recipient_institution: string;
  recipient_email?: string;
  payment_status: PaymentStatus;
  payment_id?: string;
  qr_code?: string;
  hash_code?: string;
  status: TransferStatus;
  created_at: string;
  expires_at: string;
  graduate?: Graduate & { user: User };
  document?: Document;
  payment?: Payment;
}

// ============================================================
// PAYMENT TYPES
// ============================================================

export interface Payment {
  id: string;
  graduate_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  transaction_reference?: string;
  status: PaymentStatus;
  paid_at?: string;
  receipt_url?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  graduate?: Graduate & { user: User };
}

export interface PaymentInitiateRequest {
  graduate_id: string;
  document_id: string;
  recipient_institution: string;
  recipient_email?: string;
  payment_method: PaymentMethod;
  amount: number;
}

export interface PaymentInitiateResponse {
  payment_id: string;
  reference: string;
  payment_url?: string;
  bank_details?: BankDetails;
}

export interface BankDetails {
  bank_name: string;
  account_number: string;
  account_name: string;
  reference: string;
  amount: number;
  currency: string;
}

// ============================================================
// VERIFICATION TYPES
// ============================================================

export interface Verification {
  id: string;
  document_id: string;
  verifier_institution?: string;
  verification_code?: string;
  result: VerificationResult;
  verified_at: string;
  ip_address?: string;
}

export interface VerificationResult_Full {
  result: VerificationResult;
  document?: {
    id: string;
    document_type: DocumentType;
    file_name: string;
    file_hash: string;
    uploaded_at: string;
  };
  graduate?: {
    full_name: string;
    student_id: string;
    department?: string;
    graduation_year?: number;
  };
  blockchain?: {
    tx_hash: string;
    block_number: number;
    timestamp: number;
    network: string;
    graduate_id: string;
    document_type: string;
  };
  message: string;
}

// ============================================================
// AUDIT LOG
// ============================================================

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  user?: User;
}

// ============================================================
// BLOCKCHAIN TYPES
// ============================================================

export interface BlockchainDocument {
  exists: boolean;
  revoked: boolean;
  graduateId: string;
  timestamp: bigint;
  documentType: string;
}

export interface BlockchainTxResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  error?: string;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export interface RegistrarStats {
  total_documents: number;
  pending_requests: number;
  approved_today: number;
  total_verifications: number;
  recent_uploads: Document[];
  recent_requests: TransferRequest[];
}

export interface GraduateStats {
  total_documents: number;
  active_transfers: number;
  completed_transfers: number;
  total_verifications: number;
  payment_history: Payment[];
}

// ============================================================
// FORM TYPES
// ============================================================

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone?: string;
  role: UserRole;
  student_id?: string;
  employee_id?: string;
  department?: string;
  graduation_year?: number;
}

export interface DocumentUploadFormData {
  student_id: string;
  document_type: DocumentType;
  file: File;
}

export interface TransferRequestFormData {
  document_id: string;
  recipient_institution: string;
  recipient_email?: string;
  payment_method: PaymentMethod;
}
