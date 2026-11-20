import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, BookOpen, Mountain, Settings, LogOut } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function MobileMenu() {
    const [open, setOpen] = useState(false);
    const { logout, user } = useContext(AuthContext);

    const menuItems = [
        { label: 'Resources', icon: <BookOpen size={20} />, path: '/resources' },
        { label: 'Activities', icon: <Mountain size={20} />, path: '/activities' },
        { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
    ];

    return (
        <>
            <button onClick={() => setOpen(true)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'none', padding: '8px', color: 'var(--heading)'
            }} className="mobile-menu-trigger">
                <Menu size={24} />
            </button>

            {open && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    zIndex: 999, display: 'flex', justifyContent: 'flex-end'
                }} onClick={() => setOpen(false)}>

                    <div onClick={e => e.stopPropagation()} style={{
                        width: '80%', maxWidth: '320px', height: '100%',
                        background: 'var(--card)',
                        padding: '24px',
                        display: 'flex', flexDirection: 'column',
                        animation: 'slideIn 0.3s ease-out'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <div>
                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>Signed in as</p>
                                <h3 style={{ margin: '4px 0 0', fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>{user?.alias || 'Student'}</h3>
                            </div>
                            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                            {menuItems.map(item => (
                                <Link key={item.path} to={item.path} onClick={() => setOpen(false)} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '14px', borderRadius: '12px',
                                    color: 'var(--heading)', textDecoration: 'none', fontWeight: '600',
                                    background: 'var(--surface-subtle)'
                                }}>
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </div>

                        <button onClick={logout} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '14px', borderRadius: '12px',
                            border: '1px solid var(--terra)', background: 'transparent',
                            color: 'var(--terra)', fontWeight: '700'
                        }}>
                            <LogOut size={18} />
                            Log Out
                        </button>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 900px) {
          .mobile-menu-trigger { display: block !important; }
        }
      `}</style>
        </>
    );
}