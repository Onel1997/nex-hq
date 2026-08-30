import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireXerianoAccount, XerianoAuthorizationError } from "@/lib/xeriano/server";
import { XERIANO_DESIGN_MAX_BYTES, XERIANO_DESIGN_MIME_TYPES, XERIANO_LIBRARY_PAGE_SIZE, validateDesignSignature } from "@/lib/xeriano/library";

export const runtime="nodejs";
const BUCKET="xeriano-library-assets";
function redactLibraryMessage(message: string) {
  return message
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[REDACTED_SUPABASE_KEY]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .slice(0, 500);
}
function safeLibraryError(error: unknown) {
  if (!error || typeof error !== "object") return { name: typeof error, message: "Unbekannter Fehler" };
  const value = error as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };
  return {
    name: typeof value.name === "string" ? value.name.slice(0, 80) : "Error",
    code: typeof value.code === "string" ? value.code.slice(0, 80) : undefined,
    status: typeof value.status === "number" ? value.status : undefined,
    message: typeof value.message === "string" && value.message
      ? redactLibraryMessage(value.message)
      : "Keine Servermeldung",
  };
}

function libraryFailureCategory(error: unknown) {
  if (error instanceof XerianoAuthorizationError) return "ACCOUNT_AUTHORITY_FAILED";
  const safe = safeLibraryError(error);
  if (
    safe.code === "PGRST205" ||
    safe.code === "42P01" ||
    /schema cache|relation .+ does not exist/i.test(safe.message)
  ) {
    return "SCHEMA_MIGRATION_UNAVAILABLE";
  }
  if (
    safe.name === "StorageApiError" ||
    /storage|bucket|object/i.test(safe.message)
  ) {
    return "PRIVATE_STORAGE_FAILED";
  }
  if (safe.code?.startsWith("PGRST") || /^[0-9A-Z]{5}$/.test(safe.code ?? "")) {
    return "LIBRARY_QUERY_FAILED";
  }
  return "UNEXPECTED_SERVER_ERROR";
}

function failure(error: unknown) {
  if (error instanceof XerianoAuthorizationError) {
    console.error("[xeriano-library] account resolution failed", {
      category: libraryFailureCategory(error),
      ...safeLibraryError(error),
    });
    return NextResponse.json(
      {
        success: false,
        code: error.code,
        error:
          error.code === "XERIANO_FOUNDATION_UNAVAILABLE"
            ? "Die Xeriamo-Datenbank ist noch nicht aktiviert."
            : "Kein Zugriff.",
      },
      { status: error.status },
    );
  }
  const category = libraryFailureCategory(error);
  console.error("[xeriano-library] server operation failed", {
    category,
    ...safeLibraryError(error),
  });
  return NextResponse.json(
    {
      success: false,
      code:
        category === "SCHEMA_MIGRATION_UNAVAILABLE"
          ? "XERIANO_LIBRARY_SCHEMA_UNAVAILABLE"
          : "XERIANO_LIBRARY_FAILED",
      error: "Die Bibliothek ist gerade nicht verfügbar.",
    },
    { status: 503 },
  );
}
function ext(m:string){return m==="image/jpeg"?"jpg":m==="image/webp"?"webp":"png"}

export async function GET(request:Request){try{const context=await requireXerianoAccount();const url=new URL(request.url);const type=url.searchParams.get("type");const favorite=url.searchParams.get("favorite")==="1";const offset=Math.min(10_000,Math.max(0,Number.parseInt(url.searchParams.get("offset")??"0",10)||0));const admin=createAdminClient();let query=admin.from("xeriano_library_assets").select("id,account_id,owner_user_id,asset_type,title,description,source_studio,mime_type,byte_length,favorite,tags,created_at,updated_at",{count:"exact"}).eq("account_id",context.accountId).order("created_at",{ascending:false}).range(offset,offset+XERIANO_LIBRARY_PAGE_SIZE-1);if(type&&["DESIGN","IMAGE","VIDEO","REFERENCE"].includes(type))query=query.eq("asset_type",type);if(favorite)query=query.eq("favorite",true);const{data,error,count,status}=await query;if(error)throw {...error,status};const assetIds=(data??[]).map((row)=>row.id);const creations=assetIds.length?await admin.from("xeriano_creations").select("id,library_asset_id").eq("account_id",context.accountId).in("library_asset_id",assetIds):{data:[],error:null};if(creations.error)throw creations.error;const creationByAsset=new Map((creations.data??[]).map((row)=>[row.library_asset_id,row.id]));return NextResponse.json({success:true,assets:(data??[]).map(r=>({id:r.id,accountId:r.account_id,ownerUserId:r.owner_user_id,assetType:r.asset_type,title:r.title,description:r.description,sourceStudio:r.source_studio,mimeType:r.mime_type,byteLength:Number(r.byte_length),favorite:r.favorite,tags:r.tags,createdAt:r.created_at,updatedAt:r.updated_at,contentUrl:`/api/xeriano/library/${r.id}/content`,creationId:creationByAsset.get(r.id)??null})),total:count??0,pageSize:XERIANO_LIBRARY_PAGE_SIZE});}catch(error){return failure(error)}}

