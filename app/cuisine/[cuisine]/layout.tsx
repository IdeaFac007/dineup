import type { Metadata } from "next";

function cuisineName(value:string){return value.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}

export async function generateMetadata({params}:{params:Promise<{cuisine:string}>}):Promise<Metadata>{
 const {cuisine}=await params;
 const name=cuisineName(decodeURIComponent(cuisine||""));
 const url="https://dineupindia.com/cuisine/"+encodeURIComponent(cuisine);
 return {
  title:name+" Restaurants in India | DineUp",
  description:"Discover "+name+" restaurants across India on DineUp. Explore restaurant listings, locations and direct restaurant details.",
  alternates:{canonical:url},
  openGraph:{title:name+" Restaurants in India | DineUp",description:"Discover "+name+" restaurants across India on DineUp.",url,siteName:"DineUp",type:"website",locale:"en_IN"},
  twitter:{card:"summary",title:name+" Restaurants in India | DineUp",description:"Discover "+name+" restaurants across India on DineUp."},
  robots:{index:true,follow:true}
 };
}

export default function CuisineLayout({children}:{children:React.ReactNode}){return children}
