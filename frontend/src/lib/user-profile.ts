export interface SageUserProfile {
  name: string;
  role?: string;
  interests?: string;
  preferredProvider?: string;
  updatedAt: string;
}

export const USER_PROFILE_STORAGE_KEY = "sage:user-profile:v1";

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
