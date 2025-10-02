"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Button } from "@/components/ui/button";
import { Eye, Heart, Upload } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";

type AlbumCarouselProps = {
    album: string[];
    isOwner?: boolean;
};

export default function AlbumCarousel({ album, isOwner = false }: AlbumCarouselProps) {
    const plugin = useRef(Autoplay({ delay: 3000, stopOnInteraction: true }));
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    if (!album || album.length === 0) return null;

    const handleImageClick = (imgUrl: string) => {
        setZoomedImage(imgUrl);
    };

    return (
        <>
            <Card className="rounded-2xl shadow-md p-2 bg-white dark:bg-neutral-900 relative">
                {isOwner && (
                    <div className="absolute top-3 right-3 z-10">
                        <Button variant="secondary" size="sm">
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                        </Button>
                    </div>
                )}

                <Carousel
                    plugins={[plugin.current]}
                    opts={{ loop: true }}
                    className="w-full max-w-lg mx-auto"
                >
                    <CarouselContent>
                        {album.map((imgUrl, idx) => (
                            <CarouselItem key={idx}>
                                <div
                                    className="relative w-full h-72 md:h-80 rounded-xl overflow-hidden group cursor-zoom-in"
                                    onClick={() => handleImageClick(imgUrl)}
                                >
                                    <Image
                                        src={imgUrl}
                                        alt={`Album image ${idx + 1}`}
                                        fill
                                        className="object-cover transition-transform duration-200 ease-in-out group-hover:scale-105"
                                        priority={idx === 0}
                                    />
                                    {/* Overlay Counters */}
                                    <div className="absolute bottom-2 right-2 flex items-center space-x-2 bg-black/50 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                                        <Heart className="w-4 h-4 text-pink-400" />
                                        <span>1.2k</span>
                                        <Eye className="w-4 h-4 ml-2" />
                                        <span>5.4k</span>
                                    </div>
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    {album.length > 1 && (
                        <>
                            <CarouselPrevious className="left-2 bg-white/70 dark:bg-black/50 hover:bg-white" />
                            <CarouselNext className="right-2 bg-white/70 dark:bg-black/50 hover:bg-white" />
                        </>
                    )}
                </Carousel>
            </Card>

            {/* Zoomed Image Modal */}
            <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
                <DialogTrigger asChild />
                <DialogContent className="max-w-3xl p-0 bg-transparent border-none shadow-none">
                    {zoomedImage && (
                        <div className="relative w-full h-[80vh]">
                            <Image
                                src={zoomedImage}
                                alt="Zoomed Image"
                                fill
                                className="object-contain rounded-xl"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
