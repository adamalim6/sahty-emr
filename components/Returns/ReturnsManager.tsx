
import React, { useState, useEffect } from 'react';
import { useAuth, UserType } from '../../context/AuthContext';
import { api } from '../../services/api';
import { History, LayoutGrid } from 'lucide-react';
import NewReturnTab from './NewReturnTab';
import ReturnHistoryTab from './ReturnHistoryTab';

const ReturnsManager: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [services, setServices] = useState<any[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState<string>('');
    const [loadingServices, setLoadingServices] = useState(true);

    // Load User Services on Mount
    useEffect(() => {
        const loadServices = async () => {
            try {
                // Fetch services available to user
                // EMR logic: Get user's assigned services or all if admin
                const myServices = await api.getUserServices(); 
                setServices(myServices);
                
                if (myServices.length > 0) {
                    setSelectedServiceId(myServices[0].id);
                }
            } catch (error) {
                console.error("Failed to load services", error);
            } finally {
                setLoadingServices(false);
            }
        };
        loadServices();
    }, []);

    return (
        <div className="flex h-screen bg-slate-50 overscroll-none">
            {/* Sidebar / Navigation (Simplified as left panel if needed, but here assuming full page or embedded) */}
            {/* Using standard top-level layout */}
            
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Tabs & Content */}
                <div className="flex-1 flex flex-col p-4 min-h-0 overflow-hidden pt-2">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
                        {/* Tab Bar */}
                        <div className="border-b border-slate-200 flex px-6 pt-2 bg-indigo-900 text-white rounded-t-xl">
                             <button
                                onClick={() => setActiveTab('new')}
                                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                                    activeTab === 'new' 
                                    ? 'border-white text-white' 
                                    : 'border-transparent text-indigo-200 hover:text-white'
                                }`}
                            >
                                <LayoutGrid size={18} />
                                NOUVEAU RETOUR
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                                    activeTab === 'history' 
                                    ? 'border-white text-white' 
                                    : 'border-transparent text-indigo-200 hover:text-white'
                                }`}
                            >
                                <History size={18} />
                                RETOURS DÉJÀ CRÉÉS
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-auto bg-slate-50 p-6">
                            {activeTab === 'new' ? (
                                <NewReturnTab 
                                    services={services}
                                    selectedServiceId={selectedServiceId}
                                    onServiceChange={setSelectedServiceId}
                                />
                            ) : (
                                <ReturnHistoryTab 
                                    services={services}
                                    selectedServiceId={selectedServiceId}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReturnsManager;
