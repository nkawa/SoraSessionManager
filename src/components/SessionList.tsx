// components/SessionList.tsx
import React, { useEffect, useState } from 'react';
import { Table, Spinner, Alert } from 'react-bootstrap';
import { fetchSessions } from '../lib/sora_api';
import { Session } from '@/types';

const SessionList: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getSessions = async () => {
      try {
        const data = await fetchSessions();
        setSessions(data);
      } catch (error) {
        setError('Failed to fetch session data');
      } finally {
        setLoading(false);
      }
    };

    getSessions();
  }, []);

  if (loading) {
    return <Spinner animation="border" />;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>Session ID</th>
          <th>Session Name</th>
          <th>Status</th>
          <th>Start Time</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((session) => (
          <tr key={session.id}>
            <td>{session.id}</td>
            <td>{session.name}</td>
            <td>{session.status}</td>
            <td>{new Date(session.start_time).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default SessionList;
