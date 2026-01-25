import React, { useState } from 'react';
import DemandBuilder from './DemandBuilder';
import DemandList from './DemandList';
import { Send, History, Boxes } from 'lucide-react';

const ServiceStockManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                   <h1 className="text-2xl font-bold text-slate-800">Gestion du Stock Service</h1>
                   <p className="text-slate-500">Demandes de réapprovisionnement et suivi.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-slate-200 bg-white px-4 rounded-t-xl">
                <button 
                   onClick={() => setActiveTab('request')}
                   className={`py-3 px-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'request' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                   <Send size={18} />
                   <span>Nouvelle Demande</span>
                </button>
                <button 
                   onClick={() => setActiveTab('history')}
                   className={`py-3 px-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                   <History size={18} />
                   <span>Historique</span>
                </button>
            </div>

            <div className="min-h-[500px]">
                {activeTab === 'request' ? <DemandBuilder /> : <DemandList />}
            </div>
        </div>
    );
};

export default ServiceStockManager;
