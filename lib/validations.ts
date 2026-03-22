import { z } from 'zod';

// Auth validations
export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z
  .object({
    full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirm_password: z.string(),
    phone: z
      .string()
      .optional()
      .refine((val) => !val || /^(\+251[79]\d{8}|0[79]\d{8})$/.test(val.replace(/\s/g, '')), {
        message: 'Invalid Ethiopian phone number',
      }),
    role: z.enum(['graduate', 'registrar']),
    student_id: z.string().optional(),
    employee_id: z.string().optional(),
    department: z.string().optional(),
    graduation_year: z.number().int().min(1990).max(new Date().getFullYear()).optional(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .refine(
    (data) => {
      if (data.role === 'graduate') return !!data.student_id;
      return true;
    },
    { message: 'Student ID is required for graduates', path: ['student_id'] }
  )
  .refine(
    (data) => {
      if (data.role === 'registrar') return !!data.employee_id;
      return true;
    },
    { message: 'Employee ID is required for registrars', path: ['employee_id'] }
  );

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const newPasswordSchema = z
  .object({
    token: z.string(),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[0-9]/),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

// Document validations
export const documentUploadSchema = z.object({
  student_id: z.string().min(1, 'Student ID is required'),
  document_type: z.enum(['diploma', 'transcript', 'fee_clearance', 'other']),
});

export const transferRequestSchema = z.object({
  document_id: z.string().min(1, 'Please select a document'),
  recipient_institution: z.string().min(2, 'Institution name must be at least 2 characters').max(255, 'Institution name is too long'),
  recipient_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  payment_method: z.enum(['telebirr', 'bank_transfer', 'cbe_birr']).refine((val) => ['telebirr', 'bank_transfer', 'cbe_birr'].includes(val), {
    message: 'Please select a payment method'
  }),
}).refine((data) => {
  // Additional validation to ensure recipient_institution is not just whitespace
  return data.recipient_institution && data.recipient_institution.trim().length > 0;
}, {
  message: 'Institution name is required',
  path: ['recipient_institution']
});

export const paymentInitiateSchema = z.object({
  graduate_id: z.string().uuid(),
  document_id: z.string().uuid(),
  recipient_institution: z.string().min(2),
  recipient_email: z.string().email().optional(),
  payment_method: z.enum(['telebirr', 'bank_transfer', 'cbe_birr']),
  amount: z.number().positive(),
});

export const verificationSchema = z.object({
  code: z.string().min(1, 'Verification code is required'),
  verifier_institution: z.string().optional(),
});

export const graduateSearchSchema = z.object({
  student_id: z.string().optional(),
  name: z.string().optional(),
  department: z.string().optional(),
  graduation_year: z.number().optional(),
});

export const reportSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  type: z.enum(['daily', 'payments', 'verifications', 'transfers']),
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type DocumentUploadFormData = z.infer<typeof documentUploadSchema>;
export type TransferRequestFormData = z.infer<typeof transferRequestSchema>;
export type VerificationFormData = z.infer<typeof verificationSchema>;
