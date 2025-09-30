import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo } from 'react';

export interface User {
  id: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  deviceId: string;
  createdAt: string;
}

export const [UserProvider, useUserStore] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [phoneVerificationCode, setPhoneVerificationCode] = useState<string>('');
  const [isVerifyingPhone, setIsVerifyingPhone] = useState<boolean>(false);
  const [pendingUser, setPendingUser] = useState<{ email: string; phone: string } | null>(null);

  const sendPhoneVerification = useCallback(async (phone: string) => {
    if (!phone.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Simulate sending SMS verification code
      await new Promise(resolve => {
        if (typeof resolve === 'function') {
          setTimeout(resolve, 1000);
        }
      });
      
      // Generate a mock verification code for demo
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`Mock SMS verification code: ${mockCode}`);
      
      setIsLoading(false);
      return mockCode; // In real app, this would be sent via SMS
    } catch {
      setIsLoading(false);
      throw new Error('Failed to send verification code');
    }
  }, []);

  const login = useCallback(async (email: string, phone: string) => {
    if (!email.trim() || !phone.trim()) return;
    if (email.length > 100 || phone.length > 20) return;
    
    const sanitizedEmail = email.trim();
    const sanitizedPhone = phone.trim();
    
    setIsLoading(true);
    
    try {
      await new Promise(resolve => {
        if (typeof resolve === 'function') {
          setTimeout(resolve, 1500);
        }
      });
      
      const newUser: User = {
        id: '1',
        email: sanitizedEmail,
        phone: sanitizedPhone,
        phoneVerified: true, // Assume existing users are verified
        deviceId: 'device-123',
        createdAt: new Date().toISOString(),
      };
      
      setUser(newUser);
      setIsLoggedIn(true);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      throw new Error('Login failed');
    }
  }, []);

  const register = useCallback(async (email: string, phone: string) => {
    if (!email.trim() || !phone.trim()) return;
    if (email.length > 100 || phone.length > 20) return;
    
    const sanitizedEmail = email.trim();
    const sanitizedPhone = phone.trim();
    
    // Store pending user data and initiate phone verification
    setPendingUser({ email: sanitizedEmail, phone: sanitizedPhone });
    setIsVerifyingPhone(true);
    
    // Send verification code
    await sendPhoneVerification(sanitizedPhone);
  }, [sendPhoneVerification]);

  const verifyPhoneAndCompleteRegistration = useCallback(async (code: string) => {
    if (!pendingUser || !code.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Simulate verification process
      await new Promise(resolve => {
        if (typeof resolve === 'function') {
          setTimeout(resolve, 1000);
        }
      });
      
      // In a real app, you would verify the code with your backend
      // For demo purposes, we'll accept any 6-digit code
      if (code.length !== 6) {
        throw new Error('Invalid verification code');
      }
      
      const newUser: User = {
        id: Date.now().toString(),
        email: pendingUser.email,
        phone: pendingUser.phone,
        phoneVerified: true,
        deviceId: 'device-123',
        createdAt: new Date().toISOString(),
      };
      
      setUser(newUser);
      setIsLoggedIn(true);
      setIsVerifyingPhone(false);
      setPendingUser(null);
      setPhoneVerificationCode('');
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      throw new Error('Phone verification failed');
    }
  }, [pendingUser]);

  const logout = useCallback(async () => {
    setUser(null);
    setIsLoggedIn(false);
    setVerificationCode(null);
    setIsVerifyingPhone(false);
    setPendingUser(null);
    setPhoneVerificationCode('');
  }, []);

  const cancelPhoneVerification = useCallback(() => {
    setIsVerifyingPhone(false);
    setPendingUser(null);
    setPhoneVerificationCode('');
    setIsLoading(false);
  }, []);

  const generateVerificationCode = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    setVerificationCode(code);
  }, []);

  return useMemo(() => ({
    user,
    isLoggedIn,
    verificationCode,
    isLoading,
    phoneVerificationCode,
    isVerifyingPhone,
    pendingUser,
    login,
    register,
    logout,
    generateVerificationCode,
    sendPhoneVerification,
    verifyPhoneAndCompleteRegistration,
    cancelPhoneVerification,
    setPhoneVerificationCode,
  }), [user, isLoggedIn, verificationCode, isLoading, phoneVerificationCode, isVerifyingPhone, pendingUser, login, register, logout, generateVerificationCode, sendPhoneVerification, verifyPhoneAndCompleteRegistration, cancelPhoneVerification]);
});