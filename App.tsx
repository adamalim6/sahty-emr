import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PatientList } from './components/PatientList';
import { AdmissionList } from './components/AdmissionList';
import { CalendarView } from './components/CalendarView';
import { ReturnsReception } from './components/Pharmacy/ReturnsReception';
import { ATCSandboxPage } from './components/SuperAdmin/ATCSandboxPage';
import { Toaster } from 'react-hot-toast';
import { WaitingRoom } from './components/WaitingRoom';
import { WardMap } from './components/WardMap';
import { Settings } from './components/Settings';
import { PatientDossier } from './components/PatientDossier/PatientDossier';
import { AdmissionDossier } from './components/AdmissionDossier/AdmissionDossier';
import { PharmacyModule } from './components/Pharmacy/PharmacyModule';
import { AuthProvider, useAuth, UserType } from './context/AuthContext';
import { Login } from './components/Login';
import { SuperAdminLayout } from './components/SuperAdmin/SuperAdminLayout';
import { ActesPage } from './components/SuperAdmin/ActesPage';
import { ClientsPage } from './components/SuperAdmin/ClientsPage';
import { ClientDetailPage } from './components/SuperAdmin/ClientDetailPage';
import { OrganismesPage } from './components/SuperAdmin/OrganismesPage';
import { SettingsLayout } from './components/Settings/SettingsLayout';
import { UsersPage } from './components/Settings/UsersPage';
import { ServicesPage } from './components/Settings/ServicesPage';
import { ServiceDetailPage } from './components/Settings/ServiceDetailPage';
import { RoomsPage } from './components/Settings/RoomsPage';
import { PricingPage } from './components/Settings/PricingPage';
import { RolesPage } from './components/Settings/RolesPage'; 
import { ReadOnlyRoleDetailPage } from './components/Settings/ReadOnlyRoleDetailPage'; 
// Correct import for Super Admin
import { RolesPage as SuperAdminRolesPage } from './components/SuperAdmin/RolesPage';
import { SuppliersPage } from './components/SuperAdmin/SuppliersPage';
import { GlobalProductManager } from './components/SuperAdmin/GlobalProductManager';
import { GlobalDCIManager } from './components/SuperAdmin/GlobalDCIManager';
import { EMDNSandboxPage } from './components/SuperAdmin/EMDNSandboxPage';
import { RoleDetailPage } from './components/SuperAdmin/RoleDetailPage';
import { ServiceStock } from './components/ServiceStock';
import ServiceStockManager from './components/StockTransfer/ServiceStockManager';
import { EmrLocationManager } from './components/EmrLocationManager';
import TransferManager from './components/StockTransfer/TransferManager';

const ProtectedRoute = ({ role, permission, children }: { role?: string | UserType, permission?: string, children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-400">Loading Session...</div>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  // 1. Permission Check (Strongest)
  if (permission) {
      const hasPermission = user?.permissions?.includes(permission);
      if (!hasPermission) return <Navigate to="/login" replace />;
  }

  // 2. Role Check (Legacy/Fallback)
  if (role) {
      const hasRole = Object.values(UserType).includes(role as UserType) 
        ? user?.user_type === role
        : user?.role_id === role || (role === 'DOCTOR' && user?.user_type === UserType.TENANT_USER); 
      
      if (!hasRole) return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Doctor / EMR Routes - PROTECTED BY PERMISSION */}
          <Route path="/" element={
            <ProtectedRoute permission="emr_patients">
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
            <Route path="map" element={<WardMap />} />
            <Route path="service-stock" element={<ServiceStock />} />
            <Route path="replenishment" element={<ServiceStockManager />} />

          </Route>
          
          <Route path="/profile" element={
            <ProtectedRoute role="DOCTOR">
               <Layout>
                  <Settings />
               </Layout>
            </ProtectedRoute>
          } />

          {/* Tenant Admin (DSI) Routes */}
          <Route path="/settings" element={
            <ProtectedRoute role={UserType.TENANT_SUPERADMIN}>
               <SettingsLayout />
            </ProtectedRoute>
          }>
             <Route index element={<Navigate to="users" replace />} />
             <Route path="users" element={<UsersPage />} />
             <Route path="services" element={<ServicesPage />} />
             <Route path="services/:id" element={<ServiceDetailPage />} />
             <Route path="rooms" element={<RoomsPage />} />
             <Route path="pricing" element={<PricingPage />} />
             <Route path="roles" element={<RolesPage />} />
             <Route path="roles/:id" element={<ReadOnlyRoleDetailPage />} />
          </Route>

          {/* Super Admin Routes */}
          <Route path="/super-admin/*" element={
            <ProtectedRoute role={UserType.SUPER_ADMIN}>
              <SuperAdminLayout />
            </ProtectedRoute>
          }>
             <Route path="clients" element={<ClientsPage />} />
             <Route path="clients/:id" element={<ClientDetailPage />} />
             <Route path="organismes" element={<OrganismesPage />} />
             <Route path="actes" element={<ActesPage />} />
             <Route path="roles" element={<SuperAdminRolesPage />} />
             <Route path="roles/:id" element={<RoleDetailPage />} />
             <Route path="suppliers" element={<SuppliersPage />} />
             <Route path="products" element={<GlobalProductManager />} />
             <Route path="dci" element={<GlobalDCIManager />} />
             <Route path="atc-sandbox" element={<ATCSandboxPage />} />
             <Route path="emdn" element={<EMDNSandboxPage />} />
             <Route index element={<Navigate to="clients" replace />} />
          </Route>

          {/* Pharmacist / Pharmacy Routes - PROTECTED BY PERMISSION */}
          <Route path="/pharmacy/processing/:demandId" element={
            <ProtectedRoute permission="ph_dashboard">
               <TransferManager />
            </ProtectedRoute>
          } />

          <Route path="/pharmacy/*" element={
            <ProtectedRoute permission="ph_dashboard">
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
