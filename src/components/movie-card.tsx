"use client";

import { TwicImg } from "@twicpics/components/react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { getTwicpicsUrl, MOVIE_POSTER_ASPECT_RATIO } from "@/lib/twicpics";

export type MovieCardHit = {
  id?: string | number;
  title: string;
  year?: string;
  posterPath?: string;
};

function MovieCard({ movie }: { movie: MovieCardHit }) {
  return (
    <Card size="sm" className="w-36 shrink-0 py-0" aria-label={movie.title}>
      {movie.posterPath ? (
        <TwicImg
          src={getTwicpicsUrl("tmdb", movie.posterPath)}
          ratio={MOVIE_POSTER_ASPECT_RATIO}
          alt={movie.title}
          className="w-full object-cover"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex aspect-[2/3] w-full items-center justify-center rounded-t-xl px-2 text-center text-xs leading-tight font-medium">
          No poster
        </div>
      )}

      <CardHeader className="pb-2">
        <CardTitle className="truncate text-xs">{movie.title}</CardTitle>
        {movie.year ? (
          <CardDescription className="tabular-nums">
            {movie.year}
          </CardDescription>
        ) : null}
      </CardHeader>
    </Card>
  );
}

export function MovieGrid({ movies }: { movies: MovieCardHit[] }) {
  if (movies.length === 0) return null;

  return (
    <div className="w-full min-w-0">
      <ScrollArea className="w-full">
        <div className="flex w-max min-w-full gap-2 px-1 pt-1 pb-4">
          {movies.map((movie, index) => (
            <MovieCard
              key={movie.id ?? `${movie.title}-${index}`}
              movie={movie}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
