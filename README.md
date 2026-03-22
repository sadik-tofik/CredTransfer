# CredTransfer

[![CredTransfer Logo](https://via.placeholder.com/150x50?text=CredTransfer)](https://your-repo-url)

A blockchain-powered academic credential verification system for Jimma University, ensuring tamper-proof diploma and transcript verification through Ethereum blockchain technology.

## 🚀 Features

- **Blockchain Security**: Immutable document hashes stored on Ethereum
- **Multi-Role Access**: Separate portals for Registrars, Graduates, and Verifiers
- **Instant Verification**: QR code and hash-based verification in under 2 seconds
- **Secure Document Storage**: Encrypted file storage with Supabase
- **Payment Integration**: Chapa payment gateway for transfer requests
- **Email Notifications**: Automated verification and status updates
- **Audit Trail**: Complete logging of all system activities

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Blockchain Integration](#blockchain-integration)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [License](#license)

## 📖 Overview

CredTransfer revolutionizes academic credential verification by leveraging blockchain technology to create an immutable record of academic achievements. The system allows:

1. **Registrars** to upload official documents and store cryptographic hashes on Ethereum
2. **Graduates** to request document transfers to institutions with a nominal fee
3. **Institutions** to instantly verify document authenticity using QR codes or hash codes

### How It Works

1. **Document Upload**: Registrars upload PDFs/transcripts, system computes SHA-256 hash
2. **Blockchain Storage**: Hash is permanently stored on Ethereum blockchain
3. **Graduate Request**: Graduates pay 500 ETB service fee for transfer requests
4. **Verification**: Institutions scan QR code or enter hash code for instant verification

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   Supabase DB   │    │   Ethereum      │
│                 │    │                 │    │   Blockchain    │
│ • React Frontend│    │ • User Auth     │    │ • Smart Contract│
│ • API Routes    │    │ • File Storage  │    │ • Hash Storage  │
│ • Authentication │    │ • Audit Logs   │    │ • Verification  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Telebirr Payment │
                    │   Gateway       │
                    └─────────────────┘
```

## 🛠️ Tech Stack

### Frontend

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: Zustand
- **Form Handling**: React Hook Form with Zod validation

### Backend

- **Runtime**: Node.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Email**: Nodemailer
- **Payments**: Chapa API

### Blockchain

- **Network**: Ethereum
- **Library**: Ethers.js v6
- **Smart Contract**: Solidity (CredTransferRegistry.sol)
- **Hashing**: SHA-256

### Development Tools

- **Package Manager**: pnpm
- **Linting**: ESLint
- **Code Formatting**: Prettier (implied)
- **Testing**: Jest (not configured yet)

## 📋 Prerequisites

Before running this application, make sure you have:

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Supabase** account and project
- **Ethereum** wallet (MetaMask recommended)
- **Chapa** merchant account
- **SMTP** email service (Gmail, SendGrid, etc.)

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/credtransfer.git
   cd credtransfer
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in the required environment variables (see Configuration section).

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the database migrations:
     ```bash
     psql -h your-db-host -U postgres -d postgres -f scripts/database-migrations.sql
     ```
   - Configure storage buckets (see Storage Setup)

5. **Deploy Smart Contract**

   ```bash
   # Compile and deploy to Ethereum network
   npx hardhat compile
   npx hardhat run scripts/deploy.js --network mainnet
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```

The application will be available at `http://localhost:3000`.

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Ethereum
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your-infura-key
ETHEREUM_PRIVATE_KEY=your-private-key
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...

# Chapa Payment
CHAPA_SECRET_KEY=your-chapa-secret
NEXT_PUBLIC_CHAPA_PUBLIC_KEY=your-chapa-public

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# JWT
JWT_SECRET=your-jwt-secret

# Other
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase Setup

1. **Database Tables**: Run `scripts/database-migrations.sql`
2. **Storage Buckets**: Run `scripts/storage-setup.sql`
3. **Authentication**: Configure email templates and auth settings

### Blockchain Setup

1. **Smart Contract**: Deploy `contracts/CredTransferRegistry.sol`
2. **Network**: Configure for Ethereum mainnet/testnet
3. **Gas Fees**: Set appropriate gas limits

## 📖 Usage

### For Registrars

1. **Login** to the Registrar Portal
2. **Upload Documents** for graduates
3. **Approve Transfer Requests**
4. **Generate Reports** and analytics

### For Graduates

1. **Register** and verify email
2. **View Documents** in your dashboard
3. **Request Transfers** to institutions
4. **Make Payments** (500 ETB per request)
5. **Share QR Codes** with receiving institutions

### For Verifiers

1. **Access** the public verification page
2. **Scan QR Code** or enter hash code
3. **Instant Verification** results

## 📡 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/reset-password` - Password reset
- `POST /api/auth/verify-email` - Email verification

### Document Management

- `GET /api/documents` - List documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/[id]` - Get document details
- `DELETE /api/documents/[id]` - Delete document

### Blockchain Operations

- `POST /api/blockchain/store-hash` - Store hash on blockchain
- `GET /api/blockchain/verify-hash` - Verify hash on blockchain
- `GET /api/blockchain/status` - Get blockchain status

### Transfer Requests

- `GET /api/transfers/pending` - Get pending transfers
- `POST /api/transfers/request` - Create transfer request
- `GET /api/transfers/[id]` - Get transfer details

### Payments

- `POST /api/payments/initiate` - Initiate payment
- `POST /api/payments/callback` - Payment callback
- `POST /api/payments/confirm` - Confirm payment

### Public Verification

- `GET /api/verifications/public/[code]` - Verify document by code

## 🗄️ Database Schema

### Core Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  role TEXT CHECK (role IN ('graduate', 'registrar', 'admin')),
  profile JSONB
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  student_id TEXT,
  type TEXT,
  hash TEXT,
  blockchain_tx TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP
);

-- Transfers
CREATE TABLE transfers (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  graduate_id UUID REFERENCES users(id),
  institution TEXT,
  status TEXT DEFAULT 'pending',
  payment_id TEXT,
  created_at TIMESTAMP
);
```

## 🔗 Blockchain Integration

### Smart Contract

The `CredTransferRegistry.sol` contract provides:

- **storeHash()**: Stores document hash with metadata
- **verifyHash()**: Verifies hash existence and validity
- **getDocumentInfo()**: Retrieves document information

### Integration Points

- Document upload triggers hash storage
- Transfer requests generate verification codes
- Public verification checks blockchain records

## 📸 Screenshots

### Landing Page

![Landing Page](screenshots/landing-page.png)
_Description: The main landing page showcasing CredTransfer's features and portals._

### Registrar Dashboard

![Registrar Dashboard](screenshots/registrar-dashboard.png)
_Description: Registrar interface for uploading documents and managing transfers._

### Graduate Portal

![Graduate Portal](screenshots/graduate-portal.png)
_Description: Graduate dashboard for viewing documents and requesting transfers._

### Document Verification

![Document Verification](screenshots/verification-page.png)
_Description: Public verification page for institutions to verify credentials._

### QR Code Verification

![QR Code Verification](screenshots/qr-verification.png)
_Description: Mobile-friendly QR code scanning for instant verification._

### Payment Integration

![Payment Page](screenshots/payment-page.png)
_Description: Secure payment page using Chapa gateway for transfer requests._

### Admin Reports

![Admin Reports](screenshots/admin-reports.png)
_Description: Analytics and reporting dashboard for administrators._

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Commit** your changes: `git commit -m 'Add some feature'`
4. **Push** to the branch: `git push origin feature/your-feature`
5. **Open** a Pull Request

### Development Guidelines

- Use TypeScript for all new code
- Follow ESLint configuration
- Write meaningful commit messages
- Test your changes thoroughly
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email support@credtransfer.edu.et or join our Discord community.

## 🙏 Acknowledgments

- Jimma University for the vision and support
- Ethereum Foundation for blockchain infrastructure
- Supabase for backend services
- Chapa for payment processing

---

**Built with ❤️ for secure academic credential verification**</content>
<parameter name="filePath">/mnt/vm_storage/sanzo/FYP/CredTransfer downloaded/README.md
