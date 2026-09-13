import './globals.css'

export const metadata = {
  title: 'DineUp — Where Restaurants Rise',
  description: 'Restaurant visibility marketplace for India.'
}

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>
}
