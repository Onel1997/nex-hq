import { XerianoPublicHeader } from "@/components/xeriano/public-header";
import { XerianoPublicFooter } from "@/components/xeriano/public-footer";
export default function PublicLayout({ children }: { children: React.ReactNode }) { return <div className="xeriano-public-shell"><XerianoPublicHeader />{children}<XerianoPublicFooter /></div>; }
