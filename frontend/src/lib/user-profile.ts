export interface SageUserProfile {
  name: string;
  role?: string;
  interests?: string;
  preferredProvider?: string;
  updatedAt: string;
}

export const USER_PROFILE_STORAGE_KEY = "sage:user-profile:v1";

type ProfileStorage = Pick<Storage, "getItem" | "removeItem">;

export function normalizeUserProfile(profile: SageUserProfile): SageUserProfile {
  return {
    ...profile,
    name: profile.name.trim(),
    role: profile.role?.trim() || undefined,
    interests: profile.interests?.trim() || undefined,
    preferredProvider: profile.preferredProvider?.trim() || undefined,
  };
}

export function isCompleteUserProfile(profile: SageUserProfile | null): profile is SageUserProfile {
  return Boolean(profile?.name.trim());
}

export function readStoredUserProfile(storage: ProfileStorage): SageUserProfile | null {
  const storedProfile = storage.getItem(USER_PROFILE_STORAGE_KEY);
  if (!storedProfile) return null;

  try {
    const parsedProfile = JSON.parse(storedProfile) as SageUserProfile;
    return isCompleteUserProfile(parsedProfile) ? parsedProfile : null;
  } catch {
    storage.removeItem(USER_PROFILE_STORAGE_KEY);
    return null;
  }
}
