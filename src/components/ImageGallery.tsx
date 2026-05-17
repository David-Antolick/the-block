// VDP image gallery. Arrow keys cycle when wrapper is focused; thumbnails
// are real buttons (Tab-reachable, Enter/Space-activatable). `safeIndex` is
// derived on read rather than via useEffect → setIndex (same pattern as
// useCountdown — avoids `react-hooks/set-state-in-effect`).

import { useRef, useState } from 'react';

interface Props {
  images: string[];
  altBase: string;
}

export default function ImageGallery({ images, altBase }: Props) {
  const [index, setIndex] = useState(0);
  const thumbStripRef = useRef<HTMLDivElement | null>(null);
  const count = images.length;

  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;

  if (count === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-400">
        No images available
      </div>
    );
  }

  function go(delta: number) {
    setIndex((current) => (current + delta + count) % count);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setIndex(count - 1);
    }
  }

  const activeSrc = images[safeIndex];
  const activeAlt = `${altBase} — image ${safeIndex + 1} of ${count}`;

  return (
    <figure
      className="flex flex-col gap-3 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-roledescription="image carousel"
      aria-label={`${altBase} photos`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-inset ring-zinc-200">
        {activeSrc ? (
          <img
            src={activeSrc}
            alt={activeAlt}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : null}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-2.5 py-1.5 text-zinc-700 shadow-sm ring-1 ring-zinc-200 backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-2.5 py-1.5 text-zinc-700 shadow-sm ring-1 ring-zinc-200 backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span aria-hidden="true">›</span>
            </button>
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
              {safeIndex + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div
          ref={thumbStripRef}
          role="tablist"
          aria-label="Image thumbnails"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {images.map((src, i) => {
            const isActive = i === safeIndex;
            return (
              <button
                key={`${src}-${i}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Show image ${i + 1} of ${count}`}
                onClick={() => setIndex(i)}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-md ring-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'ring-blue-600'
                    : 'ring-transparent hover:ring-zinc-300'
                }`}
              >
                <img
                  src={src}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </button>
            );
          })}
        </div>
      )}

      <figcaption className="sr-only">{activeAlt}</figcaption>
    </figure>
  );
}
