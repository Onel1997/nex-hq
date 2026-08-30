import type { Metadata } from "next";
import { VideoStudioWorkspace } from "@/components/video/video-studio-workspace";
export const metadata: Metadata = { title: "Video Studio · Xeriamo Owner" };
export default function VideoStudioPage() {
  return (
    <VideoStudioWorkspace
      syntheticEnabled={process.env.NODE_ENV !== "production"}
    />
  );
}
