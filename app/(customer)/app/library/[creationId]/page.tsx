import type { Metadata } from "next";

import { XerianoCreationDetail } from "@/components/xeriano/creation-detail";

export const metadata: Metadata = { title: "Kreation" };

export default async function CreationPage({
  params,
}: {
  params: Promise<{ creationId: string }>;
}) {
  const { creationId } = await params;
  return <XerianoCreationDetail creationId={creationId} />;
}
