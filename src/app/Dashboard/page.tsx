"use client"
import { useState, useRef, useEffect } from "react";
import React from 'react';

import { usePathname, useRouter } from "next/navigation";

export default function Page() {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  const [, setUser] = useState({
    name: "",
    email: "",
    id: "",
    role: "",
  });

  const router = useRouter();

 useEffect(() => {
    const userData = sessionStorage.getItem('currentUserData');
    if (!userData) {
      router.replace('/Login'); // kick back to login if no session
    }
  }, []);
  // Check for mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Fetch user details from localStorage inside useEffect
  useEffect(() => {
    setUser({
      name: localStorage.getItem("loggedInUserName") || "",
      email: localStorage.getItem("loggedInUserEmail") || "",
      id: localStorage.getItem("loggedInUserId") || "",
      role: localStorage.getItem("loggedInUserRole") || "",
    });
  }, []);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className="flex h-screen bg-gray-100">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Mobile Header Spacer */}
          {isMobile && <div className="h-14"></div>}

          {/* Header */}
          <header className={`bg-white border-b px-4 py-2 shadow-md ${isMobile ? 'fixed top-0 left-0 right-0 z-30' : ''}`}>
            <div className={`flex justify-between items-center ${isMobile ? 'w-full' : 'max-w-screen-xl mx-auto'}`}>
              {isMobile && <div className="w-8"></div>}

              {/* Dropdown */}
              <div className="relative ml-auto" ref={dropdownRef}>
                <button
                  onClick={toggleDropdown}
                  className={`flex items-center gap-2 text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}
                >
                  <span className="font-medium">
                    {pathname === '/Dashboard' ? 'Consultant Role' :
                      pathname === '/CXO' ? 'CXO Role' : 'Select Screen'}
                  </span>
                  <svg
                    className={`transition-transform ${showDropdown ? 'rotate-180' : ''} ${
                      isMobile ? 'w-3 h-3' : 'w-4 h-4'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showDropdown && (
                  <div className={`absolute right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 ${
                    isMobile ? 'w-36' : 'w-44'
                  }`}>
                    <a
                      href="/Dashboard"
                      className={`block px-3 py-1.5 ${isMobile ? 'text-xs' : 'text-sm'} ${
                        pathname === '/Dashboard'
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Consultant Role
                    </a>
                    <a
                      href="/CXO"
                      className={`block px-3 py-1.5 ${isMobile ? 'text-xs' : 'text-sm'} ${
                        pathname === '/CXO'
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      CXO Role
                    </a>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className={`flex-1 bg-gray-200 overflow-y-auto flex flex-col ${
            isMobile ? 'p-2' : 'p-3'
          }`}>
            <div className="max-w-6xl mx-auto w-full">

              {/* Top Section - Data Management, Prompt Repository, Settings */}
              <div className={`grid gap-3 mb-3 ${
                isMobile ? 'grid-cols-1' : 'grid-cols-3'
              }`}>

                {/* Data Management */}
                <div className="bg-white p-2 border rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <h3 className={`flex items-center font-semibold mb-2 ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}>
                    <span className="mr-2">📊</span> Data Management
                  </h3>
                  <div className={`space-y-1.5 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                    <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">
                      Configure Sources
                    </div>
                    <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">
                      Upload Data
                    </div>
                    {isMobile && (
                      <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">
                        Data Sources
                      </div>
                    )}
                  </div>
                </div>

                {/* Prompt Repository */}
                <div className="bg-white p-3 border rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <h3 className={`flex items-center font-semibold mb-2 ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}>
                    <span className="mr-2">📝</span> Prompt Repository
                  </h3>
                  <div className={`space-y-1.5 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                    <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">
                      Saved Prompts
                    </div>
                    <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">
                      Templates
                    </div>
                    {isMobile && (
                      <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">
                        Prompt History
                      </div>
                    )}
                  </div>
                </div>

                {/* Settings */}
                <div className="bg-white p-3 border rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <h3 className={`flex items-center font-semibold mb-2 ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}>
                    <span className="mr-2">⚙</span> Settings
                  </h3>
                  <div className={`space-y-1.5 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                    <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">
                      Board Settings
                    </div>
                    <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">
                      Permissions
                    </div>
                    {isMobile && (
                      <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">
                        User Settings
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Section - Visualization Area */}
              <div className={`grid gap-3 ${
                isMobile ? 'grid-cols-1' : 'grid-cols-3'
              }`}>

                {/* Revenue Over Time */}
                <div className="bg-white p-3 border rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <h3 className={`font-semibold mb-3 ${
                    isMobile ? 'text-sm' : 'text-base'
                  }`}>
                    Revenue Over Time
                  </h3>
                  <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${
                    isMobile ? 'h-32' : 'h-44'
                  }`}>
                    <div className="text-gray-500 text-center">
                      <div className="text-2xl mb-1">📈</div>
                      <div className="text-xs">Chart Visualization</div>
                      <div className="text-xs">{isMobile ? 'Tap to expand' : 'Hover for details'}</div>
                    </div>
                  </div>
                </div>

                {/* Sales Analytics */}
                <div className="bg-white p-3 border rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <h3 className={`font-semibold mb-3 ${
                    isMobile ? 'text-sm' : 'text-base'
                  }`}>
                    Sales Analytics
                  </h3>
                  <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${
                    isMobile ? 'h-32' : 'h-44'
                  }`}>
                    <div className="text-gray-500 text-center">
                      <div className="text-2xl mb-1">📊</div>
                      <div className="text-xs">Sales Data</div>
                      <div className="text-xs">{isMobile ? 'Tap to expand' : 'Hover for details'}</div>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-white p-3 border rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <h3 className={`font-semibold mb-3 ${
                    isMobile ? 'text-sm' : 'text-base'
                  }`}>
                    Performance Metrics
                  </h3>
                  <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${
                    isMobile ? 'h-32' : 'h-44'
                  }`}>
                    <div className="text-gray-500 text-center">
                      <div className="text-2xl mb-1">🎯</div>
                      <div className="text-xs">KPI Dashboard</div>
                      <div className="text-xs">{isMobile ? 'Tap to expand' : 'Hover for details'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Mobile-only Section */}
              {isMobile && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {/* Quick Actions */}
                  <div className="bg-white p-3 border rounded-lg shadow-md">
                    <h3 className="flex items-center text-xs font-semibold mb-2">
                      <span className="mr-2">🚀</span> Quick Actions
                    </h3>
                    <div className="space-y-1.5 text-xs">
                      <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">New Analysis</div>
                      <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">Recent Files</div>
                      <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">Export Data</div>
                    </div>
                  </div>

                  {/* Updates */}
                  <div className="bg-white p-3 border rounded-lg shadow-md">
                    <h3 className="flex items-center text-xs font-semibold mb-2">
                      <span className="mr-2">🔔</span> Updates
                    </h3>
                    <div className="space-y-1.5 text-xs">
                      <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">System Alerts</div>
                      <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">New Features</div>
                      <div className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors">Maintenance</div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </>
  );
}