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
  children?: ReactNode;
};

export function FeedClampScope({ text, className, textClassName, preWrap, children }: FeedClampScopeProps) {
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
      <div
        className={cn(className, "relative z-[2]")}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          ref={ref}
          className={cn(textClassName, preWrap && "whitespace-pre-wrap", !expanded && "max-md:line-clamp-4")}
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
      className={cn(
        "inline-flex min-h-11 min-w-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/60 px-4 py-2.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-muted hover:text-primary active:scale-[0.99]",
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setExpanded((v) => !v);
      }}
    >
      {expanded ? (
        <>
          <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
          {t("feed.showLess")}
        </>
      ) : (
        <>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          {t("feed.showMore")}
        </>
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
