import type { MetadataRoute } from "next";
import { getXerianoAppUrl } from "@/lib/xeriano/config";
export default function sitemap():MetadataRoute.Sitemap{const base=getXerianoAppUrl();return ["","/pricing","/login","/register","/impressum","/datenschutz","/terms"].map((path,index)=>({url:`${base}${path}`,lastModified:new Date(),changeFrequency:index<2?"weekly":"yearly",priority:index===0?1:index===1 ? .9 : .4}))}
