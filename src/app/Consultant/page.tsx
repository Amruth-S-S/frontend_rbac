"use client"
import Image from 'next/image';
import './consultant.css'
import loginImage from '../assets/logo.jpg';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Menu, X } from 'lucide-react';

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
    const [view, setView] = useState<'home' | 'welcome'>('home');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const userData = sessionStorage.getItem('currentUserData');
        if (!userData) {
            router.replace('/Login');
        }
    }, []);

    const [userData, setUserData] = useState<UserData>({
        email: "",
        userId: "",
        userRole: "",
        userName: "",
    });
    const [isMounted, setIsMounted] = useState(false);

    const goToConsultantScreen = () => {
        router.push('/Container');
        setShowMobileMenu(false);
    };

    const goToCXOScreen = () => {
        router.push('/CXO');
        setShowMobileMenu(false);
    };

    const handleLogout = () => {
        sessionStorage.clear();
        router.replace('/');
        setShowMobileMenu(false);
    };

    const toggleDropdown = () => setShowDropdown(p => !p);

    const toggleMobileMenu = () => {
        setShowMobileMenu(p => {
            if (!p) document.body.classList.add('mobile-menu-open');
            else document.body.classList.remove('mobile-menu-open');
            return !p;
        });
    };

    useEffect(() => { setIsMounted(true); }, []);

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
            if (localStorageData.userId) setUserData(localStorageData);
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }, [isMounted]);

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            {/* Navbar */}
            <header className="consultant-navbar">
                {/* Left: Logo */}
                <div className="consultant-navbar-logo">
                    <Image src={loginImage} alt="Logo" className="consultant-logo-img" />
                </div>

                {/* Center: Nav links */}
                <nav className="consultant-nav-links">
                    <a href="/Container" className="consultant-nav-link">Consultant</a>
                    <a href="/CXO" className="consultant-nav-link">CXO</a>
                </nav>

                {/* Right: User info + Settings */}
                <div className="consultant-navbar-right" ref={dropdownRef}>
                    <div className="consultant-user-info">
                        <span className="consultant-user-name">{userData.userName || "Guest"}</span>
                        <span className="consultant-user-email">{userData.email || ""}</span>
                    </div>
                    <button className="consultant-settings-btn" onClick={toggleDropdown} title="Settings">
                        <Settings size={18} />
                    </button>

                    {showDropdown && (
                        <div className="consultant-settings-dropdown">
                            <button className="consultant-logout-item" onClick={handleLogout}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                Logout
                            </button>
                        </div>
                    )}

                    {/* Mobile menu button */}
                    <button className="mobile-menu-button" onClick={toggleMobileMenu}>
                        <Menu size={22} />
                    </button>
                </div>
            </header>

            {/* Mobile Navigation */}
            <div className={`mobile-nav ${showMobileMenu ? 'active' : ''}`}>
                <div className="mobile-nav-content">
                    <div className="mobile-nav-header">
                        <span className="mobile-nav-title">Menu</span>
                        <button className="mobile-nav-close" onClick={toggleMobileMenu}><X /></button>
                    </div>
                    <div className="mobile-user-info">
                        <p><strong>Name:</strong> {userData.userName || "N/A"}</p>
                        <p><strong>Email:</strong> {userData.email || "N/A"}</p>
                    </div>
                    <div className="mobile-nav-links">
                        <a href="/Container" className="mobile-nav-link">Consultant</a>
                        <a href="/CXO" className="mobile-nav-link">CXO</a>
                    </div>
                    <button onClick={handleLogout} className="mobile-logout-button">Logout</button>
                </div>
            </div>

            {/* Main Content */}
            <main className="consultant-main">
                {/* Large Logo */}
                <div className="consultant-logo-section">
                    <Image src={loginImage} alt="GBusiness AI" className="consultant-main-logo" />
                </div>

                {/* Cards */}
                <div className="consultant-cards-container">
                    {/* Consultant Card */}
                    <div className="consultant-card" onClick={goToConsultantScreen}>
                        <h2 className="consultant-card-title">Consultant</h2>
                        <div className="consultant-card-icon">
                            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="90" height="90">
                                <rect x="10" y="10" width="80" height="80" rx="12" fill="#dbeafe" />
                                <circle cx="35" cy="42" r="11" fill="#3b82f6" />
                                <circle cx="65" cy="42" r="11" fill="#3b82f6" />
                                <rect x="22" y="58" width="56" height="22" rx="11" fill="#3b82f6" />
                                <rect x="28" y="8" width="14" height="16" rx="3" fill="#3b82f6" />
                                <rect x="58" y="8" width="14" height="16" rx="3" fill="#3b82f6" />
                                <rect x="45" y="28" width="10" height="14" rx="2" fill="#93c5fd" />
                            </svg>
                        </div>
                    </div>

                    {/* CXO Card */}
                    <div className="consultant-card" onClick={goToCXOScreen}>
                        <h2 className="consultant-card-title">CXO</h2>
                        <div className="consultant-card-icon">
                            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="90" height="90">
                                <rect x="10" y="10" width="80" height="80" rx="12" fill="#d1fae5" />
                                <circle cx="50" cy="32" r="13" fill="#10b981" stroke="#a7f3d0" strokeWidth="3" />
                                <rect x="32" y="50" width="36" height="32" rx="6" fill="#10b981" />
                                <rect x="38" y="56" width="24" height="5" rx="2" fill="white" />
                                <circle cx="75" cy="28" r="10" fill="#34d399" />
                                <path d="M70 28 l3 3 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </svg>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
