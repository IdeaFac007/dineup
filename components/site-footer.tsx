export function SiteFooter() {
  return (
    <footer className="border-t border-line py-8 text-xs text-muted">
      <div className="mx-auto max-w-[1160px] px-6">
        © {new Date().getFullYear()} DineUp · Where Restaurants Rise.
      </div>
    </footer>
  )
}
