"use client"
import Image from 'next/image';
import './consultant.css'
import loginImage from '../assets/logo.jpg';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Menu, X } from 'lucide-react';

// ✅ FIX: Use App Router metadata API instead of next/head
// Note: metadata exports only work in Server Components.
// Since this page is "use client", add a separate layout.tsx or
// metadata.ts file in the same folder if you need custom metadata.
// For now, the Head import is simply removed to fix the build warning.

interface UserData {
  email: string;
  userId: string;
  userRole: string;
  userName: string;
}

export default function Page() {
    const router = useRouter();
    const [showDropdown, setShowDropdown] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [userData, setUserData] = useState<UserData>({
      email: "",
      userId: "",
      userRole: "",
      userName: "",
    });
    const [isMounted, setIsMounted] = useState(false);

    const goToConsultantScreen = () => {
        router.push('/Dashboard');
        setShowMobileMenu(false);
    };

    const goToCXOScreen = () => {
        router.push('/CXO');
        setShowMobileMenu(false);
    };

    const handleLogout = () => {
        router.push('/');
        setShowMobileMenu(false);
    };

    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    const toggleMobileMenu = () => {
        setShowMobileMenu(!showMobileMenu);
        if (!showMobileMenu) {
            document.body.classList.add('mobile-menu-open');
        } else {
            document.body.classList.remove('mobile-menu-open');
        }
    };

    useEffect(() => {
        setIsMounted(true);
    }, []);
   
    // Load user data from storage after component mounts
    useEffect(() => {
        if (!isMounted || typeof window === 'undefined') return;
        try {
            const sessionData = sessionStorage.getItem('currentUserData');
            if (sessionData) {
                const parsedData = JSON.parse(sessionData);
                setUserData({
                    email: parsedData.email || "",
                    userId: parsedData.userId || "",
                    userRole: parsedData.userRole || "",
                    userName: parsedData.userName || "",
                });
                return;
            }
            const localStorageData = {
                email: localStorage.getItem('loggedInUserEmail') || "",
                userId: localStorage.getItem('loggedInUserId') || "",
                userRole: localStorage.getItem('loggedInUserRole') || "",
                userName: localStorage.getItem('loggedInUserName') || "",
            };
            if (localStorageData.userId) {
                setUserData(localStorageData);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }, [isMounted]);

    // Close mobile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMobileMenu && !(event.target as Element).closest('.mobile-nav-content') && 
                !(event.target as Element).closest('.mobile-menu-button')) {
                setShowMobileMenu(false);
                document.body.classList.remove('mobile-menu-open');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.classList.remove('mobile-menu-open');
        };
    }, [showMobileMenu]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    return (
        <div>
            <div className="min-h-screen flex flex-col bg-gray-100">
                {/* Header/Navigation */}
                <header className="header-container">
                    <div className="header-left">
                        <div className="user-info-section">
                            {/* Desktop User Info */}
                            <div className="user-profile" onClick={toggleDropdown}>
                                <User className="user-icon" />
                                <span className="user-name">{userData.userName || "Guest"}</span>
                            </div>

                            {/* Desktop Navigation Links */}
                            <div className="nav-links">
                                <a href="/Dashboard" className="nav-link">Consultant</a>
                                <a href="/CXO" className="nav-link">CXO</a>
                            </div>

                            {/* Dropdown Menu (Desktop) */}
                            {showDropdown && (
                                <div ref={dropdownRef} className="dropdown-menu">
                                    <p className="dropdown-title">User Info</p>
                                    <hr className="dropdown-divider" />
                                    <p className="dropdown-info">Name: {userData.userName || "N/A"}</p>
                                    <p className="dropdown-info">Email: {userData.email || "N/A"}</p>
                                    <p className="dropdown-info">ID: {userData.userId || "N/A"}</p>
                                    <p className="dropdown-info">Role: {userData.userRole || "N/A"}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop Logout Button */}
                    <div>
                        <button onClick={handleLogout} className="logout-button">
                            Logout
                        </button>
                    </div>

                    {/* Mobile Menu Button */}
                    <button className="mobile-menu-button" onClick={toggleMobileMenu}>
                        <Menu />
                    </button>
                </header>

                {/* Mobile Navigation Menu */}
                <div className={`mobile-nav ${showMobileMenu ? 'active' : ''}`}>
                    <div className="mobile-nav-content">
                        <div className="mobile-nav-header">
                            <span className="mobile-nav-title">Menu</span>
                            <button className="mobile-nav-close" onClick={toggleMobileMenu}>
                                <X />
                            </button>
                        </div>

                        {/* Mobile User Info */}
                        <div className="mobile-user-info">
                            <p><strong>Name:</strong> {userData.userName || "N/A"}</p>
                            <p><strong>Email:</strong> {userData.email || "N/A"}</p>
                            <p><strong>ID:</strong> {userData.userId || "N/A"}</p>
                            <p><strong>Role:</strong> {userData.userRole || "N/A"}</p>
                        </div>

                        {/* Mobile Navigation Links */}
                        <div className="mobile-nav-links">
                            <a href="/Dashboard" className="mobile-nav-link">Consultant</a>
                            <a href="/CXO" className="mobile-nav-link">CXO</a>
                        </div>

                        {/* Mobile Logout Button */}
                        <button onClick={handleLogout} className="mobile-logout-button">
                            Logout
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <main className="main-content">
                    {/* Logo and Title */}
                    <div className="logo-section">
                        <div className="logo-container">
                            <div>
                                <Image src={loginImage} alt="Login" className="logo" />
                            </div>
                        </div>
                    </div>

                    {/* Screen Options */}
                    <div className="cards-container">
                        {/* Consultant Screen Card */}
                        <div className="card-wrapper">
                            <div className="card" onClick={goToConsultantScreen}>
                                <h2 className="card-title">Consultant</h2>
                                <div className="card-icon">
                                    <div className="w-full h-full">
                                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                                            <rect x="15" y="15" width="70" height="70" rx="10" fill="#C7D9FF" />
                                            <circle cx="35" cy="45" r="10" fill="#4F7BFF" />
                                            <circle cx="65" cy="45" r="10" fill="#4F7BFF" />
                                            <rect x="25" y="60" width="50" height="20" rx="10" fill="#4F7BFF" />
                                            <rect x="30" y="10" width="15" height="15" rx="2" fill="#4F7BFF" />
                                            <rect x="55" y="10" width="15" height="15" rx="2" fill="#4F7BFF" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CXO Screen Card */}
                        <div className="card-wrapper">
                            <div className="card" onClick={goToCXOScreen}>
                                <h2 className="card-title">CXO</h2>
                                <div className="card-icon">
                                    <div className="w-full h-full">
                                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                                            <circle cx="50" cy="35" r="15" fill="#4F7BFF" stroke="#C7F0E0" strokeWidth="4" />
                                            <path d="M30 75 Q50 55 70 75" stroke="#C7F0E0" strokeWidth="4" fill="none" />
                                            <rect x="35" y="50" width="30" height="35" rx="5" fill="#4F7BFF" />
                                            <rect x="40" y="55" width="20" height="5" fill="white" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}