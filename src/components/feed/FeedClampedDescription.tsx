"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

type ClampContextValue = {
  overflowsMobile: boolean;
  expanded: boolean;
  setExpanded: (v: boolean | ((b: boolean) => boolean)) => void;
};

const FeedClampContext = createContext<ClampContextValue | null>(null);

function useFeedClampContext() {
  return useContext(FeedClampContext);
}

type FeedClampScopeProps = {
  text: string;
  className?: string;
  textClassName?: string;
  preWrap?: boolean;
  /** When set, the clamped text area opens the story (feed card). */
  onTextActivate?: () => void;
  children?: ReactNode;
};

export function FeedClampScope({
  text,
  className,
  textClassName,
  preWrap,
  onTextActivate,
  children,
}: FeedClampScopeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowsMobile, setOverflowsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !text.trim()) {
      setOverflowsMobile(false);
      return;
    }

    const measure = () => {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(min-width: 768px)").matches) {
        setOverflowsMobile(false);
        return;
      }
      if (expanded) return;
      setOverflowsMobile(el.scrollHeight > el.clientHeight + 2);
    };

    measure();
    const mq = window.matchMedia("(min-width: 768px)");
    mq.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      mq.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, [text, expanded]);

  const ctx = useMemo(
    () => ({ overflowsMobile, expanded, setExpanded }),
    [overflowsMobile, expanded],
  );

  if (!text.trim()) return null;

  return (
    <FeedClampContext.Provider value={ctx}>
      <div className={cn(className, "relative z-[2]")}>
        <div
          ref={ref}
          role={onTextActivate ? 'button' : undefined}
          tabIndex={onTextActivate ? 0 : undefined}
          onClick={
            onTextActivate
              ? () => {
                  onTextActivate();
                }
              : undefined
          }
          onKeyDown={
            onTextActivate
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTextActivate();
                  }
                }
              : undefined
          }
          className={cn(
            textClassName,
            preWrap && 'whitespace-pre-wrap',
            !expanded && 'max-md:line-clamp-4',
            onTextActivate &&
              'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          {text}
        </div>
        {children}
      </div>
    </FeedClampContext.Provider>
  );
}

type FeedClampToggleProps = {
  className?: string;
};

export function FeedClampToggle({ className }: FeedClampToggleProps) {
  const { t } = useLanguage();
  const ctx = useFeedClampContext();

  if (!ctx?.overflowsMobile) return null;

  const { expanded, setExpanded } = ctx;

  return (
    <button
      type="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={expanded ? t("feed.showLess") : t("feed.showMore")}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-border bg-muted/60 text-primary shadow-sm transition-colors hover:bg-muted hover:text-primary active:scale-[0.99]",
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setExpanded((v) => !v);
      }}
    >
      {expanded ? (
        <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
      )}
    </button>
  );
}

type FeedClampedDescriptionProps = {
  text: string;
  className?: string;
  textClassName?: string;
  preWrap?: boolean;
};

export default function FeedClampedDescription({
  text,
  className,
  textClassName,
  preWrap,
}: FeedClampedDescriptionProps) {
  return (
    <FeedClampScope text={text} className={className} textClassName={textClassName} preWrap={preWrap}>
      <FeedClampToggle className="mt-3" />
    </FeedClampScope>
  );
}
