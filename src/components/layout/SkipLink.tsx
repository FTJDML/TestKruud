/** Skip-to-contentlink; alleen zichtbaar bij toetsenbordfocus. */
export function SkipLink() {
  return (
    <a
      href="#hoofdinhoud"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-pill focus:bg-ink focus:px-5 focus:text-sm focus:font-semibold focus:text-white"
    >
      Ga direct naar de inhoud
    </a>
  )
}
