import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date to human readable
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM dd, yyyy');
}

// Format date with time
export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
}

// Format ETB currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
  }).format(amount);
}

// Truncate blockchain hash for display
export function truncateHash(hash: string, start = 6, end = 4): string {
  if (!hash || hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

// Validate Ethiopian phone number
export function validateEthiopianPhone(phone: string): boolean {
  // Ethiopian phone numbers: +251XXXXXXXXX or 09XXXXXXXX or 07XXXXXXXX
  const cleaned = phone.replace(/\s+/g, '');
  return /^(\+251[79]\d{8}|0[79]\d{8})$/.test(cleaned);
}

// Format phone to international format
export function formatEthiopianPhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('0')) {
    return '+251' + cleaned.slice(1);
  }
  return cleaned;
}

// Get document type label
export function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    diploma: 'Diploma',
    transcript: 'Transcript',
    fee_clearance: 'Fee Clearance Certificate',
    other: 'Other Document',
  };
  return labels[type] || type;
}

// Get status badge color
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'green',
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
    revoked: 'red',
    expired: 'gray',
    completed: 'blue',
    verified: 'green',
    invalid: 'red',
    suspicious: 'yellow',
    processing: 'blue',
    failed: 'red',
    refunded: 'purple',
  };
  return colors[status] || 'gray';
}

// Get file size in human readable format
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Alias for formatFileSize (for compatibility)
export function formatBytes(bytes: number): string {
  return formatFileSize(bytes);
}

// Validate student ID format (JU specific: JU/XXXX/YY)
export function validateStudentId(id: string): boolean {
  return /^JU\/\d{4}\/\d{2,4}$/.test(id);
}

// Generate Etherscan link
export function getEtherscanLink(txHash: string, network = 'sepolia'): string {
  if (network === 'sepolia') {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
  return `https://etherscan.io/tx/${txHash}`;
}

// Capitalize first letter
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Sleep utility for testing
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
