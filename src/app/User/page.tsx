"use client";
import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'Singapore', 'UAE', 'Japan', 'Other',
];

const TIMEZONES = [
  'Asia/Kolkata', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'UTC',
];

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CreateUserForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_number: '',
    password: '',
    confirm_password: '',
    country: '',
    timezone: '',
    department: '',
    designation: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, string> = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        mobile_number: formData.mobile_number,
        password: formData.password,
        confirm_password: formData.confirm_password,
        country: formData.country,
      };
      if (formData.timezone) payload.timezone = formData.timezone;
      if (formData.department) payload.department = formData.department;
      if (formData.designation) payload.designation = formData.designation;

      const response = await fetch(`${API_BASE_URL}/client-users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-Key': EXCEL_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('User registered successfully!');
        setTimeout(() => router.push('/UserList?success=created'), 1000);
      } else {
        const errorData = await response.json().catch(() => null);
        const msg = errorData?.detail?.[0]?.msg || errorData?.message || `Error ${response.status}`;
        toast.error(`Registration failed: ${msg}`);
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm";
  const labelCls = "block text-gray-700 text-sm font-semibold mb-1";
  const requiredMark = <span className="text-red-500 ml-0.5">*</span>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-6 pt-10">
      <div className="bg-white shadow-lg rounded-xl p-8 w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-blue-600">Register New User</h2>
            <p className="text-xs text-gray-500 mt-0.5">User will be in &ldquo;no organization&rdquo; state until an OWNER/SUPER_ADMIN adds them.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/UserList')}
            className="text-gray-500 hover:text-gray-700 text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            ← Back
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Required fields section */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Required Information</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name {requiredMark}</label>
                <input type="text" name="first_name" value={formData.first_name} onChange={handleChange}
                  required disabled={isLoading} placeholder="e.g. John" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Last Name {requiredMark}</label>
                <input type="text" name="last_name" value={formData.last_name} onChange={handleChange}
                  required disabled={isLoading} placeholder="e.g. Doe" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email {requiredMark}</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange}
                  required disabled={isLoading} placeholder="john@example.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Mobile Number {requiredMark}</label>
                <input type="tel" name="mobile_number" value={formData.mobile_number} onChange={handleChange}
                  required disabled={isLoading} placeholder="+91-9876543210" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password {requiredMark}</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password}
                    onChange={handleChange} required disabled={isLoading} placeholder="Min. 8 characters"
                    className={`${inputCls} pr-10`} minLength={8} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Confirm Password {requiredMark}</label>
                <div className="relative">
                  <input type={showConfirmPassword ? 'text' : 'password'} name="confirm_password" value={formData.confirm_password}
                    onChange={handleChange} required disabled={isLoading} placeholder="Re-enter password"
                    className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">
                    <EyeIcon visible={showConfirmPassword} />
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Country {requiredMark}</label>
                <select name="country" value={formData.country} onChange={handleChange}
                  required disabled={isLoading} className={inputCls}>
                  <option value="">Select country…</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Optional fields section */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Optional Information</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Timezone</label>
                <select name="timezone" value={formData.timezone} onChange={handleChange}
                  disabled={isLoading} className={inputCls}>
                  <option value="">Select timezone…</option>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Department</label>
                <input type="text" name="department" value={formData.department} onChange={handleChange}
                  disabled={isLoading} placeholder="e.g. Finance, Operations" className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Designation</label>
                <input type="text" name="designation" value={formData.designation} onChange={handleChange}
                  disabled={isLoading} placeholder="e.g. Manager, Analyst" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.push('/UserList')} disabled={isLoading}
              className="w-1/2 bg-gray-100 text-gray-700 border border-gray-300 py-2.5 px-4 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
              className="w-1/2 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Registering…
                </>
              ) : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CreateUserForm />
    </Suspense>
  );
}
