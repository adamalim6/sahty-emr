// Registry of all Pages/Routes in the system
// This serves as the source of truth for Role Permissions

export const PAGE_REGISTRY = [
    // --- SUPER ADMIN ---
    {
        module: 'Super Admin',
        pages: [
            { id: 'sa_clients', name: 'Gestion des Clients', description: 'Liste et détails des hôpitaux/clients', route: '/super-admin/clients' },
            { id: 'sa_organismes', name: 'Organismes', description: 'Gestion des organismes de prise en charge', route: '/super-admin/organismes' },
            { id: 'sa_actes', name: 'Référentiel Actes', description: 'Catalogue global des actes médicaux', route: '/super-admin/actes' },
            { id: 'sa_roles', name: 'Global Roles', description: 'Définition des permissions globales', route: '/super-admin/roles' },
            { id: 'sa_suppliers', name: 'Fournisseurs', description: 'Gestion des fournisseurs globaux', route: '/super-admin/suppliers' }
        ]
    },
    
    // --- PARAMETRAGE TENANT (DSI) ---
    {
        module: 'Paramètres Tenant (DSI)',
        pages: [
            { id: 'st_users', name: 'Utilisateurs', description: 'Gestion des comptes utilisateurs', route: '/settings/users' },
            { id: 'st_services', name: 'Services', description: 'Configuration des services hospitaliers', route: '/settings/services' },
            { id: 'st_rooms', name: 'Chambres', description: 'Gestion des lits et affectations', route: '/settings/rooms' },
            { id: 'st_pricing', name: 'Tarification', description: 'Configuration des prix des actes', route: '/settings/pricing' },
            { id: 'st_roles', name: 'Rôles Locaux', description: 'Configuration spécifique des rôles du tenant', route: '/settings/roles' }
        ]
    },

    // --- EMR (Dossier Patient) ---
    {
        module: 'EMR (Dossier Patient)',
        pages: [
            { id: 'emr_patients', name: 'Liste Patients', description: 'Base de données patients', route: '/' },
            { id: 'emr_admissions', name: 'Admissions', description: 'Gestion des entrées et séjours', route: '/admissions' },
            { id: 'emr_replenishment', name: 'Réapprovisionnement', description: 'Demandes de produits à la pharmacie', route: '/replenishment' },
            { id: 'emr_service_stock', name: 'Stock Service', description: 'Gestion du stock interne du service', route: '/service-stock' },
            { id: 'emr_returns', name: 'Retours', description: 'Initiation des retours de stock service', route: '/retours' },
            { id: 'emr_waiting_room', name: 'Salle d\'Attente', description: 'File d\'attente des patients', route: '/waiting-room' },
            { id: 'emr_map', name: 'Plan du Service', description: 'Vue graphique des lits', route: '/map' },
            // Note: Dossier Medical and Calendar are contextual or sub-features, but likely accessible if 'Patients' is accessible. 
            // Adding specific keys if they are standalone pages in sidebar:
            { id: 'emr_calendar', name: 'Agenda', description: 'Planification et rendez-vous', route: '/calendar' }
        ]
    },

    // --- PHARMACIE ---
    {
        module: 'Pharmacie',
        pages: [
            { id: 'ph_dashboard', name: 'Tableau de Bord', description: 'Vue d\'ensemble', route: '/pharmacy/dashboard' },
            { id: 'ph_prescriptions', name: 'Prescriptions', description: 'Validation des ordonnances', route: '/pharmacy/prescriptions' },
            { id: 'ph_catalog', name: 'Catalogue Produits', description: 'Base de données médicaments', route: '/pharmacy/catalog' },
            { id: 'ph_entry', name: 'Entrées de Stock', description: 'Réception des commandes', route: '/pharmacy/entries' },
            { id: 'ph_quarantine', name: 'Quarantaine / Contrôle', description: 'Contrôle qualité des arrivages', route: '/pharmacy/quarantine' },
            { id: 'ph_suppliers', name: 'Fournisseurs', description: 'Gestion des fournisseurs', route: '/pharmacy/suppliers' },
            { id: 'ph_stockout', name: 'Sorties / Destructions', description: 'Sorties de stock manuelles', route: '/pharmacy/stockouts' },
            { id: 'ph_returns', name: 'Réception Retours', description: 'Gestion des retours services', route: '/pharmacy/returns' },
            { id: 'ph_partners', name: 'Partenaires / Cliniques', description: 'Partenaires externes', route: '/pharmacy/partners' },
            { id: 'ph_locations', name: 'Emplacements', description: 'Zones de stockage', route: '/pharmacy/locations' },
            { id: 'ph_inventory', name: 'Audit d\'Inventaire', description: 'Inventaires physiques', route: '/pharmacy/inventory' },
            { id: 'ph_stock', name: 'Stock Pharma', description: 'Consultation du stock', route: '/pharmacy/stock' },
            { id: 'ph_requests', name: 'Demandes & Transferts', description: 'Demandes de services', route: '/pharmacy/requests' }
        ]
    }
];
