/**
 * Shared surface + hover motion for main feed cards (story, arc, universe).
 * Subtle 1px lift, border tint, and soft shadow deepen — same timing on all three.
 */
export const feedCardArticleClasses =
  "rounded-2xl border border-border bg-card overflow-hidden shadow-card " +
  "transition-[border-color,box-shadow,transform] duration-[280ms] ease-[cubic-bezier(0.33,1,0.68,1)] " +
  "motion-reduce:transition-colors motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-[var(--shadow-card)] " +
  "hover:border-primary/20 hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)]";
