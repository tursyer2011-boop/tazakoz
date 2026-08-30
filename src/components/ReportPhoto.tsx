import { useEffect, useState } from "react";
import { ImageOff, LoaderCircle } from "lucide-react";
import { signedPhotoUrl } from "@/lib/photos";

/** Фото из приватного бакета reports по пути в хранилище. */
export function ReportPhoto({
  path,
  alt,
  className = "aspect-video w-full rounded-2xl object-cover",
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    if (!path) {
      setFailed(true);
      return;
    }
    signedPhotoUrl(path)
      .then((signed) => {
        if (!active) return;
        if (signed) setUrl(signed);
        else setFailed(true);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [path]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-secondary/40 ${className}`}>
        <ImageOff className="size-5 text-muted-foreground" />
      </div>
    );
  }
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-secondary/40 ${className}`}>
        <LoaderCircle className="size-5 animate-spin text-primary" />
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" className={className} />;
}
