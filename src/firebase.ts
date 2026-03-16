import { initializeApp, cert, getApps } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';

dotenv.config();

const missingKeys = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
].filter(key => !process.env[key]);

if (missingKeys.length > 0) {
  console.error(`MISSING FIREBASE KEYS: ${missingKeys.join(', ')}`);
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
} as ServiceAccount;

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const db = getFirestore();
export const auth = getAuth();

export interface UserProfile {
  name?: string;
  email?: string;
  phone?: string;
  experienceLevel?: string;
  experience?: string[];
  education?: string[];
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  skills: string[];
  preferredRole?: string;
  location?: string;
  salaryExpectation?: string;
  workType?: 'full-time' | 'contract' | 'freelance';
}

export interface UserPreferences {
  roleType?: 'jobs' | 'gigs' | 'both';
  category?: string;
  categories?: string[];
  mode?: 'remote' | 'onsite' | 'hybrid';
  locations?: string[];
  countriesOfInterest?: string[];
  salary?: string;
  salaryRange?: string;
  seniority?: 'junior' | 'mid' | 'senior';
  jobType?: 'full-time' | 'contract' | 'freelance';
  onlyVisaSponsored?: boolean;
}

export interface UserDoc {
  chatId: number;
  profile: UserProfile;
  preferences: UserPreferences;
  savedJobs?: string[];
  swipedJobs?: string[];
  state?: string;
  isPremium?: boolean;
  weeklyInteractions?: {
    count: number;
    lastReset: any; // Timestamp
  };
  updatedAt: any;
}

export async function saveUserSkills(chatId: number, skills: string[]) {
  await saveUserProfile(chatId, { skills });
}

export async function saveUserProfile(chatId: number, profileData: Partial<UserProfile>) {
  await db.collection('users').doc(chatId.toString()).set({
    chatId,
    profile: profileData,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function saveUserPreferences(chatId: number, preferencesData: Partial<UserPreferences>) {
  await db.collection('users').doc(chatId.toString()).set({
    chatId,
    preferences: preferencesData,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function getUserProfile(chatId: number): Promise<UserProfile | null> {
  const doc = await db.collection('users').doc(chatId.toString()).get();
  return doc.exists ? (doc.data()?.profile as UserProfile) : null;
}

export async function getUserPreferences(chatId: number): Promise<UserPreferences | null> {
  const doc = await db.collection('users').doc(chatId.toString()).get();
  return doc.exists ? (doc.data()?.preferences as UserPreferences) : null;
}

export async function getUserSkills(chatId: number): Promise<string[]> {
  const profile = await getUserProfile(chatId);
  return profile?.skills || [];
}

export async function getUserDoc(chatId: number): Promise<UserDoc | null> {
  const doc = await db.collection('users').doc(chatId.toString()).get();
  return doc.exists ? (doc.data() as UserDoc) : null;
}

export async function getAllUsers(): Promise<UserDoc[]> {
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map(doc => doc.data() as UserDoc);
}

export async function saveJobInteraction(chatId: number, jobId: string, action: 'skip' | 'interested' | 'save') {
  const userRef = db.collection('users').doc(chatId.toString());
  if (action === 'save') {
    await userRef.update({
      savedJobs: FieldValue.arrayUnion(jobId)
    });
  } else {
    await userRef.update({
      swipedJobs: FieldValue.arrayUnion(jobId)
    });
  }
}

export async function getSavedJobs(chatId: number): Promise<string[]> {
  const doc = await db.collection('users').doc(chatId.toString()).get();
  return doc.exists ? (doc.data()?.savedJobs || []) : [];
}

export async function getSwipedJobs(chatId: number): Promise<string[]> {
  const doc = await db.collection('users').doc(chatId.toString()).get();
  return doc.exists ? (doc.data()?.swipedJobs || []) : [];
}

export async function updateUserState(chatId: number, state: string | null) {
  const userRef = db.collection('users').doc(chatId.toString());
  if (state === null) {
    await userRef.update({ state: FieldValue.delete() });
  } else {
    await userRef.set({ state }, { merge: true });
  }
}

export async function incrementWeeklyInteractions(chatId: number): Promise<number> {
  const userRef = db.collection('users').doc(chatId.toString());
  const doc = await userRef.get();
  const data = doc.data() as UserDoc;
  
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0, 0, 0, 0);

  let count = 1;
  const lastReset = data?.weeklyInteractions?.lastReset?.toDate() || new Date(0);

  if (lastReset < startOfWeek) {
    await userRef.update({
      weeklyInteractions: {
        count: 1,
        lastReset: FieldValue.serverTimestamp()
      }
    });
  } else {
    count = (data?.weeklyInteractions?.count || 0) + 1;
    await userRef.update({
      'weeklyInteractions.count': FieldValue.increment(1)
    });
  }
  return count;
}

export async function getUserState(chatId: number): Promise<string | null> {
  const doc = await db.collection('users').doc(chatId.toString()).get();
  return doc.exists ? (doc.data()?.state || null) : null;
}

export async function saveJob(job: any) {
  const buttonId = Buffer.from(job.id).toString('base64').substring(0, 10).replace(/=/g, '').replace(/\+/g, '').replace(/\//g, '');
  await db.collection('jobs').doc(job.id).set({
    ...job,
    buttonId,
    savedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function getJobByButtonId(buttonId: string): Promise<any | null> {
  const snapshot = await db.collection('jobs').where('buttonId', '==', buttonId).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return doc ? doc.data() : null;
}

export async function getJobById(jobId: string): Promise<any | null> {
  const doc = await db.collection('jobs').doc(jobId).get();
  return doc.exists ? doc.data() : null;
}

export async function isJobProcessed(jobId: string): Promise<boolean> {
  const doc = await db.collection('jobs').doc(jobId).get();
  return doc.exists;
}

export async function checkDatabaseConnection(): Promise<void> {
  try {
    const users = db.collection('users');
    await users.limit(1).get();
  } catch (error: any) {
    if (error.code === 7 || error.message.includes('permission_denied')) {
      throw new Error('PERMISSION_DENIED: Cloud Firestore API is not enabled or credentials lack permissions.');
    }
    if (error.code === 5 || error.message.includes('not_found')) {
      throw new Error('NOT_FOUND: Firestore database not found.');
    }
    throw error;
  }
}
