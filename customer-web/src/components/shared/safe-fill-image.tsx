"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";
import { isRemoteHttpUrl, MENU_IMAGE_FALLBACK, resolveMenuImageSrc } from "@/lib/image-url";

type SafeFillImageProps = Omit<ImageProps, "src" | "fill" | "onError"> & {
  src: string;
  fallbackSrc?: string;
};

/**
 * `next/image` with remote allowlist bypass via `unoptimized` for arbitrary HTTPS URLs,
 * plus load-error fallback so a broken URL never takes down the tree.
 */
export function SafeFillImage({
  src,
  fallbackSrc = MENU_IMAGE_FALLBACK,
  alt,
  className,
  sizes,
  loading,
  priority,
  ...rest
}: SafeFillImageProps) {
  const initial = resolveMenuImageSrc(src);
  const [display, setDisplay] = useState(initial);

  useEffect(() => {
    setDisplay(resolveMenuImageSrc(src));
  }, [src]);

  return (
    <Image
      {...rest}
      src={display}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      loading={loading}
      priority={priority}
      unoptimized={isRemoteHttpUrl(display)}
      onError={() => setDisplay(fallbackSrc)}
    />
  );
}
