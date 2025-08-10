// lib/api.ts
import { Session } from '../types';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const fetchSessions = async (): Promise<Session[]> => {
  const url = `${BASE_PATH}/api/proxy`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-sora-target': 'Sora_20231220.ListSessions',
      },
      // 必要なら: cache: 'no-store',
    });

    if (!res.ok) {
      // 4xx/5xx は自分でエラー化する
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
    }

    const data = (await res.json()) as Session[];
    return data;
  } catch (err) {
    console.error('Error fetching session data:', err);
    throw err;
  }
};
