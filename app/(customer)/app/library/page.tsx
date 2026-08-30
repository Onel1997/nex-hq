import type { Metadata } from "next";
import { XerianoLibraryGrid } from "@/components/xeriano/library-grid";
export const metadata:Metadata={title:"Bibliothek"};
export default function LibraryPage(){return <div className="xeriano-app-page xeriano-library-page"><header className="xeriano-page-header"><div><span className="xeriano-eyebrow">Private Assets</span><h1>Bibliothek</h1><p>Designs, Bilder, Videos und Referenzen — sicher in deinem Account.</p></div></header><XerianoLibraryGrid/></div>}
