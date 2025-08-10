// /src/lib/useSSE.ts
"use client";

import { useEffect, useRef, useState } from "react";

export type FrontEvent = {
    type: string;
    connectionId?: string;
    channelId?: string;
    payload?: any;
    ts?: number;
};


export function useSSE(onEvent: (evt: FrontEvent) => void) {
    const url = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/ssevents`;
    const [connected, setConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<FrontEvent | null>(null);
    const esRef = useRef<EventSource | null>(null);

    useEffect(() => {
        const es = new EventSource(url);
        esRef.current = es;

        es.onopen = () => {
            console.log("SSE connection opened:", url);
            setConnected(true);
        };

        es.onmessage = (e) => {
            console.log("SSE message received:", e.data);
            try {
                const data = JSON.parse(e.data) as FrontEvent;
//                setLastEvent(data);
                onEvent?.(data);
            } catch (_) {
                // ignore broken JSON
            }
        };

        es.onerror = (err) => {
            console.log("SSE connection error:", err);
            // EventSource は自動で再接続する。UI状態だけ反映
            setConnected(false);
        };

        return () => {
            es.close();
            esRef.current = null;
        };
    }, [url, onEvent]);

    return { connected, lastEvent };
}
