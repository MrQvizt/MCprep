import { cn } from "@/lib/utils";

type Tone = "ink" | "charcoal" | "paper" | "mist";

const TONES: Record<Tone, string> = {
  ink: "bg-ink text-white",
  charcoal: "bg-charcoal text-white",
  paper: "light bg-paper text-ink",
  mist: "light bg-mist text-ink",
};

export function Section({
  tone = "ink",
  className,
  containerClassName,
  children,
  id,
  bleed = false,
  as: Tag = "section",
  ...rest
}: {
  tone?: Tone;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
  id?: string;
  /** Skip the inner container (full-bleed content) */
  bleed?: boolean;
  as?: "section" | "div" | "header" | "aside";
} & React.AriaAttributes) {
  return (
    <Tag id={id} className={cn(TONES[tone], "py-16 sm:py-20 lg:py-28", className)} {...rest}>
      {bleed ? children : <div className={cn("container-site", containerClassName)}>{children}</div>}
    </Tag>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  as: Heading = "h2",
  size = "lg",
  className,
  id,
  children,
}: {
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  size?: "xl" | "lg" | "md";
  className?: string;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className="eyebrow mb-4 text-current/60">{eyebrow}</p>}
      <Heading id={id} className={cn(size === "xl" ? "display-xl" : size === "lg" ? "display-lg" : "display-md", "text-balance")}>
        {title}
      </Heading>
      {subtitle && <p className="mt-5 max-w-2xl text-base leading-relaxed text-current/70 sm:text-lg text-pretty">{subtitle}</p>}
      {children}
    </div>
  );
}

/** Plain text with blank-line separated paragraphs. */
export function TextBlock({ text, className }: { text: string | null | undefined; className?: string }) {
  const paras = (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <div className={cn("space-y-4 leading-relaxed", className)}>
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-line text-pretty">
          {p}
        </p>
      ))}
    </div>
  );
}
