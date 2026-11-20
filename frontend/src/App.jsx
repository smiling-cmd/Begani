import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import AuthProvider from './context/AuthProvider';
import { AuthContext } from './context/AuthContext';

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
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingName /></ProtectedRoute>} />
          <Route path="/welcome" element={<ProtectedRoute><WelcomeScreen /></ProtectedRoute>} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/tua" element={<ProtectedRoute><Tua /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute><FindSupport /></ProtectedRoute>} />
          <Route path="/therapist/:id" element={<ProtectedRoute><TherapistProfile /></ProtectedRoute>} />
          <Route path="/therapist-dashboard" element={<ProtectedRoute><TherapistDashboard /></ProtectedRoute>} />
          <Route path="/admin-dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin-resources" element={<ProtectedRoute><AdminResources /></ProtectedRoute>} />
          <Route path="/admin-activities" element={<ProtectedRoute><AdminActivities /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/earnings" element={<ProtectedRoute><Earnings /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
          <Route path="/activities" element={<ProtectedRoute><Activities /></ProtectedRoute>} />
          <Route path="/wellbeing" element={<ProtectedRoute><Wellbeing /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/chats" element={<ProtectedRoute><ChatInbox /></ProtectedRoute>} />
          <Route path="/therapist-chats" element={<ProtectedRoute><ChatInbox /></ProtectedRoute>} />
          <Route path="/chat/:id" element={<ProtectedRoute><ChatRoom /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
