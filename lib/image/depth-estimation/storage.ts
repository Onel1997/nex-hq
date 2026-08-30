export function depthMapStoragePath(input: {
  workspaceId: string;
  jobId: string;
  sourceBaseChecksumSha256: string;
  depthMapChecksumSha256: string;
}): string {
  return `workspace/${input.workspaceId}/deterministic-v2/${input.jobId}/depth/${input.sourceBaseChecksumSha256}-${input.depthMapChecksumSha256}.png`;
}
