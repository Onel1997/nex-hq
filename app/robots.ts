import type { MetadataRoute } from "next";
import { getXerianoAppUrl } from "@/lib/xeriano/config";
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:"*",allow:["/","/pricing","/login","/register","/reset-password","/impressum","/datenschutz","/terms"],disallow:["/app/","/hq/","/agents/","/api/"]},sitemap:`${getXerianoAppUrl()}/sitemap.xml`,host:getXerianoAppUrl()}}
