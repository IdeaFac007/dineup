import type { Metadata } from "next";

function cityName(value:string){return value.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}

export async function generateMetadata({params}:{params:Promise<{city:string}>}):Promise<Metadata>{
 const {city}=await params;
 const name=cityName(decodeURIComponent(city||""));
 const title="Restaurants in "+name+" | DineUp";
 const description="Discover restaurants and places to eat in "+name+" on DineUp. Explore restaurant listings, cuisines, contact details and more.";
 const url="https://dineupindia.com/city/"+encodeURIComponent(city);
 return {title,description,alternates:{canonical:url},openGraph:{title,description,url,siteName:"DineUp",type:"website",locale:"en_IN"},twitter:{card:"summary",title,description},robots:{index:true,follow:true}};
}

export default function CityLayout({children}:{children:React.ReactNode}){return children}
