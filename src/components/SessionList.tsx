// components/SessionList.tsx
"use client";
import React, { useState } from "react";
import { Table, Spinner, Alert, Button, Badge, Form, InputGroup } from "react-bootstrap";
import { fetchSessions } from "@/lib/sora_api";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useSSE, type FrontEvent } from "@/lib/useSSE";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';


// ...（既存の型宣言はそのまま）...
type Vp9Params = { profile_id: number };
type H265Params = { level_id: number };
type SoraConnection = { /* 省略（あなたの元コード通り） */
    connection_id: string; role: "sendonly" | "recvonly" | "sendrecv";
    bundle_id: string; client_id: string; audio?: boolean; video?: boolean; simulcast: boolean;
    audio_codec_type?: string; video_codec_type?: string; video_bit_rate?: number;
    video_vp9_params?: Vp9Params; video_h265_params?: H265Params;
    connection_created_timestamp: string; connection_destroyed_timestamp: string | null;
};
type SoraRecording = {
    format: "mp4" | "webm";
    recording_id: string;
    expire_time: number;
    expired_at: number;
    start_timestamp: string;
    split_duration: number;
    split_only: boolean;
};
type SoraSession = {
    label: string; version: string; node_name: string; session_id: string;
    max_connections: number; connections: SoraConnection[];
    channel_id: string; spotlight: boolean; group_id: string;
    created_time: number; created_timestamp: string; total_connections: number;
    recording?: SoraRecording; // ★ ここを使います
};

// --- ユーティリティ（既存のまま＋少し拡張） ---
const fmtTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : "-");
const fmtEpochSec = (sec?: number) => (typeof sec === "number" ? new Date(sec * 1000).toLocaleString() : "-");
//const isConnActive = (c: SoraConnection) => c.connection_destroyed_timestamp === null;
const isConnActive = (c: SoraConnection) => !c.connection_destroyed_timestamp;

const codecStr = (c: SoraConnection) => {
    if (c.video_codec_type === "VP9" && c.video_vp9_params) return `VP9 (p=${c.video_vp9_params.profile_id})`;
    if (c.video_codec_type === "H265" && c.video_h265_params) return `H265 (L${c.video_h265_params.level_id})`;
    return c.video_codec_type ?? "-";
};
const kbpsStr = (kbps?: number) => (typeof kbps === "number" ? `${kbps.toLocaleString()} kbps` : "-");
const durationStr = (startISO: string, endISO: string | null) => {
    const start = new Date(startISO).getTime();
    const end = endISO ? new Date(endISO).getTime() : Date.now();
    const sec = Math.max(0, Math.floor((end - start) / 1000));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
};
const shortId = (id?: string) => (id ? `${id.slice(0, 10)}…` : "-");
const cellStyle: React.CSSProperties = { whiteSpace: "nowrap", verticalAlign: "middle" };
const headerStyle: React.CSSProperties = { whiteSpace: "nowrap" };

// ★ 録画開始パラメータ（セッションごとに独立管理するための型）
type RecOptsState = Record<string, {
    format: "mp4" | "webm";
    expire_time?: number | "";
    split_only: boolean;
    split_duration?: number | "";
}>;

type SessionRow = {
    connectionId?: string;
    status?: string;
    // 必要に応じてフィールド追加
};

