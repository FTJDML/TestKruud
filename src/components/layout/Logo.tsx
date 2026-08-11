import Link from 'next/link'

/**
 * Tekstlogo als HTML/CSS-woordmerk: "home&living deals." met een koraal accent.
 * Geen afbeelding, geen gekopieerd logo.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={className}
      aria-label="HomeAndLivingDeals, naar de homepage"
    >
      <span className="flex flex-col leading-[0.95]">
        <span className="font-display text-[15px] font-extrabold tracking-tight text-ink sm:text-base">
          home<span className="text-accent">&amp;</span>living
        </span>
        <span className="font-display text-[15px] font-extrabold tracking-tight text-ink sm:text-base">
          deals<span className="text-accent">.</span>
        </span>
      </span>
    </Link>
  )
}
