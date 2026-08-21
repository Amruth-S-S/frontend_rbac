"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { User, Settings, LogOut, Eye, EyeOff, X, ChevronDown } from "lucide-react";

// Header-mounted account menu — avatar, name, email, Settings (change password), and
// Logout. Previously lived at the bottom of Sidebar.tsx; moved here so every page's
// header can render it instead, without duplicating the underlying logic per page.
interface UserData {
  email: string;
  userId: string;
  userRole: string;
  userName: string;
}

export default function UserProfileMenu() {
  const { t } = useTranslation();
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [userData, setUserData] = useState<UserData>({ email: "", userId: "", userRole: "", userName: "" });
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;
    try {
      const sessionData = sessionStorage.getItem("currentUserData");
      if (sessionData) {
        const p = JSON.parse(sessionData);
        setUserData({ email: p.email || "", userId: p.userId || "", userRole: p.userRole || "", userName: p.userName || "" });
        return;
      }
      const ld = {
        email: localStorage.getItem("loggedInUserEmail") || "",
        userId: localStorage.getItem("loggedInUserId") || "",
        userRole: localStorage.getItem("loggedInUserRole") || "",
        userName: localStorage.getItem("loggedInUserName") || "",
      };
      if (ld.userId) setUserData(ld);
    } catch { /* ignore */ }
  }, [isMounted]);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isDropdownOpen) return;
    const h = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isDropdownOpen]);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleSettingsClick = () => { setIsSettingsModalOpen(true); setIsDropdownOpen(false); };

  const handlePasswordUpdate = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Please fill in all password fields"); return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New password and confirm password do not match"); return;
    }
    if (passwordData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long"); return;
    }
    setIsUpdatingPassword(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password?user_id=${userData.userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": EXCEL_API_KEY },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
          confirm_password: passwordData.confirmPassword,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || "Password updated successfully!");
        setIsSettingsModalOpen(false);
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || "Failed to update password");
      }
    } catch {
      toast.error("An error occurred while updating password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("currentUserData");
    router.replace("/");
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(o => !o)}
          className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
            {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
          </div>
          <span className="hidden sm:block text-xs font-medium text-gray-800 max-w-[120px] truncate">{userData.userName || "Account"}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{userData.userName || "N/A"}</p>
                <p className="text-xs text-blue-600 truncate">{userData.email || "N/A"}</p>
              </div>
            </div>
            <div className="py-1">
              <button onClick={handleSettingsClick} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                <Settings className="w-3.5 h-3.5" /><span>Settings</span>
              </button>
              <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs text-red-600 hover:bg-red-50 transition-colors">
                <LogOut className="w-3.5 h-3.5" /><span>{t('header.logout')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Settings / Change Password Modal ─────────────────────────────── */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">Change Password</h2>
              <button onClick={() => { setIsSettingsModalOpen(false); setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" }); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {([
                { label: "Current Password", key: "currentPassword" as const, show: showCurrentPassword, toggle: () => setShowCurrentPassword(!showCurrentPassword) },
                { label: "New Password", key: "newPassword" as const, show: showNewPassword, toggle: () => setShowNewPassword(!showNewPassword) },
                { label: "Confirm New Password", key: "confirmPassword" as const, show: showConfirmPassword, toggle: () => setShowConfirmPassword(!showConfirmPassword) },
              ]).map(({ label, key, show, toggle }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
                  <div className="relative">
                    <input type={show ? "text" : "password"} value={passwordData[key]} onChange={e => setPasswordData({ ...passwordData, [key]: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 pr-9" placeholder={`Enter ${label.toLowerCase()}`} />
                    <button type="button" onClick={toggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
              <button onClick={() => { setIsSettingsModalOpen(false); setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" }); }} disabled={isUpdatingPassword} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={handlePasswordUpdate} disabled={isUpdatingPassword} className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {isUpdatingPassword ? (<><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />Updating...</>) : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
