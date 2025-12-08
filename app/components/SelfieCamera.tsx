"use client";

import React, { useEffect, useRef, useState } from "react";

type SelfieCameraProps = {
    onCapture: (file: File, previewUrl: string) => void;
    onError?: (error: string) => void;
};

export function SelfieCamera({ onCapture, onError }: SelfieCameraProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    // Start camera when component mounts
    useEffect(() => {
        let cancelled = false;

        const startCamera = async () => {
            try {
                setLoading(true);
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: false,
                });

                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setHasPermission(true);
            } catch (err) {
                console.error("Camera error", err);
                setHasPermission(false);
                onError?.("Could not access camera. Please allow camera permission.");
            } finally {
                setLoading(false);
            }
        };

        if (navigator.mediaDevices) {
            startCamera();
        } else {
            onError?.("Camera not supported in this browser.");
        }

        return () => {
            cancelled = true;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, [onError]);

    const handleCapture = () => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement("canvas");
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 640;

        // Make square if you want a profile-style selfie
        const size = Math.min(width, height);
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // center crop
        const sx = (width - size) / 2;
        const sy = (height - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                const file = new File([blob], `selfie-${Date.now()}.jpg`, {
                    type: "image/jpeg",
                });
                const url = URL.createObjectURL(blob);
                onCapture(file, url);
            },
            "image/jpeg",
            0.9
        );
    };

    return (
        <div className="flex flex-col items-center gap-3">
            {loading && (
                <p className="text-xs text-slate-500">Starting camera…</p>
            )}
            {!loading && !hasPermission && (
                <p className="text-xs text-red-500 text-center">
                    Camera not available. Please allow access and refresh the page.
                </p>
            )}
            <video
                ref={videoRef}
                className="w-48 h-48 md:w-56 md:h-56 rounded-2xl object-cover bg-black"
                playsInline
                muted
            />
            <button
                type="button"
                onClick={handleCapture}
                className="mt-2 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!hasPermission || loading}
            >
                Capture selfie
            </button>
        </div>
    );
}
