export function garmentSegmentationMaskStoragePath(input: {
  workspaceId: string;
  jobId: string;
  sourceBaseChecksumSha256: string;
  maskChecksumSha256: string;
}): string {
  return `workspace/${input.workspaceId}/deterministic-v2/${input.jobId}/segmentation/${input.sourceBaseChecksumSha256}-${input.maskChecksumSha256}.png`;
}
