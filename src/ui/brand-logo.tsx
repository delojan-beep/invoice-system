import Image from "next/image";

/** The QNetwork "Q" mark. Decorative when next to the product name, so alt is empty by default. */
export function BrandLogo({ size = 36, alt = "" }: { size?: number; alt?: string }) {
  return (
    <Image src="/qnetwork-logo.webp" alt={alt} width={size} height={size} className="shrink-0 rounded-md" style={{ width: size, height: size }} />
  );
}
