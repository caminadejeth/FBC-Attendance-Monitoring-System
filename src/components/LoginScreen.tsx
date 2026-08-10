import React, { useState } from 'react';
import { User, UserRole } from '../types';
import {
  Shield,
  KeyRound,
  Calculator,
  ArrowRight,
  Lock,
  CheckCircle2,
  User as UserIcon,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { YellowCabPlateLogo, YellowCabCheckerboard } from './YellowCabBrand';
import { showLoginToast, showErrorAlert } from '../utils/sweetAlerts';

interface LoginScreenProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLoginSuccess }) => {
  // Single Unified Login Form Inputs
  const [userIdInput, setUserIdInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Group users by role for organized dropdown and quick access
  const staffUsers = users.filter((u) => u.role === 'STAFF');
  const managerUsers = users.filter((u) => u.role === 'SHIFT_MANAGER' || u.role === 'BRANCH_MANAGER');
  const adminUsers = users.filter((u) => u.role === 'ADMIN');
  const payrollUsers = users.filter((u) => u.role === 'PAYROLL');

  // Handle User ID + PIN Submission
  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');

    const trimmedUserId = userIdInput.trim().toUpperCase();
    const trimmedPin = pinInput.trim();

    if (!trimmedUserId) {
      setLoginError('Please enter your Employee User ID.');
      return;
    }

    if (!trimmedPin) {
      setLoginError('Please enter your 4-digit PIN.');
      return;
    }

    // Match by employeeId OR email AND pin
    const matchedUser = users.find(
      (u) =>
        (u.employeeId.toUpperCase() === trimmedUserId || u.email.toUpperCase() === trimmedUserId) &&
        u.pin === trimmedPin &&
        u.status === 'ACTIVE'
    );

    if (matchedUser) {
      showLoginToast(matchedUser.name, matchedUser.role);
      onLoginSuccess(matchedUser);
    } else {
      setLoginError('Invalid User ID or PIN. Please verify your credentials.');
      showErrorAlert('Authentication Failed', 'Invalid User ID or PIN Code. Please verify your credentials and try again.');
    }
  };

  // Handle Touch Keypad Press for PIN
  const handleKeypadPress = (digit: string) => {
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      setLoginError('');

      // Auto-submit if User ID is filled and PIN reaches 4 digits
      if (userIdInput.trim() && nextPin.length === 4) {
        const trimmedUserId = userIdInput.trim().toUpperCase();
        const matched = users.find(
          (u) =>
            (u.employeeId.toUpperCase() === trimmedUserId || u.email.toUpperCase() === trimmedUserId) &&
            u.pin === nextPin &&
            u.status === 'ACTIVE'
        );
        if (matched) {
          showLoginToast(matched.name, matched.role);
          onLoginSuccess(matched);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setLoginError('');
  };

  // Quick Demo Auto-Fill & Login
  const handleQuickLogin = (user: User) => {
    setUserIdInput(user.employeeId);
    setPinInput(user.pin);
    setLoginError('');
    showLoginToast(user.name, user.role);
    onLoginSuccess(user);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6 flex flex-col items-center">
        <div className="mb-3">
          <YellowCabPlateLogo size="lg" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight uppercase">
          FBC Restaurants Corp
        </h2>
        <p className="mt-1 text-xs font-bold text-amber-800">
          Biometric Attendance 
        </p>
      </div>

      {/* Main Login Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white shadow-2xl rounded-2xl border-2 border-zinc-950 overflow-hidden">
          <YellowCabCheckerboard height="h-3" />
          <div className="py-8 px-6">
            {/* Unified Login Header Banner */}
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-center mb-6">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-950 text-amber-400 tracking-wider uppercase">
                UNIFIED STORE PORTAL
              </span>
              <h3 className="text-base font-black text-zinc-950 uppercase mt-1">
                Employee & Manager Sign In
              </h3>
              <p className="text-[11px] font-medium text-amber-900 mt-0.5">
                Staff & Managers log in using their Employee User ID & 4-Digit PIN. Your role automatically directs you to your respective dashboard.
              </p>
            </div>

            {/* LOGIN FORM: ASK FOR USER ID AND PIN */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* 1. USER ID FIELD */}
              <div>
                <label className="block text-xs font-black uppercase text-zinc-800 mb-1">
                  User ID / Employee ID
                </label>
                <div className="relative">
                  <input
                    id="input-user-id"
                    type="text"
                    placeholder="e.g. 1234567"
                    value={userIdInput}
                    onChange={(e) => {
                      setUserIdInput(e.target.value);
                      setLoginError('');
                    }}
                    required
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3.5 py-2.5 pl-9 text-xs font-mono font-bold text-zinc-950 placeholder-zinc-400 focus:ring-2 focus:ring-amber-400 focus:outline-none uppercase"
                  />
                  <Hash className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* 2. PIN CODE FIELD */}
              <div>
                <label className="block text-xs font-black uppercase text-zinc-800 mb-1">
                  4-Digit Security PIN
                </label>
                <div className="relative">
                  <input
                    id="input-user-pin"
                    type="password"
                    maxLength={6}
                    placeholder="Enter 4-Digit PIN"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setLoginError('');
                    }}
                    required
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3.5 py-2.5 pl-9 text-xs font-mono font-bold text-zinc-950 tracking-widest placeholder-zinc-400 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* ERROR MESSAGE DISPLAY */}
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* ON-SCREEN KEYPAD FOR PIN TOUCH ACCESS */}
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-black uppercase text-zinc-500 text-center">
                  Touch Keypad (Optional PIN Entry)
                </p>
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      id={`pin-btn-${digit}`}
                      onClick={() => handleKeypadPress(digit)}
                      className="h-10 rounded-xl bg-amber-100 hover:bg-amber-200 active:bg-amber-400 text-zinc-950 font-black text-base border border-amber-300 shadow-2xs transition-colors flex items-center justify-center cursor-pointer"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPinInput('')}
                    className="h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-[11px] font-bold text-zinc-700 flex items-center justify-center border border-zinc-200 cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-10 rounded-xl bg-amber-100 hover:bg-amber-200 text-zinc-950 font-black text-base border border-amber-300 shadow-2xs flex items-center justify-center cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-[11px] font-bold text-zinc-700 flex items-center justify-center border border-zinc-200 cursor-pointer"
                  >
                    ⌫
                  </button>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                id="btn-login-submit"
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider border-2 border-zinc-950 shadow-md transition-all cursor-pointer"
              >
                Sign In To Portal <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
