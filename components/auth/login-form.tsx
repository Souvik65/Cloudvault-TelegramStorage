'use client';

import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuthStore } from '@/store/use-auth-store';
import { toast } from 'sonner';
import {
  Phone, KeyRound, Lock, ChevronDown,
  Search, Eye, EyeOff, ArrowLeft, CheckCircle2, Loader2, Shield,
} from 'lucide-react';
import Image from 'next/image';

// ─── Country Data ──────────────────────────────────────────────────────────────

interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', dialCode: '93', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', dialCode: '355', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', dialCode: '213', flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina', dialCode: '54', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', dialCode: '374', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', dialCode: '61', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', dialCode: '43', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan', dialCode: '994', flag: '🇦🇿' },
  { code: 'BH', name: 'Bahrain', dialCode: '973', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh', dialCode: '880', flag: '🇧🇩' },
  { code: 'BY', name: 'Belarus', dialCode: '375', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium', dialCode: '32', flag: '🇧🇪' },
  { code: 'BZ', name: 'Belize', dialCode: '501', flag: '🇧🇿' },
  { code: 'BO', name: 'Bolivia', dialCode: '591', flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia & Herzegovina', dialCode: '387', flag: '🇧🇦' },
  { code: 'BR', name: 'Brazil', dialCode: '55', flag: '🇧🇷' },
  { code: 'BG', name: 'Bulgaria', dialCode: '359', flag: '🇧🇬' },
  { code: 'CA', name: 'Canada', dialCode: '1', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', dialCode: '56', flag: '🇨🇱' },
  { code: 'CN', name: 'China', dialCode: '86', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', dialCode: '57', flag: '🇨🇴' },
  { code: 'HR', name: 'Croatia', dialCode: '385', flag: '🇭🇷' },
  { code: 'CZ', name: 'Czech Republic', dialCode: '420', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', dialCode: '45', flag: '🇩🇰' },
  { code: 'EC', name: 'Ecuador', dialCode: '593', flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt', dialCode: '20', flag: '🇪🇬' },
  { code: 'ET', name: 'Ethiopia', dialCode: '251', flag: '🇪🇹' },
  { code: 'FI', name: 'Finland', dialCode: '358', flag: '🇫🇮' },
  { code: 'FR', name: 'France', dialCode: '33', flag: '🇫🇷' },
  { code: 'GE', name: 'Georgia', dialCode: '995', flag: '🇬🇪' },
  { code: 'DE', name: 'Germany', dialCode: '49', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', dialCode: '233', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', dialCode: '30', flag: '🇬🇷' },
  { code: 'GT', name: 'Guatemala', dialCode: '502', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', dialCode: '504', flag: '🇭🇳' },
  { code: 'HK', name: 'Hong Kong', dialCode: '852', flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary', dialCode: '36', flag: '🇭🇺' },
  { code: 'IN', name: 'India', dialCode: '91', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', dialCode: '62', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', dialCode: '98', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', dialCode: '964', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', dialCode: '353', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', dialCode: '972', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', dialCode: '39', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', dialCode: '81', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', dialCode: '962', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', dialCode: '7', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', dialCode: '254', flag: '🇰🇪' },
  { code: 'KW', name: 'Kuwait', dialCode: '965', flag: '🇰🇼' },
  { code: 'LB', name: 'Lebanon', dialCode: '961', flag: '🇱🇧' },
  { code: 'LY', name: 'Libya', dialCode: '218', flag: '🇱🇾' },
  { code: 'MY', name: 'Malaysia', dialCode: '60', flag: '🇲🇾' },
  { code: 'MX', name: 'Mexico', dialCode: '52', flag: '🇲🇽' },
  { code: 'MA', name: 'Morocco', dialCode: '212', flag: '🇲🇦' },
  { code: 'NL', name: 'Netherlands', dialCode: '31', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', dialCode: '64', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', dialCode: '234', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', dialCode: '47', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', dialCode: '968', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', dialCode: '92', flag: '🇵🇰' },
  { code: 'PE', name: 'Peru', dialCode: '51', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', dialCode: '63', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', dialCode: '48', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', dialCode: '351', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', dialCode: '974', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', dialCode: '40', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', dialCode: '7', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '966', flag: '🇸🇦' },
  { code: 'SG', name: 'Singapore', dialCode: '65', flag: '🇸🇬' },
  { code: 'ZA', name: 'South Africa', dialCode: '27', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', dialCode: '82', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain', dialCode: '34', flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '94', flag: '🇱🇰' },
  { code: 'SE', name: 'Sweden', dialCode: '46', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', dialCode: '41', flag: '🇨🇭' },
  { code: 'SY', name: 'Syria', dialCode: '963', flag: '🇸🇾' },
  { code: 'TW', name: 'Taiwan', dialCode: '886', flag: '🇹🇼' },
  { code: 'TZ', name: 'Tanzania', dialCode: '255', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', dialCode: '66', flag: '🇹🇭' },
  { code: 'TN', name: 'Tunisia', dialCode: '216', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey', dialCode: '90', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', dialCode: '380', flag: '🇺🇦' },
  { code: 'AE', name: 'UAE', dialCode: '971', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', dialCode: '44', flag: '🇬🇧' },
  { code: 'US', name: 'United States', dialCode: '1', flag: '🇺🇸' },
  { code: 'UZ', name: 'Uzbekistan', dialCode: '998', flag: '🇺🇿' },
  { code: 'VE', name: 'Venezuela', dialCode: '58', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', dialCode: '84', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', dialCode: '967', flag: '🇾🇪' },
].sort((a, b) => a.name.localeCompare(b.name));

const DEFAULT_COUNTRY = COUNTRIES.find(c => c.code === 'US')!;

// ─── OTP Input ─────────────────────────────────────────────────────────────────

const OTPInput = memo(function OTPInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const OTP_LENGTH = 5;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const chars = value.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);

  const handleChange = (index: number, char: string) => {
    if (disabled) return;
    const digit = char.replace(/\D/g, '').slice(-1);
    const next = chars.map((c, i) => (i === index ? digit : c));
    onChange(next.join(''));
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'Backspace') {
      if (chars[index]) {
        const next = chars.map((c, i) => (i === index ? '' : c));
        onChange(next.join(''));
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = chars.map((c, i) => (i === index - 1 ? '' : c));
        onChange(next.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (disabled) return;
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(pasted.padEnd(OTP_LENGTH, '').slice(0, OTP_LENGTH));
    const nextFocus = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[nextFocus]?.focus();
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center" dir="ltr">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 30 }}
        >
          <input
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            disabled={disabled}
            value={chars[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={`
              w-12 h-14 sm:w-14 sm:h-16 text-center text-xl font-bold rounded-2xl border-2 outline-none
              transition-all duration-200 min-h-[48px] min-w-[48px]
              placeholder:text-[var(--text-hint)]
              focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent-rust)_30%,transparent)]
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            style={{
              background: chars[i] ? 'var(--bg-card)' : 'color-mix(in srgb, var(--bg-input) 50%, transparent)',
              borderColor: chars[i] ? 'var(--accent-rust)' : 'color-mix(in srgb, var(--border) 60%, transparent)',
              color: 'var(--text-primary)',
              boxShadow: chars[i] ? '0 4px 12px var(--shadow-sm)' : 'inset 0 2px 4px color-mix(in srgb, var(--shadow-color) 30%, transparent)',
            }}
            onFocus={e => {
               e.target.select();
               e.target.style.borderColor = 'var(--accent-rust)'; 
               e.target.style.background = 'var(--bg-card)';
               e.target.style.boxShadow = '0 0 0 4px color-mix(in srgb, var(--accent-rust) 20%, transparent)';
            }}
            onBlur={e => {
               e.target.style.borderColor = chars[i] ? 'var(--accent-rust)' : 'color-mix(in srgb, var(--border) 60%, transparent)'; 
               e.target.style.background = chars[i] ? 'var(--bg-card)' : 'color-mix(in srgb, var(--bg-input) 50%, transparent)';
               e.target.style.boxShadow = chars[i] ? '0 4px 12px var(--shadow-sm)' : 'inset 0 2px 4px color-mix(in srgb, var(--shadow-color) 30%, transparent)';
            }}
          />
        </motion.div>
      ))}
    </div>
  );
});

// ─── Country Dropdown ──────────────────────────────────────────────────────────

const CountryDropdown = memo(function CountryDropdown({
  selected,
  onSelect,
  disabled
}: {
  selected: Country;
  onSelect: (c: Country) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search.replace('+', ''))
  ), [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (open) setSearch('');
          setOpen(!open);
        }}
        className="group flex items-center justify-between gap-2 min-h-[56px] px-4 rounded-l-2xl border-2 border-r-0
          transition-colors duration-200 focus:outline-none min-w-[110px] sm:min-w-[120px] outline-none
          disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent-rust)_30%,transparent)]"
        style={{
          background: 'color-mix(in srgb, var(--bg-input) 50%, transparent)',
          borderColor: 'color-mix(in srgb, var(--border) 60%, transparent)',
          color: 'var(--text-primary)',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-rust)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border) 60%, transparent)'; }}
      >
        <span className="text-2xl leading-none pt-1">{selected.flag}</span>
        <span className="text-[15px] font-bold tracking-wide mt-1 opacity-90 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          +{selected.dialCode}
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-[var(--text-hint)]" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute z-50 top-[calc(100%+8px)] left-0 w-72 sm:w-80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-3xl"
            style={{ 
              background: 'color-mix(in srgb, var(--bg-panel) 85%, transparent)', 
              borderColor: 'color-mix(in srgb, var(--border) 60%, transparent)', 
              borderWidth: 1,
              boxShadow: '0 32px 64px var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--border) 30%, transparent), inset 0 1px 1px color-mix(in srgb, var(--bg-body) 40%, transparent)'
            }}
          >
            {/* Search */}
            <div className="p-3" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-transparent transition-colors focus-within:border-[var(--accent-rust)]" style={{ background: 'var(--bg-input)' }}>
                <Search className="w-4.5 h-4.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search country..."
                  className="flex-1 bg-transparent text-sm outline-none w-full min-h-[24px]"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto py-2 custom-scroll">
              {filtered.length === 0 ? (
                <p className="text-center text-sm py-6" style={{ color: 'var(--text-hint)' }}>No results found</p>
              ) : (
                filtered.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      onSelect(country);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-150
                      hover:bg-[color-mix(in_srgb,var(--bg-hover)_40%,transparent)] outline-none focus-visible:bg-[color-mix(in_srgb,var(--bg-hover)_60%,transparent)]`}
                    style={{
                      backgroundColor: selected.code === country.code ? 'color-mix(in srgb, var(--selection-bg) 50%, transparent)' : 'transparent',
                      color: selected.code === country.code ? 'var(--accent-rust)' : 'var(--text-primary)',
                      fontWeight: selected.code === country.code ? 600 : 500
                    }}
                  >
                    <span className="text-xl pt-1">{country.flag}</span>
                    <span className="flex-1 text-left truncate tracking-wide text-[15px]">{country.name}</span>
                    <span className="shrink-0 font-mono tracking-wider text-[13px] font-bold mt-0.5" style={{ color: selected.code === country.code ? 'inherit' : 'var(--text-muted)' }}>
                      +{country.dialCode}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Animated Background ───────────────────────────────────────────────────────

const AnimatedBackground = memo(function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      {/* Dynamic blurred orbs */}
      <motion.div
        className="absolute w-[60vmin] h-[60vmin] rounded-full blur-[100px] opacity-20 sm:opacity-30 mix-blend-screen"
        style={{
          background: 'radial-gradient(circle, var(--accent-rust) 0%, transparent 70%)',
          top: '-10%',
          left: '-10%',
        }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[50vmin] h-[50vmin] rounded-full blur-[80px] opacity-20 sm:opacity-30 mix-blend-screen"
        style={{
          background: 'radial-gradient(circle, var(--text-primary) 0%, transparent 70%)',
          bottom: '-10%',
          right: '-5%',
        }}
        animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div
        className="absolute w-[40vmin] h-[40vmin] rounded-full blur-[60px] opacity-[0.08] mix-blend-screen"
        style={{
          background: 'radial-gradient(circle, var(--accent-rust) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.05, 0.15, 0.05] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
});

// ─── Step Indicator ────────────────────────────────────────────────────────────

const STEP_META = [
  { id: 'phone', icon: Phone, label: 'Phone' },
  { id: 'code', icon: KeyRound, label: 'Code' },
  { id: 'password', icon: Lock, label: '2FA' },
] as const;

const StepIndicator = memo(function StepIndicator({ current }: { current: 'phone' | 'code' | 'password' }) {
  const currentIdx = STEP_META.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center justify-center gap-0 mb-10 w-full px-2">
      {STEP_META.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={{
                  scale: active ? 1 : 0.9,
                  boxShadow: active ? '0 0 0 6px color-mix(in srgb, var(--accent-rust) 20%, transparent)' : '0 0 0 0px transparent',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  transition-colors duration-300 relative z-10
                `}
                style={{
                  background: done || active ? 'var(--text-primary)' : 'var(--bg-input)',
                  borderColor: done || active ? 'transparent' : 'var(--border)',
                  borderWidth: (done || active) ? 0 : 2,
                  color: (done || active) ? 'var(--bg-body)' : 'var(--text-hint)'
                }}
              >
                {done ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" style={{ strokeWidth: active ? 2.5 : 2 }} />
                )}
              </motion.div>
              <span
                className={`text-[11px] font-bold transition-colors duration-300 uppercase tracking-wider absolute mt-12`}
                style={{
                  color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-hint)',
                  opacity: active ? 1 : 0.6
                }}
              >
                {step.label}
              </span>
            </div>

            {i < STEP_META.length - 1 && (
              <div className="relative flex-1 h-[2px] mx-3 -mt-6">
                <div className="absolute inset-0 rounded-full" style={{ background: 'color-mix(in srgb, var(--border) 60%, transparent)' }} />
                <motion.div
                  className="absolute inset-0 rounded-full origin-left"
                  style={{ background: 'var(--text-primary)' }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: i < currentIdx ? 1 : 0 }}
                  transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ─── Loading Dots ──────────────────────────────────────────────────────────────

const LoadingDots = memo(function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1.5 ml-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: 'currentColor' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
});

// ─── Main Login Form ───────────────────────────────────────────────────────────

export function LoginForm({ embedded = false }: { embedded?: boolean }) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'phone' | 'code' | 'password'>('phone');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [sessionString, setSessionString] = useState('');
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState(1);

  const { setSession, setUser } = useAuthStore();
  const hasAutoSubmittedRef = useRef(false);

  // Combine country code + local number into full international format
  const phoneNumber = `+${selectedCountry.dialCode}${localNumber.replace(/\D/g, '')}`;

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((prev) => {
      if (prev === 'code') return 'phone';
      if (prev === 'password') return 'code';
      return prev;
    });
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localNumber.trim()) {
      toast.error('Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/tg/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPhoneCodeHash(data.phoneCodeHash);
      setSessionString(data.sessionString);
      setDirection(1);
      setStep('code');
      toast.success('Code sent to your Telegram app');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/tg/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          phoneCodeHash,
          phoneCode,
          password: step === 'password' ? password : undefined,
          sessionString,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.requiresPassword) {
        setDirection(1);
        setStep('password');
        toast.info('Two-step verification enabled. Enter your password.');
        return;
      }

      setSession(data.sessionString);

      const userRes = await fetch('/api/tg/user', {
        headers: { 'x-tg-session': data.sessionString },
      });
      const userData = await userRes.json();
      if (!userData.error) setUser(userData);

      toast.success('Successfully signed in');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [phoneNumber, phoneCodeHash, phoneCode, password, sessionString, step, setSession, setUser]);

  // Auto-submit when OTP is fully filled
  useEffect(() => {
    if (step !== 'code') {
      hasAutoSubmittedRef.current = false;
      return;
    }
    if (phoneCode.length < 5) {
      hasAutoSubmittedRef.current = false;
      return;
    }
    if (phoneCode.length === 5 && !loading && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      handleSignIn();
    }
  }, [phoneCode, step, loading, handleSignIn]);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 30 : -30, opacity: 0, scale: 0.96 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -30 : 30, opacity: 0, scale: 0.96 }),
  };

  return (
    <>
      {!embedded && <AnimatedBackground />}

      <motion.div
        className="w-full sm:max-w-[440px] px-4 sm:px-0 mx-auto relative z-10"
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Pro Max Glassmorphism Card */}
        <div
          className="relative rounded-[2rem] overflow-hidden flex flex-col w-full backdrop-blur-[32px]"
          style={{
            background: 'color-mix(in srgb, var(--bg-panel) 75%, transparent)',
            border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
            boxShadow: '0 32px 64px var(--shadow-lg), inset 0 1px 1px color-mix(in srgb, var(--bg-body) 30%, transparent)',
          }}
        >
          {/* Top accent bar with animated shimmer */}
          <div className="relative h-1.5 w-full overflow-hidden" style={{ background: 'var(--accent-rust)' }}>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ x: ['-200%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
            />
          </div>

          <div className="p-7 sm:p-10 flex flex-col">
            {/* Logo + title */}
            <motion.div
              className="flex flex-col items-center mb-10"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              <motion.div
                className="relative w-20 h-20 mb-6 mix-blend-multiply dark:mix-blend-screen"
                whileHover={{ scale: 1.05, rotate: 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Image src="/logo.svg" alt="Cloud Vault" width={80} height={80} className="w-full h-full rounded-[1.5rem] shadow-xl" />
                {/* Glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-[1.5rem] pointer-events-none"
                  style={{ boxShadow: '0 0 0 0px color-mix(in srgb, var(--accent-rust) 40%, transparent)' }}
                  animate={{ boxShadow: ['0 0 0 0px color-mix(in srgb, var(--accent-rust) 50%, transparent)', '0 0 0 16px rgba(0,0,0,0)', '0 0 0 0px rgba(0,0,0,0)'] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeOut', repeatDelay: 0.5 }}
                />
              </motion.div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>CloudVault</h1>
              <p className="text-[14px] mt-2 font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>Sign in securely using Telegram</p>
            </motion.div>

            {/* Step indicator */}
            <StepIndicator current={step} />

            {/* Step forms */}
            <div className="relative min-h-[220px]">
              <AnimatePresence mode="wait" custom={direction}>
                {/* ── Step 1: Phone ── */}
                {step === 'phone' && (
                  <motion.form
                    key="phone"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    onSubmit={handleSendCode}
                    className="space-y-6 pb-2"
                  >
                    <div className="space-y-3">
                      <label htmlFor="phone-input" className="text-xs font-bold uppercase tracking-widest pl-1" style={{ color: 'var(--text-muted)' }}>
                        Mobile Number
                      </label>

                      {/* Country code + number input row - Touch Target Min 56px */}
                      <div className="flex shadow-sm rounded-2xl group transition-shadow focus-within:shadow-md">
                        <CountryDropdown selected={selectedCountry} onSelect={setSelectedCountry} disabled={loading} />
                        <input
                          id="phone-input"
                          type="tel"
                          placeholder="Phone number"
                          value={localNumber}
                          disabled={loading}
                          onChange={(e) => setLocalNumber(e.target.value.replace(/[^\d\s\-()]/g, ''))}
                          autoFocus={!embedded}
                          required
                          className="flex-1 min-h-[56px] w-full px-4 rounded-r-2xl border-2 text-[16px] sm:text-lg font-semibold tracking-wider
                            transition-all duration-200 outline-none placeholder:font-normal
                            placeholder:text-[var(--text-hint)] focus:border-[var(--accent-rust)] disabled:opacity-60 disabled:cursor-not-allowed
                            focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent-rust)_25%,transparent)]"
                          style={{
                            background: 'color-mix(in srgb, var(--bg-input) 30%, transparent)',
                            borderColor: 'color-mix(in srgb, var(--border) 60%, transparent)',
                            color: 'var(--text-primary)',
                          }}
                          onFocus={e => { e.target.style.borderColor = 'var(--accent-rust)'; }}
                          onBlur={e => { e.target.style.borderColor = 'color-mix(in srgb, var(--border) 60%, transparent)'; }}
                        />
                      </div>

                      <div className="h-6 flex items-center px-1">
                        {localNumber ? (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[13px] font-medium flex items-center gap-2"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <Phone className="w-3.5 h-3.5" style={{ color: 'var(--accent-rust)' }} />
                            Sending to: <span className="font-mono tracking-wider font-bold" style={{ color: 'var(--text-primary)' }}>{phoneNumber}</span>
                          </motion.p>
                        ) : (
                          <p className="text-[12px] font-semibold flex items-center gap-2 opacity-80" style={{ color: 'var(--text-hint)' }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'currentColor' }} />
                            Select country and enter your local number
                          </p>
                        )}
                      </div>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading || !localNumber.trim()}
                      whileTap={{ scale: 0.98 }}
                      className="w-full min-h-[56px] rounded-2xl font-bold text-[15px] tracking-wide
                        disabled:opacity-60 disabled:cursor-not-allowed
                        transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5
                        flex items-center justify-center gap-2 relative overflow-hidden group outline-none
                        focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent-rust)_50%,transparent)]"
                      style={{ background: 'var(--accent-rust)', color: '#FFFFFF' }}
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin opacity-80" /> Processing<LoadingDots /></>
                      ) : (
                        <>Send Verification Code</>
                      )}
                    </motion.button>
                  </motion.form>
                )}

                {/* ── Step 2: OTP Code ── */}
                {step === 'code' && (
                  <motion.form
                    key="code"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    onSubmit={handleSignIn}
                    className="space-y-8 pb-2"
                  >
                    <div className="space-y-6">
                      <div className="text-center">
                        <label className="text-xs font-bold uppercase tracking-widest mb-4 block" style={{ color: 'var(--text-muted)' }}>
                          Enter Secret Code
                        </label>
                        <OTPInput value={phoneCode} onChange={setPhoneCode} disabled={loading} />
                      </div>

                      <p className="text-[14px] text-center font-medium leading-relaxed max-w-[280px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
                        We sent a 5-digit code to your Telegram app via
                        <span className="font-mono tracking-wider font-bold block mt-1.5" style={{ color: 'var(--text-primary)' }}>{phoneNumber}</span>
                      </p>
                    </div>

                    <div className="space-y-4">
                      <motion.button
                        type="submit"
                        disabled={loading || phoneCode.length < 5}
                        whileTap={{ scale: 0.98 }}
                        className="w-full min-h-[56px] rounded-2xl font-bold text-[15px] tracking-wide
                          disabled:opacity-60 disabled:cursor-not-allowed
                          transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5
                          flex items-center justify-center gap-2 relative overflow-hidden group outline-none
                          focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent-rust)_50%,transparent)]"
                        style={{ background: 'var(--accent-rust)', color: '#FFFFFF' }}
                      >
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {loading ? (
                          <><Loader2 className="w-5 h-5 animate-spin opacity-80" /> Verifying<LoadingDots /></>
                        ) : (
                          'Verify & Proceed'
                        )}
                      </motion.button>

                      <button
                        type="button"
                        onClick={goBack}
                        disabled={loading}
                        className="w-full h-12 flex items-center justify-center gap-2 text-[13px] font-bold tracking-wide uppercase
                          transition-colors duration-200 py-2 hover:text-opacity-80 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <ArrowLeft className="w-4 h-4" /> Incorrect number?
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* ── Step 3: 2FA Password ── */}
                {step === 'password' && (
                  <motion.form
                    key="password"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    onSubmit={handleSignIn}
                    className="space-y-7 pb-2"
                  >
                    {/* 2FA shield icon */}
                    <motion.div
                      className="flex justify-center"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
                    >
                      <div className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center shadow-inner" style={{ background: 'color-mix(in srgb, var(--bg-input) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--border) 40%, transparent)' }}>
                        <Shield className="w-10 h-10" style={{ color: 'var(--accent-rust)' }} />
                      </div>
                    </motion.div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-widest pl-1" style={{ color: 'var(--text-muted)' }}>
                        Two-Factor Password
                      </label>
                      <div className="relative shadow-sm rounded-2xl group focus-within:shadow-md transition-shadow">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Your 2FA password"
                          value={password}
                          disabled={loading}
                          onChange={(e) => setPassword(e.target.value)}
                          autoFocus={!embedded}
                          required
                          spellCheck={false}
                          className="w-full min-h-[56px] px-5 pr-14 rounded-2xl border-2 text-[16px] sm:text-lg font-medium tracking-wide
                            focus:outline-none transition-all duration-200 placeholder:font-normal placeholder:text-[var(--text-hint)]
                            disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent-rust)_25%,transparent)]"
                          style={{
                            background: 'color-mix(in srgb, var(--bg-input) 30%, transparent)',
                            borderColor: 'color-mix(in srgb, var(--border) 60%, transparent)',
                            color: 'var(--text-primary)',
                          }}
                          onFocus={e => { e.target.style.borderColor = 'var(--accent-rust)'; }}
                          onBlur={e => { e.target.style.borderColor = 'color-mix(in srgb, var(--border) 60%, transparent)'; }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          disabled={loading}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl outline-none
                            transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50
                            focus-visible:ring-2 focus-visible:ring-[var(--accent-rust)]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-[12px] font-semibold pl-1 h-5 flex items-center gap-2" style={{ color: 'var(--text-hint)' }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'currentColor' }} />
                        Two-step verification is enabled.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <motion.button
                        type="submit"
                        disabled={loading || !password}
                        whileTap={{ scale: 0.98 }}
                        className="w-full min-h-[56px] rounded-2xl font-bold text-[15px] tracking-wide
                          disabled:opacity-60 disabled:cursor-not-allowed
                          transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5
                          flex items-center justify-center gap-2 relative overflow-hidden group outline-none
                          focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent-rust)_50%,transparent)]"
                        style={{ background: 'var(--accent-rust)', color: '#FFFFFF' }}
                      >
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {loading ? (
                          <><Loader2 className="w-5 h-5 animate-spin opacity-80" /> Unlocking<LoadingDots /></>
                        ) : (
                          <>Sign In Securely <Lock className="w-4.5 h-4.5 ml-1 opacity-80" /></>
                        )}
                      </motion.button>

                      <button
                        type="button"
                        onClick={goBack}
                        disabled={loading}
                        className="w-full h-12 flex items-center justify-center gap-2 text-[13px] font-bold tracking-wide uppercase
                          transition-colors duration-200 py-2 hover:text-opacity-80 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <ArrowLeft className="w-4 h-4" /> Start over
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 sm:px-10 sm:py-5 text-center mt-auto backdrop-blur-md" style={{ borderTop: '1px solid color-mix(in srgb, var(--border) 40%, transparent)', background: 'color-mix(in srgb, var(--bg-body) 60%, transparent)' }}>
            <p className="text-[11px] font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 opacity-80" style={{ color: 'var(--text-hint)' }}>
              <Shield className="w-3.5 h-3.5" /> Secure authentication via Telegram MTProto
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
