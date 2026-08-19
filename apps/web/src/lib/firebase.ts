import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as fbSignOut,
  type UserCredential,
  type ConfirmationResult,
} from 'firebase/auth';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyC6bEzhMXO1y10oKbdmdmBZPyu3FVjp8T4",
  authDomain: "prevo-paper-trading.firebaseapp.com",
  projectId: "prevo-paper-trading",
  storageBucket: "prevo-paper-trading.firebasestorage.app",
  messagingSenderId: "274789262739",
  appId: "1:274789262739:web:696a18d2758d043591f466"
};

// Initialize Firebase (singleton safe)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// 1. Google Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// 2. Apple Provider
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

export interface FirebaseSocialUser {
  email: string;
  fullName: string;
  photoUrl?: string;
  uid: string;
  provider: 'google' | 'apple' | 'phone';
  phone?: string;
  idToken: string;
}

/**
 * 1. Google Sign-In with Firebase Popup
 */
export const signInWithFirebaseGoogle = async (): Promise<FirebaseSocialUser> => {
  const result: UserCredential = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const idToken = await user.getIdToken();

  if (!user.email) {
    throw new Error('Google account does not have an associated email address.');
  }

  return {
    email: user.email,
    fullName: user.displayName || user.email.split('@')[0] || 'Google Trader',
    photoUrl: user.photoURL || undefined,
    uid: user.uid,
    provider: 'google',
    idToken,
  };
};

/**
 * 2. Apple Sign-In with Firebase Popup
 */
export const signInWithFirebaseApple = async (): Promise<FirebaseSocialUser> => {
  const result: UserCredential = await signInWithPopup(auth, appleProvider);
  const user = result.user;
  const idToken = await user.getIdToken();

  const email = user.email || `apple_${user.uid.slice(0, 8)}@privaterelay.appleid.com`;
  const fullName = user.displayName || 'Apple Trader';

  return {
    email,
    fullName,
    photoUrl: user.photoURL || undefined,
    uid: user.uid,
    provider: 'apple',
    idToken,
  };
};

/**
 * 3. Phone OTP Authentication with Firebase Recaptcha
 */
let recaptchaVerifier: RecaptchaVerifier | null = null;

export const setupRecaptcha = (containerId: string = 'recaptcha-container'): RecaptchaVerifier => {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // Ignore
    }
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved
    },
    'expired-callback': () => {
      recaptchaVerifier = null;
    },
  });

  return recaptchaVerifier;
};

export const sendFirebasePhoneOtp = async (
  phoneNumber: string,
  containerId: string = 'recaptcha-container'
): Promise<ConfirmationResult> => {
  const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber.replace(/\D/g, '')}`;
  const appVerifier = setupRecaptcha(containerId);
  return await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
};

export const verifyFirebasePhoneOtp = async (
  confirmationResult: ConfirmationResult,
  otpCode: string,
  fullName?: string
): Promise<FirebaseSocialUser> => {
  const result: UserCredential = await confirmationResult.confirm(otpCode);
  const user = result.user;
  const idToken = await user.getIdToken();
  const phone = user.phoneNumber || '';
  const email = user.email || `trader_${phone.replace(/\D/g, '').slice(-10)}@phone.prevo.com`;

  return {
    email,
    fullName: fullName || user.displayName || `Trader ${phone.slice(-4)}`,
    photoUrl: user.photoURL || undefined,
    uid: user.uid,
    provider: 'phone',
    phone,
    idToken,
  };
};

/**
 * Sign out from Firebase Auth
 */
export const logoutFirebase = async (): Promise<void> => {
  try {
    await fbSignOut(auth);
  } catch (err) {
    console.warn('Firebase sign out error:', err);
  }
};
