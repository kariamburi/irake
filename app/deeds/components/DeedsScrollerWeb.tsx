"use client";

import React, { RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Deed } from "../data/deedsFeedWeb";
import { DeedVideoCardWeb } from "./DeedVideoCardWeb";

type Props = {
    items: Deed[];
    uid?: string | null;
    cardH: number;
    scrollerRef?: RefObject<HTMLElement | null>;
    commentedMap?: Record<string, boolean>;
    dataSaverOn?: boolean;
    hlsMaxHeight?: number;
    loading?: boolean;
    onNeedMore?: (index: number) => void;
    onOpenComments?: (deedId: string) => void;
    onActiveItemChange?: (item: Deed, index: number) => void;
    renderTopSpacer?: React.ReactNode;
    renderBottomSpacer?: React.ReactNode;
    initialIndex?: number;
};

const WINDOW_BEFORE = 1;
const WINDOW_AFTER = 2;

export function DeedsScrollerWeb({
    items,
    uid,
    cardH,
    scrollerRef,
    commentedMap = {},
    dataSaverOn = false,
    hlsMaxHeight,
    loading = false,
    onNeedMore,
    onOpenComments,
    onActiveItemChange,
    renderTopSpacer,
    renderBottomSpacer,
    initialIndex = 0,
}: Props) {
    const internalRef = useRef<HTMLElement | null>(null);
    const rootRef = scrollerRef ?? internalRef;

    const safeInitialIndex = Math.max(0, Math.min(items.length - 1, initialIndex));

    // IMPORTANT: start from selected deed, not 0
    const [activeIndex, setActiveIndex] = useState(safeInitialIndex);
    const activeIndexRef = useRef(safeInitialIndex);
    const bootKeyRef = useRef<string>("");

    // keep active index synced when initialIndex changes
    useEffect(() => {
        if (!items.length) return;

        const next = Math.max(0, Math.min(items.length - 1, initialIndex));
        activeIndexRef.current = next;
        setActiveIndex(next);
    }, [items.length, initialIndex]);

    // once DOM is rendered around selected item, scroll there
    useEffect(() => {
        const node = rootRef.current;
        if (!node) return;
        if (!items.length) return;
        if (cardH <= 0) return;

        const clamped = Math.max(0, Math.min(items.length - 1, initialIndex));
        const key = `${items.map((x) => x.id).join("|")}::${clamped}::${cardH}`;

        if (bootKeyRef.current === key) return;
        bootKeyRef.current = key;

        requestAnimationFrame(() => {
            const root = rootRef.current;
            if (!root) return;

            root.scrollTop = clamped * cardH;

            activeIndexRef.current = clamped;
            setActiveIndex(clamped);

            const item = items[clamped];
            if (item) {
                onActiveItemChange?.(item, clamped);
            }
        });
    }, [items, initialIndex, cardH, onActiveItemChange, rootRef]);

    useEffect(() => {
        const node = rootRef.current;
        if (!node) return;
        if (!items.length) return;

        let ticking = false;

        const updateActive = () => {
            ticking = false;

            const nextIndex = Math.max(
                0,
                Math.min(items.length - 1, Math.round(node.scrollTop / cardH))
            );

            if (nextIndex !== activeIndexRef.current) {
                activeIndexRef.current = nextIndex;
                setActiveIndex(nextIndex);
                onNeedMore?.(nextIndex);

                const activeItem = items[nextIndex];
                if (activeItem) {
                    onActiveItemChange?.(activeItem, nextIndex);
                }
            }
        };

        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(updateActive);
        };

        node.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            node.removeEventListener("scroll", onScroll);
        };
    }, [cardH, items, onActiveItemChange, onNeedMore, rootRef]);

    useEffect(() => {
        if (!items.length) {
            activeIndexRef.current = 0;
            setActiveIndex(0);
            return;
        }

        if (activeIndex > items.length - 1) {
            const next = Math.max(0, items.length - 1);
            activeIndexRef.current = next;
            setActiveIndex(next);

            const activeItem = items[next];
            if (activeItem) {
                onActiveItemChange?.(activeItem, next);
            }
        }
    }, [items, activeIndex, onActiveItemChange]);

    const start = Math.max(0, activeIndex - WINDOW_BEFORE);
    const end = Math.min(items.length, activeIndex + WINDOW_AFTER + 1);

    const visibleItems = useMemo(() => items.slice(start, end), [items, start, end]);

    const topSpacerHeight = start * cardH;
    const bottomSpacerHeight = Math.max(0, (items.length - end) * cardH);

    return (
        <>
            {renderTopSpacer}

            <div style={{ height: topSpacerHeight }} />

            {visibleItems.map((item, i) => {
                const realIndex = start + i;
                const distance = realIndex - activeIndex;

                const isActive = realIndex === activeIndex;
                const shouldLoad = distance >= -1 && distance <= 2;
                const shouldPreload = distance > 0 && distance <= 2;

                return (
                    <div
                        key={item.id}
                        className="snap-start"
                        style={{ height: cardH }}
                    >
                        <DeedVideoCardWeb
                            item={item}
                            uid={uid}
                            isActive={isActive}
                            shouldLoad={shouldLoad}
                            shouldPreload={shouldPreload}
                            commented={!!commentedMap[item.id]}
                            onOpenComments={onOpenComments}
                            dataSaverOn={dataSaverOn}
                            hlsMaxHeight={hlsMaxHeight}
                            loading={loading}
                        />
                    </div>
                );
            })}

            <div style={{ height: bottomSpacerHeight }} />

            {renderBottomSpacer}
        </>
    );
}