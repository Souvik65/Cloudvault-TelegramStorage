'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuthStore } from '@/store/use-auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Cloud, Phone, KeyRound, Lock } from 'lucide-react';

const STEPS = ['phone', 'code', 'password'] as const;

export function LoginForm() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | 'password'>('phone');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [sessionString, setSessionString] = useState('');
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState(1);

  const { setSession, setUser } = useAuthStore();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
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
        toast.info('Two-step verification enabled. Please enter your password.');
        return;
      }

      setSession(data.sessionString);

      // Fetch user info
      const userRes = await fetch('/api/tg/user', {
        headers: { 'x-tg-session': data.sessionString },
      });
      const userData = await userRes.json();
      if (!userData.error) {
        setUser(userData);
      }

      toast.success('Successfully logged in');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = STEPS.indexOf(step);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-[#242F3D] rounded-2xl border border-[rgba(255,255,255,0.06)] overflow-hidden shadow-2xl">
        {/* Accent top border */}
        <div className="h-1 bg-[#2AABEE]" />

        <div className="p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#2AABEE] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-[#2AABEE]/20">
              <Cloud className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">CloudVault</h2>
            <p className="text-sm text-[#6C7883] mt-1">Sign in with your Telegram account</p>
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                    i < currentStepIndex
                      ? 'bg-[#2AABEE] text-white'
                      : i === currentStepIndex
                      ? 'bg-[#2AABEE] text-white ring-4 ring-[#2AABEE]/20'
                      : 'bg-[#1C2733] text-[#6C7883]'
                  }`}
                >
                  {i < currentStepIndex ? (
                    '\u2713'
                  ) : i === 0 ? (
                    <Phone className="w-3.5 h-3.5" />
                  ) : i === 1 ? (
                    <KeyRound className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-0.5 rounded-full transition-colors duration-300 ${
                      i < currentStepIndex ? 'bg-[#2AABEE]' : 'bg-[#1C2733]'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Animated step content */}
          <AnimatePresence mode="wait" custom={direction}>
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
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-[#6C7883]">Enter your phone number in international format</p>
                </div>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Code'}
                  </Button>
                </motion.div>
              </motion.form>
            )}

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
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="12345"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-[#6C7883]">Enter the code sent to your Telegram app</p>
                </div>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </Button>
                </motion.div>
              </motion.form>
            )}

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
                <div className="space-y-2">
                  <Label htmlFor="password">2FA Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-[#6C7883]">Two-step verification is enabled on this account</p>
                </div>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Verifying...' : 'Login'}
                  </Button>
                </motion.div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
