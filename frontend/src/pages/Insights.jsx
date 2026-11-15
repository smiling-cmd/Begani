import Sidebar from '../components/Sidebar';

export default function Insights() {
  // Sample data matching your universities
  const monthlyData = [
    { name: 'Jan', bookings: 0 }, { name: 'Feb', bookings: 1 },
    { name: 'Mar', bookings: 5 }, { name: 'Apr', bookings: 1 },
    { name: 'May', bookings: 0 }, { name: 'Jun', bookings: 1 },
    { name: 'Jul', bookings: 1 }, { name: 'Aug', bookings: 3 },
    { name: 'Sep', bookings: 0 }, { name: 'Oct', bookings: 1 },
    { name: 'Nov', bookings: 2 },
  ];

  const schoolData = [
    { name: 'Kenyatta University', count: 4, percentage: 50 },
    { name: 'JKUAT', count: 4, percentage: 50 },
    { name: 'University of Nairobi', count: 8, percentage: 100 },
    { name: 'Egerton University', count: 0, percentage: 0 },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#F5F0E7', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '2rem 4rem', overflowY: 'auto' }}>
        
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#2F6F69', fontSize: '2rem', margin: 0, fontWeight: '800' }}>Insights</h1>
          <p style={{ color: '#666', margin: '0.3rem 0 0 0', fontWeight: '500' }}>
            Your appointments, chats and anonymised insights. You never see a student's phone number; students appear by alias.
          </p>
        </div>

        {/* TOP STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
          <StatCard title="Booked this year" value="16" />
          <StatCard title="Awaiting your confirmation" value="0" />
          <StatCard title="Upcoming appointments" value="2" />
          <StatCard title="Ongoing chats" value="2" />
        </div>

        <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ color: '#2F6F69', marginTop: 0 }}>Insights for data analysis</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '2rem' }}>
            Private therapist view: students come from different schools, so they are grouped by school and year. No names or contact details are used.
          </p>
          
          {/* BAR CHART */}
          <h4 style={{ color: '#2F6F69', marginBottom: '1rem' }}>Bookings by month (this year)</h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '150px', marginBottom: '3rem', paddingBottom: '20px', borderBottom: '1px solid #E5E7EB' }}>
            {monthlyData.map(item => (
              <div key={item.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                {item.bookings > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#2F6F69', marginBottom: '5px' }}>{item.bookings}</span>}
                <div style={{ height: `${(item.bookings / 5) * 100}%`, width: '80%', backgroundColor: item.bookings > 0 ? '#2F6F69' : 'transparent', borderRadius: '4px 4px 0 0', minHeight: item.bookings > 0 ? '10px' : '0' }}></div>
                <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>{item.name}</span>
              </div>
            ))}
          </div>

          {/* SCHOOL BREAKDOWN */}
          <h4 style={{ color: '#2F6F69', marginBottom: '1rem' }}>By school</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {schoolData.map(school => (
              <div key={school.name} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ width: '200px', fontSize: '0.9rem', color: '#2F6F69', fontWeight: '500' }}>{school.name}</span>
                <div style={{ flex: 1, background: '#E5E7EB', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${school.percentage}%`, background: '#2F6F69', height: '100%', borderRadius: '6px' }}></div>
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#2F6F69', width: '20px' }}>{school.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const StatCard = ({ title, value }) => (
  <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
    <h2 style={{ fontSize: '2rem', color: '#2F6F69', margin: '0 0 5px 0' }}>{value}</h2>
    <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>{title}</p>
  </div>
);