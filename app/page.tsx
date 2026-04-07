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
        <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-8 leading-tight">
          Secure Academic{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            Credential Verification
          </span>
        </h2>
        <p className="text-2xl md:text-3xl text-white/70 max-w-4xl mx-auto mb-12 leading-relaxed">
          Jimma University&apos;s blockchain-powered system for immutable diploma and transcript
          verification. Trusted by graduates, employers, and institutions across Ethiopia.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link href="/verify">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 text-xl w-full sm:w-auto h-16">
              Verify a Document
            </Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-12 py-6 text-xl w-full sm:w-auto h-16">
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
            <Card key={stat.label} className="bg-white/5 border-white/10 text-center py-8">
              <CardContent className="p-0">
                <p className="text-4xl md:text-5xl font-bold text-blue-400">{stat.value}</p>
                <p className="text-white/70 text-base mt-2">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
          How CredTransfer Works
        </h3>
        <div className="grid md:grid-cols-3 gap-10">
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
            <Card key={feature.step} className="bg-white/5 border-white/10 p-8">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-5xl">{feature.icon}</span>
                  <Badge variant="outline" className="text-blue-400 border-blue-700 px-3 py-2 text-base">
                    Step {feature.step}
                  </Badge>
                </div>
                <h4 className="text-white font-bold text-xl mb-3">{feature.title}</h4>
                <p className="text-white/70 text-base leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Portals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">Access Your Portal</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50 p-10 text-center">
            <CardContent className="p-0">
              <div className="text-6xl md:text-7xl mb-6">🏛️</div>
              <h4 className="text-white font-bold text-2xl mb-3">Registrar Portal</h4>
              <p className="text-blue-200/80 text-base mb-8 leading-relaxed">Upload documents, manage graduates, approve transfer requests, generate reports</p>
              <Link href="/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 py-4 text-lg">Registrar Login</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50 p-10 text-center">
            <CardContent className="p-0">
              <div className="text-6xl md:text-7xl mb-6">🎓</div>
              <h4 className="text-white font-bold text-2xl mb-3">Graduate Portal</h4>
              <p className="text-green-200/80 text-base mb-8 leading-relaxed">View your documents, request transfers, make payments, track sharing history</p>
              <Link href="/login">
                <Button className="w-full bg-green-600 hover:bg-green-700 py-4 text-lg">Graduate Login</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700/50 p-10 text-center">
            <CardContent className="p-0">
              <div className="text-6xl md:text-7xl mb-6">🔍</div>
              <h4 className="text-white font-bold text-2xl mb-3">Verification Portal</h4>
              <p className="text-purple-200/80 text-base mb-8 leading-relaxed">Verify any credential instantly using QR code or hash code. No login required.</p>
              <Link href="/verify">
                <Button className="w-full bg-purple-600 hover:bg-purple-700 py-4 text-lg">Verify Now</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Security */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10">
        <div className="text-center mb-12">
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">Enterprise-Grade Security</h3>
          <p className="text-white/60 text-lg">Your credentials are protected by multiple layers of security</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: '⛓️', title: 'Blockchain Immutability', desc: 'Records cannot be altered' },
            { icon: '🔐', title: 'SHA-256 Hashing', desc: 'Cryptographic document fingerprint' },
            { icon: '🛡️', title: 'Role-Based Access', desc: 'Strict permission controls' },
            { icon: '📋', title: 'Audit Trail', desc: 'Every action logged' },
          ].map((item) => (
            <div key={item.title} className="text-center p-6">
              <div className="text-4xl md:text-5xl mb-3">{item.icon}</div>
              <h5 className="text-white font-semibold text-lg mb-2">{item.title}</h5>
              <p className="text-white/50 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">CT</div>
            <span className="text-white/70 text-base">© {new Date().getFullYear()} Jimma University CredTransfer</span>
          </div>
          <div className="flex gap-8">
            <Link href="/verify" className="text-white/50 hover:text-white/80 text-base transition-colors">Verify</Link>
            <Link href="/login" className="text-white/50 hover:text-white/80 text-base transition-colors">Login</Link>
            <Link href="/register" className="text-white/50 hover:text-white/80 text-base transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
