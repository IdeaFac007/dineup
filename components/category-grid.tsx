import Image from "next/image"
import { categories } from "@/lib/data"

export function CategoryGrid() {
  return (
    <section id="categories" className="py-16">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="mb-6">
          <h2 className="font-display text-[34px] leading-tight">Explore by mood</h2>
          <p className="mt-1.5 text-muted">Find your next table.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categories.map((category) => (
            <article
              key={category.title}
              className="group overflow-hidden rounded-2xl border border-line bg-card transition-transform hover:-translate-y-1"
            >
              <div className="relative h-36 overflow-hidden">
                <Image
                  src={category.image || "/placeholder.svg"}
                  alt={`${category.title} dining`}
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="text-base font-bold">{category.title}</h3>
                <p className="mt-1 text-xs text-muted">{category.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
