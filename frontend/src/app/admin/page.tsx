"use client";

import Link from "next/link";
import { useCurrentAccount } from "@iota/dapp-kit";
import { useAdminCaps } from "@/hooks/useAdmin";
import { AdminPanel } from "@/components/AdminPanel";
import { ConnectWallet } from "@/components/ConnectWallet";

export default function AdminPage() {
  const account = useCurrentAccount();
  const { hasOwnerCap, hasOperatorCap, isLoading } = useAdminCaps();

  const isAdmin = hasOwnerCap || hasOperatorCap;

  if (isLoading) {
    return (
      <div className="min-h-screen relative">
        <div className="bg-mesh" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-[var(--text-muted)]">Loading...</div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen relative">
        <div className="bg-mesh" />
        <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-[var(--accent-glow)] border border-[var(--border-subtle)]">
                <img
                  src="https://api.tokenlabs.network/img/TokenLabsValidatorIcon.png"
                  alt="Tokenlabs"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Tokenlabs</h1>
                <p className="text-xs text-[var(--text-muted)] tracking-wider uppercase">Liquid Stake</p>
              </div>
            </Link>
            <ConnectWallet />
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-12">
          <div className="glass-card p-8 text-center">
            <p className="text-[var(--text-muted)]">Connect your wallet to access admin settings</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen relative">
        <div className="bg-mesh" />
        <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-[var(--accent-glow)] border border-[var(--border-subtle)]">
                <img
                  src="https://api.tokenlabs.network/img/TokenLabsValidatorIcon.png"
                  alt="Tokenlabs"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Tokenlabs</h1>
                <p className="text-xs text-[var(--text-muted)] tracking-wider uppercase">Liquid Stake</p>
              </div>
            </Link>
            <ConnectWallet />
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-12">
          <div className="glass-card p-8 border-red-500/30 text-center">
            <p className="text-red-400">Access denied. You don't have admin privileges.</p>
            <Link href="/" className="inline-block mt-4 text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors">
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="bg-mesh" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-[var(--border-subtle)]">
                <img
                  src="https://api.tokenlabs.network/img/TokenLabsValidatorIcon.png"
                  alt="Tokenlabs"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[var(--text-primary)] font-semibold">Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="stat-chip text-sm">
              <span className="status-dot !w-2 !h-2" />
              <span className="value">Admin</span>
            </span>
            <ConnectWallet />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <AdminPanel />
      </main>
    </div>
  );
}
