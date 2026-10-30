// Shared team library (Firebase Firestore, free "Spark" plan).
// Fill in the two values from the Firebase console to switch the library from
// "this browser only" to one library the whole team saves into:
//   Project settings › General › Your apps › Web app › firebaseConfig
//   projectId → projectId, apiKey → apiKey
// Both are public by design (they identify the project, not a password);
// what may be read and written is set by the Firestore rules (see README).
export const TEAM_LIBRARY = {
  projectId: '',
  apiKey: '',
  collection: 'patterns',
};
