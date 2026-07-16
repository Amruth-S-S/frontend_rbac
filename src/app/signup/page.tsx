// app/signup/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import loginImage from '../Login/logo.jpg';
import '../Login/Login.css'; // Reuse your existing CSS
import Link from 'next/link';
import { toast, ToastContainer } from 'react-toastify';
import Spinner from '../components/Spinner';

export default function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    // username: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
    role: '',
    language: ''
  });
  const [loading, setLoading] = useState(false);


   const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL; 
    
    const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';
  const router = useRouter();

   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

 const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      // Prepare submission data (excluding confirmPassword as it's not needed in the API)
      const { confirmPassword, mobileNumber, ...submissionData } = formData;
      const finalData = {
        ...submissionData,
        phone_number: mobileNumber // Map to the expected API field name
      };

      const response = await fetch(`${API_BASE_URL}/client-users/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "X-API-Key": EXCEL_API_KEY
        },
        body: JSON.stringify(finalData),
      });

      if (response.ok) {
        toast.success('Account created successfully!');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while processing your request.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-page">
      {loading && (
        <div className="spinner-overlay">
          <Spinner />
        </div>
      )}
      <div className="image-section">
        <div className="overlay">
          <h1>Global Business Solutions <br />with <span>AI Agent</span></h1>
          <div className="form-container">
            <Image src={loginImage} alt="Sign Up" className="logo" />
            <h2 style={{ color: "#313b96", textAlign: "left" }}><b>CREATE ACCOUNT</b></h2>
            <p style={{ textAlign: "left", marginBottom: "20px" }}>
              A brand new day is here. It's your day to shape. Sign up and get started on your projects.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* <div className="input-group">
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div> */}

              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Mobile Number</label>
                <input
                  type="tel"
                  name="mobileNumber"
                  placeholder="Mobile Number"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* <div className="input-group">
                <label>Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Role</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                  <option value="consultant">Consultant</option>
                </select>
              </div> */}

              {/* <div className="input-group">
                <label>Language</label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Language</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div> */}

              <button type="submit" disabled={loading}>
                Create Account
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <p>Already have an account? <Link href="/login" style={{ color: "#313b96", fontWeight: "bold" }}>Sign in</Link></p>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer position="bottom-center" autoClose={3000} hideProgressBar />
    </div>
  );
}