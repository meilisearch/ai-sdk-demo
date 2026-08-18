"use client";

import type { CategoryCard } from "@/lib/categories";

function CategoryCardButton({
  category,
  disabled,
  onSelect,
}: {
  category: CategoryCard;
  disabled?: boolean;
  onSelect: (genre: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={category.name}
      disabled={disabled}
      onClick={() => onSelect(category.name)}
      className="group focus-visible:ring-ring/50 relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl transition hover:scale-[1.03] hover:shadow-lg focus-visible:ring-3 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
    >
      {category.backdropUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- TMDB backdrop URLs are not in the Next image loader.
        <img
          src={category.backdropUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="bg-muted size-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="bg-muted size-full" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      <span className="absolute bottom-3 left-3 text-left text-sm font-semibold text-white md:text-base">
        {category.name}
      </span>
    </button>
  );
}

export function HomeEmptyState({
  categories,
  disabled,
  onSelect,
}: {
  categories: CategoryCard[];
  disabled?: boolean;
  onSelect: (genre: string) => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-8 py-8">
      <h1 className="text-center text-4xl font-semibold tracking-tight text-pretty md:text-5xl">
        What&apos;s your next binge?
      </h1>
      {categories.length > 0 ? (
        <ul className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {categories.map((category) => (
            <li key={category.name} className="min-w-0">
              <CategoryCardButton
                category={category}
                disabled={disabled}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
