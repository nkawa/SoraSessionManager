"use client";
import React, { useMemo, useState } from "react";
import { Table, Spinner, Alert, Button, Badge, Form, InputGroup } from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Sora Signaling API: ListConnections のレスポンス型
 * 参考: https://sora-doc.shiguredo.jp/API_SIGNALING#listconnections
 */
type Vp9Params = { profile_id: number };
type H265Params = { level_id: number };
type AudioInfo = { codec_type?: string };
type VideoInfo = {
  bit_rate?: number;
  codec_type?: string;
  vp9_params?: Vp9Params;
  h265_params?: H265Params;
};

type SoraConnectionItem = {
  node_name: string;
  channel_id: string;
  session_id: string;
  client_id: string;
  bundle_id: string;
  connection_id: string;
  created_time?: number; // epoch microsec (doc例)
  created_timestamp: string; // ISO
  role: "sendonly" | "recvonly" | "sendrecv";
  simulcast: boolean;
  spotlight: boolean;
  recording_block?: boolean;
  event_metadata?: Record<string, unknown>;
  audio?: AudioInfo;
  video?: VideoInfo;
};

const headerStyle: React.CSSProperties = { whiteSpace: "nowrap" };
const cellStyle: React.CSSProperties = { whiteSpace: "nowrap", verticalAlign: "middle" };

const fmtTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : "-");
const kbpsStr = (kbps?: number) => (typeof kbps === "number" ? `${kbps.toLocaleString()} kbps` : "-");
const codecStr = (v?: VideoInfo) => {
  if (!v) return "-";
  if (v.codec_type === "VP9" && v.vp9_params) return `VP9 (p=${v.vp9_params.profile_id})`;
  if (v.codec_type === "H265" && v.h265_params) return `H265 (L${v.h265_params.level_id})`;
  return v.codec_type ?? "-";
};
const durationFrom = (startISO: string) => {
  const start = new Date(startISO).getTime();
  const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const ConnectionList: React.FC = () => {
  const [rows, setRows] = useState<SoraConnectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フィルタ/検索
  const [onlyChannel, setOnlyChannel] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "sendonly" | "recvonly" | "sendrecv">("");
  const [query, setQuery] = useState("");

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      // シグナリング API: ListConnections
      // x-sora-target: Sora_20201013.ListConnections
      // body は空でOK（クラスタを跨ぎたくないなら { local: true } を渡す）
      const r = await fetch(BASE_PATH + "/api/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sora-target": "Sora_20201013.ListConnections",
        },
        body: JSON.stringify({local: true}), // 必要に応じて { local: true/false }
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status} ${t}`);
      }
      const data = (await r.json()) as SoraConnectionItem[];
      // 新しい順（created_timestamp 降順）
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.created_timestamp).getTime() - new Date(a.created_timestamp).getTime()
      );
      setRows(sorted);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to fetch connections";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (row: SoraConnectionItem) => {
    setLoading(true);
    setError(null);
    try {
      // シグナリング API: DisconnectConnection
      // x-sora-target: Sora_20151104.DisconnectConnection
      const r = await fetch(BASE_PATH + "/api/proxy", {
        method: "POST",
        headers: {
          "x-sora-target": "Sora_20151104.DisconnectConnection",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel_id: row.channel_id,
          connection_id: row.connection_id,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Disconnect failed: HTTP ${r.status} ${t}`);
      }
      toast.success(`Disconnected: ${row.connection_id.slice(0, 8)}…`);
      // 再取得
      await handleFetch();
    } catch (e: any) {
      const msg = e?.message ?? "Disconnect API error";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (onlyChannel && r.channel_id !== onlyChannel) return false;
      if (roleFilter && r.role !== roleFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay =
          `${r.channel_id} ${r.session_id} ${r.client_id} ${r.bundle_id} ${r.connection_id} ${r.node_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, onlyChannel, roleFilter, query]);

  // channel_id 候補（セレクタ）
  const channelOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.channel_id));
    return Array.from(s).sort();
  }, [rows]);

  return (
    <div>
      {/* 操作列 */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <Button onClick={handleFetch} disabled={loading}>
          {loading ? "Loading..." : "Fetch Connections"}
        </Button>

        <Form.Select
          size="sm"
          style={{ maxWidth: 220 }}
          value={onlyChannel}
          onChange={(e) => setOnlyChannel(e.currentTarget.value)}
        >
          <option value="">All channels</option>
          {channelOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Form.Select>

        <Form.Select
          size="sm"
          style={{ maxWidth: 180 }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.currentTarget.value as typeof roleFilter)}
        >
          <option value="">All roles</option>
          <option value="sendonly">sendonly</option>
          <option value="recvonly">recvonly</option>
          <option value="sendrecv">sendrecv</option>
        </Form.Select>

        <InputGroup size="sm" style={{ maxWidth: 300 }}>
          <InputGroup.Text>Search</InputGroup.Text>
          <Form.Control
            placeholder="channel / session / client / connection"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </InputGroup>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <Spinner animation="border" />
      ) : filtered.length === 0 ? (
        <Alert variant="secondary">No connections.</Alert>
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover className="mb-0">
            <thead>
              <tr>
                <th style={headerStyle}>Status</th>
                <th style={headerStyle}>Role</th>
                <th style={headerStyle}>Channel</th>
                <th style={headerStyle}>Conn ID</th>
                <th style={headerStyle}>Client</th>
                <th style={headerStyle}>Codec</th>
                <th style={headerStyle}>Bitrate</th>
                <th style={headerStyle}>Simulcast</th>
                <th style={headerStyle}>Created</th>
                <th style={headerStyle}>Duration</th>
                <th style={headerStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.connection_id}>
                  <td style={cellStyle}>
                    {/* ListConnections は「現在の接続」なので常に active 扱い */}
                    <Badge bg="success">active</Badge>
                  </td>
                  <td style={cellStyle}>{r.role}</td>
                  <td style={cellStyle}>{r.channel_id}</td>
                  <td style={cellStyle} title={r.connection_id}>
                    {r.connection_id.slice(0, 10)}…
                  </td>
                  <td style={cellStyle} title={`client=${r.client_id} / session=${r.session_id}`}>
                    {r.client_id.slice(0, 10)}…
                  </td>
                  <td style={cellStyle}>{codecStr(r.video)}</td>
                  <td style={cellStyle}>{kbpsStr(r.video?.bit_rate)}</td>
                  <td style={cellStyle}>{r.simulcast ? "yes" : "no"}</td>
                  <td style={cellStyle}>{fmtTime(r.created_timestamp)}</td>
                  <td style={cellStyle}>{durationFrom(r.created_timestamp)}</td>
                  <td style={cellStyle}>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => handleDisconnect(r)}
                      disabled={loading}
                      title="Disconnect this connection"
                    >
                      Disconnect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <ToastContainer position="bottom-right" autoClose={3000} newestOnTop />
    </div>
  );
};

export default ConnectionList;
