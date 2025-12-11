"use client";

import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PoolStats } from "@/components/PoolStats";
import { StakingPanel } from "@/components/StakingPanel";
import { ProtocolStakes } from "@/components/ProtocolStakes";
import { useCurrentAccount } from "@iota/dapp-kit";
import { useAdminCaps } from "@/hooks/useAdmin";

export default function Home() {
  const account = useCurrentAccount();
  const { hasOwnerCap, hasOperatorCap } = useAdminCaps();

  const isAdmin = hasOwnerCap || hasOperatorCap;

  return (
    <div className="min-h-screen relative">
      {/* Animated background */}
      <div className="bg-mesh" />

      {/* Floating particles - Bubbles */}
      <div className="particles">
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
      </div>

      {/* Header */}
      <header className="header-glass">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="logo-container group cursor-pointer">
            <div className="logo-mark">
              <div className="logo-mark-inner">
                <img
                  src="https://api.tokenlabs.network/img/TokenLabsValidatorIcon.png"
                  alt="Tokenlabs"
                />
              </div>
              <div className="logo-status">
                <div className="logo-status-dot" />
              </div>
            </div>
            <div className="logo-text">
              <span className="logo-brand">Tokenlabs</span>
              <span className="logo-tagline">Liquid Stake</span>
            </div>
          </div>

          {/* Right side */}
          <div className="header-actions">
            {/* Network Badge */}
            <div className="network-badge">
              <span className="dot" />
              <span>Testnet</span>
            </div>

            {/* Divider */}
            <div className="header-divider" />

            {/* Admin gear icon */}
            {account && isAdmin && (
              <Link href="/admin" className="admin-btn" title="Admin Settings">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            )}

            <ConnectWallet />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-6 relative">
        {/* Hero Section - Compact */}
        <div className="text-center mb-6 animate-fadeInUp relative">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-2 tracking-tight">
            <span className="text-[var(--text-primary)]">Stake </span>
            <span className="logo-shimmer">IOTA</span>
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-xl mx-auto">
            Earn rewards while maintaining liquidity. Get <span className="text-[var(--accent-secondary)] font-semibold">tIOTA</span> that compounds over time.
          </p>
        </div>

        {/* Pool Stats */}
        <div className="mb-4 animate-fadeInUp stagger-1">
          <PoolStats />
        </div>

        {/* Main Grid: Staking Panel + Protocol Stakes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fadeInUp stagger-2 items-stretch">
          {/* Staking Panel */}
          <div className="min-h-[400px]">
            <StakingPanel />
          </div>

          {/* Protocol Stakes */}
          <div className="min-h-[400px]">
            <ProtocolStakes />
          </div>
        </div>

        {/* Info Section (when not connected) */}
        {!account && (
          <div className="mt-10 animate-fadeInUp stagger-3">
            <div className="glass-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  How It Works
                </h3>
                <div className="flex gap-3">
                  {["Tokenlabs", "DLT.GREEN", "SDVC"].map((name) => (
                    <div key={name} className="stat-chip !py-1.5 !px-3 text-xs">
                      <div className="status-dot !w-1.5 !h-1.5" />
                      <span className="value">{name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {[
                  { step: 1, title: "Connect", desc: "Link wallet" },
                  { step: 2, title: "Choose", desc: "Amount & validators" },
                  { step: 3, title: "Stake", desc: "Get tIOTA" },
                  { step: 4, title: "Earn", desc: "Compound rewards" },
                ].map((item, i) => (
                  <div key={item.step} className="text-center group relative">
                    {i < 3 && (
                      <div className="hidden md:block absolute top-5 left-[70%] w-[60%] h-px bg-gradient-to-r from-[var(--border-glow)] to-transparent" />
                    )}
                    <div className="relative inline-block mb-2">
                      <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center group-hover:border-[var(--border-glow)] transition-all">
                        <span className="font-display font-bold text-[var(--accent-primary)] group-hover:text-[var(--accent-secondary)]">
                          {item.step}
                        </span>
                      </div>
                    </div>
                    <h4 className="font-display font-semibold text-[var(--text-primary)] text-sm">
                      {item.title}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] mt-auto relative z-10 bg-[var(--bg-primary)]/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-[var(--border-subtle)] group-hover:border-[var(--border-glow)] transition-all duration-300 shadow-sm shadow-[var(--glow-soft)]">
                <img
                  src="https://api.tokenlabs.network/img/TokenLabsValidatorIcon.png"
                  alt="Tokenlabs"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[var(--text-secondary)] text-xs font-medium font-display">
                  Tokenlabs Liquid Stake
                </span>
                <span className="text-[var(--text-muted)] text-[10px] mono">
                  v1.0.0
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://tokenlabs.network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-muted)] hover:text-[var(--accent-secondary)] text-xs transition-colors"
              >
                Website
              </a>
              <a
                href="https://x.com/tokenlabsx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-muted)] hover:text-[var(--accent-secondary)] text-xs transition-colors"
              >
                X
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
