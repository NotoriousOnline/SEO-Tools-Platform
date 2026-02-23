/**
 * Maps team member names/roles (as they appear in meeting transcripts)
 * to Asana user GIDs. Replace placeholder GIDs with real values from your Asana workspace.
 */
const ownerMap: Record<string, string> = {
  Sam: "1234567890123456",
  Alex: "1234567890123457",
  "Marketing Team": "1234567890123458",
  "Dev Team": "1234567890123459",
};

/** Project manager's Asana user GID — used when no match is found or owner is Unassigned. */
const DEFAULT_OWNER = "1234567890123456";

/**
 * Resolves a name from a meeting transcript to an Asana user GID.
 * @param name - Team member name or role (e.g. "Sam", "Alex", "Marketing Team")
 * @returns Asana user GID string
 */
export function resolveOwner(name: string): string {
  const trimmed = name?.trim() ?? "";
  if (trimmed === "" || trimmed.toLowerCase() === "unassigned") {
    return DEFAULT_OWNER;
  }
  const lower = trimmed.toLowerCase();
  for (const [key, gid] of Object.entries(ownerMap)) {
    const keyLower = key.toLowerCase();
    if (lower.includes(keyLower) || keyLower.includes(lower)) {
      return gid;
    }
  }
  return DEFAULT_OWNER;
}
