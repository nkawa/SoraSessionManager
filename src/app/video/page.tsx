"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Container, Row, Col, Table, Button, Badge, Spinner,
  Form, InputGroup, Modal, Alert
} from "react-bootstrap";
import TopNavi from "../../components/TopNavi";

type RecordingSummary = {
  recordingId: string;
  dirName: string;
  channelId?: string;
  sessionId?: string;
  startTimestamp?: string;
  stopTimestamp?: string;
  parts: number;
  totalSizeBytes: number;
};

type PartItem = {
  index: string;              // "0001"
  sizeBytes: number;
  width: number;
  height: number;
  codec: string;
  start_timestamp: string;
  stop_timestamp: string;
  video_url: string;
  metadata_filename: string;
};

const BASE_PATH = process.env.NEXT_PUBLIC_SORA_ARCHIVE_BASE_PATH ?? ""; // nginx のサブパス運用向け

function fmtBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1; do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(1)} ${u[i]}`;
}
function ts(s?: string) {
  if (!s) return "-";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function RecordingsPage() {
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<RecordingSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [activeRec, setActiveRec] = useState<RecordingSummary | null>(null);
  const [parts, setParts] = useState<PartItem[] | null>(null);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsErr, setPartsErr] = useState<string | null>(null);

  // video modal
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerSrc, setPlayerSrc] = useState<string | null>(null);
  const [playerTitle, setPlayerTitle] = useState<string>("");

  // crop params (上下カットの開始yと高さ)
  const [cropY, setCropY] = useState<number>(420);
  const [cropH, setCropH] = useState<number>(1080);

  // 初回: 録画一覧
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_PATH}/api/recordings`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
        setRecs(j.items as RecordingSummary[]);
        setErr(null);
      } catch (e: any) {
        setErr(e?.message || "failed to load recordings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 録画選択 → パーツ取得
  async function loadParts(rec: RecordingSummary) {
    try {
      setActiveRec(rec);
      setParts(null);
      setPartsErr(null);
      setPartsLoading(true);
      const res = await fetch(`${BASE_PATH}/api/recordings/${rec.dirName}/parts`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setParts(j.items as PartItem[]);
    } catch (e: any) {
      setPartsErr(e?.message || "failed to load parts");
    } finally {
      setPartsLoading(false);
    }
  }

  function openPlayer(url: string, title: string) {
    setPlayerSrc(url);
    setPlayerTitle(title);
    setShowPlayer(true);
  }

  function partVideoUrl(recId: string, idx: string) {
    return `${BASE_PATH}/api/recordings/${recId}/parts/${idx}/video`;
  }
  function partVideoLowUrl(recId: string, idx: string) {
    return `${BASE_PATH}/api/recordings/${recId}/parts/${idx}/video-low`;
  }
  function partVideoCropUrl(recId: string, idx: string, y = cropY, h = cropH) {
    const qs = new URLSearchParams({ y: String(y), height: String(h) });
    // クエリ対応の video-crop 実装にしている場合（提案したクエリ対応版）
    return `${BASE_PATH}/api/recordings/${recId}/parts/${idx}/video-crop?${qs.toString()}`;
  }

  const totalSize = useMemo(
    () => recs.reduce((s, r) => s + (r.totalSizeBytes || 0), 0),
    [recs]
  );

  return (
    <div>
      <TopNavi />

      <Container fluid="md" className="mt-3">
        <Row className="mb-3">
          <Col>
            <h3>録画ブラウザ</h3>
            <div className="text-muted">
              録画一覧の取得・パーツ選択・低解像度変換/クロップ再生ができます。
            </div>
          </Col>
        </Row>

        {/* 録画一覧 */}
        <Row className="mb-3">
          <Col>
            <div className="d-flex align-items-center gap-3">
              <h5 className="mb-0">録画一覧</h5>
              {loading && <Spinner animation="border" size="sm" />}
              <div className="ms-auto text-muted">
                合計サイズ: <Badge bg="secondary">{fmtBytes(totalSize)}</Badge>
              </div>
            </div>

            {err && <Alert variant="danger" className="mt-2">{err}</Alert>}

            <Table striped hover size="sm" className="mt-2">
              <thead>
                <tr>
                  <th>Recording ID</th>
                  <th>Channel</th>
                  <th>Session</th>
                  <th>開始</th>
                  <th>終了</th>
                  <th>Parts</th>
                  <th>Total Size</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.dirName} className={activeRec?.dirName === r.dirName ? "table-primary" : ""}>
                    <td className="text-break">{r.dirName}</td>
                    <td>{r.channelId || "-"}</td>
                    <td className="text-break">{r.sessionId || "-"}</td>
                    <td>{ts(r.startTimestamp)}</td>
                    <td>{ts(r.stopTimestamp)}</td>
                    <td><Badge bg="info">{r.parts}</Badge></td>
                    <td>{fmtBytes(r.totalSizeBytes)}</td>
                    <td className="text-end">
                      <Button size="sm" variant="primary" onClick={() => loadParts(r)}>
                        パーツを表示
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && recs.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted">録画が見つかりません</td></tr>
                )}
              </tbody>
            </Table>
          </Col>
        </Row>

        {/* パーツ一覧 */}
        {activeRec && (
          <Row className="mb-4">
            <Col>
              <div className="d-flex align-items-center gap-3">
                <h5 className="mb-0">パーツ一覧: <code>{activeRec.dirName}</code></h5>
                {partsLoading && <Spinner animation="border" size="sm" />}
              </div>
              {partsErr && <Alert variant="danger" className="mt-2">{partsErr}</Alert>}

              {/* クロップパラメータ */}
              <Form className="mt-3">
                <Row className="g-2">
                  <Col xs={12} md={3}>
                    <InputGroup>
                      <InputGroup.Text>crop y</InputGroup.Text>
                      <Form.Control
                        type="number"
                        value={cropY}
                        onChange={(e) => setCropY(parseInt(e.target.value || "0", 10))}
                      />
                    </InputGroup>
                  </Col>
                  <Col xs={12} md={3}>
                    <InputGroup>
                      <InputGroup.Text>crop height</InputGroup.Text>
                      <Form.Control
                        type="number"
                        value={cropH}
                        onChange={(e) => setCropH(parseInt(e.target.value || "0", 10))}
                      />
                    </InputGroup>
                  </Col>
                  <Col className="d-flex align-items-center text-muted">
                    上下クロップ後に 640x360 へ縮小されます
                  </Col>
                </Row>
              </Form>

              <Table striped hover size="sm" className="mt-3">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>サイズ</th>
                    <th>解像度</th>
                    <th>Codec</th>
                    <th>開始</th>
                    <th>終了</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {parts?.map((p) => (
                    <tr key={`part-${activeRec?.dirName}-${p.index}`}>
                      <td><Badge bg="secondary">{p.index}</Badge></td>
                      <td>{fmtBytes(p.sizeBytes)}</td>
                      <td>{p.width}×{p.height}</td>
                      <td>{p.codec}</td>
                      <td>{ts(p.start_timestamp)}</td>
                      <td>{ts(p.stop_timestamp)}</td>
                      <td className="d-flex gap-2 flex-wrap">
                        {/* オリジナル再生（Range対応） */}
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => openPlayer(partVideoUrl(activeRec.dirName, p.index), `Original ${activeRec.dirName} #${p.index}`)}
                        >
                          再生(原本)
                        </Button>

                        {/* 低解像度変換（オンデマンド） */}
                        <Button
                          size="sm"
                          variant="outline-success"
                          onClick={() => openPlayer(partVideoLowUrl(activeRec.dirName, p.index), `Low ${activeRec.dirName} #${p.index}`)}
                        >
                          低解像度
                        </Button>

                        {/* クロップ + 縮小（オンデマンド） */}
                        <Button
                          size="sm"
                          variant="outline-warning"
                          onClick={() => openPlayer(partVideoCropUrl(activeRec.dirName, p.index, cropY, cropH), `Crop ${activeRec.dirName} #${p.index}`)}
                        >
                          クロップして再生
                        </Button>

                        {/* ダウンロード（原本） */}
                        <a
                          className="btn btn-sm btn-outline-secondary"
                          href={partVideoUrl(activeRec.dirName, p.index)}
                          download
                        >
                          DL(原本)
                        </a>
                      </td>
                    </tr>
                  ))}
                  {parts && parts.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted">パーツがありません</td></tr>
                  )}
                </tbody>
              </Table>
            </Col>
          </Row>
        )}
      </Container>

      {/* 動画プレイヤーモーダル */}
      <Modal show={showPlayer} onHide={() => setShowPlayer(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{playerTitle || "Player"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {playerSrc ? (
            <video
              src={playerSrc}
              controls
              style={{ width: "100%", height: "auto" }}
              // 低レイテンシ/オンデマンド向けに controlsOnly
            />
          ) : (
            <div className="text-muted">ソースがありません</div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
