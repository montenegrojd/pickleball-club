
import { JsonFileAdapter } from './json-adapter';
import { FirestoreAdapter } from './firestore-adapter';
import { StorageAdapter } from '@/lib/types';

// Switch between JSON file storage and Firestore based on environment variable
// Set USE_FIRESTORE=true to use Firestore
const useFirestore = process.env.USE_FIRESTORE === 'true';

// Singleton instance
export const db: StorageAdapter = useFirestore 
    ? new FirestoreAdapter() 
    : new JsonFileAdapter();
