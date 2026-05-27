import assert from "node:assert/strict";
import {
  normalizeUserProfile,
  readStoredUserProfile,
  USER_PROFILE_STORAGE_KEY,
} from "../src/lib/user-profile.ts";

const normalized = normalizeUserProfile({
  name: "  Ada  ",
  role: "  researcher  ",
  interests: "  ",
  preferredProvider: "  local-agent  ",
  updatedAt: "2026-05-27T00:00:00.000Z",
});

assert.deepEqual(normalized, {
  name: "Ada",
  role: "researcher",
  interests: undefined,
  preferredProvider: "local-agent",
  updatedAt: "2026-05-27T00:00:00.000Z",
});

function createStorage(initialValue) {
  let value = initialValue;
  let removed = false;
  return {
    getItem(key) {
      assert.equal(key, USER_PROFILE_STORAGE_KEY);
      return value;
    },
    removeItem(key) {
      assert.equal(key, USER_PROFILE_STORAGE_KEY);
      removed = true;
      value = null;
    },
    wasRemoved() {
      return removed;
    },
  };
}

const validStorage = createStorage(
  JSON.stringify({ name: "Jezelle", updatedAt: "2026-05-27T00:00:00.000Z" }),
);
assert.equal(readStoredUserProfile(validStorage)?.name, "Jezelle");
assert.equal(validStorage.wasRemoved(), false);

const incompleteStorage = createStorage(
  JSON.stringify({ name: "   ", updatedAt: "2026-05-27T00:00:00.000Z" }),
);
assert.equal(readStoredUserProfile(incompleteStorage), null);
assert.equal(incompleteStorage.wasRemoved(), false);

const corruptStorage = createStorage("not json");
assert.equal(readStoredUserProfile(corruptStorage), null);
assert.equal(corruptStorage.wasRemoved(), true);

console.log("user profile tests passed");