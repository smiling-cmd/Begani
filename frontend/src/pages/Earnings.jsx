import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

export default function Earnings() {
  const { token } = useContext(AuthContext);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const fetchBookings = async () => {
      const res = await axios.get('http://127.0.0.1:8000/api/bookings/therapist-list/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(res.data);
    };
    fetchBookings();
  }, [token]);

  // Calculate earnings (assuming 10% commission)
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalEarned = completedBookings.reduce((sum, b) => sum + b.fee_kes_snapshot, 0);
  const commission = totalEarned * 0.10;
  const netEarned = totalEarned - commission;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#F5F0E7', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
        <h1 style={{ color: '#1A4331', fontSize: '2rem', margin: 0, fontWeight: '800' }}>Earnings</h1>
        <p style={{ color: '#666', margin: '0.5rem 0 2rem 0' }}>Students pay BEGANI. After each session you mark it completed, and BEGANI sends your share by M-Pesa, minus the commission.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <h2 style={{ fontSize: '1.8rem', color: '#1A4331', margin: '0 0 5px 0' }}>KES {netEarned}</h2>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Paid out to you</p>
          </div>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <h2 style={{ fontSize: '1.8rem', color: '#1A4331', margin: '0 0 5px 0' }}>KES 0</h2>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Held until sessions are done</p>
          </div>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <h2 style={{ fontSize: '1.8rem', color: '#1A4331', margin: '0 0 5px 0' }}>KES {commission}</h2>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Commission deducted (10%)</p>
          </div>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <h2 style={{ fontSize: '1.8rem', color: '#1A4331', margin: '0 0 5px 0' }}>Active</h2>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Platform status</p>
          </div>
        </div>

        <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ color: '#1A4331', marginTop: 0 }}>Payments and payouts</h3>
          
          {completedBookings.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No completed sessions yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left', color: '#666' }}>
                  <th style={{ padding: '10px' }}>Date</th>
                  <th style={{ padding: '10px' }}>Student</th>
                  <th style={{ padding: '10px' }}>Amount</th>
                  <th style={{ padding: '10px' }}>Commission</th>
                  <th style={{ padding: '10px' }}>You Receive</th>
                  <th style={{ padding: '10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {completedBookings.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '10px' }}>{new Date(b.slot_time).toLocaleDateString()}</td>
                    <td style={{ padding: '10px' }}>{b.student_alias}</td>
                    <td style={{ padding: '10px' }}>KES {b.fee_kes_snapshot}</td>
                    <td style={{ padding: '10px' }}>KES {b.fee_kes_snapshot * 0.10}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#1A4331' }}>KES {b.fee_kes_snapshot * 0.90}</td>
                    <td style={{ padding: '10px' }}><span style={{ background: '#E8F5E9', color: '#1A4331', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Paid out</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}