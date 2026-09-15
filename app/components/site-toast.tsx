type SiteToastProps = {
  message: string;
  variant?: "success" | "info" | "error";
};

export function SiteToast({ message, variant = "info" }: SiteToastProps) {
  const icon = variant === "success" ? "✓" : variant === "error" ? "!" : "i";
  return (
    <div className={`site-toast site-toast-${variant}`} role="status" aria-live="polite">
      <b aria-hidden="true">{icon}</b><span>{message}</span>
    </div>
  );
}
