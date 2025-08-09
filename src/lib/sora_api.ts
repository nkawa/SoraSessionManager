// lib/api.ts
import axios from 'axios';
import { Session } from '../types';

// 環境変数から API URL を取得
const API_URL = process.env.NEXT_PUBLIC_SORA_API_URL;

export const fetchSessions = async (): Promise<Session[]> => {
  try {
    // POST リクエストで API にアクセス
    const response = await axios.post(
      API_URL,
      {
        // 必要なリクエストボディ（もしあれば）を追加
        // 例: sessionのリストを取得するためのパラメータ
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-sora-target': 'Sora_20231220.ListSessions', // 指定するターゲット
        },
      }
    );
    return response.data; // セッション情報を返す
  } catch (error) {
    console.error('Error fetching session data:', error);
    throw error;
  }
};