const SessionList: React.FC = () => {
    const [sessions, setSessions] = useState<SoraSession[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [onlyActive, setOnlyActive] = useState<boolean>(true);

    const [rows, setRows] = useState<SessionRow[]>([]);

    // ★ セッションごとの録画オプション（デフォルト: H.265対策で mp4）
    const [recOpts, setRecOpts] = useState<RecOptsState>({});



    // auth や session イベントを受け取るためのリスナー
    const handleEvent = (event: FrontEvent) => {
        console.log("SSE Handle event:", event);
        if (event.type === "auth_webhook.hit") {
            console.log("Auth webhook hit:", event);

            // ここで必要な処理を追加（例: トースト通知など）
        } else if (event.type === "session.created") {
            console.log("Session created:", event);
            handleFetchSessions();
        } else if (event.type === "event_webhook.hit") {
            console.log("Clt event webhook hit:", event);
        } else if (event.type === "recording.started" || event.type === "recording.stopped") {
            console.log("Recording event:", event);
        }
    }

    const { connected } = useSSE(handleEvent);


    const handleFetchSessions = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = (await fetchSessions()) as unknown as SoraSession[];
            const sorted = [...(Array.isArray(data) ? data : [])].sort(
                (a, b) => new Date(b.created_timestamp).getTime() - new Date(a.created_timestamp).getTime()
            );
            setSessions(sorted);

            // 新しいセッションに初期オプションを入れておく
            setRecOpts(prev => {
                const next = { ...prev };
                for (const s of sorted) {
                    if (!next[s.session_id]) {
                        next[s.session_id] = { format: "mp4", split_only: true, split_duration: 3600 };
                    }
                }
                return next;
            });
        } catch (e: any) {
            setError("Failed to fetch session data");
        } finally {
            setLoading(false);
        }
    };



    const visibleSessions = sessions.filter(sess => !onlyActive || sess.connections.some(isConnActive));

    // ★ Start/Stop 実行関数
    const callRecording = async (action: "start" | "stop", sess: SoraSession) => {
        setLoading(true);
        setError(null);
        try {
            const opts = recOpts[sess.session_id] ?? { format: "mp4", split_only: false };
            const payload =
                action === "start"
                    ? {
                        channel_id: sess.channel_id,
                        format: opts.format,
                        expire_time: opts.expire_time === "" ? undefined : opts.expire_time,
                        split_only: opts.split_only,
                        split_duration: opts.split_only
                            ? (opts.split_duration === "" ? undefined : opts.split_duration)
                            : undefined,
                    }
                    : { channel_id: sess.channel_id };

            const r = await fetch(BASE_PATH + "/api/recording", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!r.ok) {
                const t = await r.text();
                throw new Error(`Recording ${action} failed: HTTP ${r.status} ${t}`);
            }

            // 成功トースト
            toast.success(
                action === "start"
                    ? `Recording started: ${sess.channel_id}`
                    : `Recording stopped: ${sess.channel_id}`
            );

            // 成功したら最新状態を再取得
            await handleFetchSessions();
        } catch (e: any) {
            const msg = e?.message ?? "Recording API error";
            setError(msg);
            toast.error(msg); // 失敗トースト
        } finally {
            setLoading(false);
        }
    };


    return (
        <div>
            <div className="d-flex gap-2 align-items-center mb-2">
                <Button onClick={handleFetchSessions} disabled={loading}>
                    {loading ? "Loading..." : "Fetch Sessions"}
                </Button>
                <Form.Check
                    type="switch"
                    id="only-active"
                    label="Active only"
                    checked={onlyActive}
                    onChange={(e) => setOnlyActive(e.currentTarget.checked)}
                />
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            {loading ? (
                <Spinner animation="border" />
            ) : visibleSessions.length === 0 ? (
                <Alert variant="secondary">No sessions.</Alert>
            ) : (
                <div className="d-flex flex-column gap-3">
                    {visibleSessions.map((sess) => {
                        const activeCount = sess.connections.filter(isConnActive).length;
                        const sendCount = sess.connections.filter((c) => c.role === "sendonly").length;
                        const recvCount = sess.connections.filter((c) => c.role === "recvonly").length;
                        const sendrecvCount = sess.connections.filter((c) => c.role === "sendrecv").length;
                        const totalKbps = sess.connections.reduce((sum, c) => sum + (c.video_bit_rate ?? 0), 0);
                        const activeTotalKbps = sess.connections.reduce((sum, c) => sum + (isConnActive(c) ? (c.video_bit_rate ?? 0) : 0), 0);

                        const ro = recOpts[sess.session_id] ?? { format: "mp4", split_only: true };

                        return (
                            <div key={sess.session_id} className="p-3 border rounded-3">
                                {/* セッションサマリー */}
                                <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                                    <div>
                                        <div className="fw-bold">
                                            {sess.channel_id}{" "}
                                            <Badge bg={activeCount > 0 ? "success" : "secondary"}>
                                                {activeCount > 0 ? "active" : "ended"}
                                            </Badge>
                                        </div>
                                        <div className="text-muted small">{sess.session_id}</div>
                                    </div>
                                    <div className="small d-flex flex-column text-end">
                                        <span>
                                            Total: <strong>{sess.total_connections}</strong> / Max:{" "}
                                            <strong>{sess.max_connections}</strong>
                                        </span>
                                        <span>Created: {fmtTime(sess.created_timestamp)}</span>
                                    </div>
                                </div>

                                {/* 役割 & ビットレート サマリー */}
                                <div className="mb-2 small">
                                    <Badge bg="primary" className="me-2">send: {sendCount}</Badge>
                                    <Badge bg="info" className="me-2" text="dark">recv: {recvCount}</Badge>
                                    <Badge bg="dark" className="me-2">sendrecv: {sendrecvCount}</Badge>
                                    <Badge bg="success" className="me-2">active: {activeCount}</Badge>
                                    <Badge bg="secondary">
                                        bitrate total: {kbpsStr(totalKbps)} (active: {kbpsStr(activeTotalKbps)})
                                    </Badge>
                                </div>

                                {/* ★ 録画コントロール */}
                                <div className="mb-2 small p-2 rounded border">
                                    <div className="d-flex flex-wrap align-items-end gap-2">
                                        <Badge bg={sess.recording ? "warning" : "secondary"} text={sess.recording ? "dark" : undefined}>
                                            recording {sess.recording ? "ON" : "OFF"}
                                        </Badge>

                                        {sess.recording && (
                                            <>
                                                <span>format: <strong>{sess.recording.format}</strong></span>
                                                <span>rec_id: <span title={sess.recording.recording_id}>{shortId(sess.recording.recording_id)}</span></span>
                                                <span>start: {fmtTime(sess.recording.start_timestamp)}</span>
                                                <span>expire_at: {fmtEpochSec(sess.recording.expired_at)}</span>
                                                <span>split: {sess.recording.split_duration}s / {sess.recording.split_only ? "only" : "off"}</span>
                                            </>
                                        )}

                                        <div className="ms-auto d-flex flex-wrap gap-2">
                                            {/* Start オプション（録画中は編集しにくいので一旦常に表示） */}
                                            <Form.Select
                                                size="sm"
                                                value={ro.format}
                                                onChange={(e) =>
                                                    setRecOpts(o => ({ ...o, [sess.session_id]: { ...ro, format: e.currentTarget.value as "mp4" | "webm" } }))
                                                }
                                                title="format (H.265はmp4必須)"
                                                disabled={loading || sess.recording}
                                            >
                                                <option value="mp4">mp4</option>
                                                <option value="webm">webm</option>
                                            </Form.Select>

                                            <InputGroup size="sm" style={{ width: 160 }}>
                                                <InputGroup.Text>expire</InputGroup.Text>
                                                <Form.Control
                                                    type="number"
                                                    min={1} max={86400}
                                                    placeholder="sec"
                                                    value={ro.expire_time === "" ? "" : (ro.expire_time ?? "")}
                                                    disabled={loading || sess.recording}
                                                    onChange={(e) => {
                                                        const v = e.currentTarget.value;
                                                        setRecOpts(o => ({ ...o, [sess.session_id]: { ...ro, expire_time: v === "" ? "" : Number(v) } }));
                                                    }}

                                                />
                                            </InputGroup>

                                            <Form.Check
                                                type="switch"
                                                id={`split-${sess.session_id}`}
                                                label="split_only"
                                                checked={!!ro.split_only}
                                                onChange={(e) =>
                                                    setRecOpts(o => ({ ...o, [sess.session_id]: { ...ro, split_only: e.currentTarget.checked } }))
                                                }
                                                disabled={loading || sess.recording}

                                            />

                                            <InputGroup size="sm" style={{ width: 180 }}>
                                                <InputGroup.Text>split</InputGroup.Text>
                                                <Form.Control
                                                    type="number"
                                                    min={1} max={86400}
                                                    placeholder="duration (sec)"
                                                    value={ro.split_duration === "" ? "" : (ro.split_duration ?? "")}
                                                    onChange={(e) => {
                                                        const v = e.currentTarget.value;
                                                        setRecOpts(o => ({ ...o, [sess.session_id]: { ...ro, split_duration: v === "" ? "" : Number(v) } }));
                                                    }}
                                                    disabled={!ro.split_only || loading || sess.recording}

                                                />
                                            </InputGroup>

                                            <Button
                                                size="sm"
                                                variant="outline-primary"
                                                onClick={() => callRecording("start", sess)}
                                                disabled={loading || sess.recording}
                                                title="Start recording for this channel"
                                            >
                                                Start
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="outline-danger"
                                                onClick={() => callRecording("stop", sess)}
                                                disabled={loading || !sess.recording}
                                                title="Stop recording for this channel"
                                            >
                                                Stop
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* コネクション詳細（既存どおり） */}
                                <div className="table-responsive">
                                    <Table striped bordered hover className="mb-0">
                                        <thead>
                                            <tr>
                                                <th style={headerStyle}>Status</th>
                                                <th style={headerStyle}>Role</th>
                                                <th style={headerStyle}>Conn ID</th>
                                                <th style={headerStyle}>Codec</th>
                                                <th style={headerStyle}>Bitrate</th>
                                                <th style={headerStyle}>Simulcast</th>
                                                <th style={headerStyle}>Created</th>
                                                <th style={headerStyle}>Destroyed</th>
                                                <th style={headerStyle}>Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(onlyActive ? sess.connections.filter(isConnActive) // ← ここで行も絞る
                                                : sess.connections).map((c) => {
                                                    const active = isConnActive(c);
                                                    return (
                                                        <tr key={c.connection_id}>
                                                            <td style={cellStyle}>
                                                                <Badge bg={active ? "success" : "secondary"}>{active ? "active" : "ended"}</Badge>
                                                            </td>
                                                            <td style={cellStyle}>{c.role}</td>
                                                            <td style={cellStyle} title={c.connection_id}>{c.connection_id.slice(0, 10)}…</td>
                                                            <td style={cellStyle}>{codecStr(c)}</td>
                                                            <td style={cellStyle}>{kbpsStr(c.video_bit_rate)}</td>
                                                            <td style={cellStyle}>{c.simulcast ? "yes" : "no"}</td>
                                                            <td style={cellStyle}>{fmtTime(c.connection_created_timestamp)}</td>
                                                            <td style={cellStyle}>{fmtTime(c.connection_destroyed_timestamp)}</td>
                                                            <td style={cellStyle}>{durationStr(c.connection_created_timestamp, c.connection_destroyed_timestamp)}</td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <ToastContainer position="bottom-right" autoClose={3000} newestOnTop />
        </div>
    );
};

export default SessionList;
