import { Link, useLocation } from 'react-router-dom';
import { Home, MessageCircle, MessageSquare, Calendar, Heart, Leaf } from 'lucide-react';

export default function MobileBottomNav() {
    const location = useLocation();

    const navItems = [
        { label: 'Home', icon: <Home size={22} />, path: '/home' },
        { label: 'TUA', icon: <MessageCircle size={22} />, path: '/tua' },
        { label: 'Messages', icon: <MessageSquare size={22} />, path: '/chats' },
        { label: 'Calendar', icon: <Calendar size={22} />, path: '/calendar' },
        { label: 'Support', icon: <Heart size={22} />, path: '/support' },
        { label: 'Wellbeing', icon: <Leaf size={22} />, path: '/wellbeing' },
    ];

    return (
        <div className="mobile-bottom-nav-wrapper">
            <div
                style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '40px',
                    background: 'linear-gradient(to right, transparent, var(--card))',
                    pointerEvents: 'none',
                    zIndex: 2,
                }}
            />
            <nav
                className="swipeable-nav"
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    gap: '4px',
                    padding: '8px 12px',
                }}
            >
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                                color: isActive ? 'var(--brand-teal-deep)' : 'var(--muted)',
                                textDecoration: 'none',
                                fontSize: '10px',
                                fontWeight: '600',
                                flex: '0 0 auto',
                                minWidth: '68px',
                                scrollSnapAlign: 'start',
                                padding: '6px 0',
                                position: 'relative',
                            }}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                            {isActive && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: '-8px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: '20px',
                                        height: '3px',
                                        borderRadius: '3px',
                                        background: 'var(--brand-teal-deep)',
                                    }}
                                />
                            )}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}