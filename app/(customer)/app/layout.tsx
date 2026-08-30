import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { XerianoCustomerNav } from "@/components/xeriano/customer-nav";
import { XerianoCustomerProviders } from "@/components/xeriano/customer-providers";
import { XerianoFoundationUnavailable } from "@/components/xeriano/foundation-unavailable";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";

export const metadata:Metadata={title:{default:"Xeriamo App",template:"%s · Xeriamo"},robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function CustomerAppLayout({children}:{children:React.ReactNode}){const access=await resolveXerianoAccess();if(access.status==="UNAUTHENTICATED")redirect("/login");if(access.status==="AUTHENTICATED"&&access.context.role==="OWNER")redirect("/hq");if(access.status!=="AUTHENTICATED")return <XerianoCustomerProviders><XerianoFoundationUnavailable/></XerianoCustomerProviders>;return <XerianoCustomerProviders><div className="xeriano-customer-shell"><XerianoCustomerNav/><main className="xeriano-customer-main">{children}</main></div></XerianoCustomerProviders>}
