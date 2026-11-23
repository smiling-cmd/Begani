import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import AuthProvider from './context/AuthProvider';
import { AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

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
import NotFound from './pages/NotFound';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';


const homeFor = (role) => (role === 'admin' ? '/admin-dashboard' : role === 'therapist' ? '/therapist-dashboard' : '/home');

// Sends signed-out visitors to /login and visitors with the wrong role to their own home page.
const ProtectedRoute = ({ children, allowedRoles, allowUser }) => {
  const { token, user, initializing } = useContext(AuthContext);
  if (!token) return <Navigate to="/login" replace />;
  if (initializing) return <main className="page-content"><p role="status">Loading your account…</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  if (allowUser && !allowUser(user)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* AUTHENTICATED ROUTES */}
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingName /></ProtectedRoute>} />
          <Route path="/welcome" element={<ProtectedRoute><WelcomeScreen /></ProtectedRoute>} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/tua" element={<ProtectedRoute><Tua /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute><FindSupport /></ProtectedRoute>} />
          <Route path="/therapist/:id" element={<ProtectedRoute><TherapistProfile /></ProtectedRoute>} />
          <Route path="/therapist-dashboard" element={<ProtectedRoute allowedRoles={['therapist']}><TherapistDashboard /></ProtectedRoute>} />
          <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin-resources" element={<ProtectedRoute allowedRoles={['admin']}><AdminResources /></ProtectedRoute>} />
          <Route path="/admin-activities" element={<ProtectedRoute allowedRoles={['admin']}><AdminActivities /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute allowedRoles={['therapist']}><Insights /></ProtectedRoute>} />
          <Route path="/earnings" element={<ProtectedRoute allowedRoles={['therapist']} allowUser={(user) => user.therapist_type !== 'school_counsellor'}><Earnings /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
          <Route path="/activities" element={<ProtectedRoute><Activities /></ProtectedRoute>} />
          <Route path="/wellbeing" element={<ProtectedRoute><Wellbeing /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute allowedRoles={['student']}><Calendar /></ProtectedRoute>} />
          <Route path="/chats" element={<ProtectedRoute><ChatInbox /></ProtectedRoute>} />
          <Route path="/therapist-chats" element={<ProtectedRoute><ChatInbox /></ProtectedRoute>} />
          <Route path="/chat/:id" element={<ProtectedRoute><ChatRoom /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />


        </Routes>
      </Router>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
