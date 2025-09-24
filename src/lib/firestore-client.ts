import { Firestore } from "@google-cloud/firestore";

let cachedFirestore: Firestore | null = null;

function initializeFirestore(): Firestore {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is required");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(serviceAccountJson) as Record<string, unknown>;
  } catch (error) {
    throw new Error("Invalid JSON in FIREBASE_SERVICE_ACCOUNT environment variable");
  }

  const projectId = credentials["project_id"];
  if (typeof projectId !== "string" || projectId.trim() === "") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must include a project_id");
  }

  return new Firestore({
    projectId,
    credentials: credentials as Record<string, string>,
  });
}

export function getFirestore(): Firestore {
  if (!cachedFirestore) {
    cachedFirestore = initializeFirestore();
  }

  return cachedFirestore;
}
