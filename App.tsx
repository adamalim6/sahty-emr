import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PatientList } from './components/PatientList';
import { AdmissionList } from './components/AdmissionList';
import { CalendarView } from './components/CalendarView';
import { WaitingRoom } from './components/WaitingRoom';
import { WardMap } from './components/WardMap';
import { Settings } from './components/Settings';
import { PatientDossier } from './components/PatientDossier/PatientDossier';
import { AdmissionDossier } from './components/AdmissionDossier/AdmissionDossier';
import { PharmacyModule } from './components/Pharmacy/PharmacyModule';
import { AuthProvider, useAuth, UserRole } from './context/AuthContext';
import { Login } from './components/Login';

const ProtectedRoute = ({ role, children }: { role: UserRole, children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== role) {
    // Redirect to the correct home based on role
    return <Navigate to={user?.role === 'PHARMACIST' ? '/pharmacy' : '/'} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Doctor / EMR Routes */}
          <Route path="/" element={
            <ProtectedRoute role="DOCTOR">
              <Layout>
                <Outlet />
              </Layout>
            </ProtectedRoute>
          }>
            <Route index element={<PatientList />} />
            <Route path="patient/:id" element={<PatientDossier />} />
            <Route path="admissions" element={<AdmissionList />} />
            <Route path="admission/:id" element={<AdmissionDossier />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="waiting-room" element={<WaitingRoom />} />
            <Route path="waiting-room" element={<WaitingRoom />} />
            <Route path="map" element={<WardMap />} />
            <Route path="map" element={<WardMap />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Pharmacist / Pharmacy Routes */}
          <Route path="/pharmacy/*" element={
            <ProtectedRoute role="PHARMACIST">
              <PharmacyModule />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
