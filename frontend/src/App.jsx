import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import AuthProvider from './context/AuthProvider';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Tua from './pages/Tua';
import Register from './pages/Register'; 
import { useContext } from 'react';
import FindSupport from './pages/FindSupport';
import TherapistProfile from './pages/TherapistProfile';
import TherapistDashboard from './pages/TherapistDashboard';
import Wellbeing from './pages/Wellbeing';
import Activities from './pages/Activities';
import Resources from './pages/Resources';
import Settings from './pages/Settings';
import ChatInbox from './pages/ChatInbox';
import ChatRoom from './pages/ChatRoom';
import OnboardingName from './pages/OnboardingName';
import WelcomeScreen from './pages/WelcomeScreen';
import Insights from './pages/Insights';
import Earnings from './pages/Earnings';  
import AdminDashboard from './pages/AdminDashboard';
import AdminResources from './pages/AdminResources';
import AdminActivities from './pages/AdminActivities';
import CalendarPage from './pages/Calendar';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { token, user } = useContext(AuthContext);
  if (!token) return <Navigate to="/" />;
  if (allowedRoles && !user) {
    return <main className="page-content"><p role="status">Loading your account…</p></main>;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const home = user.role === 'admin'
      ? '/admin-dashboard'
      : user.role === 'therapist'
        ? '/therapist-dashboard'
        : '/home';
    return <Navigate to={home} replace />;
  }
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Register />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingName /></ProtectedRoute>} />
            <Route path="/welcome" element={<ProtectedRoute><WelcomeScreen /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/tua" element={<ProtectedRoute><Tua /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><FindSupport /></ProtectedRoute>} />
            <Route path="/wellbeing" element={<ProtectedRoute><Wellbeing /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute allowedRoles={['student']}><CalendarPage /></ProtectedRoute>} />
            <Route path="/activities" element={<ProtectedRoute><Activities /></ProtectedRoute>} />
            <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/chats" element={<ProtectedRoute><ChatInbox /></ProtectedRoute>} />
            <Route path="/therapist-chats" element={<ProtectedRoute><ChatInbox /></ProtectedRoute>} />
            <Route path="/chat/:id" element={<ProtectedRoute><ChatRoom /></ProtectedRoute>} />
            <Route path="/therapist/:id" element={<ProtectedRoute><TherapistProfile /></ProtectedRoute>} />
            <Route path="/therapist-dashboard" element={<ProtectedRoute allowedRoles={['therapist']}><TherapistDashboard /></ProtectedRoute>} />
            <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin-resources" element={<ProtectedRoute allowedRoles={['admin']}><AdminResources /></ProtectedRoute>} />
            <Route path="/admin-activities" element={<ProtectedRoute allowedRoles={['admin']}><AdminActivities /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute allowedRoles={['therapist']}><Insights /></ProtectedRoute>} />
            <Route path="/earnings" element={<ProtectedRoute allowedRoles={['therapist']}><Earnings /></ProtectedRoute>} />
            
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
