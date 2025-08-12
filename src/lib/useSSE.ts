// /src/lib/useSSE.ts
"use client";

import { useEffect, useRef, useState } from "react";
import {setLocalStorage,getLocalStroage} from "./localStorageUtil";

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
//        console.log("Run useEffect of useSSE:", url);
        const es = new EventSource(url);
        esRef.current = es;

        es.onopen = () => {
            console.log("SSE connection opened:", url);
            setConnected(true);
        };

        es.onmessage = (e) => {
//            console.log("SSE message received:", e.data);
            try {
                const data = JSON.parse(e.data);
                if (data.type === "connected") return;
//                console.log("SSE message received:", e.data);
                setLastEvent(data); // 同じイベントなら無視？

                if (data.type === "auth_webhook.hit") {
                    // 認証 Webhook の場合、ConnectinoID , ユーザ情報をlocalStorage に保存
//                    console.log("Store auth info!!",data)
                    const connectionId = data.connectionId;
                    const metadata = data.metadata;
                    
                    setLocalStorage(connectionId, JSON.stringify({...metadata})); // 24時間有効
  //                  console.log("set LocalStorage", connectionId, metadata );
                }

                onEvent?.(data);

                // ここで、auth関係の情報については処理しちゃうほうが良い
                // 内部的にデータベースを持つ？


            } catch (_) {
                console.error("Failed to parse SSE message:", e.data);
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
    }, []);

    return { connected, lastEvent };
}
