export function isOwnedPrivatePath(path: string, ownerId: string) {
  const parts = path.split("/");
  return parts.length === 2 && parts[0] === ownerId && (parts[1]?.length ?? 0) > 0 && !parts.includes("..") && !path.includes("\\");
}