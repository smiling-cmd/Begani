import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import AuthProvider from './context/AuthProvider';
import { AuthContext } from './context/AuthContext';

// Layout Components
import Sidebar from './components/Sidebar';
import MobileHeader from './components/MobileHeader';
import MobileBottomNav from './components/MobileBottomNav';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import OnboardingName from './pages/OnboardingName';
import WelcomeScreen from './pages/WelcomeScreen';
import Home from './pages/Home';
import Tua from './pages/Tua';
import FindSupport from './pages/FindSupport';
import TherapistProfile from './pages/TherapistProfile';
import TherapistDashboard from './pages/TherapistDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminResources from './pages/AdminResources';
import AdminActivities from './pages/AdminActivities';
import Insights from './pages/Insights';
import Earnings from './pages/Earnings';
import Settings from './pages/Settings';
import Resources from './pages/Resources';
import Activities from './pages/Activities';
import Wellbeing from './pages/Wellbeing';
import Calendar from './pages/Calendar';
import ChatInbox from './pages/ChatInbox';
import ChatRoom from './pages/ChatRoom';

const ProtectedRoute = ({ children }) => {
  const { token } = useContext(AuthContext);
  if (!token) return <Navigate to="/" />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* AUTHENTICATED ROUTES */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="app-shell">
                  <MobileHeader />
                  <MobileBottomNav />
                  <Sidebar />
                  <main className="page-content">
                    <Routes>
                      <Route path="/onboarding" element={<OnboardingName />} />
                      <Route path="/welcome" element={<WelcomeScreen />} />
                      <Route path="/home" element={<Home />} />
                      <Route path="/tua" element={<Tua />} />
                      <Route path="/support" element={<FindSupport />} />
                      <Route path="/therapist/:id" element={<TherapistProfile />} />
                      <Route path="/therapist-dashboard" element={<TherapistDashboard />} />
                      <Route path="/admin-dashboard" element={<AdminDashboard />} />
                      <Route path="/admin-resources" element={<AdminResources />} />
                      <Route path="/admin-activities" element={<AdminActivities />} />
                      <Route path="/insights" element={<Insights />} />
                      <Route path="/earnings" element={<Earnings />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/resources" element={<Resources />} />
                      <Route path="/activities" element={<Activities />} />
                      <Route path="/wellbeing" element={<Wellbeing />} />
                      <Route path="/calendar" element={<Calendar />} />
                      <Route path="/chats" element={<ChatInbox />} />
                      <Route path="/therapist-chats" element={<ChatInbox />} />
                      <Route path="/chat/:id" element={<ChatRoom />} />
                      <Route path="*" element={<Navigate to="/home" />} />
                    </Routes>
                  </main>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;