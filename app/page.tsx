import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-lg">
              CT
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">CredTransfer</h1>
              <p className="text-blue-300 text-xs">Jimma University</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/verify" className="text-white/70 hover:text-white text-sm transition-colors">
              Verify Document
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                Register
              </Button>
            </Link>
          </nav>
          <div className="md:hidden flex gap-2">
            <Link href="/login">
              <Button size="sm" variant="outline" className="border-white/30 text-white text-xs">Login</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <Badge className="bg-blue-900/50 text-blue-300 border-blue-700 mb-6">
          Powered by Ethereum Blockchain
        </Badge>
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Secure Academic{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            Credential Verification
          </span>
        </h2>
        <p className="text-xl text-white/60 max-w-3xl mx-auto mb-10">
          Jimma University&apos;s blockchain-powered system for immutable diploma and transcript
          verification. Trusted by graduates, employers, and institutions across Ethiopia.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/verify">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg w-full sm:w-auto">
              Verify a Document
            </Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg w-full sm:w-auto">
              Graduate Portal
            </Button>
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: '40,000+', label: 'Graduates' },
            { value: '100%', label: 'Tamper-proof' },
            { value: '<2s', label: 'Verify Time' },
            { value: 'Free', label: 'Verification' },
          ].map((stat) => (
            <Card key={stat.label} className="bg-white/5 border-white/10 text-center py-6">
              <CardContent className="p-0">
                <p className="text-3xl font-bold text-blue-400">{stat.value}</p>
                <p className="text-white/60 text-sm mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-2xl font-bold text-white text-center mb-12">
          How CredTransfer Works
        </h3>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Registrar Uploads',
              description: 'Academic registrars upload official documents. SHA-256 hash is computed and stored permanently on Ethereum blockchain.',
              icon: '📄',
            },
            {
              step: '02',
              title: 'Graduate Shares',
              description: 'Graduates request document transfer to institutions. Receive unique QR code and hash code after 500 ETB service fee.',
              icon: '🔗',
            },
            {
              step: '03',
              title: 'Instant Verification',
              description: 'Receiving institutions verify authenticity instantly by scanning QR code or entering hash code. Blockchain confirms in seconds.',
              icon: '✅',
            },
          ].map((feature) => (
            <Card key={feature.step} className="bg-white/5 border-white/10 p-6">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{feature.icon}</span>
                  <Badge variant="outline" className="text-blue-400 border-blue-700">
                    Step {feature.step}
                  </Badge>
                </div>
                <h4 className="text-white font-semibold text-lg mb-2">{feature.title}</h4>
                <p className="text-white/60 text-sm leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Portals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-2xl font-bold text-white text-center mb-12">Access Your Portal</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50 p-8 text-center">
            <CardContent className="p-0">
              <div className="text-5xl mb-4">🏛️</div>
              <h4 className="text-white font-bold text-xl mb-2">Registrar Portal</h4>
              <p className="text-blue-200/70 text-sm mb-6">Upload documents, manage graduates, approve transfer requests, generate reports</p>
              <Link href="/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">Registrar Login</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50 p-8 text-center">
            <CardContent className="p-0">
              <div className="text-5xl mb-4">🎓</div>
              <h4 className="text-white font-bold text-xl mb-2">Graduate Portal</h4>
              <p className="text-green-200/70 text-sm mb-6">View your documents, request transfers, make payments, track sharing history</p>
              <Link href="/login">
                <Button className="w-full bg-green-600 hover:bg-green-700">Graduate Login</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700/50 p-8 text-center">
            <CardContent className="p-0">
              <div className="text-5xl mb-4">🔍</div>
              <h4 className="text-white font-bold text-xl mb-2">Verification Portal</h4>
              <p className="text-purple-200/70 text-sm mb-6">Verify any credential instantly using QR code or hash code. No login required.</p>
              <Link href="/verify">
                <Button className="w-full bg-purple-600 hover:bg-purple-700">Verify Now</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Security */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10">
        <div className="text-center mb-10">
          <h3 className="text-2xl font-bold text-white mb-2">Enterprise-Grade Security</h3>
          <p className="text-white/50">Your credentials are protected by multiple layers of security</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: '⛓️', title: 'Blockchain Immutability', desc: 'Records cannot be altered' },
            { icon: '🔐', title: 'SHA-256 Hashing', desc: 'Cryptographic document fingerprint' },
            { icon: '🛡️', title: 'Role-Based Access', desc: 'Strict permission controls' },
            { icon: '📋', title: 'Audit Trail', desc: 'Every action logged' },
          ].map((item) => (
            <div key={item.title} className="text-center p-4">
              <div className="text-3xl mb-2">{item.icon}</div>
              <h5 className="text-white font-medium text-sm mb-1">{item.title}</h5>
              <p className="text-white/40 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">CT</div>
            <span className="text-white/60 text-sm">© {new Date().getFullYear()} Jimma University CredTransfer</span>
          </div>
          <div className="flex gap-6">
            <Link href="/verify" className="text-white/40 hover:text-white/70 text-sm transition-colors">Verify</Link>
            <Link href="/login" className="text-white/40 hover:text-white/70 text-sm transition-colors">Login</Link>
            <Link href="/register" className="text-white/40 hover:text-white/70 text-sm transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
