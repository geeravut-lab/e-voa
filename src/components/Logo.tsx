/** Always points at /brand/logo, which serves the admin's upload or the built-in mark. Never hard-code the file. */
export function LogoMark({ size = 36, version, className = "" }: { size?: number; version?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/brand/logo${version ? `?v=${version}` : ""}`} alt="" width={size} height={size} className={`shrink-0 rounded-[22%] ${className}`} />
  );
}
