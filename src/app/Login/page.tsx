'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import loginImage from '../Login/logo.jpg';
import './Login.css';
import { toast, ToastContainer } from 'react-toastify';
import Spinner from '../components/Spinner';
import { useTranslation } from 'react-i18next';
import useSWRMutation from 'swr/mutation';
import { Eye, EyeOff } from 'lucide-react';

// ─── SWR Fetcher ────────────────────────────────────────────────────────────
// A single reusable POST fetcher for all mutations.
// Throws on non-OK responses so useSWRMutation captures them as errors.
async function postFetcher<T = unknown>(
  url: string,
  { arg }: { arg: Record<string, unknown> }
): Promise<T> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || '';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(arg),
  });
  const data = await res.json();
  if (!res.ok) {
    // Attach status + server message so handlers can inspect it
    throw Object.assign(new Error(data.message || 'Request failed'), {
      status: res.status,
      data,
    });
  }
  return data as T;
}

// AuthResponse includes an `organization` object for any org member (not just
// the OWNER) — this is the only way non-owner roles (ADMIN/EDITOR/ANALYST/VIEWER)
// can learn their org_id, since /organizations/my-org only resolves for OWNERs.
function extractOrgId(data: any): number | null {
  const org = data?.organization ?? data?.access?.organization ?? data?.org ?? data?.user?.organization;
  const id =
    org?.id ??
    org?.org_id ??
    data?.access?.org_id ??
    data?.org_id ??
    data?.organization_id ??
    data?.user?.org_id ??
    data?.user?.organization_id;
  const resolved = typeof id === 'number' ? id : (id ? Number(id) || null : null);
  if (!resolved) {
    console.warn('[Login] Could not find org_id in AuthResponse — check the organization/access shape:', data);
  }
  return resolved;
}

// ─── Sub-components (unchanged) ─────────────────────────────────────────────

const CountdownTimer: React.FC<{
  endTime: number | null;
  onExpire: () => void;
  label?: string;
}> = ({ endTime, onExpire, label }) => {
  const [secondsLeft, setSecondsLeft] = React.useState<number>(0);

  React.useEffect(() => {
    if (!endTime) return;
    const update = () => {
      const left = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) onExpire();
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endTime, onExpire]);

  if (!endTime || secondsLeft <= 0) return null;
  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  return (
    <div className="countdown-timer" style={{ margin: '8px 0', color: '#313b96', fontWeight: 500 }}>
      {label ? `${label}: ` : ''}{min}:{sec.toString().padStart(2, '0')}
    </div>
  );
};

const ErrorMessage: React.FC<{ message: string; type?: 'error' | 'warning' | 'info' }> = ({
  message,
  type = 'error',
}) => {
  if (!message) return null;
  const styles = {
    error:   { color: '#dc3545', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb' },
    warning: { color: '#856404', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7' },
    info:    { color: '#0c5460', backgroundColor: '#d1ecf1', border: '1px solid #bee5eb' },
  };
  return (
    <div style={{
      ...styles[type],
      borderRadius: '6px', padding: '12px', margin: '15px 0', fontSize: '14px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textAlign: 'center',
    }}>
      <i className={`fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`} />
      {message}
    </div>
  );
};

const OTPInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  length: number;
  disabled?: boolean;
}> = ({ value, onChange, length, disabled }) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const newVal = e.target.value.replace(/\D/g, '');
    if (newVal.length <= 1) {
      const arr = Array(length).fill('');
      for (let i = 0; i < value.length && i < length; i++) arr[i] = value[i] || '';
      arr[idx] = newVal;
      onChange(arr.join('').replace(/\s/g, ''));
      if (newVal && idx < length - 1) {
        setTimeout(() => (document.getElementById(`otp-input-${idx + 1}`) as HTMLInputElement)?.focus(), 10);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      const arr = Array(length).fill('');
      for (let i = 0; i < value.length && i < length; i++) arr[i] = value[i] || '';
      arr[idx] = '';
      onChange(arr.join('').replace(/\s/g, ''));
      if (!value[idx] && idx > 0) {
        setTimeout(() => (document.getElementById(`otp-input-${idx - 1}`) as HTMLInputElement)?.focus(), 10);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    onChange(e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length));
  };

  const getInputStyle = (idx: number): React.CSSProperties => ({
    width: '42px', height: '42px', textAlign: 'center', fontSize: '20px', fontWeight: '600',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    border: focusedIndex === idx ? '2px solid #313b96' : '2px solid #e1e5e9',
    borderRadius: '10px', outline: 'none', background: disabled ? '#f5f5f5' : '#fff',
    transition: 'all 0.2s ease',
    boxShadow: focusedIndex === idx ? '0 0 0 3px rgba(49,59,150,0.1)' : '0 2px 8px rgba(0,0,0,0.08)',
    color: '#2d3748', caretColor: '#313b96',
  });

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '20px 0', padding: '0 10px' }}>
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx} id={`otp-input-${idx}`} type="text" inputMode="numeric" pattern="[0-9]*"
          maxLength={1} value={value[idx] || ''} onChange={e => handleChange(e, idx)}
          onKeyDown={e => handleKeyDown(e, idx)} onPaste={handlePaste}
          onFocus={() => setFocusedIndex(idx)} onBlur={() => setFocusedIndex(null)}
          disabled={disabled} autoComplete="off" style={getInputStyle(idx)}
        />
      ))}
    </div>
  );
};

const HoverButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  style?: React.CSSProperties;
}> = ({ children, onClick, disabled = false, type = 'button', variant = 'primary', loading = false, style = {} }) => {
  const [isHovered, setIsHovered] = useState(false);

  const getButtonStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600',
      cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease',
      minWidth: '180px', padding: '14px 50px', ...style,
    };
    if (disabled) return { ...base, background: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)', color: '#fff' };
    if (variant === 'primary') return {
      ...base,
      background: 'linear-gradient(135deg, #313b96 0%, #1e3a8a 100%)', color: '#fff',
      transform: isHovered ? 'translateY(-2px)' : 'translateY(-1px)',
      boxShadow: isHovered ? '0 6px 16px rgba(49,59,150,0.4)' : '0 4px 12px rgba(49,59,150,0.3)',
    };
    return {
      ...base,
      background: isHovered ? '#313b96' : 'transparent', color: isHovered ? '#fff' : '#313b96',
      border: '1px solid #313b96', padding: '10px 24px', minWidth: 'auto',
    };
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} style={getButtonStyle()}
      onMouseEnter={() => !disabled && setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <i className="fas fa-spinner fa-spin" />
          {typeof children === 'string' ? 'Loading...' : children}
        </span>
      ) : children}
    </button>
  );
};

