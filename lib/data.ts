export type Restaurant = {
  id: string
  name: string
  cuisine: string
  area: string
  bid: number
  change: number
  sponsored: boolean
  initials: string
}

export const initialRestaurants: Restaurant[] = [
  {
    id: "the-terrace",
    name: "The Terrace",
    cuisine: "North Indian",
    area: "Gomti Nagar",
    bid: 5500,
    change: 700,
    sponsored: true,
    initials: "TT",
  },
  {
    id: "tunday-kababi",
    name: "Tunday Kababi",
    cuisine: "Awadhi",
    area: "Hazratganj",
    bid: 4200,
    change: 500,
    sponsored: true,
    initials: "TK",
  },
  {
    id: "dastarkhwan",
    name: "Dastarkhwan",
    cuisine: "Mughlai",
    area: "Kaiserbagh",
    bid: 3100,
    change: 300,
    sponsored: true,
    initials: "DK",
  },
  {
    id: "urban-brasserie",
    name: "The Urban Brasserie",
    cuisine: "Cafe",
    area: "Gomti Nagar",
    bid: 2000,
    change: 200,
    sponsored: false,
    initials: "UB",
  },
  {
    id: "moti-mahal",
    name: "Moti Mahal",
    cuisine: "Indian",
    area: "Aliganj",
    bid: 1600,
    change: 150,
    sponsored: false,
    initials: "MM",
  },
  {
    id: "molecule",
    name: "Molecule",
    cuisine: "Bar & Kitchen",
    area: "Gomti Nagar",
    bid: 1200,
    change: 100,
    sponsored: false,
    initials: "ML",
  },
]

export type Category = {
  title: string
  description: string
  image: string
}

export const categories: Category[] = [
  { title: "Cafe", description: "Coffee & brunch spots", image: "/categories/cafe.png" },
  { title: "Awadhi", description: "Local Lucknawi favourites", image: "/categories/awadhi.png" },
  { title: "Fine Dining", description: "For special nights", image: "/categories/fine-dining.png" },
  { title: "Family", description: "Everyone's table", image: "/categories/family.png" },
]

export const BID_INCREMENT = 100

export function formatMoney(amount: number): string {
  return "₹" + Number(amount).toLocaleString("en-IN")
}
