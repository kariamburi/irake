// --- SmartImage.tsx (inline helper) ---
import Image, { ImageProps } from "next/image";
import React from "react";

type SmartImageProps = ImageProps & {
    /** Optional wrapper class (must include position/size for fill images) */
    containerClassName?: string;
    /** Optional fallback text block when error (used if no fallback src) */
    emptyFallback?: React.ReactNode;
    /** Optional explicit fallback src when load fails */
    fallbackSrc?: string;
};

export function SmartImage({
    containerClassName,
    emptyFallback = (
        <div className="absolute inset-0 grid place-items-center text-gray-400 text-xs bg-gray-50">
            No image
        </div>
    ),
    fallbackSrc,
    src,
    alt,
    className,
    onLoadingComplete,
    ...imgProps
}: SmartImageProps) {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(false);
    const [currentSrc, setCurrentSrc] = React.useState(src);

    React.useEffect(() => {
        setCurrentSrc(src);
        setLoading(!!src);
        setError(false);
    }, [src]);

    const handleComplete = () => {
        setLoading(false);
        onLoadingComplete?.(undefined as any);
    };

    const handleError = () => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
            setCurrentSrc(fallbackSrc);
            setLoading(true);
            setError(false);
        } else {
            setError(true);
            setLoading(false);
        }
    };

    return (
        <div className={containerClassName ?? "relative w-full h-full"}>
            {/* loader overlay */}
            {loading && !error && (
                <div className="absolute inset-0 grid place-items-center bg-gray-100">
                    <div
                        className="h-8 w-8 rounded-full border-2 animate-spin"
                        style={{ borderColor: "#D1D5DB", borderTopColor: "#233F39" /* EKARI.forest */ }}
                    />
                    <span className="mt-2 text-[11px] font-semibold text-gray-500">Loading image…</span>
                </div>
            )}

            {!error ? (
                <Image
                    {...imgProps}
                    src={currentSrc}
                    alt={alt}
                    className={`transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"} ${className ?? ""}`}
                    onLoadingComplete={handleComplete}
                    onError={handleError}
                />
            ) : (
                emptyFallback
            )}
        </div>
    );
}
