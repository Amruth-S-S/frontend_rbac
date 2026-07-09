"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

const ROLES = ['Admin', 'User', 'Manager', 'Analyst', 'Viewer'];
const SUBSCRIPTIONS = ['Trial', 'Gold', 'Silver', 'Platinum', 'Enterprise'];

interface EditForm {
  email: string;
  name: string;
  username: string;
  password: string;
  role: string;
  subscription: string;
}

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

export default function EditUserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('id');

  const [formData, setFormData] = useState<EditForm>({
    email: '',
    name: '',
    username: '',
    password: '',
    role: '',
    subscription: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!userId) {
      setError('No user ID provided');
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/client-users/${userId}`, {
          headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        setFormData({
          email: data.email || '',
          name: data.name || '',
          username: data.username || '',
          password: '',
          role: data.role || '',
          subscription: data.subscription || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload: Partial<EditForm> = {
        email: formData.email,
        name: formData.name,
        username: formData.username,
        role: formData.role,
        subscription: formData.subscription,
      };
      if (formData.password) payload.password = formData.password;

      const res = await fetch(`${API_BASE_URL}/client-users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-Key': EXCEL_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('User updated successfully!');
        setTimeout(() => router.push('/UserList?success=updated'), 1000);
      } else {
        const errorData = await res.json().catch(() => null);
        const msg = errorData?.detail?.[0]?.msg || errorData?.message || `Error ${res.status}`;
        toast.error(`Update failed: ${msg}`);
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm";
  const labelCls = "block text-gray-700 text-sm font-semibold mb-1";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Loading user data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-300 text-red-700 px-6 py-5 rounded-xl max-w-md w-full">
          <p className="font-bold mb-2">Failed to load user</p>
          <p className="text-sm mb-4">{error}</p>
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700">
              Try Again
            </button>
            <button onClick={() => router.push('/UserList')}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-6 pt-10">
      <div className="bg-white shadow-lg rounded-xl p-8 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-blue-600">Edit User</h2>
          <button type="button" onClick={() => router.push('/UserList')}
            className="text-gray-500 hover:text-gray-700 text-sm border border-gray-300 rounded-lg px-3 py-1.5">
            ← Back
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange}
                disabled={isSaving} placeholder="Full name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                disabled={isSaving} placeholder="john@example.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input type="text" name="username" value={formData.username} onChange={handleChange}
                disabled={isSaving} placeholder="john_doe" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Password <span className="text-gray-400 font-normal text-xs">(leave blank to keep current)</span></label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password}
                  onChange={handleChange} disabled={isSaving} placeholder="New password"
                  className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <select name="role" value={formData.role} onChange={handleChange}
                disabled={isSaving} className={inputCls}>
                <option value="">Select role…</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Subscription</label>
              <select name="subscription" value={formData.subscription} onChange={handleChange}
                disabled={isSaving} className={inputCls}>
                <option value="">Select subscription…</option>
                {SUBSCRIPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.push('/UserList')} disabled={isSaving}
              className="w-1/2 bg-gray-100 text-gray-700 border border-gray-300 py-2.5 px-4 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={isSaving}
              className="w-1/2 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2">
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