// ─── Types ───────────────────────────────────────────────────────────────────
type FormState = 'email-login' | 'phone-entry' | 'phone-verify' | 'signup' | 'signup-verify' | 'forgot-email' | 'forgot-reset';

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Login() {
  const { i18n } = useTranslation();
  const router = useRouter();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  // ── SWR Mutations (one per endpoint) ────────────────────────────────────
  // Each hook manages its own isMutating (loading) state automatically.

  const { trigger: triggerLogin, isMutating: loginLoading } =
    useSWRMutation(`${API_BASE_URL}/auth/login`, postFetcher);

  const { trigger: triggerSendOtp, isMutating: sendOtpLoading } =
    useSWRMutation(`${API_BASE_URL}/auth/send-login-otp`, postFetcher);

  const { trigger: triggerVerifyOtp, isMutating: verifyOtpLoading } =
    useSWRMutation(`${API_BASE_URL}/auth/verify-login-otp`, postFetcher);

  const { trigger: triggerSignup, isMutating: signupLoading } =
    useSWRMutation(`${API_BASE_URL}/client-users/register-with-otp`, postFetcher);

  const { trigger: triggerResendSignupOtp, isMutating: resendSignupOtpLoading } =
    useSWRMutation(`${API_BASE_URL}/client-users/resend-registration-otp`, postFetcher);

  const { trigger: triggerVerifySignup, isMutating: verifySignupLoading } =
    useSWRMutation(`${API_BASE_URL}/auth/verify-registration`, postFetcher);

  const { trigger: triggerForgotPassword, isMutating: forgotLoading } =
    useSWRMutation(`${API_BASE_URL}/auth/forgot-password`, postFetcher);

  const { trigger: triggerResetPassword, isMutating: resetLoading } =
    useSWRMutation(`${API_BASE_URL}/auth/reset-password`, postFetcher);

  // Derive a single global loading flag for the spinner overlay
  const loading =
    loginLoading || sendOtpLoading || verifyOtpLoading ||
    signupLoading || resendSignupOtpLoading || verifySignupLoading || forgotLoading || resetLoading;

  // ── UI State ─────────────────────────────────────────────────────────────
  const [currentForm, setCurrentForm] = useState<FormState>('email-login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetOtpExpiryTime, setResetOtpExpiryTime] = useState<number | null>(null);
  const [resetOtpCooldown, setResetOtpCooldown] = useState(0);
  const [resetOtpError, setResetOtpError] = useState('');

  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupCountry, setSignupCountry] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');
  const [signupOtpExpiryTime, setSignupOtpExpiryTime] = useState<number | null>(null);
  const [signupOtpCooldown, setSignupOtpCooldown] = useState(0);
  const [signupOtpError, setSignupOtpError] = useState('');
  const [registeredUserId, setRegisteredUserId] = useState<number | null>(null);

  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyLoginEmail, setVerifyLoginEmail] = useState('');

  const [otpExpiryTime, setOtpExpiryTime] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const maxOtpAttempts = 3;
  const [isOtpBlocked, setIsOtpBlocked] = useState(false);
  const [otpBlockTime, setOtpBlockTime] = useState<number | null>(null);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');

  // ── Cooldown timers ───────────────────────────────────────────────────────
  useEffect(() => { if (resendCooldown > 0) { const t = setTimeout(() => setResendCooldown(p => p - 1), 1000); return () => clearTimeout(t); } }, [resendCooldown]);
  useEffect(() => { if (resetOtpCooldown > 0) { const t = setTimeout(() => setResetOtpCooldown(p => p - 1), 1000); return () => clearTimeout(t); } }, [resetOtpCooldown]);
  useEffect(() => { if (signupOtpCooldown > 0) { const t = setTimeout(() => setSignupOtpCooldown(p => p - 1), 1000); return () => clearTimeout(t); } }, [signupOtpCooldown]);

  // OTP block timer
  useEffect(() => {
    if (!isOtpBlocked || !otpBlockTime) return;
    const t = setInterval(() => {
      if (Date.now() >= otpBlockTime) {
        setIsOtpBlocked(false); setOtpBlockTime(null); setOtpAttempts(0); setOtpError('');
      }
    }, 1000);
    return () => clearInterval(t);
  }, [isOtpBlocked, otpBlockTime]);

  // Clear errors when OTP fields change
  useEffect(() => { if (otp && otpError) setOtpError(''); }, [otp, otpError]);
  useEffect(() => { if (resetOtp && resetOtpError) setResetOtpError(''); }, [resetOtp, resetOtpError]);
  useEffect(() => { if (signupOtp && signupOtpError) setSignupOtpError(''); }, [signupOtp, signupOtpError]);

  // ── Reset helper ─────────────────────────────────────────────────────────
  const resetToEmailLogin = () => {
    setCurrentForm('email-login');
    setOtp(''); setPhoneNumber(''); setOtpExpiryTime(null); setResendCooldown(0);
    setOtpAttempts(0); setIsOtpBlocked(false); setOtpBlockTime(null); setOtpError(''); setOtpSuccess('');
    setForgotEmail(''); setResetOtp(''); setNewPassword(''); setConfirmNewPassword('');
    setResetOtpExpiryTime(null); setResetOtpCooldown(0); setResetOtpError('');
    setSignupOtp(''); setSignupOtpExpiryTime(null); setSignupOtpCooldown(0); setSignupOtpError('');
    setRegisteredUserId(null); setVerifyEmail(''); setVerifyLoginEmail('');
  };

  // phoneNumber kept for compatibility (unused in current flows)
  const [phoneNumber, setPhoneNumber] = useState('');

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please enter both email and password.'); return; }

    // OTP verification step is disabled for now — /auth/login already returns the
    // same AuthResponse shape as /auth/verify-login-otp, so we log in directly here.
    // To re-enable OTP: after a successful triggerLogin, call triggerSendOtp and
    // setCurrentForm('phone-verify') instead of writing sessionStorage below.
    try {
      const data: any = await triggerLogin({ email, password });
      const userName = data.user_name ? data.user_name.trim() : 'Unknown User';
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('currentUserData', JSON.stringify({
          email: data.email, name: data.name, userId: data.user_id, userRole: data.role, userName,
          orgId: extractOrgId(data),
          orgRole: data.access?.org_role || data.org_role || data.role || '',
          orgData: data.organization || null,
        }));
      }
      toast.success('Login successful!');
      setTimeout(() => router.push('/Consultant'), 1000);
    } catch (err: any) {
      toast.error(`Login failed: ${err.data?.message || 'Invalid credentials.'}`);
    }
  };

  const handleSendOtp = async () => {
    if (!email) { setOtpError('Please enter your email.'); return; }
    if (isOtpBlocked) {
      setOtpError(`Maximum OTP attempts exceeded. Try again in ${Math.ceil(((otpBlockTime ?? Date.now()) - Date.now()) / 60000)} minutes.`);
      return;
    }
    if (resendCooldown > 0) { setOtpError(`Please wait ${resendCooldown}s before requesting a new OTP.`); return; }
    try {
      await triggerSendOtp({ email: email.trim().toLowerCase() });
      setOtpSuccess('OTP sent successfully to your Email!');
      setVerifyLoginEmail(email);
      setCurrentForm('phone-verify');
      setOtpExpiryTime(Date.now() + 10 * 60 * 1000);
      setResendCooldown(60);
      setOtp('');
    } catch (err: any) {
      setOtpError(`Failed to send OTP: ${err.data?.message || 'Unknown error.'}`);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verifyLoginEmail) { setOtpError('Please enter your email address.'); return; }
    if (!otp || otp.length !== 6) { setOtpError('Please enter the complete 6-digit OTP.'); return; }
    if (isOtpBlocked) {
      setOtpError(`Maximum OTP attempts exceeded. Try again in ${Math.ceil(((otpBlockTime ?? Date.now()) - Date.now()) / 60000)} minutes.`);
      return;
    }
    if (otpExpiryTime && Date.now() > otpExpiryTime) { setOtpError('OTP expired. Please request a new one.'); return; }
    try {
      const data: any = await triggerVerifyOtp({ email: verifyLoginEmail.trim().toLowerCase(), otp_code: otp });
      setOtpAttempts(0); setOtpError('');
      const userName = data.user_name ? data.user_name.trim() : 'Unknown User';
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('currentUserData', JSON.stringify({
          email: data.email, name: data.name, userId: data.user_id, userRole: data.role, userName,
          orgId: extractOrgId(data),
          orgRole: data.access?.org_role || data.org_role || data.role || '',
          orgData: data.organization || null,
        }));
      }
      toast.success('OTP verified successfully!');
      setTimeout(() => router.push('/Consultant'), 2000);
    } catch (err: any) {
      const newAttempts = otpAttempts + 1;
      setOtpAttempts(newAttempts);
      if (newAttempts >= maxOtpAttempts) {
        setIsOtpBlocked(true);
        setOtpBlockTime(Date.now() + 30 * 60 * 1000);
        setOtpError('Maximum OTP attempts exceeded. Account blocked for 30 minutes.');
      } else {
        setOtp('');
        setOtpError(`Invalid OTP. ${maxOtpAttempts - newAttempts} attempts remaining.`);
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirmPassword) { toast.error("Passwords don't match"); return; }
    if (signupPassword.length < 6) { toast.error('Password must be at least 6 characters long'); return; }
    try {
      const data: any = await triggerSignup({
        first_name: signupFirstName.trim(),
        last_name: signupLastName.trim(),
        email: signupEmail.trim().toLowerCase(),
        mobile_number: signupPhone.trim() || null,
        password: signupPassword,
        confirm_password: signupConfirmPassword,
        country: signupCountry.trim(),
        timezone: null,
        department: null,
        designation: null,
      });
      toast.success('Registration successful! Please check your email for OTP.');
      setRegisteredUserId(data.user_id);
      setVerifyEmail(signupEmail);
      setSignupOtpExpiryTime(Date.now() + 10 * 60 * 1000);
      setSignupOtpCooldown(60);
      setCurrentForm('signup-verify');
    } catch (err: any) {
      const status = err.status;
      let msg = 'Failed to create account';
      if (status === 409) msg = 'An account with this email or username already exists';
      else if (status === 429) msg = 'Too many signup attempts. Please try again later';
      else if (status >= 500) msg = 'Server error. Please try again later';
      else msg = err.data?.message || msg;
      toast.error(msg, { autoClose: 8000 });
    }
  };

  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmail) { setSignupOtpError('Please enter your email address.'); return; }
    if (!signupOtp || signupOtp.length !== 6) { setSignupOtpError('Please enter the complete 6-digit OTP.'); return; }
    if (signupOtpExpiryTime && Date.now() > signupOtpExpiryTime) { setSignupOtpError('OTP expired. Please request a new one.'); return; }
    try {
      await triggerVerifySignup({ email: verifyEmail.trim().toLowerCase(), otp_code: signupOtp });
      toast.success('User registered successfully! Please login to continue.', { autoClose: 4000 });
      setSignupFirstName(''); setSignupLastName(''); setSignupEmail(''); setSignupPhone(''); setSignupCountry('');
      setSignupPassword(''); setSignupConfirmPassword(''); setSignupOtp(''); setVerifyEmail('');
      setSignupOtpExpiryTime(null); setRegisteredUserId(null);
      setTimeout(() => setCurrentForm('email-login'), 1000);
    } catch (err: any) {
      setSignupOtp('');
      setSignupOtpError(err.data?.message || 'Invalid OTP. Please try again.');
    }
  };

  const handleResendSignupOtp = async () => {
    if (signupOtpCooldown > 0) { setSignupOtpError(`Please wait ${signupOtpCooldown}s before requesting a new OTP.`); return; }
    if (!verifyEmail) { setSignupOtpError('Please enter your email address.'); return; }
    try {
      await triggerResendSignupOtp({ email: verifyEmail.trim().toLowerCase() });
      toast.success('New OTP sent to your email!');
      setSignupOtpExpiryTime(Date.now() + 10 * 60 * 1000);
      setSignupOtpCooldown(60);
      setSignupOtp('');
    } catch (err: any) {
      setSignupOtpError(`Error: ${err.data?.message || 'Failed to resend OTP'}`);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { toast.error('Please enter your email address.'); return; }
    setResetOtpError('');
    try {
      await triggerForgotPassword({ email: forgotEmail });
      toast.success('OTP sent to your email address!');
      setCurrentForm('forgot-reset');
      setResetOtpExpiryTime(Date.now() + 10 * 60 * 1000);
      setResetOtpCooldown(60);
    } catch (err: any) {
      toast.error(`Error: ${err.data?.message || 'Failed to send reset email'}`);
    }
  };

  const handleResendResetOtp = async () => {
    if (resetOtpCooldown > 0) { setResetOtpError(`Please wait ${resetOtpCooldown}s before requesting a new OTP.`); return; }
    if (!forgotEmail) { setResetOtpError('Please enter your email address.'); return; }
    setResetOtpError('');
    try {
      await triggerForgotPassword({ email: forgotEmail });
      toast.success('New OTP sent to your email!');
      setResetOtpExpiryTime(Date.now() + 10 * 60 * 1000);
      setResetOtpCooldown(60);
      setResetOtp('');
    } catch (err: any) {
      setResetOtpError(`Error: ${err.data?.message || 'Failed to resend OTP'}`);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { setResetOtpError('Please enter your email address.'); return; }
    if (!resetOtp || resetOtp.length !== 6) { setResetOtpError('Please enter the complete 6-digit OTP.'); return; }
    if (!newPassword || !confirmNewPassword) { setResetOtpError('Please fill in all password fields.'); return; }
    if (newPassword !== confirmNewPassword) { setResetOtpError("Passwords don't match."); return; }
    if (newPassword.length < 6) { setResetOtpError('Password must be at least 6 characters long.'); return; }
    if (resetOtpExpiryTime && Date.now() > resetOtpExpiryTime) { setResetOtpError('OTP expired. Please request a new one.'); return; }
    setResetOtpError('');
    try {
      await triggerResetPassword({
        email: forgotEmail.trim().toLowerCase(), otp_code: resetOtp,
        new_password: newPassword, confirm_password: confirmNewPassword,
      });
      toast.success('Password reset successfully! Please login with your new password.');
      resetToEmailLogin();
    } catch (err: any) {
      setResetOtp('');
      setResetOtpError(err.data?.message || 'Failed to reset password. Please check your OTP and try again.');
    }
  };

  const handleOtpExpiry = () => { setOtpError('OTP expired. Please request a new one.'); setOtpExpiryTime(null); };
  const handleResetOtpExpiry = () => { setResetOtpError('OTP expired. Please request a new one.'); setResetOtpExpiryTime(null); };
  const handleSignupOtpExpiry = () => { setSignupOtpError('OTP expired. Please request a new one.'); setSignupOtpExpiryTime(null); };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    document.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  // ── Form Renderer ─────────────────────────────────────────────────────────
  const renderCurrentForm = () => {
    switch (currentForm) {
      case 'email-login':
        return (
          <>
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label>Email Address</label>
                <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required />
                <i className="fas fa-envelope" />
              </div>
              <div className="input-group">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#313b96', display: 'flex', alignItems: 'center' }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>
              <div className="forgot-password">
                <span onClick={() => setCurrentForm('forgot-email')} style={{ cursor: 'pointer', color: '#313b96' }}>Forgot password?</span>
              </div>
              <button type="submit" disabled={loginLoading}>Login now</button>
            </form>
          </>
        );

      case 'phone-entry':
        return (
          <div className="otp-phone-screen">
            <h3>Sign in with OTP</h3>
            <div className="input-group">
              <label>Email</label>
              <input type="email" placeholder="Enter your email address" value={email} onChange={e => setEmail(e.target.value)} required />
              <i className="fas fa-envelope" />
            </div>
            <ErrorMessage message={otpError} type="error" />
            <button type="button" onClick={handleSendOtp} className="submit-button" disabled={sendOtpLoading || resendCooldown > 0 || isOtpBlocked}>
              {sendOtpLoading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        );

      case 'phone-verify':
        return (
          <div style={{ padding: '20px 15px', textAlign: 'center', background: '#fff', borderRadius: '16px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <h3 style={{ color: '#313b96', marginBottom: '8px', fontSize: '28px', fontWeight: '700' }}>Verify OTP</h3>
            <p style={{ color: '#6b7280', marginBottom: '35px', fontSize: '15px', lineHeight: '1.6' }}>Enter your email and the 6-digit code sent to your inbox</p>
            <form onSubmit={e => { e.preventDefault(); handleVerifyOtp(); }}>
              <div style={{ marginBottom: '25px', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input type="email" placeholder="Enter your email" value={verifyLoginEmail} onChange={e => setVerifyLoginEmail(e.target.value)} required disabled={verifyOtpLoading}
                    style={{ width: '100%', padding: '12px 40px 12px 12px', fontSize: '15px', border: '2px solid #e1e5e9', borderRadius: '10px', outline: 'none', boxSizing: 'border-box' }} />
                  <i className="fas fa-envelope" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '20px', color: '#374151', fontSize: '16px', fontWeight: '600' }}>Enter OTP</label>
                <OTPInput value={otp} onChange={setOtp} length={6} disabled={verifyOtpLoading || isOtpBlocked} />
              </div>
              <div style={{ margin: '20px 0' }}>
                <CountdownTimer endTime={otpExpiryTime} onExpire={handleOtpExpiry} label="OTP expires in" />
              </div>
              <ErrorMessage message={otpError} type="error" />
              {otpSuccess && <ErrorMessage message={otpSuccess} type="info" />}
              {otpAttempts > 0 && !isOtpBlocked && <ErrorMessage message={`${maxOtpAttempts - otpAttempts} attempts remaining`} type="warning" />}
              <div style={{ margin: '25px 0 15px 0' }}>
                <HoverButton type="submit" disabled={Boolean(verifyOtpLoading || isOtpBlocked || !verifyLoginEmail || !otp || otp.length !== 6 || (otpExpiryTime && Date.now() > otpExpiryTime))} loading={verifyOtpLoading} variant="primary">Verify OTP</HoverButton>
              </div>
            </form>
            {resendCooldown === 0 ? (
              <div style={{ marginTop: '25px', textAlign: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '14px', display: 'block', marginBottom: '12px' }}>Didn't receive the code?</span>
                <HoverButton onClick={handleSendOtp} disabled={isOtpBlocked || sendOtpLoading || !verifyLoginEmail} variant="secondary">Resend OTP</HoverButton>
              </div>
            ) : (
              <div style={{ marginTop: '25px', color: '#6b7280', fontSize: '14px', padding: '12px 20px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <i className="fas fa-clock" style={{ marginRight: '6px', color: '#9ca3af' }} />Resend available in {resendCooldown} seconds
              </div>
            )}
            <div style={{ margin: '30px 0 0 0', textAlign: 'center' }}>
              <button onClick={() => setCurrentForm('email-login')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '0 auto', padding: '8px 12px', borderRadius: '6px' }}>
                <i className="fas fa-arrow-left" /> Back to Sign in
              </button>
            </div>
          </div>
        );

      case 'signup':
        return (
          <form onSubmit={handleSignup} className="compact-form" style={{ width: '100%', maxWidth: '100%', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px', textAlign: 'left' }}>
              {/* Row 1: First Name | Last Name */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '3px', textAlign: 'left' }}>First Name</label>
                <input type="text" placeholder="First Name" value={signupFirstName} onChange={e => setSignupFirstName(e.target.value)} required
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '3px', textAlign: 'left' }}>Last Name</label>
                <input type="text" placeholder="Last Name" value={signupLastName} onChange={e => setSignupLastName(e.target.value)} required
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>

              {/* Row 2: Email | Country */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '3px', textAlign: 'left' }}>Email Address</label>
                <input type="email" placeholder="Email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '3px', textAlign: 'left' }}>Country</label>
                <input type="text" placeholder="Country" value={signupCountry} onChange={e => setSignupCountry(e.target.value)} required
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>

              {/* Row 3: Password | Confirm Password */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '3px', textAlign: 'left' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showSignupPassword ? 'text' : 'password'} placeholder="Password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required
                    style={{ width: '100%', padding: '6px 28px 6px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
                  <span onClick={() => setShowSignupPassword(!showSignupPassword)}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#313b96', display: 'flex', alignItems: 'center' }}>
                    {showSignupPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '3px', textAlign: 'left' }}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showSignupConfirmPassword ? 'text' : 'password'} placeholder="Confirm Password" value={signupConfirmPassword} onChange={e => setSignupConfirmPassword(e.target.value)} required
                    style={{ width: '100%', padding: '6px 28px 6px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
                  <span onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#313b96', display: 'flex', alignItems: 'center' }}>
                    {showSignupConfirmPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </span>
                </div>
              </div>

              {/* Row 4: Mobile Number (full width) */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '3px', textAlign: 'left' }}>
                  Mobile Number <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '10px' }}>(Optional)</span>
                </label>
                <input type="tel" placeholder="Mobile Number" value={signupPhone} onChange={e => setSignupPhone(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <button type="submit" className="submit-btn" disabled={signupLoading}>Create Account</button>
            <div className="switch-auth">Already have an account? <span onClick={() => setCurrentForm('email-login')}>Sign in</span></div>
          </form>
        );

      case 'signup-verify':
        return (
         <div style={{ padding: '25px 20px', textAlign: 'center', background: '#fff', borderRadius: '16px', minWidth: 'auto', maxWidth: '100%', margin: '0 auto' }}>
            <h3 style={{ color: '#313b96', marginBottom: '8px', fontSize: '28px', fontWeight: '700' }}>Verify Your Email</h3>
            <p style={{ marginBottom: '35px', color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>Enter your email and the 6-digit code sent to your inbox</p>
            <form onSubmit={handleVerifySignupOtp}>
              <div style={{ marginBottom: '25px', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input type="email" placeholder="Enter your email" value={verifyEmail} onChange={e => setVerifyEmail(e.target.value)} required disabled={verifySignupLoading}
                    style={{ width: '100%', padding: '12px 40px 12px 12px', fontSize: '15px', border: '2px solid #e1e5e9', borderRadius: '10px', outline: 'none', boxSizing: 'border-box' }} />
                  <i className="fas fa-envelope" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '20px', color: '#374151', fontSize: '16px', fontWeight: '600' }}>Enter OTP</label>
                <OTPInput value={signupOtp} onChange={setSignupOtp} length={6} disabled={verifySignupLoading} />
              </div>
              <div style={{ margin: '20px 0' }}>
                <CountdownTimer endTime={signupOtpExpiryTime} onExpire={handleSignupOtpExpiry} label="OTP expires in" />
              </div>
              <ErrorMessage message={signupOtpError} type="error" />
              <div style={{ margin: '25px 0 15px 0' }}>
                <HoverButton type="submit" disabled={verifySignupLoading || !verifyEmail || !signupOtp || signupOtp.length !== 6} loading={verifySignupLoading} variant="primary">Verify Email</HoverButton>
              </div>
            </form>
            {signupOtpCooldown === 0 ? (
              <div style={{ marginTop: '25px', textAlign: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '14px', display: 'block', marginBottom: '12px' }}>Didn't receive the code?</span>
                <HoverButton onClick={handleResendSignupOtp} disabled={resendSignupOtpLoading || !verifyEmail} variant="secondary">Resend OTP</HoverButton>
              </div>
            ) : (
              <div style={{ marginTop: '25px', color: '#6b7280', fontSize: '14px', padding: '12px 20px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <i className="fas fa-clock" style={{ marginRight: '6px', color: '#9ca3af' }} />Resend available in {signupOtpCooldown} seconds
              </div>
            )}
            <div style={{ margin: '20px 0', textAlign: 'center' }}>
              <button onClick={() => setCurrentForm('signup')} style={{ background: 'none', border: 'none', color: '#313b96', cursor: 'pointer', textDecoration: 'underline' }}>Back to Signup</button>
            </div>
          </div>
        );

      case 'forgot-email':
        return (
          <div className="forgot-password-container">
            <h3>Reset Password</h3>
            <form onSubmit={handleForgotPassword}>
              <div className="input-group">
                <label>Email Address</label>
                <input type="email" placeholder="Enter your email address" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                <i className="fas fa-envelope" />
              </div>
              <button type="submit" disabled={forgotLoading} className="mt-4">{forgotLoading ? 'Sending...' : 'Send Reset OTP'}</button>
            </form>
            <div style={{ margin: '20px 0', textAlign: 'center' }}>
              <button onClick={resetToEmailLogin} style={{ background: 'none', border: 'none', color: '#313b96', cursor: 'pointer', textDecoration: 'underline' }}>Back to Login</button>
            </div>
          </div>
        );

      case 'forgot-reset':
        return (
          <div style={{ padding: '25px 20px', textAlign: 'center', background: '#fff', borderRadius: '16px', minWidth: 'auto', maxWidth: '100%', margin: '0 auto' }}>
            <h3 style={{ color: '#313b96', marginBottom: '8px', fontSize: '28px', fontWeight: '700' }}>Set New Password</h3>
            <p style={{ marginBottom: '35px', color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>Enter your email, OTP, and new password</p>
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input type="email" placeholder="Enter your email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required disabled={resetLoading}
                    style={{ width: '100%', padding: '12px 40px 12px 12px', fontSize: '15px', border: '2px solid #e1e5e9', borderRadius: '10px', outline: 'none', boxSizing: 'border-box' }} />
                  <i className="fas fa-envelope" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '20px', color: '#374151', fontSize: '16px', fontWeight: '600', textAlign: 'center' }}>Enter OTP</label>
                <OTPInput value={resetOtp} onChange={setResetOtp} length={6} disabled={resetLoading} />
              </div>
              <div style={{ margin: '20px 0' }}>
                <CountdownTimer endTime={resetOtpExpiryTime} onExpire={handleResetOtpExpiry} label="OTP expires in" />
              </div>
              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showNewPassword ? 'text' : 'password'} placeholder="Enter new password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required disabled={resetLoading}
                    style={{ width: '100%', padding: '12px 40px 12px 12px', fontSize: '15px', border: '2px solid #e1e5e9', borderRadius: '10px', outline: 'none', boxSizing: 'border-box' }} />
                  <span onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </span>
                </div>
              </div>
              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirmNewPassword ? 'text' : 'password'} placeholder="Confirm new password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required disabled={resetLoading}
                    style={{ width: '100%', padding: '12px 40px 12px 12px', fontSize: '15px', border: '2px solid #e1e5e9', borderRadius: '10px', outline: 'none', boxSizing: 'border-box' }} />
                  <span onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                    {showConfirmNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </span>
                </div>
              </div>
              <ErrorMessage message={resetOtpError} type="error" />
              <div style={{ margin: '25px 0 15px 0' }}>
                <HoverButton type="submit" disabled={resetLoading || !forgotEmail || !resetOtp || resetOtp.length !== 6 || !newPassword || !confirmNewPassword} loading={resetLoading} variant="primary">Reset Password</HoverButton>
              </div>
            </form>
            {resetOtpCooldown === 0 ? (
              <div style={{ marginTop: '25px', textAlign: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '14px', display: 'block', marginBottom: '12px' }}>Didn't receive the code?</span>
                <HoverButton onClick={handleResendResetOtp} disabled={forgotLoading || !forgotEmail} variant="secondary">Resend OTP</HoverButton>
              </div>
            ) : (
              <div style={{ marginTop: '25px', color: '#6b7280', fontSize: '14px', padding: '12px 20px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <i className="fas fa-clock" style={{ marginRight: '6px', color: '#9ca3af' }} />Resend available in {resetOtpCooldown} seconds
              </div>
            )}
            <div style={{ margin: '20px 0', textAlign: 'center' }}>
              <button onClick={resetToEmailLogin} style={{ background: 'none', border: 'none', color: '#313b96', cursor: 'pointer', textDecoration: 'underline' }}>Back to Login</button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="login-page">
      {loading && <div className="spinner-overlay"><Spinner /></div>}
      <div className="image-section">
        <div className="overlay">
          <h1>Global Business Solutions <br />with <span>AI Agent</span></h1>
          <div className={`form-container ${['signup', 'signup-verify'].includes(currentForm) ? 'signup-mode' : ''}`}>
            <Image src={loginImage} alt="Login" className="logo" />
            {(['email-login', 'phone-entry', 'phone-verify', 'signup', 'signup-verify'] as FormState[]).includes(currentForm) && (
              <div className="tab-navigation">
                <button className={`tab-button ${['email-login', 'phone-entry', 'phone-verify'].includes(currentForm) ? 'active' : ''}`} onClick={() => setCurrentForm('email-login')}>LOGIN</button>
                <button className={`tab-button ${['signup', 'signup-verify'].includes(currentForm) ? 'active' : ''}`} onClick={() => setCurrentForm('signup')}>SIGN UP</button>
              </div>
            )}
            {renderCurrentForm()}
          </div>
        </div>
      </div>
      <ToastContainer position="bottom-center" autoClose={3000} hideProgressBar />
    </div>
  );
}