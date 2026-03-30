/**
 * Maps team member names/roles (as they appear in meeting transcripts)
 * to Asana user GIDs. Replace placeholder GIDs with real values from your Asana workspace.
 */
const ownerMap: Record<string, string> = {
  Sam: "1234567890123456",
  Alex: "1234567890123457",
  Graham: "ASANA_USER_GID_HERE",
  Mark: "ASANA_USER_GID_HERE",
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
  console.log("resolveOwner called with:", name);
  if (!name || name.trim().toLowerCase() === "unassigned") {
    console.log("resolveOwner: no name — returning DEFAULT_OWNER");
    return DEFAULT_OWNER;
  }
  const match = Object.keys(ownerMap).find((k) =>
    name.trim().toLowerCase().includes(k.toLowerCase())
  );
  if (match) {
    console.log("resolveOwner: matched", match, "→", ownerMap[match]);
    return ownerMap[match];
  }
  console.log("resolveOwner: no match for", name, "— returning DEFAULT_OWNER");
  return DEFAULT_OWNER;
}