export async function POST(request:Request){try{const context=await requireXerianoAccount();const form=await request.formData();const file=form.get("file");const title=form.get("title");const description=form.get("description");const rawTags=form.get("tags");const replaceAssetId=form.get("replaceAssetId");if(!(file instanceof File)||typeof title!=="string"||!title.trim())return NextResponse.json({success:false,error:"Datei und Titel sind erforderlich.",code:"INVALID_DESIGN"},{status:400});if(!XERIANO_DESIGN_MIME_TYPES.includes(file.type as never)||file.size<=0||file.size>XERIANO_DESIGN_MAX_BYTES)return NextResponse.json({success:false,error:"Erlaubt sind PNG, JPG und WebP bis 20 MB.",code:"INVALID_DESIGN_FILE"},{status:400});let tags:string[]=[];if(typeof rawTags==="string"){try{const parsed=JSON.parse(rawTags);if(Array.isArray(parsed))tags=parsed.filter((value):value is string=>typeof value==="string").map(value=>value.trim().slice(0,40)).filter(Boolean).slice(0,20)}catch{return NextResponse.json({success:false,error:"Die Tags sind ungültig.",code:"INVALID_DESIGN_TAGS"},{status:400})}}const bytes=Buffer.from(await file.arrayBuffer());if(!validateDesignSignature(bytes,file.type))return NextResponse.json({success:false,error:"Die Dateisignatur passt nicht zum Dateityp.",code:"INVALID_DESIGN_SIGNATURE"},{status:400});const admin=createAdminClient();type ExistingAsset={id:string;storage_bucket:string;storage_path:string};let existing:ExistingAsset|null=null;if(typeof replaceAssetId==="string"&&replaceAssetId){const found=await admin.from("xeriano_library_assets").select("id,storage_bucket,storage_path").eq("id",replaceAssetId).eq("account_id",context.accountId).eq("owner_user_id",context.userId).eq("asset_type","DESIGN").maybeSingle();if(found.error||!found.data)return NextResponse.json({success:false,error:"Design nicht gefunden.",code:"DESIGN_NOT_FOUND"},{status:404});existing=found.data as ExistingAsset}
const assetId=existing?.id??randomUUID();const path=`accounts/${context.accountId}/designs/${assetId}/${randomUUID()}.${ext(file.type)}`;const upload=await admin.storage.from(BUCKET).upload(path,bytes,{contentType:file.type,upsert:false});if(upload.error)throw upload.error;const payload={account_id:context.accountId,owner_user_id:context.userId,asset_type:"DESIGN",title:title.trim().slice(0,160),description:typeof description==="string"&&description.trim()?description.trim().slice(0,2000):null,tags,source_studio:"DESIGN_STUDIO",storage_bucket:BUCKET,storage_path:path,mime_type:file.type,byte_length:bytes.byteLength,checksum_sha256:createHash("sha256").update(bytes).digest("hex"),provenance:{contract:"xeriano-customer-design-v1",originalName:file.name}};const written=existing?await admin.from("xeriano_library_assets").update(payload).eq("id",assetId).eq("account_id",context.accountId).select("id").single():await admin.from("xeriano_library_assets").insert({id:assetId,...payload}).select("id").single();if(written.error){await admin.storage.from(BUCKET).remove([path]);throw written.error}if(existing){await admin.storage.from(existing.storage_bucket).remove([existing.storage_path])}return NextResponse.json({success:true,assetId},{status:existing?200:201});}catch(error){return failure(error)}}
