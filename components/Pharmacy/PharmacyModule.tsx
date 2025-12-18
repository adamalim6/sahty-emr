
import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, ClipboardList, Search, Zap, AlertTriangle,
  CheckCircle2, PackageSearch, RotateCcw, Sparkles, DollarSign,
  FileCode, Database, Check, ArrowRight, ArrowLeft, Save, Lock,
  BookOpen, Truck, ShieldAlert, MapPin, LogOut, Building2,
  FileSignature // Import de l'icône
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
// import { generateMockInventory, generateMockCatalog, generateMockLocations, generateMockPartners, generateMockStockOutHistory } from '../../constants/pharmacy';
import {
  InventoryItem, ItemCategory, InventorySession, InventoryStatus,
  ProductDefinition, PurchaseOrder, DeliveryNote, POStatus,
  StockLocation, QuarantineSessionResult, ProcessingStatus, ProductType,
  PartnerInstitution, StockOutTransaction
} from '../../types/pharmacy';
import { StatCard } from './StatCard';
import { InventoryTable } from './InventoryTable';
import { SystemStockTable } from './SystemStockTable';
import { InventorySessionList } from './InventorySessionList';
import { JavaCodeModal } from './JavaCodeModal';
import { ProductCatalog } from './ProductCatalog';
import { StockEntry } from './StockEntry';
import { LocationManager } from './LocationManager';
import { QuarantineManager } from './QuarantineManager';
import { PartnerManager } from './PartnerManager';
import { StockOutManager } from './StockOutManager';
import { PrescriptionManager } from './PrescriptionManager'; // Import du composant
import { analyzeInventoryDiscrepancies } from '../../services/pharmacyGemini';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const PharmacyModule: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [systemItems, setSystemItems] = useState<InventoryItem[]>([]);
  const [productCatalog, setProductCatalog] = useState<ProductDefinition[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [partners, setPartners] = useState<PartnerInstitution[]>([]);
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [currentSession, setCurrentSession] = useState<InventorySession | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [stockOutHistory, setStockOutHistory] = useState<StockOutTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  // Ajout de 'prescriptions' au type de la vue
  const [view, setView] = useState<'dashboard' | 'inventory' | 'stock' | 'catalog' | 'entry' | 'quarantine' | 'locations' | 'partners' | 'stockout' | 'prescriptions'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showJavaModal, setShowJavaModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [validationSummary, setValidationSummary] = useState<{ count: number, variance: number } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [inv, cat, loc, part, hist] = await Promise.all([
          api.getInventory(),
          api.getCatalog(),
          api.getLocations(),
          api.getPartners(),
          api.getStockOutHistory()
        ]);
        setSystemItems(inv);
        setProductCatalog(cat);
        setLocations(loc);
        setPartners(part);
        // Convert date strings to Date objects
        setStockOutHistory(hist.map(h => ({ ...h, date: new Date(h.date) })));
        setLoading(false);
      } catch (error) {
        console.error("Failed to load pharmacy data", error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddProduct = (product: ProductDefinition) => setProductCatalog([...productCatalog, product]);
  const handleUpdateProduct = (product: ProductDefinition) => setProductCatalog(productCatalog.map(p => p.id === product.id ? product : p));
  const handleUpdateLocations = (newLocations: StockLocation[]) => setLocations(newLocations);
  const handleUpdatePartners = (newPartners: PartnerInstitution[]) => setPartners(newPartners);
  const handleCreatePO = (po: PurchaseOrder) => setPurchaseOrders([po, ...purchaseOrders]);

  const handleReceiveDelivery = (poId: string, deliveryNote: DeliveryNote) => {
    const updatedPOs = purchaseOrders.map(po => {
      if (po.id !== poId) return po;
      const newItems = po.items.map(item => {
        const deliveredNow = deliveryNote.items.find(d => d.productId === item.productId)?.deliveredQty || 0;
        return { ...item, deliveredQty: item.deliveredQty + deliveredNow };
      });
      const allComplete = newItems.every(i => i.deliveredQty >= i.orderedQty);
      const someDelivered = newItems.some(i => i.deliveredQty > 0);
      const status = allComplete ? POStatus.COMPLETED : someDelivered ? POStatus.PARTIAL : POStatus.DRAFT;
      return { ...po, items: newItems, status };
    });
    setPurchaseOrders(updatedPOs);
    setDeliveryNotes([{ ...deliveryNote, status: ProcessingStatus.PENDING }, ...deliveryNotes]);
  };

  const handleConfirmStockOut = (transaction: StockOutTransaction) => {
    setStockOutHistory([transaction, ...stockOutHistory]);
    const newSystemItems = systemItems.map(item => {
      const match = transaction.items.find(t => t.inventoryItemId === item.id);
      if (match) return { ...item, theoreticalQty: item.theoreticalQty - match.quantityToRemove };
      return item;
    });
    setSystemItems(newSystemItems);
    alert(`Sortie de stock confirmée pour ${transaction.type}. Stock mis à jour.`);
  };

  const handleQuarantineProcess = (result: QuarantineSessionResult) => {
    const updatedNotes = deliveryNotes.map(n => n.id === result.noteId ? { ...n, status: ProcessingStatus.PROCESSED, processingResult: result } : n);
    setDeliveryNotes(updatedNotes);

    const newInventoryItems: InventoryItem[] = [];
    result.items.forEach(procItem => {
      const productDef = productCatalog.find(p => p.id === procItem.productId);
      if (!productDef) return;
      procItem.batches.forEach(batch => {
        if (batch.quantity <= 0) return;
        newInventoryItems.push({
          id: `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          productId: procItem.productId,
          name: productDef.name,
          category: productDef.type === ProductType.DRUG ? ItemCategory.ANTIBIOTICS : ItemCategory.CONSUMABLES,
          location: batch.locationId,
          batchNumber: batch.batchNumber || 'N/A',
          expiryDate: batch.expiryDate || '2099-12-31',
          unitPrice: productDef.suppliers[0]?.purchasePrice || 0,
          theoreticalQty: batch.quantity,
          actualQty: null,
          lastUpdated: new Date()
        });
      });
    });
    setSystemItems([...newInventoryItems, ...systemItems]);
    alert(`${newInventoryItems.length} nouvelles lignes de stock injectées avec succès.`);
  };

  const handleCreateSession = () => {
    const newSessionId = `INV-${new Date().getFullYear()}-${String(sessions.length + 1).padStart(3, '0')}`;
    const newSession: InventorySession = {
      id: newSessionId,
      date: new Date().toISOString(),
      createdBy: 'Admin Pharmacie',
      status: InventoryStatus.DRAFT,
      itemsSnapshot: systemItems.map(item => ({ ...item, actualQty: item.theoreticalQty })),
      stats: { totalVariance: 0, itemsCounted: 0 }
    };
    setCurrentSession(newSession);
    setSessions([newSession, ...sessions]);
  };

  const handleUpdateSessionItem = (id: string, qty: number | null) => {
    if (!currentSession || currentSession.status === InventoryStatus.COMPLETED) return;
    const updatedSession = { ...currentSession, itemsSnapshot: currentSession.itemsSnapshot.map(item => item.id === id ? { ...item, actualQty: qty } : item) };
    setCurrentSession(updatedSession);
    setSessions(sessions.map(s => s.id === currentSession.id ? updatedSession : s));
  };

  const handleValidateInventory = () => {
    if (!currentSession) return;
    const itemsToUpdate = currentSession.itemsSnapshot.filter(i => i.actualQty !== null);
    let totalVarianceUnits = itemsToUpdate.reduce((acc, item) => acc + ((item.actualQty || 0) - item.theoreticalQty), 0);
    setValidationSummary({ count: itemsToUpdate.length, variance: totalVarianceUnits });
    setShowConfirmModal(true);
  };

  const confirmAndExecuteUpdate = () => {
    if (!currentSession) return;
    setShowConfirmModal(false);
    setLoading(true);
    setTimeout(() => {
      setSystemItems(systemItems.map(sysItem => {
        const sessionItem = currentSession.itemsSnapshot.find(si => si.id === sysItem.id);
        return (sessionItem && sessionItem.actualQty !== null) ? { ...sysItem, theoreticalQty: sessionItem.actualQty, lastUpdated: new Date() } : sysItem;
      }));
      const completedSession: InventorySession = { ...currentSession, status: InventoryStatus.COMPLETED, stats: { itemsCounted: validationSummary?.count || 0, totalVariance: validationSummary?.variance || 0 } };
      setSessions(sessions.map(s => s.id === completedSession.id ? completedSession : s));
      setCurrentSession(completedSession);
      setLoading(false);
      setShowSuccessModal(true);
    }, 800);
  };

  const generateReport = async () => {
    if (!process.env.API_KEY) return alert("Clé API manquante.");
    setIsAnalyzing(true);
    setShowAiModal(true);
    try {
      const report = await analyzeInventoryDiscrepancies(currentSession ? currentSession.itemsSnapshot : systemItems);
      setAiReport(report);
    } catch (e) {
      setAiReport("Échec de la génération du rapport.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const stats = useMemo(() => {
    const totalValue = systemItems.reduce((acc, i) => acc + (i.theoreticalQty * i.unitPrice), 0);
    return {
      totalItems: systemItems.length,
      totalValue,
      pendingNotes: deliveryNotes.filter(n => n.status === ProcessingStatus.PENDING).length,
      pendingPOs: purchaseOrders.filter(p => p.status !== POStatus.COMPLETED).length
    };
  }, [systemItems, deliveryNotes, purchaseOrders]);

  const categoryData = useMemo(() => {
    const data: Record<string, { name: string, value: number }> = {};
    systemItems.forEach(item => {
      if (!data[item.category]) data[item.category] = { name: item.category, value: 0 };
      data[item.category].value += item.theoreticalQty * item.unitPrice;
    });
    return Object.values(data);
  }, [systemItems]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">Chargement des données de la pharmacie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans text-slate-900">

      {/* Sidebar / Menu */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 md:h-screen sticky top-0 md:fixed z-10 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg"><Zap size={20} className="text-white" /></div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">PharmaCount</h1>
            <p className="text-xs text-slate-400">Pharmacie IA Hospitalière</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button onClick={() => { setView('dashboard'); setCurrentSession(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard size={20} /><span className="font-medium text-sm">Tableau de Bord</span>
          </button>
          {/* Nouveau bouton Prescriptions */}
          <button onClick={() => { setView('prescriptions'); setCurrentSession(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'prescriptions' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <FileSignature size={20} /><span className="font-medium text-sm">Prescriptions</span>
          </button>
          <button onClick={() => { setView('catalog'); setCurrentSession(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'catalog' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <BookOpen size={20} /><span className="font-medium text-sm">Catalogue Produits</span>
          </button>
          <button onClick={() => { setView('entry'); setCurrentSession(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'entry' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Truck size={20} /><span className="font-medium text-sm">Entrées de Stock</span>
          </button>
          <button onClick={() => { setView('quarantine'); setCurrentSession(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'quarantine' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <ShieldAlert size={20} /><span className="font-medium text-sm">Quarantaine / Contrôle</span>
          </button>
          <button onClick={() => { setView('stockout'); setCurrentSession(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'stockout' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <LogOut size={20} /><span className="font-medium text-sm">Sorties / Destructions</span>
          </button>
          <button onClick={() => { setView('partners'); setCurrentSession(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'partners' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Building2 size={20} /><span className="font-medium text-sm">Partenaires / Cliniques</span>
          </button>
          <button onClick={() => { setView('locations'); setCurrentSession(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'locations' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <MapPin size={20} /><span className="font-medium text-sm">Emplacements</span>
          </button>
          <div className="border-t border-slate-800 my-2"></div>
          <button onClick={() => setView('inventory')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'inventory' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <ClipboardList size={20} /><span className="font-medium text-sm">Audit d'Inventaire</span>
          </button>
          <button onClick={() => { setView('stock'); setCurrentSession(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === 'stock' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Database size={20} /><span className="font-medium text-sm">Stock Système</span>
          </button>

          <div className="border-t border-slate-800 my-2"></div>

          <button
            onClick={() => logout()}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-red-400 hover:bg-slate-800 hover:text-red-300"
          >
            <LogOut size={20} /><span className="font-medium text-sm">Déconnexion</span>
          </button>
        </nav>
      </aside>

      {/* Contenu Principal */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        {view !== 'prescriptions' && (
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {view === 'dashboard' ? 'Tableau de Bord' :
                  view === 'catalog' ? 'Catalogue de Produits' :
                    view === 'entry' ? 'Gestion des Entrées' :
                      view === 'quarantine' ? 'Contrôle Quarantaine' :
                        view === 'locations' ? 'Zones de Stockage' :
                          view === 'partners' ? 'Institutions Partenaires' :
                            view === 'stockout' ? 'Gestion des Sorties' :
                              view === 'inventory' ? (currentSession ? `Session : ${currentSession.id}` : 'Sessions d\'Inventaire') : 'État des Stocks Système'}
              </h2>
            </div>

            <div className="flex items-center space-x-3">
              {currentSession && view === 'inventory' && (
                <button onClick={generateReport} className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-all transform active:scale-95">
                  <Sparkles size={18} /><span>Analyse IA Gemini</span>
                </button>
              )}
            </div>
          </header>
        )}

        {view === 'dashboard' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Valeur Totale Stock" value={`€${stats.totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`} icon={<DollarSign size={24} />} color="blue" />
              <StatCard title="Commandes en cours" value={stats.pendingPOs} icon={<Truck size={24} />} color="amber" />
              <StatCard title="En Quarantaine" value={stats.pendingNotes} icon={<ShieldAlert size={24} />} color="red" />
              <StatCard title="Audits Terminés" value={sessions.filter(s => s.status === InventoryStatus.COMPLETED).length} icon={<CheckCircle2 size={24} />} color="green" />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-6">Valeur du Stock par Catégorie</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : view === 'prescriptions' ? (
          <PrescriptionManager />
        ) : view === 'catalog' ? (
          <ProductCatalog products={productCatalog} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} />
        ) : view === 'entry' ? (
          <StockEntry purchaseOrders={purchaseOrders} products={productCatalog} deliveryNotes={deliveryNotes} onCreatePO={handleCreatePO} onReceiveDelivery={handleReceiveDelivery} />
        ) : view === 'quarantine' ? (
          <QuarantineManager deliveryNotes={deliveryNotes} products={productCatalog} locations={locations} onProcessNote={handleQuarantineProcess} />
        ) : view === 'stockout' ? (
          <StockOutManager systemItems={systemItems} partners={partners} deliveryNotes={deliveryNotes} products={productCatalog} onConfirmStockOut={handleConfirmStockOut} stockOutHistory={stockOutHistory} />
        ) : view === 'partners' ? (
          <PartnerManager partners={partners} onUpdatePartners={handleUpdatePartners} />
        ) : view === 'locations' ? (
          <LocationManager locations={locations} inventoryItems={systemItems} onUpdateLocations={handleUpdateLocations} />
        ) : view === 'inventory' ? (
          <>
            {!currentSession ? (
              <InventorySessionList sessions={sessions} onCreateNew={handleCreateSession} onViewSession={setCurrentSession} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                  <div className="flex items-center space-x-4">
                    <button onClick={() => setCurrentSession(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft size={20} /></button>
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="font-bold text-slate-900 text-lg">{currentSession.id}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${currentSession.status === InventoryStatus.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {currentSession.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    {currentSession.status === InventoryStatus.DRAFT && (
                      <>
                        <button onClick={() => setCurrentSession(null)} className="flex items-center space-x-2 px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg">
                          <Save size={18} /><span>Sauvegarder Brouillon</span>
                        </button>
                        <button onClick={handleValidateInventory} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">
                          <Check size={18} /><span>Valider l'Inventaire</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <InventoryTable items={currentSession.itemsSnapshot} onUpdateQuantity={handleUpdateSessionItem} filter={searchTerm} readOnly={currentSession.status === InventoryStatus.COMPLETED} />
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <SystemStockTable items={systemItems} filter={searchTerm} />
          </div>
        )}

        {/* Modal AI */}
        {showAiModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <div className="flex items-center space-x-2"><Sparkles size={20} className="text-purple-600" /><h3 className="font-bold text-lg">Analyse Audit Gemini</h3></div>
                <button onClick={() => setShowAiModal(false)} className="text-slate-400">Fermer</button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 text-slate-700 prose prose-slate max-w-none">
                {isAnalyzing ? <div className="text-center py-12">Analyse des écarts en cours...</div> : <div dangerouslySetInnerHTML={{ __html: aiReport || '' }} />}
              </div>
            </div>
          </div>
        )}

        <JavaCodeModal isOpen={showJavaModal} onClose={() => setShowJavaModal(false)} />
      </main>
    </div>
  );
};


