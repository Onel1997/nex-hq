export function normalMapStoragePath(input: { workspaceId: string; jobId: string; sourceBaseChecksumSha256: string; normalMapChecksumSha256: string }) {
  return `workspace/${input.workspaceId}/deterministic-v2/${input.jobId}/normal/${input.sourceBaseChecksumSha256}-${input.normalMapChecksumSha256}.png`;
}
