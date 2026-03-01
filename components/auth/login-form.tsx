'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuthStore } from '@/store/use-auth-store';
import { toast } from 'sonner';
import {
  Cloud, Phone, KeyRound, Lock, ChevronDown,
  Search, Eye, EyeOff, ArrowLeft, CheckCircle2, Loader2, Shield,
} from 'lucide-react';

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

function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const OTP_LENGTH = 5;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const chars = value.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const next = chars.map((c, i) => (i === index ? digit : c));
    onChange(next.join(''));
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
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
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(pasted.padEnd(OTP_LENGTH, '').slice(0, OTP_LENGTH));
    const nextFocus = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[nextFocus]?.focus();
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <input
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={chars[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`
              w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border-2 outline-none
              bg-[#1C2733] text-white caret-[#2AABEE]
              transition-all duration-200
              ${chars[i]
                ? 'border-[#2AABEE] bg-[#1a2e3f] shadow-[0_0_12px_rgba(42,171,238,0.25)]'
                : 'border-[rgba(255,255,255,0.08)] focus:border-[#2AABEE] focus:shadow-[0_0_12px_rgba(42,171,238,0.15)]'
              }
            `}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Country Dropdown ──────────────────────────────────────────────────────────

function CountryDropdown({
  selected,
  onSelect,
}: {
  selected: Country;
  onSelect: (c: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search.replace('+', ''))
  );

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
    } else {
      setSearch('');
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-12 px-3 rounded-l-xl border-2 border-r-0 border-[rgba(255,255,255,0.08)]
          bg-[#1C2733] hover:bg-[#212e3d] hover:border-[rgba(42,171,238,0.4)]
          text-white transition-all duration-200 focus:outline-none focus:border-[#2AABEE] min-w-[90px]"
      >
        <span className="text-xl leading-none">{selected.flag}</span>
        <span className="text-sm font-medium text-[#8B9CAF]">+{selected.dialCode}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 text-[#6C7883]" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 top-[calc(100%+6px)] left-0 w-64 sm:w-72 rounded-xl border border-[rgba(255,255,255,0.08)]
              bg-[#1a2535] shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Search */}
            <div className="p-2 border-b border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#242F3D]">
                <Search className="w-3.5 h-3.5 text-[#6C7883] shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search country..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-[#6C7883] outline-none"
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-52 overflow-y-auto py-1 custom-scroll">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-[#6C7883] py-4">No results</p>
              ) : (
                filtered.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      onSelect(country);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-[#2AABEE]/10
                      transition-colors duration-150 ${
                        selected.code === country.code ? 'bg-[#2AABEE]/15 text-[#2AABEE]' : 'text-white'
                      }`}
                  >
                    <span className="text-lg">{country.flag}</span>
                    <span className="flex-1 text-left truncate">{country.name}</span>
                    <span className="text-[#6C7883] shrink-0">+{country.dialCode}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Animated Background ───────────────────────────────────────────────────────

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Blob 1 */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(42,171,238,0.12) 0%, transparent 70%)',
          top: '-10%',
          left: '-10%',
        }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Blob 2 */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(29,155,240,0.10) 0%, transparent 70%)',
          bottom: '-10%',
          right: '-5%',
        }}
        animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      {/* Blob 3 — subtle center glow */}
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(42,171,238,0.06) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
}

// ─── Step Indicator ────────────────────────────────────────────────────────────

const STEP_META = [
  { id: 'phone', icon: Phone, label: 'Phone' },
  { id: 'code', icon: KeyRound, label: 'Code' },
  { id: 'password', icon: Lock, label: '2FA' },
] as const;

function StepIndicator({ current }: { current: 'phone' | 'code' | 'password' }) {
  const currentIdx = STEP_META.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_META.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  scale: active ? 1 : 0.85,
                  boxShadow: active ? '0 0 0 6px rgba(42,171,238,0.18)' : '0 0 0 0px transparent',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center
                  transition-colors duration-300
                  ${done
                    ? 'bg-[#2AABEE]'
                    : active
                    ? 'bg-[#2AABEE]'
                    : 'bg-[#1C2733] border-2 border-[rgba(255,255,255,0.08)]'
                  }
                `}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-[#4A5568]'}`} />
                )}
              </motion.div>
              <span
                className={`text-[10px] font-medium transition-colors duration-300 ${
                  active ? 'text-[#2AABEE]' : done ? 'text-[#2AABEE]/70' : 'text-[#4A5568]'
                }`}
              >
                {step.label}
              </span>
            </div>

            {i < STEP_META.length - 1 && (
              <div className="relative w-10 sm:w-16 h-0.5 mx-1 mb-5">
                <div className="absolute inset-0 rounded-full bg-[#1C2733]" />
                <motion.div
                  className="absolute inset-0 rounded-full bg-[#2AABEE] origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: i < currentIdx ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Loading Dots ──────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white inline-block"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

// ─── Main Login Form ───────────────────────────────────────────────────────────

export function LoginForm() {
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

  // Combine country code + local number into full international format
  const phoneNumber = `+${selectedCountry.dialCode}${localNumber.replace(/\D/g, '')}`;

  const goBack = () => {
    setDirection(-1);
    if (step === 'code') setStep('phone');
    else if (step === 'password') setStep('code');
  };

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

  const handleSignIn = async (e?: React.FormEvent) => {
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
  };

  // Auto-submit when OTP is fully filled
  useEffect(() => {
    if (step === 'code' && phoneCode.length === 5 && !loading) {
      handleSignIn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneCode, step]);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <>
      <AnimatedBackground />

      <motion.div
        className="w-full max-w-[440px] mx-auto"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Card */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(36,47,61,0.95) 0%, rgba(28,39,51,0.98) 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(42,171,238,0.05)',
          }}
        >
          {/* Top accent bar with animated shimmer */}
          <div className="relative h-1 bg-gradient-to-r from-[#1D9BF0] via-[#2AABEE] to-[#1D9BF0]">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
            />
          </div>

          <div className="p-5 sm:p-8">
            {/* Logo + title */}
            <motion.div
              className="flex flex-col items-center mb-7"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.div
                className="relative w-16 h-16 mb-4"
                whileHover={{ scale: 1.05 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-[#2AABEE] to-[#1D7FBF] rounded-2xl flex items-center justify-center shadow-lg">
                  <Cloud className="w-9 h-9 text-white" />
                </div>
                {/* Glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{ boxShadow: '0 0 0 0px rgba(42,171,238,0.4)' }}
                  animate={{ boxShadow: ['0 0 0 0px rgba(42,171,238,0.4)', '0 0 0 8px rgba(42,171,238,0)', '0 0 0 0px rgba(42,171,238,0)'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', repeatDelay: 1 }}
                />
              </motion.div>

              <h1 className="text-2xl font-bold text-white tracking-tight">CloudVault</h1>
              <p className="text-sm text-[#6C7883] mt-1">Sign in with your Telegram account</p>
            </motion.div>

            {/* Step indicator */}
            <StepIndicator current={step} />

            {/* Step forms */}
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
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  onSubmit={handleSendCode}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#8B9CAF] uppercase tracking-wider">
                      Phone Number
                    </label>

                    {/* Country code + number input row */}
                    <div className="flex">
                      <CountryDropdown selected={selectedCountry} onSelect={setSelectedCountry} />
                      <input
                        type="tel"
                        placeholder="Phone number"
                        value={localNumber}
                        onChange={(e) => setLocalNumber(e.target.value.replace(/[^\d\s\-()]/g, ''))}
                        autoFocus
                        required
                        className="flex-1 h-12 px-3 rounded-r-xl border-2 border-[rgba(255,255,255,0.08)]
                          bg-[#1C2733] text-white placeholder:text-[#4A5568] text-sm
                          focus:outline-none focus:border-[#2AABEE] focus:shadow-[0_0_0_3px_rgba(42,171,238,0.1)]
                          transition-all duration-200"
                      />
                    </div>

                    {localNumber && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-[#6C7883] flex items-center gap-1.5"
                      >
                        <Phone className="w-3 h-3" />
                        Full number: <span className="text-[#8B9CAF] font-mono">{phoneNumber}</span>
                      </motion.p>
                    )}
                    {!localNumber && (
                      <p className="text-xs text-[#4A5568]">Select your country and enter your phone number</p>
                    )}
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading || !localNumber.trim()}
                    whileTap={{ scale: 0.98 }}
                    className="w-full h-12 rounded-xl font-semibold text-sm text-white
                      bg-gradient-to-r from-[#2AABEE] to-[#1D9BF0]
                      hover:from-[#1D9BF0] hover:to-[#1a88d3]
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200 shadow-lg shadow-[#2AABEE]/20
                      flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending<LoadingDots /></>
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
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  onSubmit={handleSignIn}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="text-center">
                      <label className="text-xs font-medium text-[#8B9CAF] uppercase tracking-wider">
                        Verification Code
                      </label>
                      <p className="text-sm text-[#6C7883] mt-1">
                        Code sent to <span className="text-[#8B9CAF] font-mono">{phoneNumber}</span>
                      </p>
                    </div>

                    <OTPInput value={phoneCode} onChange={setPhoneCode} />

                    <p className="text-xs text-center text-[#4A5568]">
                      Check your Telegram app for the 5-digit code
                    </p>
                  </div>

                  <div className="space-y-3">
                    <motion.button
                      type="submit"
                      disabled={loading || phoneCode.length < 5}
                      whileTap={{ scale: 0.98 }}
                      className="w-full h-12 rounded-xl font-semibold text-sm text-white
                        bg-gradient-to-r from-[#2AABEE] to-[#1D9BF0]
                        hover:from-[#1D9BF0] hover:to-[#1a88d3]
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-200 shadow-lg shadow-[#2AABEE]/20
                        flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Verifying<LoadingDots /></>
                      ) : (
                        'Verify Code'
                      )}
                    </motion.button>

                    <button
                      type="button"
                      onClick={goBack}
                      className="w-full flex items-center justify-center gap-2 text-sm text-[#6C7883]
                        hover:text-[#8B9CAF] transition-colors duration-200 py-2"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Change phone number
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
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  onSubmit={handleSignIn}
                  className="space-y-5"
                >
                  {/* 2FA shield icon */}
                  <motion.div
                    className="flex justify-center"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#2AABEE]/10 border border-[#2AABEE]/20
                      flex items-center justify-center">
                      <Shield className="w-7 h-7 text-[#2AABEE]" />
                    </div>
                  </motion.div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#8B9CAF] uppercase tracking-wider">
                      Two-Factor Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Your 2FA password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                        required
                        className="w-full h-12 px-3 pr-11 rounded-xl border-2 border-[rgba(255,255,255,0.08)]
                          bg-[#1C2733] text-white placeholder:text-[#4A5568] text-sm
                          focus:outline-none focus:border-[#2AABEE] focus:shadow-[0_0_0_3px_rgba(42,171,238,0.1)]
                          transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6C7883]
                          hover:text-[#8B9CAF] transition-colors duration-150"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-[#4A5568]">Two-step verification is enabled on this account</p>
                  </div>

                  <div className="space-y-3">
                    <motion.button
                      type="submit"
                      disabled={loading || !password}
                      whileTap={{ scale: 0.98 }}
                      className="w-full h-12 rounded-xl font-semibold text-sm text-white
                        bg-gradient-to-r from-[#2AABEE] to-[#1D9BF0]
                        hover:from-[#1D9BF0] hover:to-[#1a88d3]
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-200 shadow-lg shadow-[#2AABEE]/20
                        flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Signing in<LoadingDots /></>
                      ) : (
                        'Sign In'
                      )}
                    </motion.button>

                    <button
                      type="button"
                      onClick={goBack}
                      className="w-full flex items-center justify-center gap-2 text-sm text-[#6C7883]
                        hover:text-[#8B9CAF] transition-colors duration-200 py-2"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to code entry
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 sm:px-8 sm:pb-6 text-center">
            <p className="text-xs text-[#3D4F5E]">
              Secure authentication via Telegram MTProto
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
