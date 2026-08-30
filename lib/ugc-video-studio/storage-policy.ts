export const UGC_VIDEO_BUCKET_FILE_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;
export const UGC_VIDEO_RESULT_MAX_BYTES = 50 * 1024 * 1024;

/**
 * One explicit V1 policy keeps Supabase bucket authority and the application
 * result guard separate, while making a future coordinated increase a single
 * configuration change after the project-level storage limit is raised.
 */
export const UGC_VIDEO_STORAGE_POLICY_V1 = Object.freeze({
  bucketFileSizeLimitBytes: UGC_VIDEO_BUCKET_FILE_SIZE_LIMIT_BYTES,
  resultMaxBytes: UGC_VIDEO_RESULT_MAX_BYTES,
});
