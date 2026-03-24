BEGIN;

-- Seed public.units
INSERT INTO public.units (code, display, is_ucum, is_active, sort_order, requires_fluid_info) VALUES 
('ug/L', 'µg/L', TRUE::boolean, TRUE::boolean, '100'::int, FALSE::boolean),
('ng/L', 'ng/L', TRUE::boolean, TRUE::boolean, '101'::int, FALSE::boolean),
('pg/mL', 'pg/mL', TRUE::boolean, TRUE::boolean, '102'::int, FALSE::boolean),
('ng/mL', 'ng/mL', TRUE::boolean, TRUE::boolean, '103'::int, FALSE::boolean),
('ug/mL', 'µg/mL', TRUE::boolean, TRUE::boolean, '104'::int, FALSE::boolean),
('mg/dL', 'mg/dL', TRUE::boolean, TRUE::boolean, '105'::int, FALSE::boolean),
('ug/dL', 'µg/dL', TRUE::boolean, TRUE::boolean, '106'::int, FALSE::boolean),
('ng/dL', 'ng/dL', TRUE::boolean, TRUE::boolean, '107'::int, FALSE::boolean),
('pg/L', 'pg/L', TRUE::boolean, TRUE::boolean, '108'::int, FALSE::boolean),
('pmol/L', 'pmol/L', TRUE::boolean, TRUE::boolean, '109'::int, FALSE::boolean),
('nmol/L', 'nmol/L', TRUE::boolean, TRUE::boolean, '110'::int, FALSE::boolean),
('umol/L', 'µmol/L', TRUE::boolean, TRUE::boolean, '111'::int, FALSE::boolean),
('umol/24h', 'µmol/24h', TRUE::boolean, TRUE::boolean, '112'::int, FALSE::boolean),
('mmol/24h', 'mmol/24h', TRUE::boolean, TRUE::boolean, '113'::int, FALSE::boolean),
('mg/24h', 'mg/24h', TRUE::boolean, TRUE::boolean, '114'::int, FALSE::boolean),
('g/24h', 'g/24h', TRUE::boolean, TRUE::boolean, '115'::int, FALSE::boolean),
('mL/24h', 'mL/24h', TRUE::boolean, TRUE::boolean, '116'::int, FALSE::boolean),
('g/dL', 'g/dL', TRUE::boolean, TRUE::boolean, '117'::int, FALSE::boolean),
('U/mL', 'U/mL', TRUE::boolean, TRUE::boolean, '118'::int, FALSE::boolean),
('IU/mL', 'IU/mL', TRUE::boolean, TRUE::boolean, '119'::int, FALSE::boolean),
('mIU/mL', 'mIU/mL', TRUE::boolean, TRUE::boolean, '120'::int, FALSE::boolean),
('kU/L', 'kU/L', TRUE::boolean, TRUE::boolean, '121'::int, FALSE::boolean),
('IU/L', 'IU/L', TRUE::boolean, TRUE::boolean, '122'::int, FALSE::boolean),
('sec', 'sec', FALSE::boolean, TRUE::boolean, '123'::int, FALSE::boolean),
('INR', 'INR', FALSE::boolean, TRUE::boolean, '124'::int, FALSE::boolean),
('fL', 'fL', TRUE::boolean, TRUE::boolean, '125'::int, FALSE::boolean),
('pg', 'pg', TRUE::boolean, TRUE::boolean, '126'::int, FALSE::boolean),
('copies/mL', 'copies/mL', FALSE::boolean, TRUE::boolean, '127'::int, FALSE::boolean),
('log10 copies/mL', 'log10 copies/mL', FALSE::boolean, TRUE::boolean, '128'::int, FALSE::boolean),
('CFU/mL', 'UFC/mL', FALSE::boolean, TRUE::boolean, '129'::int, FALSE::boolean),
('CFU/g', 'UFC/g', FALSE::boolean, TRUE::boolean, '130'::int, FALSE::boolean),
('cells/uL', 'cellules/µL', FALSE::boolean, TRUE::boolean, '131'::int, FALSE::boolean),
('G/L', 'G/L', FALSE::boolean, TRUE::boolean, '132'::int, FALSE::boolean),
('T/L', 'T/L', FALSE::boolean, TRUE::boolean, '133'::int, FALSE::boolean),
('M/uL', 'M/µL', FALSE::boolean, TRUE::boolean, '134'::int, FALSE::boolean),
('ratio', 'ratio', FALSE::boolean, TRUE::boolean, '135'::int, FALSE::boolean),
('index', 'index', FALSE::boolean, TRUE::boolean, '136'::int, FALSE::boolean),
('titre', 'titre', FALSE::boolean, TRUE::boolean, '137'::int, FALSE::boolean),
('UA/mL', 'UA/mL', FALSE::boolean, TRUE::boolean, '138'::int, FALSE::boolean),
('AU/mL', 'AU/mL', FALSE::boolean, TRUE::boolean, '139'::int, FALSE::boolean),
('kPa', 'kPa', TRUE::boolean, TRUE::boolean, '140'::int, FALSE::boolean),
('mEq/L', 'mEq/L', TRUE::boolean, TRUE::boolean, '141'::int, FALSE::boolean),
('mOsm/kg', 'mOsm/kg', TRUE::boolean, TRUE::boolean, '142'::int, FALSE::boolean),
('/uL', '/µL', FALSE::boolean, TRUE::boolean, '143'::int, FALSE::boolean),
('/mm3', '/mm³', FALSE::boolean, TRUE::boolean, '144'::int, FALSE::boolean),
('No unit', 'Sans unité', FALSE::boolean, TRUE::boolean, '145'::int, FALSE::boolean);

-- Seed public.lab_sections
INSERT INTO public.lab_sections (sous_famille_id, code, libelle, description, actif, sort_order) 
  SELECT id, 'CHIMIE_GENERALE', 'Chimie générale', 'Chimie générale', TRUE::boolean, '10'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'CHIMIE_GENERALE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'METABOLISME_GLUCIDIQUE', 'Métabolisme glucidique', 'Métabolisme glucidique', TRUE::boolean, '20'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'METABOLISME_GLUCIDIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'FONCTION_RENALE', 'Fonction rénale', 'Fonction rénale', TRUE::boolean, '30'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'FONCTION_RENALE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'FONCTION_HEPATIQUE', 'Fonction hépatique', 'Fonction hépatique', TRUE::boolean, '40'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'FONCTION_HEPATIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ENZYMOLOGIE', 'Enzymologie', 'Enzymologie', TRUE::boolean, '50'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ENZYMOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'BILAN_LIPIDIQUE', 'Bilan lipidique', 'Bilan lipidique', TRUE::boolean, '60'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'BILAN_LIPIDIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'METABOLISME_PHOSPHOCALCIQUE', 'Métabolisme phosphocalcique', 'Métabolisme phosphocalcique', TRUE::boolean, '70'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'METABOLISME_PHOSPHOCALCIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PROTEINES_INFLAMMATION', 'Protéines et inflammation', 'Protéines et inflammation', TRUE::boolean, '80'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PROTEINES_INFLAMMATION' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'VITAMINES_OLIGOELEMENTS', 'Vitamines et oligoéléments', 'Vitamines et oligoéléments', TRUE::boolean, '90'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'VITAMINES_OLIGOELEMENTS' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'MARQUEURS_CARDIAQUES', 'Marqueurs cardiaques', 'Marqueurs cardiaques', TRUE::boolean, '100'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'MARQUEURS_CARDIAQUES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'MARQUEURS_TUMORAUX', 'Marqueurs tumoraux', 'Marqueurs tumoraux', TRUE::boolean, '110'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'MARQUEURS_TUMORAUX' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'Endocrinologie / Hormonologie', 'Endocrinologie / Hormonologie', TRUE::boolean, '120'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ENDOCRINOLOGIE_HORMONOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'CHIMIE_URINAIRE_GENERALE', 'Chimie urinaire générale', 'Chimie urinaire générale', TRUE::boolean, '130'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CHIMIE URINAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'CHIMIE_URINAIRE_GENERALE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'RECUEILS_24H', 'Recueils de 24h', 'Recueils de 24h', TRUE::boolean, '140'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CHIMIE URINAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'RECUEILS_24H' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'RAPPORTS_URINAIRES', 'Rapports urinaires', 'Rapports urinaires', TRUE::boolean, '150'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CHIMIE URINAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'RAPPORTS_URINAIRES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'MICROALBUMINURIE_PROTEINURIE', 'Microalbuminurie / protéinurie', 'Microalbuminurie / protéinurie', TRUE::boolean, '160'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CHIMIE URINAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'MICROALBUMINURIE_PROTEINURIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PROTEINES', 'Protéines', 'Protéines', TRUE::boolean, '170'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ELECTROPHORÈSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PROTEINES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'HEMOGLOBINES', 'Hémoglobines', 'Hémoglobines', TRUE::boolean, '180'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ELECTROPHORÈSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'HEMOGLOBINES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'LIPOPROTEINES', 'Lipoprotéines', 'Lipoprotéines', TRUE::boolean, '190'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ELECTROPHORÈSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'LIPOPROTEINES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'IMMUNOFIXATION', 'Immunofixation', 'Immunofixation', TRUE::boolean, '200'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ELECTROPHORÈSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'IMMUNOFIXATION' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'EQUILIBRE_ACIDO_BASIQUE', 'Équilibre acido-basique', 'Équilibre acido-basique', TRUE::boolean, '210'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'GAZOMÉTRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'EQUILIBRE_ACIDO_BASIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'OXYGENATION', 'Oxygénation', 'Oxygénation', TRUE::boolean, '220'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'GAZOMÉTRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'OXYGENATION' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PARAMETRES_DERIVES', 'Paramètres dérivés', 'Paramètres dérivés', TRUE::boolean, '230'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'GAZOMÉTRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PARAMETRES_DERIVES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'COOXIMETRIE', 'Co-oxymétrie', 'Co-oxymétrie', TRUE::boolean, '240'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'GAZOMÉTRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'COOXIMETRIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'HEMATIMETRIE', 'Hématimétrie', 'Hématimétrie', TRUE::boolean, '250'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'HÉMATOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'HEMATIMETRIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'RETICULOCYTES', 'Réticulocytes', 'Réticulocytes', TRUE::boolean, '260'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'HÉMATOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'RETICULOCYTES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'HEMOSTASE', 'Hémostase', 'Hémostase', TRUE::boolean, '270'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'HÉMATOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'HEMOSTASE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'THROMBOPHILIE', 'Thrombophilie', 'Thrombophilie', TRUE::boolean, '280'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'HÉMATOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'THROMBOPHILIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'CELLULES_SPECIALISEES', 'Cellules spécialisées', 'Cellules spécialisées', TRUE::boolean, '290'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'HÉMATOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'CELLULES_SPECIALISEES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'AUTOIMMUNITE_SYSTEMIQUE', 'Auto-immunité systémique', 'Auto-immunité systémique', TRUE::boolean, '300'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'IMMUNOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'AUTOIMMUNITE_SYSTEMIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'Auto-immunité d’organe', 'Auto-immunité d’organe', TRUE::boolean, '310'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'IMMUNOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'AUTOIMMUNITE_ORGANE_SPECIFIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'IMMUNOCHIMIE', 'Immunochimie', 'Immunochimie', TRUE::boolean, '320'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'IMMUNOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'IMMUNOCHIMIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ALLERGOLOGIE', 'Allergologie', 'Allergologie', TRUE::boolean, '330'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'IMMUNOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ALLERGOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'COMPLEMENT_IMMUNITAIRE', 'Complément immunitaire', 'Complément immunitaire', TRUE::boolean, '340'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'IMMUNOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'COMPLEMENT_IMMUNITAIRE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'BACTERIOLOGIE', 'Bactériologie', 'Bactériologie', TRUE::boolean, '350'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'MICROBIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'BACTERIOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'MYCOBACTERIOLOGIE', 'Mycobactériologie', 'Mycobactériologie', TRUE::boolean, '360'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'MICROBIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'MYCOBACTERIOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'MYCOLOGIE', 'Mycologie', 'Mycologie', TRUE::boolean, '370'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'MICROBIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'MYCOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PARASITOLOGIE', 'Parasitologie', 'Parasitologie', TRUE::boolean, '380'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'MICROBIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PARASITOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PRELEVEMENTS_SPECIFIQUES', 'Prélèvements spécifiques', 'Prélèvements spécifiques', TRUE::boolean, '390'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'MICROBIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PRELEVEMENTS_SPECIFIQUES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'MYCOLOGIE_CLINIQUE', 'Mycologie clinique', 'Mycologie clinique', TRUE::boolean, '400'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'PARASITOLOGIE/MYCOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'MYCOLOGIE_CLINIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PARASITOLOGIE_CLINIQUE', 'Parasitologie clinique', 'Parasitologie clinique', TRUE::boolean, '410'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'PARASITOLOGIE/MYCOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PARASITOLOGIE_CLINIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'HEPATITES_VIRALES', 'Hépatites virales', 'Hépatites virales', TRUE::boolean, '420'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'SÉROLOGIE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'HEPATITES_VIRALES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'VIH_RETROVIRUS', 'VIH / rétrovirus', 'VIH / rétrovirus', TRUE::boolean, '430'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'SÉROLOGIE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'VIH_RETROVIRUS' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'HERPESVIRIDAE', 'Herpesviridae', 'Herpesviridae', TRUE::boolean, '440'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'SÉROLOGIE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'HERPESVIRIDAE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'INFECTIONS_MATERNELLES', 'Infections maternelles', 'Infections maternelles', TRUE::boolean, '450'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'SÉROLOGIE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'INFECTIONS_MATERNELLES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'BACTERIENNES', 'Infections bactériennes', 'Infections bactériennes', TRUE::boolean, '460'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'SÉROLOGIE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'BACTERIENNES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PARASITAIRES', 'Infections parasitaires', 'Infections parasitaires', TRUE::boolean, '470'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'SÉROLOGIE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PARASITAIRES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'VIRALES_DIVERSES', 'Infections virales diverses', 'Infections virales diverses', TRUE::boolean, '480'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'SÉROLOGIE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'VIRALES_DIVERSES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PCR_VIRALES', 'PCR virales', 'PCR virales', TRUE::boolean, '490'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOLOGIE MOLÉCULAIRE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PCR_VIRALES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PCR_BACTERIENNES', 'PCR bactériennes', 'PCR bactériennes', TRUE::boolean, '500'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOLOGIE MOLÉCULAIRE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PCR_BACTERIENNES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PCR_PARASITAIRES', 'PCR parasitaires', 'PCR parasitaires', TRUE::boolean, '510'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOLOGIE MOLÉCULAIRE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PCR_PARASITAIRES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'CHARGES_VIRALES', 'Charges virales', 'Charges virales', TRUE::boolean, '520'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOLOGIE MOLÉCULAIRE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'CHARGES_VIRALES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'GENOTYPAGE_RESISTANCE', 'Génotypage / résistance', 'Génotypage / résistance', TRUE::boolean, '530'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOLOGIE MOLÉCULAIRE INFECTIEUSE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'GENOTYPAGE_RESISTANCE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'IMMUNOPHENOTYPAGE_HEMATO', 'Immunophénotypage hématologique', 'Immunophénotypage hématologique', TRUE::boolean, '540'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CYTOMÉTRIE EN FLUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'IMMUNOPHENOTYPAGE_HEMATO' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'IMMUNOMONITORING', 'Immunomonitoring', 'Immunomonitoring', TRUE::boolean, '550'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CYTOMÉTRIE EN FLUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'IMMUNOMONITORING' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'MALADIE_RESIDUELLE', 'Maladie résiduelle', 'Maladie résiduelle', TRUE::boolean, '560'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CYTOMÉTRIE EN FLUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'MALADIE_RESIDUELLE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'TYPAGE_HLA', 'Typage HLA', 'Typage HLA', TRUE::boolean, '570'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'HISTOCOMPATIBILITÉ' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'TYPAGE_HLA' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ANTICORPS_ANTI_HLA', 'Anticorps anti-HLA', 'Anticorps anti-HLA', TRUE::boolean, '580'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'HISTOCOMPATIBILITÉ' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ANTICORPS_ANTI_HLA' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'CROSSMATCH', 'Crossmatch', 'Crossmatch', TRUE::boolean, '590'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'HISTOCOMPATIBILITÉ' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'CROSSMATCH' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'SUIVI_GREFFE', 'Suivi de greffe', 'Suivi de greffe', TRUE::boolean, '600'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'HISTOCOMPATIBILITÉ' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'SUIVI_GREFFE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'CYTOGENETIQUE_CONSTITUTIONNELLE', 'Cytogénétique constitutionnelle', 'Cytogénétique constitutionnelle', TRUE::boolean, '610'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CYTOGÉNÉTIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'CYTOGENETIQUE_CONSTITUTIONNELLE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'CYTOGENETIQUE_HEMATO', 'Cytogénétique hématologique', 'Cytogénétique hématologique', TRUE::boolean, '620'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CYTOGÉNÉTIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'CYTOGENETIQUE_HEMATO' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'FISH', 'FISH', 'FISH', TRUE::boolean, '630'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CYTOGÉNÉTIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'FISH' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ARRAY_CGH', 'Array CGH', 'Array CGH', TRUE::boolean, '640'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'CYTOGÉNÉTIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ARRAY_CGH' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'GENES_MONOGENIQUES', 'Gènes monogéniques', 'Gènes monogéniques', TRUE::boolean, '650'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'GÉNÉTIQUE MOLÉCULAIRE CONSTITUTIONNELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'GENES_MONOGENIQUES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PANELS_GENETIQUES', 'Panels génétiques', 'Panels génétiques', TRUE::boolean, '660'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'GÉNÉTIQUE MOLÉCULAIRE CONSTITUTIONNELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PANELS_GENETIQUES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'CNV', 'CNV', 'CNV', TRUE::boolean, '670'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'GÉNÉTIQUE MOLÉCULAIRE CONSTITUTIONNELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'CNV' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'PHARMACOGENETIQUE', 'Pharmacogénétique', 'Pharmacogénétique', TRUE::boolean, '680'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'GÉNÉTIQUE MOLÉCULAIRE CONSTITUTIONNELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'PHARMACOGENETIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'FUSIONS_TRANSCRITS', 'Fusions / transcrits', 'Fusions / transcrits', TRUE::boolean, '690'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOLOGIE MOLÉCULAIRE ONCOHÉMATOLOGIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'FUSIONS_TRANSCRITS' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'MUTATIONS_SOMATIQUES', 'Mutations somatiques', 'Mutations somatiques', TRUE::boolean, '700'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOLOGIE MOLÉCULAIRE ONCOHÉMATOLOGIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'MUTATIONS_SOMATIQUES' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'MALADIE_RESIDUELLE_MOLECULAIRE', 'Maladie résiduelle moléculaire', 'Maladie résiduelle moléculaire', TRUE::boolean, '710'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'BIOLOGIE MOLÉCULAIRE ONCOHÉMATOLOGIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'MALADIE_RESIDUELLE_MOLECULAIRE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'SUIVI_THERAPEUTIQUE', 'Suivi thérapeutique', 'Suivi thérapeutique', TRUE::boolean, '720'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'MÉDICAMENTS ET TOXIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'SUIVI_THERAPEUTIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'TOXICOLOGIE_D_URGENCE', 'Toxicologie d’urgence', 'Toxicologie d’urgence', TRUE::boolean, '730'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'MÉDICAMENTS ET TOXIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'TOXICOLOGIE_D_URGENCE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'TOXIQUES_ET_METAUX', 'Toxiques et métaux', 'Toxiques et métaux', TRUE::boolean, '740'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'MÉDICAMENTS ET TOXIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'TOXIQUES_ET_METAUX' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ADDICTOLOGIE_BIOLOGIQUE', 'Addictologie biologique', 'Addictologie biologique', TRUE::boolean, '750'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'MÉDICAMENTS ET TOXIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ADDICTOLOGIE_BIOLOGIQUE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ANATOMOPATHOLOGIE', 'Anatomopathologie', 'Anatomopathologie', TRUE::boolean, '760'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ANAPATH - BIOLOGIE MOLECULAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ANATOMOPATHOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ANATOMOPATHOLOGIE', 'Anatomopathologie', 'Anatomopathologie', TRUE::boolean, '770'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ANAPATH - BIOPSIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ANATOMOPATHOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ANATOMOPATHOLOGIE', 'Anatomopathologie', 'Anatomopathologie', TRUE::boolean, '780'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ANAPATH-CYTOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ANATOMOPATHOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ANATOMOPATHOLOGIE', 'Anatomopathologie', 'Anatomopathologie', TRUE::boolean, '790'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ANAPATH - EXTEMPORANE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ANATOMOPATHOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ANATOMOPATHOLOGIE', 'Anatomopathologie', 'Anatomopathologie', TRUE::boolean, '800'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ANAPATH - IMMUNOHISTOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ANATOMOPATHOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ANATOMOPATHOLOGIE', 'Anatomopathologie', 'Anatomopathologie', TRUE::boolean, '810'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ANAPATH - PETITE PIECE OPERATOIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ANATOMOPATHOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ANATOMOPATHOLOGIE', 'Anatomopathologie', 'Anatomopathologie', TRUE::boolean, '820'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ANAPATH - PIECE OPERATOIRE COMPLEXE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ANATOMOPATHOLOGIE' AND sous_famille_id = public.sih_sous_familles.id)
  UNION ALL
  SELECT id, 'ANATOMOPATHOLOGIE', 'Anatomopathologie', 'Anatomopathologie', TRUE::boolean, '830'::int 
  FROM public.sih_sous_familles 
  WHERE code = 'ANAPATH - PIECE OPERATOIRE SIMPLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = 'ANATOMOPATHOLOGIE' AND sous_famille_id = public.sih_sous_familles.id);

-- Seed public.lab_sub_sections
INSERT INTO public.lab_sub_sections (section_id, code, libelle, description, actif, sort_order) 
  SELECT id, 'ELECTROLYTES', 'Electrolytes', 'Electrolytes', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ELECTROLYTES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'OSMOLALITE', 'Osmolalite', 'Osmolalite', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'OSMOLALITE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LACTATE', 'Lactate', 'Lactate', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LACTATE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'AMMONIEMIE', 'Ammoniemie', 'Ammoniemie', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'AMMONIEMIE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'OLIGO_ELEMENTS_COURANTS', 'Oligo Elements Courants', 'Oligo Elements Courants', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'OLIGO_ELEMENTS_COURANTS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'GLYCEMIE', 'Glycemie', 'Glycemie', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'METABOLISME_GLUCIDIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'GLYCEMIE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEMOGLOBINE_GLYQUEE', 'Hemoglobine Glyquee', 'Hemoglobine Glyquee', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'METABOLISME_GLUCIDIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEMOGLOBINE_GLYQUEE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'INSULINORESISTANCE', 'Insulinoresistance', 'Insulinoresistance', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'METABOLISME_GLUCIDIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'INSULINORESISTANCE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HORMONES_PANCREATIQUES', 'Hormones Pancreatiques', 'Hormones Pancreatiques', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'METABOLISME_GLUCIDIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HORMONES_PANCREATIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'AZOTEMIE', 'Azotemie', 'Azotemie', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'FONCTION_RENALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'AZOTEMIE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'FILTRATION_GLOMERULAIRE', 'Filtration Glomerulaire', 'Filtration Glomerulaire', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'FONCTION_RENALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'FILTRATION_GLOMERULAIRE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PROTEINES_RENALES', 'Proteines Renales', 'Proteines Renales', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'FONCTION_RENALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PROTEINES_RENALES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'FONCTION_TUBULAIRE', 'Fonction Tubulaire', 'Fonction Tubulaire', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'FONCTION_RENALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'FONCTION_TUBULAIRE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CYTOLYSE', 'Cytolyse', 'Cytolyse', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'FONCTION_HEPATIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CYTOLYSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CHOLESTASE', 'Cholestase', 'Cholestase', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'FONCTION_HEPATIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CHOLESTASE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'BILIRUBINE', 'Bilirubine', 'Bilirubine', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'FONCTION_HEPATIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'BILIRUBINE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SYNTHSE_HEPATIQUE', 'Synthse Hepatique', 'Synthse Hepatique', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'FONCTION_HEPATIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SYNTHSE_HEPATIQUE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ENZYMES_HEPATIQUES', 'Enzymes Hepatiques', 'Enzymes Hepatiques', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'ENZYMOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ENZYMES_HEPATIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ENZYMES_PANCREATIQUES', 'Enzymes Pancreatiques', 'Enzymes Pancreatiques', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'ENZYMOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ENZYMES_PANCREATIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ENZYMES_TISSULAIRES', 'Enzymes Tissulaires', 'Enzymes Tissulaires', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'ENZYMOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ENZYMES_TISSULAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CHOLESTEROL', 'Cholesterol', 'Cholesterol', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'BILAN_LIPIDIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CHOLESTEROL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'TRIGLYCERIDES', 'Triglycerides', 'Triglycerides', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'BILAN_LIPIDIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'TRIGLYCERIDES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'APOLIPOPROTEINES', 'Apolipoproteines', 'Apolipoproteines', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'BILAN_LIPIDIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'APOLIPOPROTEINES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LIPOPROTEINES_SPECIALES', 'Lipoproteines Speciales', 'Lipoproteines Speciales', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'BILAN_LIPIDIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LIPOPROTEINES_SPECIALES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CALCIUM', 'Calcium', 'Calcium', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'METABOLISME_PHOSPHOCALCIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CALCIUM' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PHOSPHORE', 'Phosphore', 'Phosphore', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'METABOLISME_PHOSPHOCALCIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PHOSPHORE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MAGNESIUM', 'Magnesium', 'Magnesium', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'METABOLISME_PHOSPHOCALCIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MAGNESIUM' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PTH_VITAMINE_D', 'Pth Vitamine D', 'Pth Vitamine D', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'METABOLISME_PHOSPHOCALCIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PTH_VITAMINE_D' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PROTEINES_SERIQUES', 'Proteines Seriques', 'Proteines Seriques', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PROTEINES_INFLAMMATION' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PROTEINES_SERIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'INFLAMMATION', 'Inflammation', 'Inflammation', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PROTEINES_INFLAMMATION' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'INFLAMMATION' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'METABOLISME_MARTIAL', 'Metabolisme Martial', 'Metabolisme Martial', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PROTEINES_INFLAMMATION' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'METABOLISME_MARTIAL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'COMPLEMENT_BIOCHIMIQUE', 'Complement Biochimique', 'Complement Biochimique', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'PROTEINES_INFLAMMATION' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'COMPLEMENT_BIOCHIMIQUE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VITAMINES_HYDROSOLUBLES', 'Vitamines Hydrosolubles', 'Vitamines Hydrosolubles', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'VITAMINES_OLIGOELEMENTS' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VITAMINES_HYDROSOLUBLES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VITAMINES_LIPOSOLUBLES', 'Vitamines Liposolubles', 'Vitamines Liposolubles', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'VITAMINES_OLIGOELEMENTS' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VITAMINES_LIPOSOLUBLES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'OLIGOELEMENTS', 'Oligoelements', 'Oligoelements', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'VITAMINES_OLIGOELEMENTS' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'OLIGOELEMENTS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'NECROSE_MYOCARDIQUE', 'Necrose Myocardique', 'Necrose Myocardique', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'MARQUEURS_CARDIAQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'NECROSE_MYOCARDIQUE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'INSUFFISANCE_CARDIAQUE', 'Insuffisance Cardiaque', 'Insuffisance Cardiaque', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'MARQUEURS_CARDIAQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'INSUFFISANCE_CARDIAQUE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'RISQUE_CARDIOVASCULAIRE', 'Risque Cardiovasculaire', 'Risque Cardiovasculaire', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'MARQUEURS_CARDIAQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'RISQUE_CARDIOVASCULAIRE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'DIGESTIFS', 'Digestifs', 'Digestifs', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'MARQUEURS_TUMORAUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'DIGESTIFS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'GYNECOLOGIQUES', 'Gynecologiques', 'Gynecologiques', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'MARQUEURS_TUMORAUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'GYNECOLOGIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'UROLOGIQUES', 'Urologiques', 'Urologiques', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'MARQUEURS_TUMORAUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'UROLOGIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'NEUROENDOCRINES', 'Neuroendocrines', 'Neuroendocrines', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'MARQUEURS_TUMORAUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'NEUROENDOCRINES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'AUTRES_MARQUEURS', 'Autres Marqueurs', 'Autres Marqueurs', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'MARQUEURS_TUMORAUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'AUTRES_MARQUEURS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'THYROIDE', 'Thyroide', 'Thyroide', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'ENDOCRINOLOGIE_HORMONOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'THYROIDE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SURRENALES', 'Surrenales', 'Surrenales', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'ENDOCRINOLOGIE_HORMONOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SURRENALES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HYPOPHYSE', 'Hypophyse', 'Hypophyse', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'ENDOCRINOLOGIE_HORMONOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HYPOPHYSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'GONADES', 'Gonades', 'Gonades', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'ENDOCRINOLOGIE_HORMONOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'GONADES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'GROSSESSE_FERTILITE', 'Grossesse Fertilite', 'Grossesse Fertilite', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'ENDOCRINOLOGIE_HORMONOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'GROSSESSE_FERTILITE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'METABOLISME_OSSEUX_HORMONAL', 'Metabolisme Osseux Hormonal', 'Metabolisme Osseux Hormonal', TRUE::boolean, '60'::int 
  FROM public.lab_sections 
  WHERE code = 'ENDOCRINOLOGIE_HORMONOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'METABOLISME_OSSEUX_HORMONAL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ELECTROLYTES_URINAIRES', 'Electrolytes Urinaires', 'Electrolytes Urinaires', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_URINAIRE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ELECTROLYTES_URINAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'AZOTE_URINAIRE', 'Azote Urinaire', 'Azote Urinaire', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_URINAIRE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'AZOTE_URINAIRE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PROTEINES_URINAIRES', 'Proteines Urinaires', 'Proteines Urinaires', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_URINAIRE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PROTEINES_URINAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'METABOLITES_URINAIRES', 'Metabolites Urinaires', 'Metabolites Urinaires', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_URINAIRE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'METABOLITES_URINAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'OSMOLALITE_DENSITE', 'Osmolalite Densite', 'Osmolalite Densite', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'CHIMIE_URINAIRE_GENERALE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'OSMOLALITE_DENSITE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'IONS_24H', 'Ions 24H', 'Ions 24H', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'RECUEILS_24H' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'IONS_24H' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PROTEINES_24H', 'Proteines 24H', 'Proteines 24H', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'RECUEILS_24H' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PROTEINES_24H' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CALCULS_RENAUX_24H', 'Calculs Renaux 24H', 'Calculs Renaux 24H', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'RECUEILS_24H' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CALCULS_RENAUX_24H' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ALBUMINE_CREATININE', 'Albumine Creatinine', 'Albumine Creatinine', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'RAPPORTS_URINAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ALBUMINE_CREATININE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PROTEINE_CREATININE', 'Proteine Creatinine', 'Proteine Creatinine', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'RAPPORTS_URINAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PROTEINE_CREATININE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CALCIUM_CREATININE', 'Calcium Creatinine', 'Calcium Creatinine', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'RAPPORTS_URINAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CALCIUM_CREATININE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'DEPISTAGE', 'Depistage', 'Depistage', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'MICROALBUMINURIE_PROTEINURIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'DEPISTAGE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'QUANTIFICATION', 'Quantification', 'Quantification', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'MICROALBUMINURIE_PROTEINURIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'QUANTIFICATION' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'EPP_SERUM', 'Epp Serum', 'Epp Serum', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PROTEINES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'EPP_SERUM' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'EPP_URINES', 'Epp Urines', 'Epp Urines', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PROTEINES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'EPP_URINES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CHAINES_LEGERES', 'Chaines Legeres', 'Chaines Legeres', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PROTEINES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CHAINES_LEGERES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VARIANTS_HEMOGLOBINIQUES', 'Variants Hemoglobiniques', 'Variants Hemoglobiniques', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMOGLOBINES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VARIANTS_HEMOGLOBINIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HbA2_HBF', 'Hba2 Hbf', 'Hba2 Hbf', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMOGLOBINES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HbA2_HBF' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'FRACTIONS_LIPOPROTEIQUES', 'Fractions Lipoproteiques', 'Fractions Lipoproteiques', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'LIPOPROTEINES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'FRACTIONS_LIPOPROTEIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SERUM', 'Serum', 'Serum', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOFIXATION' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SERUM' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'URINES', 'Urines', 'Urines', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOFIXATION' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'URINES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PH_HCO3_BASE_EXCESS', 'Ph Hco3 Base Excess', 'Ph Hco3 Base Excess', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'EQUILIBRE_ACIDO_BASIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PH_HCO3_BASE_EXCESS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANION_GAP', 'Anion Gap', 'Anion Gap', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'EQUILIBRE_ACIDO_BASIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANION_GAP' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LACTATE_GAZ', 'Lactate Gaz', 'Lactate Gaz', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'EQUILIBRE_ACIDO_BASIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LACTATE_GAZ' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PO2_SATURATION', 'Po2 Saturation', 'Po2 Saturation', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'OXYGENATION' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PO2_SATURATION' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'GRADIENTS', 'Gradients', 'Gradients', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'OXYGENATION' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'GRADIENTS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CALCULS_VENTILATOIRES', 'Calculs Ventilatoires', 'Calculs Ventilatoires', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PARAMETRES_DERIVES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CALCULS_VENTILATOIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CONTENU_O2', 'Contenu O2', 'Contenu O2', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PARAMETRES_DERIVES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CONTENU_O2' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CARBOXYHEMOGLOBINE', 'Carboxyhemoglobine', 'Carboxyhemoglobine', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'COOXIMETRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CARBOXYHEMOGLOBINE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'METHEMOGLOBINE', 'Methemoglobine', 'Methemoglobine', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'COOXIMETRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'METHEMOGLOBINE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEMOGLOBINE_TOTALE', 'Hemoglobine Totale', 'Hemoglobine Totale', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'COOXIMETRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEMOGLOBINE_TOTALE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'NUMERATION_FORMULE_SANGUINE', 'Numeration Formule Sanguine', 'Numeration Formule Sanguine', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMATIMETRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'NUMERATION_FORMULE_SANGUINE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'INDICES_ERYTHROCYTAIRES', 'Indices Erythrocytaires', 'Indices Erythrocytaires', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMATIMETRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'INDICES_ERYTHROCYTAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PLAQUETTES', 'Plaquettes', 'Plaquettes', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMATIMETRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PLAQUETTES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MORPHOLOGIE_SANGUINE', 'Morphologie Sanguine', 'Morphologie Sanguine', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMATIMETRIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MORPHOLOGIE_SANGUINE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'NUMERATION', 'Numeration', 'Numeration', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'RETICULOCYTES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'NUMERATION' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'INDICES_RETICULOCYTAIRES', 'Indices Reticulocytaires', 'Indices Reticulocytaires', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'RETICULOCYTES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'INDICES_RETICULOCYTAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'TEMPS_GLOBAUX', 'Temps Globaux', 'Temps Globaux', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMOSTASE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'TEMPS_GLOBAUX' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'FIBRINOGENE_DDIMERS', 'Fibrinogene Ddimers', 'Fibrinogene Ddimers', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMOSTASE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'FIBRINOGENE_DDIMERS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'FACTEURS_COAGULATION', 'Facteurs Coagulation', 'Facteurs Coagulation', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMOSTASE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'FACTEURS_COAGULATION' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANTI_COAGULANTS', 'Anti Coagulants', 'Anti Coagulants', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'HEMOSTASE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANTI_COAGULANTS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PROTEINE_C_S', 'Proteine C S', 'Proteine C S', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'THROMBOPHILIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PROTEINE_C_S' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANTITHROMBINE', 'Antithrombine', 'Antithrombine', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'THROMBOPHILIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANTITHROMBINE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MUTATIONS_THROMBOPHILIE', 'Mutations Thrombophilie', 'Mutations Thrombophilie', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'THROMBOPHILIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MUTATIONS_THROMBOPHILIE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANTICORPS_ANTIPHOSPHOLIPIDES', 'Anticorps Antiphospholipides', 'Anticorps Antiphospholipides', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'THROMBOPHILIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANTICORPS_ANTIPHOSPHOLIPIDES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEMOGLOBINOPATHIES', 'Hemoglobinopathies', 'Hemoglobinopathies', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'CELLULES_SPECIALISEES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEMOGLOBINOPATHIES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CELLULES_NUCLEEES', 'Cellules Nucleees', 'Cellules Nucleees', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'CELLULES_SPECIALISEES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CELLULES_NUCLEEES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PARASITES_SANGUINS', 'Parasites Sanguins', 'Parasites Sanguins', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'CELLULES_SPECIALISEES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PARASITES_SANGUINS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANA_ENA', 'Ana Ena', 'Ana Ena', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'AUTOIMMUNITE_SYSTEMIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANA_ENA' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VASCULARITES_ANCA', 'Vascularites Anca', 'Vascularites Anca', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'AUTOIMMUNITE_SYSTEMIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VASCULARITES_ANCA' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CONNECTIVITES', 'Connectivites', 'Connectivites', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'AUTOIMMUNITE_SYSTEMIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CONNECTIVITES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SYNDROME_ANTIPHOSPHOLIPIDES', 'Syndrome Antiphospholipides', 'Syndrome Antiphospholipides', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'AUTOIMMUNITE_SYSTEMIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SYNDROME_ANTIPHOSPHOLIPIDES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'THYROIDE_AUTOIMMUNE', 'Thyroide Autoimmune', 'Thyroide Autoimmune', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'AUTOIMMUNITE_ORGANE_SPECIFIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'THYROIDE_AUTOIMMUNE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MALADIE_COELIAQUE', 'Maladie Coeliaque', 'Maladie Coeliaque', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'AUTOIMMUNITE_ORGANE_SPECIFIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MALADIE_COELIAQUE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEPATITES_AUTOIMMUNES', 'Hepatites Autoimmunes', 'Hepatites Autoimmunes', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'AUTOIMMUNITE_ORGANE_SPECIFIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEPATITES_AUTOIMMUNES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'DIABETE_AUTOIMMUN', 'Diabete Autoimmun', 'Diabete Autoimmun', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'AUTOIMMUNITE_ORGANE_SPECIFIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'DIABETE_AUTOIMMUN' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'GASTRITE_AUTOIMMUNE', 'Gastrite Autoimmune', 'Gastrite Autoimmune', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'AUTOIMMUNITE_ORGANE_SPECIFIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'GASTRITE_AUTOIMMUNE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'IMMUNOGLOBULINES', 'Immunoglobulines', 'Immunoglobulines', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'IMMUNOGLOBULINES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CHAINES_LEGERES_LIBRES', 'Chaines Legeres Libres', 'Chaines Legeres Libres', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CHAINES_LEGERES_LIBRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CRYOGLOBULINES', 'Cryoglobulines', 'Cryoglobulines', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CRYOGLOBULINES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'FACTEUR_RHUMATOIDE_CCP', 'Facteur Rhumatoide Ccp', 'Facteur Rhumatoide Ccp', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOCHIMIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'FACTEUR_RHUMATOIDE_CCP' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'IGE_TOTALES', 'Ige Totales', 'Ige Totales', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'ALLERGOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'IGE_TOTALES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'IGE_SPECIFIQUES', 'Ige Specifiques', 'Ige Specifiques', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'ALLERGOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'IGE_SPECIFIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'TRYPTASE', 'Tryptase', 'Tryptase', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'ALLERGOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'TRYPTASE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'C3_C4', 'C3 C4', 'C3 C4', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'COMPLEMENT_IMMUNITAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'C3_C4' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CH50_AH50', 'Ch50 Ah50', 'Ch50 Ah50', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'COMPLEMENT_IMMUNITAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CH50_AH50' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEMOCULTURES', 'Hemocultures', 'Hemocultures', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEMOCULTURES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ECBU', 'Ecbu', 'Ecbu', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ECBU' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'COPROCULTURES', 'Coprocultures', 'Coprocultures', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'COPROCULTURES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PRELEVEMENTS_RESPIRATOIRES', 'Prelevements Respiratoires', 'Prelevements Respiratoires', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PRELEVEMENTS_RESPIRATOIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PRELEVEMENTS_CUTANES', 'Prelevements Cutanes', 'Prelevements Cutanes', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PRELEVEMENTS_CUTANES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PRELEVEMENTS_ORL', 'Prelevements Orl', 'Prelevements Orl', TRUE::boolean, '60'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PRELEVEMENTS_ORL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PRELEVEMENTS_GENITAUX', 'Prelevements Genitaux', 'Prelevements Genitaux', TRUE::boolean, '70'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PRELEVEMENTS_GENITAUX' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PRELEVEMENTS_PLEURO_PERITONEAUX', 'Prelevements Pleuro Peritoneaux', 'Prelevements Pleuro Peritoneaux', TRUE::boolean, '80'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PRELEVEMENTS_PLEURO_PERITONEAUX' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LCR', 'Lcr', 'Lcr', TRUE::boolean, '90'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LCR' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANTIBIOGRAMMES', 'Antibiogrammes', 'Antibiogrammes', TRUE::boolean, '100'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANTIBIOGRAMMES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'BK_DIRECT', 'Bk Direct', 'Bk Direct', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOBACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'BK_DIRECT' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CULTURE_BK', 'Culture Bk', 'Culture Bk', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOBACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CULTURE_BK' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PCR_BK', 'Pcr Bk', 'Pcr Bk', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOBACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PCR_BK' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SENSIBILITE_BK', 'Sensibilite Bk', 'Sensibilite Bk', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOBACTERIOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SENSIBILITE_BK' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LEVURES', 'Levures', 'Levures', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LEVURES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MOISISSURES', 'Moisissures', 'Moisissures', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MOISISSURES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'DERMATOPHYTES', 'Dermatophytes', 'Dermatophytes', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'DERMATOPHYTES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANTIFONGIGRAMMES', 'Antifongigrammes', 'Antifongigrammes', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANTIFONGIGRAMMES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'COPROPARASITOLOGIE', 'Coproparasitologie', 'Coproparasitologie', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'COPROPARASITOLOGIE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEMOPARASITES', 'Hemoparasites', 'Hemoparasites', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEMOPARASITES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PARASITES_TISSULAIRES', 'Parasites Tissulaires', 'Parasites Tissulaires', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PARASITES_TISSULAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PARASITES_UROGENITAUX', 'Parasites Urogenitaux', 'Parasites Urogenitaux', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PARASITES_UROGENITAUX' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CATHETERS', 'Catheters', 'Catheters', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PRELEVEMENTS_SPECIFIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CATHETERS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MATERIELS_IMPLANTES', 'Materiels Implantes', 'Materiels Implantes', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PRELEVEMENTS_SPECIFIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MATERIELS_IMPLANTES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SURFACES_HYGIENE', 'Surfaces Hygiene', 'Surfaces Hygiene', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PRELEVEMENTS_SPECIFIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SURFACES_HYGIENE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MYCOSES_CUTANEES', 'Mycoses Cutanees', 'Mycoses Cutanees', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOLOGIE_CLINIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MYCOSES_CUTANEES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MYCOSES_PROFONDES', 'Mycoses Profondes', 'Mycoses Profondes', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOLOGIE_CLINIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MYCOSES_PROFONDES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANTIGENES_FONGIQUES', 'Antigenes Fongiques', 'Antigenes Fongiques', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'MYCOLOGIE_CLINIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANTIGENES_FONGIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PARASITES_DIGESTIFS', 'Parasites Digestifs', 'Parasites Digestifs', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITOLOGIE_CLINIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PARASITES_DIGESTIFS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEMOPARASITES', 'Hemoparasites', 'Hemoparasites', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITOLOGIE_CLINIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEMOPARASITES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PARASITES_TISSULAIRES', 'Parasites Tissulaires', 'Parasites Tissulaires', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITOLOGIE_CLINIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PARASITES_TISSULAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SEROLOGIES_PARASITAIRES', 'Serologies Parasitaires', 'Serologies Parasitaires', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITOLOGIE_CLINIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SEROLOGIES_PARASITAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEPATITE_A', 'Hepatite A', 'Hepatite A', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'HEPATITES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEPATITE_A' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEPATITE_B', 'Hepatite B', 'Hepatite B', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'HEPATITES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEPATITE_B' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEPATITE_C', 'Hepatite C', 'Hepatite C', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'HEPATITES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEPATITE_C' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEPATITE_E', 'Hepatite E', 'Hepatite E', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'HEPATITES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEPATITE_E' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VIH', 'Vih', 'Vih', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'VIH_RETROVIRUS' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VIH' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HTLV', 'Htlv', 'Htlv', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'VIH_RETROVIRUS' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HTLV' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CMV', 'Cmv', 'Cmv', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'HERPESVIRIDAE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CMV' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'EBV', 'Ebv', 'Ebv', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'HERPESVIRIDAE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'EBV' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HSV', 'Hsv', 'Hsv', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'HERPESVIRIDAE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HSV' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VZV', 'Vzv', 'Vzv', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'HERPESVIRIDAE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VZV' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HHV6_8', 'Hhv6 8', 'Hhv6 8', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'HERPESVIRIDAE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HHV6_8' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'TOXOPLASMOSE', 'Toxoplasmose', 'Toxoplasmose', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'INFECTIONS_MATERNELLES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'TOXOPLASMOSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'RUBEOLLE', 'Rubeolle', 'Rubeolle', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'INFECTIONS_MATERNELLES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'RUBEOLLE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CMV_GROSSESSE', 'Cmv Grossesse', 'Cmv Grossesse', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'INFECTIONS_MATERNELLES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CMV_GROSSESSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SYPHILIS', 'Syphilis', 'Syphilis', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIENNES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SYPHILIS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'BRUCELLOSE', 'Brucellose', 'Brucellose', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIENNES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'BRUCELLOSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'BORRELIOSE', 'Borreliose', 'Borreliose', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIENNES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'BORRELIOSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'RICKETTSIOSES', 'Rickettsioses', 'Rickettsioses', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'BACTERIENNES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'RICKETTSIOSES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'AMIBIASE', 'Amibiase', 'Amibiase', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'AMIBIASE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ECHINOCOCCOSE', 'Echinococcose', 'Echinococcose', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ECHINOCOCCOSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LEISHMANIOSE', 'Leishmaniose', 'Leishmaniose', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LEISHMANIOSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'BILHARZIOSE', 'Bilharziose', 'Bilharziose', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'PARASITAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'BILHARZIOSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ROUGEOLE', 'Rougeole', 'Rougeole', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'VIRALES_DIVERSES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ROUGEOLE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'OREILLONS', 'Oreillons', 'Oreillons', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'VIRALES_DIVERSES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'OREILLONS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PARVOVIRUS_B19', 'Parvovirus B19', 'Parvovirus B19', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'VIRALES_DIVERSES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PARVOVIRUS_B19' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'DENGUE', 'Dengue', 'Dengue', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'VIRALES_DIVERSES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'DENGUE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CHIKUNGUNYA', 'Chikungunya', 'Chikungunya', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'VIRALES_DIVERSES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CHIKUNGUNYA' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'WEST_NILE', 'West Nile', 'West Nile', TRUE::boolean, '60'::int 
  FROM public.lab_sections 
  WHERE code = 'VIRALES_DIVERSES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'WEST_NILE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SARS_COV_2', 'Sars Cov 2', 'Sars Cov 2', TRUE::boolean, '70'::int 
  FROM public.lab_sections 
  WHERE code = 'VIRALES_DIVERSES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SARS_COV_2' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'RESPIRATOIRES', 'Respiratoires', 'Respiratoires', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'RESPIRATOIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HERPESVIRIDAE', 'Herpesviridae', 'Herpesviridae', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HERPESVIRIDAE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEPATITES', 'Hepatites', 'Hepatites', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEPATITES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VIH', 'Vih', 'Vih', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VIH' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'AUTRES_VIRUS', 'Autres Virus', 'Autres Virus', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'AUTRES_VIRUS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MYCOBACTERIES', 'Mycobacteries', 'Mycobacteries', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_BACTERIENNES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MYCOBACTERIES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'IST', 'Ist', 'Ist', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_BACTERIENNES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'IST' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SEPSIS_MENINGITES', 'Sepsis Meningites', 'Sepsis Meningites', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_BACTERIENNES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SEPSIS_MENINGITES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'TOXOPLASMA', 'Toxoplasma', 'Toxoplasma', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_PARASITAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'TOXOPLASMA' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LEISHMANIA', 'Leishmania', 'Leishmania', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_PARASITAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LEISHMANIA' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PLASMODIUM', 'Plasmodium', 'Plasmodium', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PCR_PARASITAIRES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PLASMODIUM' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VIH', 'Vih', 'Vih', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'CHARGES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VIH' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VHB', 'Vhb', 'Vhb', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'CHARGES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VHB' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VHC', 'Vhc', 'Vhc', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'CHARGES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VHC' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CMV', 'Cmv', 'Cmv', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'CHARGES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CMV' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'EBV', 'Ebv', 'Ebv', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'CHARGES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'EBV' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'BK_VIRUS', 'Bk Virus', 'Bk Virus', TRUE::boolean, '60'::int 
  FROM public.lab_sections 
  WHERE code = 'CHARGES_VIRALES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'BK_VIRUS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VIH', 'Vih', 'Vih', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'GENOTYPAGE_RESISTANCE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VIH' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VHB', 'Vhb', 'Vhb', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'GENOTYPAGE_RESISTANCE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VHB' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VHC', 'Vhc', 'Vhc', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'GENOTYPAGE_RESISTANCE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VHC' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'TUBERCULOSE', 'Tuberculose', 'Tuberculose', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'GENOTYPAGE_RESISTANCE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'TUBERCULOSE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LEUCEMIES_AIGUES', 'Leucemies Aigues', 'Leucemies Aigues', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOPHENOTYPAGE_HEMATO' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LEUCEMIES_AIGUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SYNDROMES_LYMPHOPROLIFERATIFS', 'Syndromes Lymphoproliferatifs', 'Syndromes Lymphoproliferatifs', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOPHENOTYPAGE_HEMATO' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SYNDROMES_LYMPHOPROLIFERATIFS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PLASMA_CELLS', 'Plasma Cells', 'Plasma Cells', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOPHENOTYPAGE_HEMATO' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PLASMA_CELLS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SOUS_POPULATIONS_LYMPHOCYTAIRES', 'Sous Populations Lymphocytaires', 'Sous Populations Lymphocytaires', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOMONITORING' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SOUS_POPULATIONS_LYMPHOCYTAIRES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CD34', 'Cd34', 'Cd34', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOMONITORING' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CD34' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'IMMUNODEFICIENCES', 'Immunodeficiences', 'Immunodeficiences', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'IMMUNOMONITORING' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'IMMUNODEFICIENCES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LAL', 'Lal', 'Lal', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'MALADIE_RESIDUELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LAL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LAM', 'Lam', 'Lam', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'MALADIE_RESIDUELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LAM' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MYELOME', 'Myelome', 'Myelome', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'MALADIE_RESIDUELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MYELOME' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CLASSE_I', 'Classe I', 'Classe I', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'TYPAGE_HLA' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CLASSE_I' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CLASSE_II', 'Classe Ii', 'Classe Ii', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'TYPAGE_HLA' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CLASSE_II' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HAUTE_RESOLUTION', 'Haute Resolution', 'Haute Resolution', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'TYPAGE_HLA' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HAUTE_RESOLUTION' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SCREENING', 'Screening', 'Screening', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'ANTICORPS_ANTI_HLA' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SCREENING' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'IDENTIFICATION', 'Identification', 'Identification', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'ANTICORPS_ANTI_HLA' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'IDENTIFICATION' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MFI', 'Mfi', 'Mfi', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'ANTICORPS_ANTI_HLA' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MFI' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LYMPHOCYTAIRE', 'Lymphocytaire', 'Lymphocytaire', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'CROSSMATCH' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LYMPHOCYTAIRE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'VIRTUEL', 'Virtuel', 'Virtuel', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'CROSSMATCH' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'VIRTUEL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'DSA', 'Dsa', 'Dsa', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'SUIVI_GREFFE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'DSA' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CHIMERISME', 'Chimerisme', 'Chimerisme', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'SUIVI_GREFFE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CHIMERISME' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CARYOTYPE_SANG', 'Caryotype Sang', 'Caryotype Sang', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'CYTOGENETIQUE_CONSTITUTIONNELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CARYOTYPE_SANG' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CARYOTYPE_PRENATAL', 'Caryotype Prenatal', 'Caryotype Prenatal', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'CYTOGENETIQUE_CONSTITUTIONNELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CARYOTYPE_PRENATAL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MOSAICISMES', 'Mosaicismes', 'Mosaicismes', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'CYTOGENETIQUE_CONSTITUTIONNELLE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MOSAICISMES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CARYOTYPE_MOELLE', 'Caryotype Moelle', 'Caryotype Moelle', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'CYTOGENETIQUE_HEMATO' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CARYOTYPE_MOELLE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANOMALIES_CLONALES', 'Anomalies Clonales', 'Anomalies Clonales', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'CYTOGENETIQUE_HEMATO' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANOMALIES_CLONALES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'HEMATOLOGIE', 'Hematologie', 'Hematologie', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'FISH' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'HEMATOLOGIE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PRENATAL', 'Prenatal', 'Prenatal', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'FISH' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PRENATAL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'TISSUS', 'Tissus', 'Tissus', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'FISH' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'TISSUS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'POSTNATAL', 'Postnatal', 'Postnatal', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'ARRAY_CGH' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'POSTNATAL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PRENATAL', 'Prenatal', 'Prenatal', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'ARRAY_CGH' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PRENATAL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SANGER', 'Sanger', 'Sanger', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'GENES_MONOGENIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SANGER' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'NGS_CIBLE', 'Ngs Cible', 'Ngs Cible', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'GENES_MONOGENIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'NGS_CIBLE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CARDIOGENETIQUE', 'Cardiogenetique', 'Cardiogenetique', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PANELS_GENETIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CARDIOGENETIQUE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'NEUROGENETIQUE', 'Neurogenetique', 'Neurogenetique', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PANELS_GENETIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'NEUROGENETIQUE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ONCOGENETIQUE_CONSTITUTIONNELLE', 'Oncogenetique Constitutionnelle', 'Oncogenetique Constitutionnelle', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PANELS_GENETIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ONCOGENETIQUE_CONSTITUTIONNELLE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MALADIES_METABOLIQUES', 'Maladies Metaboliques', 'Maladies Metaboliques', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'PANELS_GENETIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MALADIES_METABOLIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MLPA', 'Mlpa', 'Mlpa', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'CNV' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MLPA' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'QF_PCR', 'Qf Pcr', 'Qf Pcr', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'CNV' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'QF_PCR' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CNV_NGS', 'Cnv Ngs', 'Cnv Ngs', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'CNV' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CNV_NGS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'TPMT', 'Tpmt', 'Tpmt', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'PHARMACOGENETIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'TPMT' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'DPYD', 'Dpyd', 'Dpyd', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'PHARMACOGENETIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'DPYD' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CYP', 'Cyp', 'Cyp', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'PHARMACOGENETIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CYP' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'BCR_ABL', 'Bcr Abl', 'Bcr Abl', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'FUSIONS_TRANSCRITS' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'BCR_ABL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PML_RARA', 'Pml Rara', 'Pml Rara', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'FUSIONS_TRANSCRITS' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PML_RARA' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CBFB_MYH11', 'Cbfb Myh11', 'Cbfb Myh11', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'FUSIONS_TRANSCRITS' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CBFB_MYH11' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'RUNX1_RUNX1T1', 'Runx1 Runx1T1', 'Runx1 Runx1T1', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'FUSIONS_TRANSCRITS' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'RUNX1_RUNX1T1' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'JAK2_CALR_MPL', 'Jak2 Calr Mpl', 'Jak2 Calr Mpl', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'MUTATIONS_SOMATIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'JAK2_CALR_MPL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'NPM1_FLT3', 'Npm1 Flt3', 'Npm1 Flt3', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'MUTATIONS_SOMATIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'NPM1_FLT3' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'IDH1_IDH2', 'Idh1 Idh2', 'Idh1 Idh2', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'MUTATIONS_SOMATIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'IDH1_IDH2' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MYELOME', 'Myelome', 'Myelome', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'MUTATIONS_SOMATIQUES' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MYELOME' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LMC', 'Lmc', 'Lmc', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'MALADIE_RESIDUELLE_MOLECULAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LMC' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LAL', 'Lal', 'Lal', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'MALADIE_RESIDUELLE_MOLECULAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LAL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LAM', 'Lam', 'Lam', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'MALADIE_RESIDUELLE_MOLECULAIRE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LAM' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANTI_EPILEPTIQUES', 'Anti Epileptiques', 'Anti Epileptiques', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'SUIVI_THERAPEUTIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANTI_EPILEPTIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'IMMUNOSUPPRESSEURS', 'Immunosuppresseurs', 'Immunosuppresseurs', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'SUIVI_THERAPEUTIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'IMMUNOSUPPRESSEURS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ANTIBIOTIQUES', 'Antibiotiques', 'Antibiotiques', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'SUIVI_THERAPEUTIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ANTIBIOTIQUES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PSYCHOTROPES', 'Psychotropes', 'Psychotropes', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'SUIVI_THERAPEUTIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PSYCHOTROPES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CARDIOLOGIE', 'Cardiologie', 'Cardiologie', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'SUIVI_THERAPEUTIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CARDIOLOGIE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PARACETAMOL', 'Paracetamol', 'Paracetamol', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'TOXICOLOGIE_D_URGENCE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PARACETAMOL' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'SALICYLES', 'Salicyles', 'Salicyles', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'TOXICOLOGIE_D_URGENCE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'SALICYLES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ALCOOLS', 'Alcools', 'Alcools', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'TOXICOLOGIE_D_URGENCE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ALCOOLS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'DROGUES_ABUS', 'Drogues Abus', 'Drogues Abus', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'TOXICOLOGIE_D_URGENCE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'DROGUES_ABUS' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'PLOMB', 'Plomb', 'Plomb', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'TOXIQUES_ET_METAUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'PLOMB' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'MERCURE', 'Mercure', 'Mercure', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'TOXIQUES_ET_METAUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'MERCURE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'ARSENIC', 'Arsenic', 'Arsenic', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'TOXIQUES_ET_METAUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'ARSENIC' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'LITHIUM', 'Lithium', 'Lithium', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'TOXIQUES_ET_METAUX' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'LITHIUM' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'OPIACES', 'Opiaces', 'Opiaces', TRUE::boolean, '10'::int 
  FROM public.lab_sections 
  WHERE code = 'ADDICTOLOGIE_BIOLOGIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'OPIACES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'COCAINE', 'Cocaine', 'Cocaine', TRUE::boolean, '20'::int 
  FROM public.lab_sections 
  WHERE code = 'ADDICTOLOGIE_BIOLOGIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'COCAINE' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'CANNABINOIDES', 'Cannabinoides', 'Cannabinoides', TRUE::boolean, '30'::int 
  FROM public.lab_sections 
  WHERE code = 'ADDICTOLOGIE_BIOLOGIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'CANNABINOIDES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'AMPHETAMINES', 'Amphetamines', 'Amphetamines', TRUE::boolean, '40'::int 
  FROM public.lab_sections 
  WHERE code = 'ADDICTOLOGIE_BIOLOGIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'AMPHETAMINES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'BENZODIAZEPINES', 'Benzodiazepines', 'Benzodiazepines', TRUE::boolean, '50'::int 
  FROM public.lab_sections 
  WHERE code = 'ADDICTOLOGIE_BIOLOGIQUE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'BENZODIAZEPINES' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'DIAGNOSTIC', 'Diagnostic', 'Diagnostic', TRUE::boolean, '150'::int 
  FROM public.lab_sections 
  WHERE code = 'ANATOMOPATHOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'DIAGNOSTIC' AND section_id = public.lab_sections.id)
  UNION ALL
  SELECT id, 'COMPLEMENTAIRE', 'Examens complémentaires', 'Examens complémentaires', TRUE::boolean, '160'::int 
  FROM public.lab_sections 
  WHERE code = 'ANATOMOPATHOLOGIE' 
  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = 'COMPLEMENTAIRE' AND section_id = public.lab_sections.id);

-- Update public.global_actes with section and sub-section linking
UPDATE public.global_actes g
SET lab_section_id = sec.id, 
    lab_sub_section_id = subsec.id
FROM (
  VALUES 
  ('79efd9f0-aaaf-4e27-8b26-01e6eb3b1f9e'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('ce52cccf-579a-4732-a138-a1841b200f12'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_LIPOSOLUBLES'),
  ('6f5da265-b021-45d5-b8dd-f58541cc4dbd'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'METABOLITES_URINAIRES'),
  ('6c410ee8-85d2-46b7-95c7-fa345382d16f'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('0264adfd-28ad-4d69-a450-94772f38bb23'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_B'),
  ('c841712b-2ced-4878-9b26-95cfb8bef4b5'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('5dd0de18-3e62-4a3c-97f7-9f37543ceb29'::uuid, 'BACTERIOLOGIE', 'ECBU'),
  ('b709dba4-53bd-4a5f-9d86-ae5e8bee9f36'::uuid, 'THROMBOPHILIE', 'ANTICORPS_ANTIPHOSPHOLIPIDES'),
  ('2ceadc20-eaaf-4f95-8e6f-cd61e68db8f3'::uuid, 'THROMBOPHILIE', 'ANTICORPS_ANTIPHOSPHOLIPIDES'),
  ('dd3a1425-9bd1-471f-beea-4ae5870484f4'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('687348b7-86f7-48cc-abe1-f4b3e6de373b'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'HEPATITES_AUTOIMMUNES'),
  ('266e8d6f-6000-421e-a099-22a177f3a4b5'::uuid, 'MARQUEURS_TUMORAUX', 'DIGESTIFS'),
  ('1d20eab5-e3d2-4b2d-9df4-39d1fa59902c'::uuid, 'MARQUEURS_TUMORAUX', 'DIGESTIFS'),
  ('44852826-ba14-4d6b-93df-64d2a55c92f6'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('e6971850-3e3a-45e6-a57a-3510a0834a99'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'MALADIE_COELIAQUE'),
  ('4f0e9d48-7952-476f-9a35-efa9aad331ed'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'MALADIE_COELIAQUE'),
  ('cf547ea7-e707-4563-acc9-1346eee8e638'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'GASTRITE_AUTOIMMUNE'),
  ('74590347-e122-4015-963b-82daebddb3e2'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_HYDROSOLUBLES'),
  ('39a96bc9-bd7a-4cd5-8914-5a37c3641d5d'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_HYDROSOLUBLES'),
  ('98ca53f7-1461-49c5-b454-7302830b79de'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_B'),
  ('05041cec-84dc-43a7-8194-37954801b2fa'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_B'),
  ('13cdd957-9751-45bc-9a34-7aa093d7c8fe'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_B'),
  ('621dbcf5-4058-4c0f-844d-cf81bf861bf6'::uuid, 'ANTICORPS_ANTI_HLA', 'SCREENING'),
  ('4f1c5345-cd1c-40c7-bfe8-0615a47417ca'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'HEPATITES_AUTOIMMUNES'),
  ('e845d705-c3d6-4dee-9f83-b282b0df2d55'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'HEPATITES_AUTOIMMUNES'),
  ('d9dfe0d7-6928-4965-ab62-0a3da95106e4'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('b781dcdd-0d9e-47f0-b0c4-90461833c9fc'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('bfafc530-f11f-48fd-aeea-6009cbdc22c5'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'GASTRITE_AUTOIMMUNE'),
  ('a2030d59-c75d-4cf3-9b26-8eee7f2113da'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'HEPATITES_AUTOIMMUNES'),
  ('e2fee66f-4924-44a5-adee-9da29c86d07f'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('1758c27c-e8c7-4645-bf44-a5dd1edc6140'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('8b8f5eb0-5a48-41f7-a8ab-dfcfe5c2dae2'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'THYROIDE'),
  ('6b95030c-2535-46f4-8d21-bf545e50004f'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('95b82e31-98e9-4402-a0a7-af7f3dabc4c3'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'MALADIE_COELIAQUE'),
  ('19514a1d-cdf9-47ee-833f-70ac905d906c'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'MALADIE_COELIAQUE'),
  ('26603cbc-9fb8-4c86-b997-d9ab1b9a164a'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('b8c85938-38ff-4249-9fff-baa617c0f73a'::uuid, 'CHARGES_VIRALES', 'EBV'),
  ('1a80cb93-9101-4953-a8e2-121af7e1ea25'::uuid, 'CHARGES_VIRALES', 'EBV'),
  ('9977f51b-8cd2-458e-acb8-843b53329585'::uuid, 'BACTERIOLOGIE', 'ECBU'),
  ('635eb0c2-6159-4808-aff2-e9222890623d'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('d2d751a0-807e-41f3-bbc5-5dde028ded42'::uuid, 'CELLULES_SPECIALISEES', 'CELLULES_NUCLEEES'),
  ('c55e928f-6686-42d1-85ab-415241e26530'::uuid, 'MARQUEURS_TUMORAUX', 'DIGESTIFS'),
  ('29447cad-3051-4c21-b096-29d9c9be713b'::uuid, 'MARQUEURS_TUMORAUX', 'DIGESTIFS'),
  ('6a36e0d6-39a8-4ef8-a027-239fe6f2c723'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GROSSESSE_FERTILITE'),
  ('3add2328-f34a-4695-a1e3-c1d3edc28fcf'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_B'),
  ('1d691cf4-706e-41a3-b034-413e23a26dbf'::uuid, 'BACTERIOLOGIE', 'LCR'),
  ('7343ebd1-e0c1-4e73-8334-026d1870e29b'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_A'),
  ('6528132f-25d5-4d1a-a360-97619e2c8ef8'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_A'),
  ('31731bad-5b82-4e3f-bb11-49df9167a0ed'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('5c888bab-6aae-4c6d-90d5-b8104f851d0d'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('f77b4b4a-ee96-482a-9ceb-680d94abdec3'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('5bdfcb19-4c46-4c77-8a42-6f4a8ce59ecc'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('ad11ace8-4c75-4e3a-a453-f23af8b68864'::uuid, 'CYTOGENETIQUE_CONSTITUTIONNELLE', 'CARYOTYPE_PRENATAL'),
  ('bf4426c6-cf2c-4e94-a286-77b4d4619cd7'::uuid, 'ENZYMOLOGIE', 'ENZYMES_PANCREATIQUES'),
  ('95531498-e886-4bda-b2f5-dcbf56f21367'::uuid, 'ENZYMOLOGIE', 'ENZYMES_PANCREATIQUES'),
  ('555da1ef-1b2c-4ee5-a6af-2230435c9693'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'VASCULARITES_ANCA'),
  ('05f5c9a9-b938-4b72-ac84-c13951b3b6c2'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('d1d42ac5-0ebf-4d16-be77-3994013fe92a'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('dedf7f46-29b8-4d39-ac44-eefbf8e6251a'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('6c591494-0ece-4444-b086-982c15363f2c'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('d386bd34-2856-4db8-b953-31fbd5ae6cd2'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('73b0928f-29b0-47a3-b996-b169e877ba36'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('b8cbcfba-5177-4c56-8824-a89c255f1ef8'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9fb82786-09f2-426a-ac32-98380627489c'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('970229d0-74d5-4003-a841-5b8b9af92ab7'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('ea857055-672c-4b62-b083-7a241c8f0f61'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('08d71fea-18b9-4d12-b361-8e318d582263'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('80ebbc3e-a4aa-4044-ab40-7ebf29098a87'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('cd1fce84-e8a8-4f8e-b483-0557378cf2c4'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('6d27f19c-b14a-47c4-8427-7ca7e301ebf4'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('28625759-950b-4824-87c6-c224e7a83d98'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('dc71d8f6-0f60-4ac5-9ede-21a29039b6fc'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('6b6a6f96-936d-471f-9057-b1afe592d00d'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('d96c7af6-77f1-4f1e-9386-a13310b89bb0'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('faa3acf3-3f20-4598-9dbc-70a757482271'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('6cae8916-57dc-40ca-bee6-d7aecc9f86ef'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('87bd4d72-2525-4bd3-8fe7-fd9d73ed5868'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('be0894b7-3657-466e-ae34-181b4be27664'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('59db474b-e651-4ab7-9d52-004a902481b0'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('281e3ed0-94e1-4a36-b90f-63e8a138192b'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('bf376577-cf49-4d6e-98de-07f4c14d746b'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('86820ddb-f771-4b10-a04c-0ae6c1cb49f1'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('0fc44265-5068-459e-af38-904f0abde773'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('691d91d6-a0b3-4201-81e3-9ddd2b3b9cf7'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('c013c3cb-6a12-487b-a529-63ea95a11d64'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('2e309be7-c771-46dc-8694-563d3c1f9100'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9671e4ac-2aff-4edf-833a-66607312d0b2'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('f99ddf2c-2c06-4f4d-bb2f-0ea996ae35cd'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('c75ff94e-7a73-427b-989c-1aeef0399598'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('b39a46ca-21c4-41ff-b1e8-9810f5238ca7'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('79b0bde2-248f-4108-9835-a10d6cae6f1f'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('16936824-2d4f-454d-9646-3a1c67090915'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('b7b5047e-b812-4cd2-993e-e62729edfea4'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('141b46d7-3591-43a0-8561-8cacb12a7478'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('a6a67c6b-00e8-4845-825d-3b5c58ba8b5c'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('2fa7ee25-45bd-4e3e-a3c3-9cfa6e7a2925'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('7374b492-8d6a-43f1-9982-aa13aa216edb'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('a75e35ff-f6b8-49a8-9f91-b659d64d8ed3'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('d0365e60-edcf-4635-9e46-d1dd78333bb2'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('ca025481-ceea-4864-8dcc-467e65156bd9'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('17a3810d-9af5-4ad9-b7b0-240a9f1f7b56'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('a034cf46-2e80-48dc-9df3-3e8209ebcea8'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('221231bc-be69-4754-9ba6-21ce6cc95f27'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('207f95ac-8bfb-4f46-9867-1e9cb49ad8fe'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('c65ea4eb-54ec-4c20-a1c3-3041f3efb190'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('490e8779-2b5a-4d9f-bf46-9c7030d2efe2'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('3045f32d-a0fd-4f75-b2a3-9856318a6a4d'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('4240b7dd-a1cc-4c46-8a66-db6aa3ec11ea'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('b3eb769c-fa75-4f74-976c-c069ae4e9105'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('66557882-75a7-4282-bc4f-ad966f88a30f'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('7eca3e3a-b6b2-49ae-af45-d692ed8d4785'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('8c1d793c-883e-4fba-972a-140b7e1ab93d'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('2d66652e-a864-43be-9358-e6d3f7e73b94'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('f56b98f7-29df-46a2-9807-7f5cf453480d'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('ad800f3b-1588-4f38-97a9-2db24a074d63'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('e562c9d7-db3f-49ae-8841-af716a49ddaa'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('2e105a60-8553-4b64-92ab-723c3ed14dbc'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('5c383171-91b2-4394-b2d7-a5b16d89d148'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('c846b543-f685-448c-b748-f92d3ca71604'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('c3bbe000-7017-4d57-9cc6-2598f2f86fa6'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('efddf7fe-a185-4f9e-b9b6-b67e8b3fd5ee'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('3b8ddfe4-5200-41c9-a722-1ea0f597e7f7'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('63f23111-ba67-42a0-936b-839912632d76'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('5dc84c41-afdb-4d59-9d52-66d94c762b76'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('62797bef-7d00-4b24-a853-1d561b357d9a'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('8be92c71-c2a1-4215-97bd-06f57707e15d'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('4fce481c-8ffe-47a6-82f7-95e81623b851'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('c3016fe8-4b67-4258-922d-6ae4f2b35c69'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('82877a57-5276-41b0-bdd4-b37c270ef4d3'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('cc103a30-f189-4e90-9c05-47d63d8c9079'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('b879d0dd-1610-4f9a-b3ad-bebb3d2572e1'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('16c6278b-31ba-4080-92ae-7b142674ce6a'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9d4deff9-b9a1-421a-a2a7-0bfc437548af'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('cb41d9ed-1512-43cc-9793-9c7bbb8ddc61'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('0c23ca59-0bfd-4263-ac06-b5121e9038a1'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('7e048c13-b625-40fe-8252-fa29f1f3fedc'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('51fc57e5-2ae4-4458-835e-be080417e34d'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('49cfd4d0-9186-4d73-b099-f72ea3019bae'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('6f0bd357-ae72-450c-9f82-83c43f9eddca'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('344393a4-1f2a-42ee-81e7-7dde35dd966a'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9e82c4ed-e642-4e4d-bf75-e12fa33e9a88'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('81edbc8d-a833-497c-a1ef-d82142f7ebf4'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('a757f38e-edcb-4e6b-b62f-899b1f84c015'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('cee0728c-362d-4388-bfb0-011d3395c237'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('e7f4c375-bb9a-41b8-a5b1-8ef9a7fef222'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('e17a82d2-a7f7-40b8-a71c-5a0f5ddf1187'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('b7df46f6-aee3-45c8-8b77-dab905cc2447'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('685ca5c8-34dd-4028-9ded-d4f888151acd'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('d2310b54-4a4a-48a1-93fc-9053f19cbd6f'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('d72de4af-f56b-4a22-b8d5-2c345d156e09'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('ba482f2e-8ba5-4822-9ba3-f3bdf6379d7a'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('836550d8-f0b7-43cc-bb9f-e84d9a5b1413'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('417fbbd4-69aa-4d6c-a5d2-4929475e8332'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('525baee1-f610-4b29-8643-b9d8067ee564'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('0e0c7c87-0350-4f04-a502-3c8e87470426'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('e37bc237-7ab4-4b8e-b113-4eed297e8299'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9ea8d2a2-50d7-47ac-94ab-24f1ebe2307d'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('706e2415-6957-43fd-9e86-cc0126ec7eb6'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('14050faa-d1ce-4e4e-b168-eb037e8f60f3'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('29290fdd-943f-4241-b87b-27b33a21b832'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('63eb887f-ce4d-495c-ba74-bbfee681acff'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('8a9cd67e-c00a-4a28-beea-7da084f2b840'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('2eb69a0d-8773-4e43-97d1-5db1eec7aac0'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('c2a104d4-d52d-4ef5-8315-19eab3c4a2f3'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('afb4bdc0-efc7-4d90-8cc9-d937e39d5307'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('66164277-408b-490a-8d2a-aff05d1371c5'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('d3ece7e5-78a2-49aa-b663-f60d93c7946b'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('e9e0b41c-b6e9-4115-9013-0747c6fca1a9'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('f2d6fa0e-c587-4a30-8633-46dbfcb0c1c7'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('481d44dd-982c-4c3e-80ac-331612275769'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('7d95092c-a3f4-457b-8996-7b731c8d7667'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('4479d8ad-48d3-482b-b760-4ee5ef0c228a'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('4f5eef78-f24a-4c27-8f0d-67e850678235'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('42fa23d8-782c-4743-986c-aae466d25020'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('77d37434-a77f-4275-9252-e7ccc2da561f'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('8ec2779d-4890-49a9-8019-77ff87819511'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9f2e3587-10a8-41bc-ae27-0b0651fcb4a1'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('517eea7e-6adb-4223-9755-eef4ad40cc11'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('4bd8e76f-64ee-4d3d-b90a-1fff7cdbd6cc'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('ee0e9a6e-5582-4727-b3c1-63ecaa6d3233'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('bdd956a9-0931-4f5a-8bf5-d1ede3b09f2f'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('3645f658-151e-4a75-b24b-630738767856'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('6045e59a-e0a7-4f72-82aa-541c1d1afe96'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('6f1afbff-15c3-4cd5-8d4e-c0ca9e329627'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('c3667c25-dc30-4b41-b6ac-7e80a3de82df'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('5bbcf9f3-b941-4745-85ec-637c78f7d9e5'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('5f63eae2-5a5b-458b-902c-4084d7d4252d'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('7e98e7b9-9409-4c36-b49b-f78512776b1f'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('aa003afd-73ac-41b1-b506-b63fe13fb80f'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('52d21f6d-7f20-4a0e-b68d-79c30747a2b1'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('75b1be48-a7bd-4438-8458-71de948b4b8a'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('67d1b17d-174c-461a-8cb1-2cb8064c6ea2'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('4b13be15-7540-4011-9c87-000b0c4b8f64'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('6eaba04f-697e-4a2b-8405-040434f944d0'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('784d653d-ab5d-40b3-801d-5b133d68bbce'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('3fddd73c-33f9-43b8-a7c2-1afb288135e5'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('02033ea9-2355-4447-a7ac-cd5574462826'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('511e3093-3cfc-484a-84be-56d656db8484'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('cf062fde-b359-474f-be88-bf80e055aa2e'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9b0041c2-7a89-4aea-a9fc-bab418cf0621'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('5097d797-d1aa-40e4-a713-cc376e26e326'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9ef1d05c-963f-451c-b5c7-ffd6eb48ba54'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('79e0a4ec-5ff6-498e-8a0a-810a885b4190'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('800b788a-5460-4351-b03c-37c90a40f9d0'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('55982ff4-270f-4d87-b5fe-61ec1db2238f'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('fc5c890f-d552-4c80-a8dd-2a17ebe3ea8b'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('b1f77f46-43ea-4bc1-8044-5db1331c4eea'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('cdb5aa69-d4d3-4170-85e1-734fab12c9ee'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('fb9b22bb-fa9e-4688-b3c7-2c9b2b75d3eb'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('375de0e6-1c86-449e-b04f-74c7b63d3180'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('0c7a8b15-0ef5-4c12-86f4-b15eaa5a3561'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9ce90077-736f-4b18-ac7b-9679202abe2d'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('be007626-1c89-425f-adbd-2f7093f667f5'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('1c8941af-a5a0-44dc-b21a-e11c408ec943'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('60938bb1-2421-4c30-af74-c775113b21f5'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('9072405a-a218-464c-8a0f-3a0d14e4d061'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('1ea5459d-619b-4440-b48a-a18cfd003375'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('aaaf972d-2f90-4676-bcc4-43cd83bdfd52'::uuid, 'MARQUEURS_CARDIAQUES', 'RISQUE_CARDIOVASCULAIRE'),
  ('839e3a7c-a99d-4f9e-8489-97ed98cf66b5'::uuid, 'BILAN_LIPIDIQUE', 'CHOLESTEROL'),
  ('7be71408-6db2-4abb-8cc9-e21593824372'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('9524f42a-67ca-4e3d-9f08-86058bd6bfb2'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('9dbeb91e-2882-4037-84d1-0a87b90b298c'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('4153f5b2-72db-48f4-b29f-2f95f797f9d6'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('35fa3c93-b9fa-42c5-9087-edfe364aeaae'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('013f16b4-293e-4d9f-bdaa-e32d0ea41756'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('952e386c-cd60-428a-94ea-cf2fb51998a3'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('ee522a8b-c5bb-41e4-a653-d1f4b955e3e2'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('466afbc7-f92e-4c00-9434-4330ba8735f0'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('088448bd-36d9-4ae4-851a-99f3e35ec5d8'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('f140ae37-1f2f-4799-a766-8f1f2716fac4'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('aed7e0b1-0edf-4678-b16c-49b617972034'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('989ce76c-af87-4388-9ce4-9bbfa50a5ddb'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('f29a914d-310b-4da1-adf1-6cf4070676de'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('38dff7b7-1237-475b-9a90-c6c0707acf2d'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('29b631e6-0142-488a-914f-f5d5031b4608'::uuid, 'BACTERIOLOGIE', 'ANTIBIOGRAMMES'),
  ('67179afb-b11d-44ff-8dd8-3db19a76e5bd'::uuid, 'BACTERIOLOGIE', 'ANTIBIOGRAMMES'),
  ('0220d4f6-3b58-48b9-830d-0bbc5509dbda'::uuid, 'BACTERIOLOGIE', 'ANTIBIOGRAMMES'),
  ('e0fb1d08-c1d0-413d-a4ae-9472f8071bf1'::uuid, 'BACTERIOLOGIE', 'ANTIBIOGRAMMES'),
  ('34b8fe64-4f5d-41ba-bbd2-23c32c7d399f'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('e03194b6-a14e-4119-8908-5578aa733e23'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('a0bf0fd0-91a0-4dd6-900f-c64fd1bd9fe9'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('8bf4b1e8-c5f0-417a-b96e-7de17c2b079a'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('96714df9-19f4-4d90-9ce7-f2f6653d7d0a'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('87935dd0-c3f8-4a1c-ab2a-0537b3f3a3dd'::uuid, 'FONCTION_RENALE', 'AZOTEMIE'),
  ('b2b7a1d3-5eae-4328-b674-c407f7ff7d47'::uuid, 'FONCTION_RENALE', 'AZOTEMIE'),
  ('97045e89-e3a1-4f50-a6e5-4b1efede2f35'::uuid, 'FONCTION_RENALE', 'AZOTEMIE'),
  ('f0911044-08c9-4f9d-ba12-fb1b04776f85'::uuid, 'FONCTION_RENALE', 'AZOTEMIE'),
  ('159083d3-fd95-4b2b-8e39-927cfb48637e'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('e8ba2caf-079f-4714-831f-ce211054fa91'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('b26ec365-5710-4abb-b444-ff72b8b30a0c'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('2f0ef846-cbbd-46c1-b283-c3f0ba4e269b'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('a3a5419c-8cb8-4015-9b55-4a0247c266dc'::uuid, 'INFECTIONS_MATERNELLES', 'TOXOPLASMOSE'),
  ('36e7a587-81a8-4c3d-9a9d-73132d130faa'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('6051f71a-fe17-4887-bc7f-9faf7ea66a45'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('eb1d1cdf-2946-490b-ad84-4be75859d215'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('476e701c-1972-4c44-b76c-c144fa0ffaff'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('3ec2433e-cf06-4594-80c8-b1afea7ea209'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_PLEURO_PERITONEAUX'),
  ('00d61eb1-6a90-4c7f-a427-54ee56bfea88'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_PLEURO_PERITONEAUX'),
  ('0368440e-6625-4918-b518-44b08a0703c3'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('d4e91945-c200-465f-8bb8-c5b111324199'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('2ed1e12d-ce79-4b0e-9874-741975d02b57'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('050b49dc-0a61-4225-b478-c8091a9867fa'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('2d6cfe91-cd92-471b-8f7b-88d997f36f70'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'MATERIELS_IMPLANTES'),
  ('b4b6de8d-3a21-446c-afe2-d0038cec1ca0'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('eeb7863f-dab6-4aee-a108-217ffd51f7c5'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('20e24350-8067-4ed8-bcd6-8dcd0c97dcd8'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('fdc0a4b4-b7af-41d3-a12e-d141287a9c7d'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_B'),
  ('9b3e3c8b-ab80-48dc-bcef-7b12e9583aed'::uuid, 'ADDICTOLOGIE_BIOLOGIQUE', 'AMPHETAMINES'),
  ('ffd097c7-87ab-4fa4-96ae-d78484cbba02'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('f4c84cb3-7a86-4e13-9ab2-74a61a6b4b70'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('881be9be-19ef-4a90-8389-b20b03c25c02'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('5105d091-3b43-4d43-a449-9c3ec224faa9'::uuid, 'PCR_VIRALES', 'HEPATITES'),
  ('d8b9b6ca-7479-4a4a-a3a9-6f9edf2db3d2'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('88fea750-11c8-4e39-8576-ae22bcb4a29b'::uuid, 'ENZYMOLOGIE', 'ENZYMES_PANCREATIQUES'),
  ('476be945-eeff-4520-ab95-e1abd2c85e8b'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('cad88c12-f746-4ff8-bb60-181a0ef0ec29'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('793866b0-1e04-4a73-8049-38080c1b643a'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('650366c5-c140-446b-adee-b6c72ab2fad2'::uuid, 'BACTERIENNES', 'BORRELIOSE'),
  ('165832f9-90ad-41a1-84b3-71ac1f82c940'::uuid, 'BACTERIENNES', 'BORRELIOSE'),
  ('492f62c2-ad1b-4c88-906d-9052f28f7e20'::uuid, 'MYCOLOGIE_CLINIQUE', 'ANTIGENES_FONGIQUES'),
  ('e468e06a-17d9-4198-a202-7305bf536ce5'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('2bbd19bf-dfba-4a49-be4c-185fd9baad02'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('b0d3eb39-ca90-4c9f-aeb6-7ef2b4bc6423'::uuid, 'PROTEINES_INFLAMMATION', 'METABOLISME_MARTIAL'),
  ('b4f64221-8a46-491a-af7a-c4c738b9c510'::uuid, 'SUIVI_THERAPEUTIQUE', 'IMMUNOSUPPRESSEURS'),
  ('b2fff24c-158a-40d7-9ad2-7075167c97f0'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('92c4a949-11e7-4589-86ff-108bf20336c8'::uuid, 'MARQUEURS_TUMORAUX', 'NEUROENDOCRINES'),
  ('9ed6cbab-cbcf-4feb-b72d-5b69276f47cf'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('a239a15e-8753-42d7-9f2b-68561eb4d6a6'::uuid, 'FUSIONS_TRANSCRITS', 'BCR_ABL'),
  ('a56e95ff-57f6-4787-8743-59b503f669cd'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PTH_VITAMINE_D'),
  ('741c5ca9-3ec4-4f43-a8cf-31103e340485'::uuid, 'VIRALES_DIVERSES', 'DENGUE'),
  ('ff597cd6-acbd-4834-becc-be63f4b837df'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('16117d7a-55a5-48da-b3f0-781875ca9cb7'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('9749c932-0b5f-4ea0-997f-a3dfb84d1054'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('6f1e706f-b7bc-42ea-9da9-e5ac28d3ff16'::uuid, 'ADDICTOLOGIE_BIOLOGIQUE', 'BENZODIAZEPINES'),
  ('c7bff847-2303-4083-8472-e3241c4688d2'::uuid, 'ADDICTOLOGIE_BIOLOGIQUE', 'BENZODIAZEPINES'),
  ('81644aa2-9963-481a-aee0-014166ed033a'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('45f84ff1-a147-4e93-8d99-15526bcdf1da'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('65435849-dd2b-4ef1-b3df-16a7f6d0d3bc'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('03d056cf-64ce-4311-907e-c7953b2a81fc'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('3c77a5ce-59cb-4a19-8fb8-dcaeb07dc0ae'::uuid, 'PROTEINES_INFLAMMATION', 'METABOLISME_MARTIAL'),
  ('5897873e-9440-4a82-9133-b4a858a2f180'::uuid, 'PARASITOLOGIE_CLINIQUE', 'HEMOPARASITES'),
  ('cf85d443-160a-4330-92ac-f52ca4365fa9'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('16a90c9b-9ffd-4c90-9c15-d97096c85d80'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('5077288b-6a52-44c2-b233-47ba36dab875'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('5f15cfe7-b1d4-47a8-a35a-b35a98fbbccb'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('227bed06-1f2e-4788-bc12-d14f3cc9af72'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('ff1dfa41-a0a4-4abb-b7e1-cb70cf08da54'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('9f39665d-2b20-481b-8df7-fa664472c968'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('d5b13287-0bc3-4175-9825-16a79787de49'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('2eb59f24-5b19-4ce3-974b-948596f16e4c'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('61ba6345-4b5d-4509-afce-ce445ee20776'::uuid, 'TOXIQUES_ET_METAUX', 'MERCURE'),
  ('8e1ea89d-f1ad-4bd8-9af7-739a6c62205d'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('eacbd0d0-a255-4a0b-bf26-c238a9f40532'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('7a14adcc-acbb-4f01-ac27-5d9952a4188d'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('05eb9535-e505-4840-8541-67b53c41ea67'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'HYPOPHYSE'),
  ('38fd5a75-0a33-40c9-bdf3-a02261d78d30'::uuid, 'FONCTION_HEPATIQUE', 'BILIRUBINE'),
  ('05f61766-bc05-459b-81d4-d058d16805ce'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('f3633fdd-1b8c-43ea-97ad-db67d9f3ab00'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('7c51a5f1-ce9b-4154-b893-96cab78eb570'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('6750d7fa-ad6d-423f-b41a-a9085c1917f4'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('c3455bcc-8233-4027-a011-d6b6ccd4db1d'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('cd2e8b9f-1bcf-401e-849a-cbb75cf75ddc'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('e38e731f-5e02-492d-b922-eba5a32aa1fc'::uuid, 'MYCOBACTERIOLOGIE', 'CULTURE_BK'),
  ('ed7c0722-c6c1-49ce-b142-b60e81a45ee8'::uuid, 'MYCOBACTERIOLOGIE', 'CULTURE_BK'),
  ('9b7314ab-922c-43dd-9ed8-2bcb81d56a38'::uuid, 'MYCOBACTERIOLOGIE', 'CULTURE_BK'),
  ('e8ffb769-5c96-4945-b257-16e21e42beb6'::uuid, 'MYCOBACTERIOLOGIE', 'CULTURE_BK'),
  ('1fa05933-23c4-4fb0-b523-866c6f713419'::uuid, 'MYCOBACTERIOLOGIE', 'BK_DIRECT'),
  ('7fb6ca41-f484-4ffb-b291-3eebef1bd1db'::uuid, 'PCR_BACTERIENNES', 'SEPSIS_MENINGITES'),
  ('38c4b944-1127-4018-bb29-2e0c0a316001'::uuid, 'PCR_BACTERIENNES', 'MYCOBACTERIES'),
  ('dedee19a-5fd9-4918-8cb1-5f525d4cf60d'::uuid, 'CHARGES_VIRALES', 'BK_VIRUS'),
  ('2192e977-0896-4982-b654-a7f7bbe748e8'::uuid, 'PCR_PARASITAIRES', 'LEISHMANIA'),
  ('86b518c9-6574-4d68-bb9b-b8f156328d73'::uuid, 'PCR_BACTERIENNES', 'SEPSIS_MENINGITES'),
  ('8fed310b-5a25-4932-bd93-8470a2d0fb89'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('5349bde6-33dc-4131-9bb9-ed59cc58beb1'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('a508e160-d618-4744-ac78-a2df70754373'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'HEPATITES_AUTOIMMUNES'),
  ('f2f25d37-02b0-450b-a9a7-e97b582737d4'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('16d92087-89ea-4c1a-bc6d-fd48ace92636'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('45151e64-a799-48aa-a3d2-14b7824bf512'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('e0e8d88d-ae82-455d-b7a5-911e99b0980a'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('7ae25442-6c61-488b-82c8-1bba113bf547'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('681289de-439f-4d63-8352-7829816ada5e'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('511ca16c-d5b1-4b6f-af9d-3ea7028042bb'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('ed5442d1-7f0b-4929-97d1-2bbf16c271b9'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('e5609937-7097-4305-952b-f8bd7a7481ad'::uuid, 'CNV', 'CNV_NGS'),
  ('a08df84a-66ac-4897-827b-f556c62d1978'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('f1962ab6-6e0e-43fb-ba1e-fc26a0ad1c59'::uuid, 'MARQUEURS_CARDIAQUES', 'INSUFFISANCE_CARDIAQUE'),
  ('3cf6faa1-40c7-4812-8fc5-c6a37465d5d8'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('c9c88a0c-0f08-4ba3-bb72-b650d5c78460'::uuid, 'PCR_VIRALES', 'RESPIRATOIRES'),
  ('2713b78d-3642-4b0a-8c85-335b3baba3a3'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('7c16390e-b821-43eb-948d-3b69edef265b'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PTH_VITAMINE_D'),
  ('36000699-3d13-4f3e-9c46-6d21f218a49a'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('8f4e13eb-8935-4748-a4cc-ca13a01a34e3'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('63677b96-04ae-4958-8271-eade3daf54a2'::uuid, 'HEMATIMETRIE', 'PLAQUETTES'),
  ('5198c2b7-4aac-4018-a1a2-e50ae9959d6a'::uuid, 'HEMATIMETRIE', 'PLAQUETTES'),
  ('4f8aa78f-2561-4907-912e-08e9f22e6753'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('36914343-e3dd-4dcb-87bd-d83bf5f7ac77'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PTH_VITAMINE_D'),
  ('a12ba2a9-0fd4-4890-a57d-8f611eaec9fa'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PTH_VITAMINE_D'),
  ('6e1b0dd4-e3ea-440a-a68a-48500cde1cae'::uuid, 'BACTERIOLOGIE', 'ANTIBIOGRAMMES'),
  ('bd133ae8-c1dc-4a43-8ec7-e188937a06e4'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('d569f665-9a64-44ba-9832-52a258cebe52'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('26d5fbd3-e6eb-4f10-8890-86fe2c535bf3'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('b3aeddbc-6ff1-4ce0-a2b4-4c3c72b03129'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('10878aff-6890-4ce9-859f-74020d3e65e2'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('9e9c1780-9aac-4288-a213-ce37f19c694f'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('462018dc-307a-4df1-8da0-2edf21852125'::uuid, 'PCR_BACTERIENNES', 'SEPSIS_MENINGITES'),
  ('aab49380-7234-4ca2-9461-9028f5795f7b'::uuid, 'ENZYMOLOGIE', 'ENZYMES_PANCREATIQUES'),
  ('a114bcd3-645f-411e-bde5-5142536b5b58'::uuid, 'FONCTION_HEPATIQUE', 'BILIRUBINE'),
  ('69afa0fe-38c5-4f42-b3fe-3eb2f649a992'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('425b3bfa-da4b-4629-ae60-494d917b5028'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('45d26ecc-474f-4ecc-b409-98f543b4deab'::uuid, 'PHARMACOGENETIQUE', 'TPMT'),
  ('f2caf1f9-189d-4667-8bdb-4f757f13996e'::uuid, 'METABOLISME_GLUCIDIQUE', 'HORMONES_PANCREATIQUES'),
  ('c535a6cd-bc8e-440f-bcb8-201e8d0874e6'::uuid, 'VITAMINES_OLIGOELEMENTS', 'OLIGOELEMENTS'),
  ('a83f8cec-4da6-4770-b8fc-a0d2d5293c7a'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('8c342773-6d25-455c-ba70-fb4b4ae9c258'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('e8561a1d-83d1-4105-8ea8-0468970847d0'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_LIPOSOLUBLES'),
  ('9d2c5e09-89b3-4298-8280-d3df5517d5eb'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('53383e96-631b-41c5-999d-5d28d4e14d1a'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('743e4d42-edf4-4d42-aca2-13c625eb6bba'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('5f394de8-36c9-46c9-a750-7c2f7f5b1d66'::uuid, 'COMPLEMENT_IMMUNITAIRE', 'C3_C4'),
  ('81f12843-4243-4694-81e8-6c21916d5c6a'::uuid, 'COMPLEMENT_IMMUNITAIRE', 'C3_C4'),
  ('d5db15a7-9965-453e-84f6-afc2b83358f3'::uuid, 'MARQUEURS_TUMORAUX', 'DIGESTIFS'),
  ('439c8319-805d-4652-87b8-cf5371279cff'::uuid, 'FONCTION_HEPATIQUE', 'CHOLESTASE'),
  ('e01ea190-7b66-4050-8735-48593d9da195'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('9f32e953-7dc4-4bd0-870c-5654489b4ae7'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'CALCIUM'),
  ('7365e730-c520-474d-9762-1c8595b6fa41'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'CALCIUM'),
  ('5a23e0c1-9782-4ee9-944d-505785c85df9'::uuid, 'MARQUEURS_TUMORAUX', 'AUTRES_MARQUEURS'),
  ('24059d64-554d-4293-9bd6-29cc3bd80823'::uuid, 'MARQUEURS_TUMORAUX', 'AUTRES_MARQUEURS'),
  ('3256391e-9cfe-4588-9aa9-213f3da35ac1'::uuid, 'MARQUEURS_TUMORAUX', 'AUTRES_MARQUEURS'),
  ('137b282c-ae76-496f-8053-62ab57bf12eb'::uuid, 'MARQUEURS_TUMORAUX', 'AUTRES_MARQUEURS'),
  ('d3cc0174-0400-4cf7-9b2b-37520d905ba5'::uuid, 'MARQUEURS_TUMORAUX', 'AUTRES_MARQUEURS'),
  ('a1fb2a4b-f957-4fb7-8bad-ad77226f5207'::uuid, 'MARQUEURS_TUMORAUX', 'AUTRES_MARQUEURS'),
  ('15bc1e89-7fc1-441f-8316-e0c67de35261'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('45a03e8f-cf79-4be0-a9b2-61b3f00c4e3f'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'CALCIUM'),
  ('74a88870-7c85-4211-9e1a-e45b0137deef'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'CALCIUM'),
  ('31e44b6e-1b80-4af9-a36e-bb54afbf4013'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('46814814-c4cd-4a61-a284-c57f291749c3'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'METABOLITES_URINAIRES'),
  ('fd4bb962-db42-430b-a823-68ec7dd8f57a'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'METABOLITES_URINAIRES'),
  ('a3d4e591-c616-4c5f-8430-856a3aeb5057'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('bbc72051-d586-40f4-807c-473fcc4cfd8a'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('245b682f-756f-4cf7-a16e-000d4053b16f'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('8b293fad-aa4d-42f9-ad0e-98375bfe7a28'::uuid, 'FONCTION_HEPATIQUE', 'CHOLESTASE'),
  ('96ee3611-98d4-40b3-9bfb-0ac50d723537'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('90fd7f3c-03c2-4c3a-98a2-ce093a2fc93f'::uuid, 'MARQUEURS_TUMORAUX', 'DIGESTIFS'),
  ('e480e227-53bc-439c-a04a-e63a9555aee1'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('cec61b1b-1371-4d42-8f1a-e31ca4ccf4d9'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('f6ef9405-431e-4582-a0c8-905be62f8e38'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('4dbfa6b5-8b46-44d8-aa3d-008d28558b05'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'DIABETE_AUTOIMMUN'),
  ('1002b7d2-7d11-475c-adc5-df42f1847d3d'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('89591783-9aaa-4517-a074-4090bb40dc48'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('bdb9d70c-604b-4bef-8d69-e6b4c6964c54'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'DIABETE_AUTOIMMUN'),
  ('e1f93cc6-e9c9-4603-89f0-76084e5af500'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('69bb7c69-1974-4918-99c9-c51d632a9c16'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('9eb0be67-c7da-465a-ad59-12dc927cd471'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'CALCIUM'),
  ('88b2e1fd-9150-457b-b4d3-46918d4c08eb'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'CALCIUM'),
  ('d3cb8340-db71-48ea-8f42-bd8bbddf3541'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('8d762f5e-b8c5-4500-aea8-21050fd2573c'::uuid, 'PARASITOLOGIE_CLINIQUE', 'PARASITES_TISSULAIRES'),
  ('d639a398-47ef-4ca6-bceb-a821ea8b4c8c'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('35cd5232-7f60-4c44-a768-9fd404184433'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'HYPOPHYSE'),
  ('92bc733c-1e62-4e43-8014-f8c49e78223b'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('5bf9fe8d-ddc1-4b95-9f56-bf97afbb1f8f'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('78766058-806d-4ee2-aa81-da4da94e717a'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('126d21a1-7bf9-4d0c-9008-00c16460b83f'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('573ed7b4-733f-4678-8492-b3a4808bd980'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('b88b3c99-04ff-4e92-92c3-541b128a1738'::uuid, 'PCR_VIRALES', 'RESPIRATOIRES'),
  ('66543fc9-8f42-4f16-a776-02b7cd6eeec9'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'HYPOPHYSE'),
  ('0d8497aa-f08a-4c0e-b631-d5fa14576b6b'::uuid, 'SUIVI_THERAPEUTIQUE', 'IMMUNOSUPPRESSEURS'),
  ('8a607c92-1d40-4d83-9e32-74373ed934d7'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('c83b36a9-bf8a-4108-a325-481fe523af87'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('9e695f0e-16e5-46b7-beb2-6cca6511f651'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('a786e0a7-b67a-47f3-b8d6-348c61140f9b'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'CALCIUM'),
  ('f4c3afa7-55c2-41c1-919c-1560ccbe481a'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('6732c15f-e45e-4fbe-b54f-993c20a1c6a6'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('d2d158c7-01c7-4e4f-bd22-f17255634fd9'::uuid, 'ENZYMOLOGIE', 'ENZYMES_TISSULAIRES'),
  ('dc655c80-0524-498f-afed-d337299995f4'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('dd22d682-b348-4d3b-8698-d76558bf831a'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('4b188d8f-bb6a-4a41-8ce5-b008ba392926'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('f9c442af-a195-4138-b452-33f919463055'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('9db7fe55-a447-4908-ba84-53184275f3cc'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('4271c684-2c7b-4095-a010-579460e3a83b'::uuid, 'VITAMINES_OLIGOELEMENTS', 'OLIGOELEMENTS'),
  ('ae3a75ce-2ba4-45c7-b09f-db3ee4ed3a22'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('eda62ebe-60ee-42f3-84ae-aee5850d51a3'::uuid, 'SUIVI_THERAPEUTIQUE', 'ANTIBIOTIQUES'),
  ('91712e23-b96c-4d04-90e0-3e03d34a786f'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'METABOLITES_URINAIRES'),
  ('0e4ba31d-e766-488e-bae2-6477c2ceacd7'::uuid, 'CHIMIE_GENERALE', 'AMMONIEMIE'),
  ('29a62c12-d856-4e6e-a6d3-159dddd2d154'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('b04073e6-de3f-49b1-a645-5406f4ecc129'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('0c477182-2e11-4461-b233-9b4460cda03a'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('7b592202-a924-45a6-ab42-ab6ef0e09786'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('bf4c48a9-3c2a-41e4-98df-98aa357ff995'::uuid, 'HEMOSTASE', 'TEMPS_GLOBAUX'),
  ('a3016e82-eae2-4b2f-b9d9-d88210011a48'::uuid, 'CYTOGENETIQUE_CONSTITUTIONNELLE', 'CARYOTYPE_SANG'),
  ('ea01db34-3338-436a-bb28-a607fdec34ea'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('f7205654-6d4e-441c-a524-6375fa96399b'::uuid, 'CYTOGENETIQUE_HEMATO', 'CARYOTYPE_MOELLE'),
  ('25657caf-e08f-4c51-9336-6b338904275e'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('f4a43089-de10-46d8-bb6d-6efd90c4e167'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('4c7ce289-5812-4a5f-9fe9-ad1f96ca3db7'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('8a9f4da8-4ccb-4247-ba51-5d60a5db0c2d'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('ff37a31e-264b-4d8b-9bc1-a14b7a8d28a5'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('797f3e9f-ad4a-47d4-b72b-f49ee80eb98a'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('3526862e-347c-44aa-b680-f89db1e2a007'::uuid, 'RECUEILS_24H', 'IONS_24H'),
  ('4f0311f4-c46d-4946-bf9f-51a88a28c6d5'::uuid, 'RECUEILS_24H', 'IONS_24H'),
  ('7b50a908-aa0c-4c19-a2bb-3eed850fc507'::uuid, 'RECUEILS_24H', 'IONS_24H'),
  ('96b0be45-01e5-4672-a663-47470144edb5'::uuid, 'RECUEILS_24H', 'IONS_24H'),
  ('81a004ec-08e8-403f-bf9e-1fd2ddb9225f'::uuid, 'CNV', 'QF_PCR'),
  ('89bbebaa-442f-4660-b24d-e5caf3f45ad2'::uuid, 'MARQUEURS_TUMORAUX', 'DIGESTIFS'),
  ('ef66ed1f-d2d7-4fba-b43a-f09ff2420b16'::uuid, 'FUSIONS_TRANSCRITS', 'BCR_ABL'),
  ('12c287cd-5332-4036-8689-c199e1250b3e'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_RESPIRATOIRES'),
  ('ff54ca00-9032-4fee-9b5d-ff23b896d950'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('d66fa6c7-765a-4905-a31f-63a328d29bb9'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('6b2bd31b-a910-4074-9717-ff4b038d11cc'::uuid, 'MALADIE_RESIDUELLE_MOLECULAIRE', 'LAM'),
  ('977595c3-c35f-47e3-ab10-2104a4e33c0d'::uuid, 'PARASITAIRES', 'BILHARZIOSE'),
  ('052e7985-1338-4c0b-9f63-ab836b1ea1a4'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('32788f44-be4b-436f-86c9-c2d0ffcb3bc6'::uuid, 'BACTERIENNES', 'BORRELIOSE'),
  ('58f74f4e-3afa-4266-bc86-7b1a680f8d55'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('9f992742-3811-4205-9364-a6555a221d9a'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('7fb6f60a-b513-4511-b2f7-9e023b67f75f'::uuid, 'BACTERIENNES', 'BRUCELLOSE'),
  ('b02693ad-a1e8-4983-a8c0-fe1dab66e0ef'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('f649dbf9-f969-498d-b39e-5b52e8c68624'::uuid, 'BACTERIOLOGIE', 'ECBU'),
  ('ab70c7ed-9f89-43fa-a889-ffa091c81924'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('f53ac193-a94b-4648-8480-abd9077796f3'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('0da54dfc-167c-4549-8bca-31f2d79a0399'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('ab55c9a2-9930-4035-b63c-63313fc32dc4'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('22548a2a-52ad-458c-9194-78afd33273e4'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('3500111e-2c02-48b2-8806-6599c1316af7'::uuid, 'FONCTION_RENALE', 'FILTRATION_GLOMERULAIRE'),
  ('20aa8dca-8175-4ccb-86e4-8165c1f25080'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('71a406b1-2dac-4c62-89e8-050ed66880f6'::uuid, 'MUTATIONS_SOMATIQUES', 'JAK2_CALR_MPL'),
  ('455f9163-69c1-4a28-b465-eb9596b97d05'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('4d305157-db98-4d33-a2de-24e3c06298db'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('4901866d-e52f-4359-a37b-60604d1699e4'::uuid, 'SUIVI_THERAPEUTIQUE', 'ANTI_EPILEPTIQUES'),
  ('bd5b44a5-4bc3-4275-8072-49c9438d9cd2'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('44f52e62-2d10-4f2d-9ec1-3f1b415f9300'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('9cf26c93-9e25-48c9-94bd-f221b41febdf'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'METABOLITES_URINAIRES'),
  ('9fc2de98-41ac-4bdc-a448-521eed790b94'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('9c7b71be-26c7-4251-8ca8-1eff26040efb'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('e2826793-1f1e-4e92-8328-bf433739973d'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('b44bf9b3-036f-422f-80d4-6d4c8b194046'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('6204f1b8-2cd3-4521-bd6a-c59bcb45b7d4'::uuid, 'ARRAY_CGH', 'POSTNATAL'),
  ('0d85dce1-8841-4205-a17b-ab910078fa69'::uuid, 'ENZYMOLOGIE', 'ENZYMES_TISSULAIRES'),
  ('fd6df731-f857-4ca6-8dae-b626dcd16077'::uuid, 'COMPLEMENT_IMMUNITAIRE', 'C3_C4'),
  ('6071d5f9-18f5-459b-b14e-de06cdee8421'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'ELECTROLYTES_URINAIRES'),
  ('eb564c82-e1b3-4060-a80e-6bda7c9244f6'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('2aebb94c-959e-4ef6-9820-ecfde158f7ee'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('5a956f9e-2772-41b7-907f-c03650cabd49'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('c7efa5f9-f417-4b88-aca7-17dbb8968c15'::uuid, 'ADDICTOLOGIE_BIOLOGIQUE', 'COCAINE'),
  ('984967d1-5bbd-4dbc-aef4-d4dbb7c48113'::uuid, 'ADDICTOLOGIE_BIOLOGIQUE', 'COCAINE'),
  ('1032a0d1-7fca-4f57-a27f-26f0a99fea18'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('e86f68a3-3b89-4070-b7f1-e395f4561583'::uuid, 'PCR_BACTERIENNES', 'SEPSIS_MENINGITES'),
  ('11d81af9-71b6-4b46-860c-05ea3e3503fa'::uuid, 'IMMUNOCHIMIE', 'FACTEUR_RHUMATOIDE_CCP'),
  ('5f8205b3-11dc-4c83-bf01-dc0f3b29f287'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('325eeee1-463d-40bb-a9a4-7bad1602d5bf'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('2830edd6-1d54-41ea-a954-991c229c032e'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('2f41b6de-5ba8-4dba-ab07-1bbb53ebab74'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('58703d7c-284c-4c92-9ba4-34c596c56b4a'::uuid, 'VITAMINES_OLIGOELEMENTS', 'OLIGOELEMENTS'),
  ('1c9aab1e-7ed7-46fa-854b-7e1eb008e1cc'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('12fa6a5a-3ff1-40fc-8855-7397c49099b6'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('abff483d-27c7-40ab-affb-e74f22f4f00d'::uuid, 'SUIVI_THERAPEUTIQUE', 'PSYCHOTROPES'),
  ('e5f166ff-2705-4c78-b0f6-1eeb66bf322d'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('f241b0e5-1644-4d32-ac55-a36fe57dc498'::uuid, 'IMMUNOMONITORING', 'CD34'),
  ('3ee0fd3f-f249-4444-834d-8481cf2cf210'::uuid, 'IMMUNOMONITORING', 'CD34'),
  ('049d3301-97d6-4beb-a0fb-acde763aa42d'::uuid, 'IMMUNOMONITORING', 'CD34'),
  ('f1e06bf6-5005-41cd-a8d3-0426fc0f437c'::uuid, 'IMMUNOMONITORING', 'CD34'),
  ('2b1552b2-603d-47df-a421-65b725098a93'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('4dc80e22-2d9f-4994-b632-b14ce31d5f9d'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('6d9c7fb8-b34c-4e70-a263-dd90177401f0'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('bb4ff438-b4d8-4959-9b70-586a92b4326c'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('8febee20-c1c8-4ab1-9768-67ff3f49ed9a'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('60f4f65f-f04c-4eb9-9916-af618bdb3a4e'::uuid, 'SUIVI_THERAPEUTIQUE', 'CARDIOLOGIE'),
  ('3d885baa-ebc6-4bff-b0fc-e72c5e2b7b12'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('371fcc51-d3ae-4676-8271-f8e4f3c7ae0c'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('5584fa89-e35c-4ca0-b43b-d0c9c404e7a7'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('6b14f6d1-e9a5-40fd-af2a-5b23aab89168'::uuid, 'PARASITAIRES', 'ECHINOCOCCOSE'),
  ('4da74d03-d302-4303-9146-1f732158dee6'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('0aba44a7-e4f5-49bc-849e-0d5e7d7c6cf3'::uuid, 'LIPOPROTEINES', 'FRACTIONS_LIPOPROTEIQUES'),
  ('345cb914-50a4-42dd-9874-04410fcfe2d8'::uuid, 'BACTERIOLOGIE', 'LCR'),
  ('571708fc-f7cd-4616-9f02-5d8be0d6a8cc'::uuid, 'PROTEINES', 'EPP_URINES'),
  ('06f60bb5-2444-421b-834f-bcefcbcb9b36'::uuid, 'SUIVI_THERAPEUTIQUE', 'IMMUNOSUPPRESSEURS'),
  ('48b4e92c-5eb9-4d2d-bea9-cc2c920855ae'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('940e8a9a-6167-45ed-b9d3-763bb83689c8'::uuid, 'PROTEINES_INFLAMMATION', 'METABOLISME_MARTIAL'),
  ('b9b3d3dd-5225-496b-ab83-df9de2f78d85'::uuid, 'FONCTION_HEPATIQUE', 'SYNTHSE_HEPATIQUE'),
  ('c7ebf34d-f9c8-475c-a006-4320e6887395'::uuid, 'FONCTION_HEPATIQUE', 'SYNTHSE_HEPATIQUE'),
  ('e72cb729-b8ae-409f-8287-86c0bafd1844'::uuid, 'FONCTION_HEPATIQUE', 'SYNTHSE_HEPATIQUE'),
  ('7d7a9d1e-1c07-4922-8631-1dc78ed387ee'::uuid, 'FONCTION_HEPATIQUE', 'SYNTHSE_HEPATIQUE'),
  ('fdf7ff13-8aa7-4b32-8f07-7b0fc68b8bb3'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('ccbf3c5d-6c6d-4ec3-b095-5c33b61f254a'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('42cd3524-894f-49c8-b062-802a486afd35'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('0bbb32e2-88a8-4f76-9290-f2ac4803ba1f'::uuid, 'CYTOGENETIQUE_CONSTITUTIONNELLE', 'CARYOTYPE_PRENATAL'),
  ('0c1a344c-b434-4ee4-81a9-7deb06e2fa8c'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('9396d4cf-9cd1-490c-baa7-e13b2cc657f6'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('da9aefe6-527a-4a6b-a4d6-c003b223ebff'::uuid, 'MUTATIONS_SOMATIQUES', 'NPM1_FLT3'),
  ('524348f6-9121-4c43-977f-49f7321678ee'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('fbe02ac4-cd9a-454d-a0bb-b1bb3f04fd87'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('01036e4f-8ca4-4f1b-88bb-d67723f63a4f'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('e0aa2a31-d240-4c3d-b394-fbcb8fdd7606'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('56f82eba-593e-44f2-a1c4-85dd953da376'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('a59e2c39-e9ba-4b47-b21f-0955a0dfa0e6'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('f0320357-aea7-4380-800e-88264e1697de'::uuid, 'MARQUEURS_TUMORAUX', 'DIGESTIFS'),
  ('35b3e8f9-795f-4388-91cf-40b4ec26d2c9'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('67548065-c4cc-4dcd-a31e-ad8f8fce3fc6'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'HYPOPHYSE'),
  ('c88bd308-be1b-4f19-b802-012044da0c58'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('ad1c2d5f-df95-4c1b-bf1b-6839cd0116ac'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('cd0a37ea-c085-45aa-a71d-579c21e045ae'::uuid, 'METABOLISME_GLUCIDIQUE', 'HORMONES_PANCREATIQUES'),
  ('25b128b5-c6fe-43ca-9a76-38b81786f4bb'::uuid, 'METABOLISME_GLUCIDIQUE', 'HORMONES_PANCREATIQUES'),
  ('c73a39bf-d380-44ba-a817-ae88a8fcf120'::uuid, 'ENZYMOLOGIE', 'ENZYMES_TISSULAIRES'),
  ('ab9781bf-34ab-454e-bd3a-2bee3ad241d8'::uuid, 'CNV', 'QF_PCR'),
  ('7abdae94-0f2f-480f-82c3-c7939768ae87'::uuid, 'COMPLEMENT_IMMUNITAIRE', 'CH50_AH50'),
  ('55593abd-33f2-4b84-aa94-78e215c4f3cd'::uuid, 'PCR_VIRALES', 'HERPESVIRIDAE'),
  ('60528f1d-8f90-4979-af77-6b650a968f1a'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('ca800133-a145-436f-964e-bb70edef6d8b'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('43f3d02c-1382-4877-9870-d68a6f1fdd78'::uuid, 'MARQUEURS_TUMORAUX', 'GYNECOLOGIQUES'),
  ('6988d3c0-d929-4847-af7f-1f3fc5e4d89e'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('34cbc68b-436e-4b1b-9257-e78021def5df'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_E'),
  ('c3f48135-e6c2-4be9-80be-c15f6fa11459'::uuid, 'HERPESVIRIDAE', 'HSV'),
  ('5973936b-4c8a-4ca4-969c-52045afafed1'::uuid, 'HERPESVIRIDAE', 'HSV'),
  ('05d9690e-bd84-4bd0-9191-0c2b5423295f'::uuid, 'PCR_VIRALES', 'HEPATITES'),
  ('fad0e749-a166-417c-a41a-7cd79c59a0e6'::uuid, 'TOXIQUES_ET_METAUX', 'MERCURE'),
  ('e7bb15d3-19d4-41ae-9b17-1a4c10ca2ee7'::uuid, 'SUIVI_GREFFE', 'CHIMERISME'),
  ('2302d885-5e50-4fa7-8ede-8a800b0d926b'::uuid, 'SUIVI_GREFFE', 'CHIMERISME'),
  ('0cf3be62-7ef7-47f2-8cae-d6f388a4cc9c'::uuid, 'SUIVI_GREFFE', 'CHIMERISME'),
  ('26b58379-0196-4ff3-b62b-83c445693540'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('08e7a8ba-0161-4db9-b911-57b7d1b8c0b0'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('f76bfb6b-6d4a-43f3-bc62-9cd1876cd53f'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('7911d5e8-ff11-4270-84e0-d2603b6cb00f'::uuid, 'GENOTYPAGE_RESISTANCE', 'VIH'),
  ('c263ba14-13e7-4a55-861d-085fffc7ef36'::uuid, 'GENOTYPAGE_RESISTANCE', 'VIH'),
  ('3b38e134-30fb-4996-8c90-70f7f16735c6'::uuid, 'GENOTYPAGE_RESISTANCE', 'VIH'),
  ('aa8c168c-a216-49ca-a834-fca4a0ae1d17'::uuid, 'TYPAGE_HLA', 'HAUTE_RESOLUTION'),
  ('249a54fb-db7f-4aeb-b65f-4956ea0d1e2f'::uuid, 'TYPAGE_HLA', 'CLASSE_I'),
  ('44a36f88-fc8c-4e67-ad44-b4115c004389'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('6760bd7b-2dc1-468e-ad9d-2e74b06b9087'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('f503f34a-3b4f-476a-a452-ff2eabc3815b'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('93055ad9-1717-4539-a7af-b5fea4feebfb'::uuid, 'PCR_BACTERIENNES', 'IST'),
  ('d4e159a8-3278-4b7d-976b-d172b10fe3dd'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('beee0cfd-aee5-42f4-bd2d-9001a43c97b3'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('9ea8e536-6c3a-4211-8205-2bf6eaaa239a'::uuid, 'MARQUEURS_CARDIAQUES', 'RISQUE_CARDIOVASCULAIRE'),
  ('a2790d44-dc5a-417e-8812-bcd851adf2c3'::uuid, 'IMMUNOMONITORING', 'IMMUNODEFICIENCES'),
  ('ef37e9e9-eac3-4545-865d-88aac55f377e'::uuid, 'VIH_RETROVIRUS', 'HTLV'),
  ('4a544110-c401-45f2-9b6d-258f0df7e32c'::uuid, 'VIH_RETROVIRUS', 'HTLV'),
  ('7bb3b84b-60be-4e70-8742-d1c45dd8be1c'::uuid, 'PCR_VIRALES', 'HERPESVIRIDAE'),
  ('16f16b7a-19d8-4f30-83ba-37300263896c'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('6abb31ca-65f7-480f-b997-2747cd794d44'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('72f6b7a2-1082-40da-8399-7d75887c44f5'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('83532314-3088-48f2-bdb4-c2a90f4e21d4'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'DIABETE_AUTOIMMUN'),
  ('119808a6-75e8-4e2d-b2d9-46f4ad74c146'::uuid, 'SUIVI_THERAPEUTIQUE', 'IMMUNOSUPPRESSEURS'),
  ('1457e49b-1945-402f-86d0-22653f9b97b5'::uuid, 'MUTATIONS_SOMATIQUES', 'IDH1_IDH2'),
  ('bf083621-2d3c-4bd3-a2ec-0c80e0b8da43'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('c40ae6fd-bafd-46cc-af06-0fdf983bbded'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'HYPOPHYSE'),
  ('cd61a0b3-0478-4593-95a0-77ff9df2d548'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('f8fbaf38-bd27-400e-baf3-f682fa952a2b'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('a0ba2ae7-edf4-49fe-98dc-42048f37d80c'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('64696d07-d0ec-46ac-bb24-6c69da126ed5'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('f6aa2137-5e5b-4706-a0aa-c82a7ab0298a'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('c6498065-f635-4708-a9fa-769580896c4f'::uuid, 'PROTEINES_INFLAMMATION', 'INFLAMMATION'),
  ('4c3a5e1a-9df2-46ec-8296-3cba20142ec5'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'DIABETE_AUTOIMMUN'),
  ('a07ceacb-aa5a-4282-9033-1d7921e66d8e'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('5c1e5152-c108-4cc6-9895-6006300a9c1a'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('15fe47f0-32dc-44a2-bc2b-803ec5c7843e'::uuid, 'SUIVI_THERAPEUTIQUE', 'IMMUNOSUPPRESSEURS'),
  ('1937621a-b742-4de5-b7cd-1ac2b1a6f85e'::uuid, 'SUIVI_THERAPEUTIQUE', 'ANTIBIOTIQUES'),
  ('1802f32f-9405-475f-bd90-ff0e4b2af1ec'::uuid, 'METABOLISME_GLUCIDIQUE', 'HORMONES_PANCREATIQUES'),
  ('aefe9702-18b7-449c-a037-f8253129789e'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('0036fdd8-1ad1-4e39-a02e-d8b6e4d12b8a'::uuid, 'MUTATIONS_SOMATIQUES', 'JAK2_CALR_MPL'),
  ('c2975b58-066c-46e1-bd1a-6bb945f74163'::uuid, 'MUTATIONS_SOMATIQUES', 'JAK2_CALR_MPL'),
  ('25c9718d-25ac-427c-9645-eab1d1acd89b'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('1a1bcb99-1097-43d7-ab12-bd0265caab0c'::uuid, 'CHIMIE_GENERALE', 'ELECTROLYTES'),
  ('775bae1d-ee84-4e12-9854-0e462b13c0d8'::uuid, 'RAPPORTS_URINAIRES', 'PROTEINE_CREATININE'),
  ('65790a70-3f3b-4cd7-8880-f5db78acdc42'::uuid, 'CHIMIE_GENERALE', 'LACTATE'),
  ('b8913c82-f47d-4771-ab5e-799e5ba6c188'::uuid, 'MALADIE_RESIDUELLE_MOLECULAIRE', 'LAL'),
  ('cec6ace6-a36c-41a2-8492-72374af116ef'::uuid, 'FUSIONS_TRANSCRITS', 'RUNX1_RUNX1T1'),
  ('aba80215-b1e6-431f-979b-b79ba6cb55e1'::uuid, 'FUSIONS_TRANSCRITS', 'CBFB_MYH11'),
  ('df5fa59b-a087-4681-98e2-4707abf0b905'::uuid, 'SUIVI_THERAPEUTIQUE', 'ANTI_EPILEPTIQUES'),
  ('ad54c6e7-843d-46c5-a3ea-173d577b2903'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('a7cb844e-38c2-40a0-a932-74add9782501'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('c18be4c6-65e3-486c-aa7e-a7424894aa3a'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('f45fbe92-6e12-4251-b590-f02b2a197f1f'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('7eb4dd44-466e-434f-b19f-15af44499198'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('8fd147b2-13db-4001-8cff-7a0265665e62'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('a5160d03-fe9f-4e9f-bc53-911d7e8bc0d5'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('4878da79-0cd9-4c0d-84cc-5d6fd2e4f99d'::uuid, 'PARASITAIRES', 'LEISHMANIOSE'),
  ('5e1ae5d5-a567-428c-927a-23b4dd867da0'::uuid, 'PARASITAIRES', 'LEISHMANIOSE'),
  ('fe768d9d-a129-45f8-bb77-dd911dafb969'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('61b7618e-50c4-4130-9811-70cc14f7b3e0'::uuid, 'TOXIQUES_ET_METAUX', 'LITHIUM'),
  ('9b206809-0167-4fbe-8dfb-8be326b28b00'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('84f4a868-ae65-4f89-ba8d-e0b973a736dd'::uuid, 'CHIMIE_GENERALE', 'ELECTROLYTES'),
  ('02342672-4ddb-47dd-8d51-7e15e45ec726'::uuid, 'PCR_BACTERIENNES', 'SEPSIS_MENINGITES'),
  ('421b9ca1-89d8-42c5-8cbc-e14608676cdb'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'ELECTROLYTES_URINAIRES'),
  ('7446e9b7-f164-44fe-83ce-2d7d4bccdf4f'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('43fcf4b0-94b9-478f-b18c-23a0b5508eb6'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('4818a4d8-4d3c-4983-83df-9285a6cba680'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('3617e238-e85f-4bae-a66b-874a03320676'::uuid, 'PCR_VIRALES', 'RESPIRATOIRES'),
  ('bba83979-7e29-4d6c-a54b-c57da0769883'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('6ce65c42-a318-4268-b6ec-4c0675b0d305'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('bdb4d207-9306-4ebc-8738-8ff781878572'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('0158758f-237b-42d0-96fa-285f580eed22'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('fba157b8-0958-40d4-9ab9-61685544de15'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('2f4ad984-2b45-433a-9982-256ca773faf4'::uuid, 'VITAMINES_OLIGOELEMENTS', 'OLIGOELEMENTS'),
  ('7f2a76f7-9e4e-4043-9a9f-bc2c86c66cfc'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('385d1db1-a158-4fc3-90a8-f81703e7ee80'::uuid, 'MUTATIONS_SOMATIQUES', 'JAK2_CALR_MPL'),
  ('7a260f65-a48e-4dbc-bf1a-0083a4cc05dc'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('4f6d96fa-4978-4ef7-9467-0c4b2379d272'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('d1c9bef1-4c5e-4027-aabd-beff0e6c7f63'::uuid, 'CHARGES_VIRALES', 'CMV'),
  ('2581add8-e3b8-4264-ae61-58fffe282135'::uuid, 'CHARGES_VIRALES', 'CMV'),
  ('ec2922c6-c449-4bff-8197-5db8d99b60c6'::uuid, 'CHARGES_VIRALES', 'CMV'),
  ('3b3599b9-4a2e-43e7-8b82-70c9c4550fd0'::uuid, 'PCR_VIRALES', 'HERPESVIRIDAE'),
  ('0eac17df-a2b5-4553-8a13-8d82ef4950c9'::uuid, 'PCR_BACTERIENNES', 'IST'),
  ('75123afc-7f00-438b-999f-9ade1859fc6d'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('6629f37a-5256-43ac-ba79-1340d2ad7d57'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('b7aa0391-7545-4be2-a78f-c3d4bd135268'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('30b4c74c-3fd8-4cc6-b166-7881c9143ab3'::uuid, 'PANELS_GENETIQUES', 'ONCOGENETIQUE_CONSTITUTIONNELLE'),
  ('bea49b90-585f-4107-a684-c59a2a80cce6'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('9b6c2fec-9ace-4cde-86de-23bfa1b4587c'::uuid, 'MARQUEURS_TUMORAUX', 'AUTRES_MARQUEURS'),
  ('1fb9dcea-43d9-4b7a-b0ee-47c3a6a26fa4'::uuid, 'FONCTION_RENALE', 'FILTRATION_GLOMERULAIRE'),
  ('5f16fee6-4dba-4f56-99af-f6edb2ef9969'::uuid, 'PROTEINES_INFLAMMATION', 'METABOLISME_MARTIAL'),
  ('c11a429f-73e4-4d57-842d-32240f612255'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('17ccf964-ed9c-4a58-bc3d-7ca07bc23415'::uuid, 'BACTERIOLOGIE', 'COPROCULTURES'),
  ('6bda78a4-a4f8-4627-ac34-4eda8cadf146'::uuid, 'VIRALES_DIVERSES', 'OREILLONS'),
  ('cf05b1dc-9992-403e-b9bb-83659a9689b3'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('769bd404-eb02-48f2-9c6b-5648c971ff85'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('c31b7801-b256-45b6-bc32-1ab7b1adc6c1'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('520adc79-92d9-4fc7-a7f1-10ba9ea8f162'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('a556f5b9-46ab-4241-a50f-11970d6b4ae3'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('14de9320-82c1-4612-bc38-61b6fe0be3af'::uuid, 'VIRALES_DIVERSES', 'SARS_COV_2'),
  ('de86d908-5c89-4584-af5a-e7a809928030'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('b6fa377f-add0-4db3-a303-b9e01813c753'::uuid, 'VIRALES_DIVERSES', 'SARS_COV_2'),
  ('8422ec9a-fec0-4f89-9398-c239428250c8'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('59634192-7589-4ecb-b340-c8534fdc924c'::uuid, 'FONCTION_HEPATIQUE', 'CYTOLYSE'),
  ('1df16d75-2b5d-4d30-821b-460d2278a067'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('d0a0a9b6-e33f-4e85-9c13-a0192b36d085'::uuid, 'VIRALES_DIVERSES', 'PARVOVIRUS_B19'),
  ('b5963b89-7052-4c77-8cc9-58a78bceefa9'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('fb295f1a-e64a-439b-b578-ef2463357ef2'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('7e597fbe-d148-422a-bf2d-9189cffaf03e'::uuid, 'TOXICOLOGIE_D_URGENCE', 'PARACETAMOL'),
  ('101db5e4-bcbb-45dd-ace6-b1d9252e5c30'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('8a97f5f5-45d7-4583-b673-738c6eb7f21f'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('ff64a3d9-00b7-44c2-9463-57ce65fa528a'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('02223651-718c-4d21-8620-537b751ed6b8'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('a4814623-d6fe-45bd-bea7-aa9609f394cd'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('9ad952ff-a288-4037-970d-856819572901'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('e3dd1bd1-4996-45e6-a23a-1861322d3382'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('66e67f35-6522-4c3d-9265-7aa2a0213def'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('d4769ba1-c93a-4f93-b82a-9efb746b8db5'::uuid, 'ENZYMOLOGIE', 'ENZYMES_TISSULAIRES'),
  ('6364ae16-f0bc-43ba-bcdd-ac9b92c650e9'::uuid, 'ENZYMOLOGIE', 'ENZYMES_TISSULAIRES'),
  ('a5d9997b-1ca1-4898-849a-4e429bb4e8c5'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('d45453ac-2933-4fc4-a1a1-9fdbf182dd37'::uuid, 'MARQUEURS_CARDIAQUES', 'NECROSE_MYOCARDIQUE'),
  ('a415c8d7-bdd1-481c-bb69-613038fc045c'::uuid, 'FUSIONS_TRANSCRITS', 'PML_RARA'),
  ('3d4a3700-79de-4346-adce-e96ffd4b7b46'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('c11fc150-3eb7-4828-ba4c-efe817cd2616'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('f1256433-0954-4000-be00-11e03d58c4fc'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('2e088a2f-f79b-4b0a-a660-1a91b8e9e739'::uuid, 'METABOLISME_GLUCIDIQUE', 'HORMONES_PANCREATIQUES'),
  ('122a82d4-0b11-482a-9413-c545ae807a5e'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('9797473a-ac0a-44a1-a138-6bdf685f7dc0'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('9b598921-973d-4c6d-aacb-8c7481e8e23e'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('ccc652b2-c5c7-45e1-b61e-0f066c79c59b'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('7bd43f82-eac3-46c8-b04d-cf05bb2e4c8e'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('098178d2-636a-4103-a70a-0d624b0233ce'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('f6ea9b35-b8a9-43a1-8d30-0f4a09128338'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('4a27be3e-04c9-4a50-a024-ca18758d5452'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('b44e70d6-6832-437c-a3a1-fa762afa61bc'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('1b1eb64d-d275-4a6d-90b5-448af29e071d'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('eb8c1f9a-4a99-4f8a-9177-e858bab6a5f8'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('a09ade06-8057-4d74-bff5-0331222215c7'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('278c8903-55d2-48b4-99d5-05ac9c93b917'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('602d60d1-7d80-47b3-816e-c1482a509326'::uuid, 'FONCTION_RENALE', 'FILTRATION_GLOMERULAIRE'),
  ('2b88652e-1478-4148-bd8e-4d6f262d1b42'::uuid, 'FONCTION_RENALE', 'FILTRATION_GLOMERULAIRE'),
  ('523d8313-426a-4045-99f5-6f823f8e125f'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('cd7578cf-f523-419d-8120-433a6b01c7d2'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('a360530e-83f3-42c6-8f86-684fffc09bad'::uuid, 'RECUEILS_24H', 'CALCULS_RENAUX_24H'),
  ('d7146de3-755a-4662-a06b-2a36baa4bfc7'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('24e11da7-b367-4c33-891f-86b28ccc53e3'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('c02e1c08-a67a-4c74-b349-2e30bc58fa8e'::uuid, 'BACTERIENNES', 'RICKETTSIOSES'),
  ('a64937f6-a99a-43d2-bc04-b5d2a1949538'::uuid, 'BACTERIENNES', 'RICKETTSIOSES'),
  ('e51e069d-eedd-4217-82fb-aaa7a677edb3'::uuid, 'CROSSMATCH', 'LYMPHOCYTAIRE'),
  ('8d014436-201f-4716-993c-cc045de64790'::uuid, 'CROSSMATCH', 'LYMPHOCYTAIRE'),
  ('17c7e392-5130-461b-a3a7-57ca2cf80571'::uuid, 'VIRALES_DIVERSES', 'ROUGEOLE'),
  ('31c0dea0-7ebe-4676-b96c-6997d560e342'::uuid, 'PROTEINES_INFLAMMATION', 'INFLAMMATION'),
  ('90408fa5-de74-4b0f-825f-017d55791e5c'::uuid, 'THROMBOPHILIE', 'MUTATIONS_THROMBOPHILIE'),
  ('45e10fee-ff2c-4f54-afad-fcea1538587a'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('54599f5a-94eb-40b8-8feb-0cd3f3b9aaca'::uuid, 'IMMUNOCHIMIE', 'CRYOGLOBULINES'),
  ('ef7982a8-cc6c-4e3f-af72-ebdd1f7f4c2e'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('878fc2db-7b30-4f89-ab6b-9fc5867eafca'::uuid, 'IMMUNOCHIMIE', 'CRYOGLOBULINES'),
  ('4b175f1c-8f59-4c1c-89d8-b89d74efd9d3'::uuid, 'MYCOLOGIE_CLINIQUE', 'ANTIGENES_FONGIQUES'),
  ('da38a193-b8af-46f1-89ab-982b476e6a94'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('e6c2a6ec-c031-4987-9b03-ffc50517264b'::uuid, 'PARASITAIRES', 'AMIBIASE'),
  ('675427e1-11ed-48ff-98e0-47fbd09e2ad0'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('e1d43c73-4ccf-46d3-b86e-43c78d3eb24f'::uuid, 'VITAMINES_OLIGOELEMENTS', 'OLIGOELEMENTS'),
  ('b6d66e7a-f405-476b-b13c-68b6da866349'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('794cc031-ec5b-4cbc-8fc4-f596096137f3'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('84c22dc0-c5d8-4c0c-96e5-a5d851afc996'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('1a98f045-0261-4d64-ae45-89ed711fa1e2'::uuid, 'CNV', 'CNV_NGS'),
  ('6c4dd784-f446-4be2-bb7e-e9d46d5dc1d8'::uuid, 'MUTATIONS_SOMATIQUES', 'JAK2_CALR_MPL'),
  ('2653a6a2-6845-4651-9667-997535b645da'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('3dda137d-6187-43ca-b0af-62200d58bbcc'::uuid, 'ENZYMOLOGIE', 'ENZYMES_TISSULAIRES'),
  ('4b35206a-0690-47c3-bdea-e9c39eaa6795'::uuid, 'VITAMINES_OLIGOELEMENTS', 'OLIGOELEMENTS'),
  ('ae53f019-b3e0-4342-9b31-63c25991a0db'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('9a366381-6d4b-42d3-ad6d-11cd31047840'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('144c0e86-6969-40d4-a739-fdf4fbae3fd5'::uuid, 'MARQUEURS_TUMORAUX', 'DIGESTIFS'),
  ('527c7435-3907-4595-adcb-5bc16c4b349b'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('93875b77-7308-4b1c-b969-fdf258505b68'::uuid, 'BACTERIENNES', 'SYPHILIS'),
  ('47d967fb-6f36-40f0-b4f4-4a7da7ade69d'::uuid, 'BILAN_LIPIDIQUE', 'CHOLESTEROL'),
  ('0c93be2f-65f7-4243-bf93-50f4fe94a926'::uuid, 'SUIVI_THERAPEUTIQUE', 'IMMUNOSUPPRESSEURS'),
  ('b6817835-d6ac-4198-a07e-4429392a5b36'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('cd00d218-afb8-454b-8d15-9f0a0bed6dd4'::uuid, 'ANATOMOPATHOLOGIE', 'DIAGNOSTIC'),
  ('6b2bc221-9192-4a75-a5f2-53241efc8c06'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('a3764320-797b-46ce-a21c-aecbdc95c744'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('7b624a38-d066-42be-a200-15fc5c51829d'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('0562d860-313f-4895-81f3-51d1de46d6e5'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('01778f2f-9115-4228-ab75-f08f6ab7fcc9'::uuid, 'INFECTIONS_MATERNELLES', 'TOXOPLASMOSE'),
  ('4d7a16f8-ae62-487a-bf5e-7bc0984280c2'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('ce200d54-9b1b-4874-a59b-0367f8c3dac5'::uuid, 'MUTATIONS_SOMATIQUES', 'MYELOME'),
  ('8c7fe549-6327-455a-bbc1-cc368996e0c4'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('af3d93d8-4638-430e-a12c-9acaf69f5ff6'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('bdc65269-5352-4cb1-ab1c-72bb1677c225'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('af54584b-88bd-44d5-8786-751deab518b3'::uuid, 'ALLERGOLOGIE', 'TRYPTASE'),
  ('11135721-ab74-4984-be02-15ae25675827'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('52b8895b-df6b-43d5-b1da-e853ec9542f6'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('b3773d5f-0d49-4370-b62d-340bdfdb00e5'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('ca4f259b-b7a9-490e-9d50-54ccea5483a5'::uuid, 'CYTOGENETIQUE_CONSTITUTIONNELLE', 'CARYOTYPE_SANG'),
  ('34c858bc-03f8-43ad-9bdf-c6f85f497fa7'::uuid, 'SUIVI_THERAPEUTIQUE', 'ANTIBIOTIQUES'),
  ('141025d7-cf0e-4f5c-be2b-84f340c0690d'::uuid, 'HERPESVIRIDAE', 'VZV'),
  ('15f4a026-a748-4169-ac06-10f4f75a3f49'::uuid, 'HERPESVIRIDAE', 'VZV'),
  ('6d208d37-b09e-4edb-92f7-6a067977371f'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('0e0e5287-77b7-4268-8803-13eba974044e'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('186720a3-ab93-4a7d-b834-30cf2418d920'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_HYDROSOLUBLES'),
  ('f88a3358-2c0e-4907-9ab2-786fd41f3609'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_HYDROSOLUBLES'),
  ('16edc08d-6a3b-460e-8482-0b6f952d7e1d'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_HYDROSOLUBLES'),
  ('962a9a2d-8434-4903-a4f2-1122cb82e038'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_LIPOSOLUBLES'),
  ('d9e030ab-a734-4b1e-8f49-63fafb7dcec3'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_LIPOSOLUBLES'),
  ('0ea9ef3b-cd07-4341-a3ab-49a1432bd522'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_HYDROSOLUBLES'),
  ('2ad31f3e-3dde-4aa3-a01c-0ad7dc77c2e0'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('6b0a6cfb-5efb-4866-af65-804417394cae'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('9bc5afb7-7264-4687-a62c-e37b8d77d6e4'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('09b1ca64-2cd9-4cfb-b63f-70e14d8bae90'::uuid, 'BACTERIENNES', 'BRUCELLOSE'),
  ('1c7af89c-7371-454e-ba51-7b49b10cc343'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('d9c5f047-0793-41cf-a950-ae86d58103fd'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('18ec608f-3a4a-4f3d-a5fd-f6f496b43ce6'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('da673e71-f1f1-477f-aefc-ae5272fe11aa'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('c6bec015-456b-423d-846d-b5ade1cf0a60'::uuid, 'MARQUEURS_TUMORAUX', 'AUTRES_MARQUEURS'),
  ('32250bb5-f4b0-4979-844d-68c006ad5641'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_PLEURO_PERITONEAUX'),
  ('0b49ffd2-1c1b-46e2-b963-b319518a943f'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('98f9c6f9-b33c-4546-9d5f-f3d2d1953a68'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('6e6802ac-ef1b-40b5-9bc2-ea8ac74ba035'::uuid, 'VITAMINES_OLIGOELEMENTS', 'OLIGOELEMENTS'),
  ('b9415cc0-cf94-49e3-ada0-82fb36e7ec97'::uuid, 'HEMOSTASE', 'TEMPS_GLOBAUX'),
  ('0bcff70c-6f5a-4c56-91ff-f3704f81b846'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'OSMOLALITE_DENSITE'),
  ('8ec90848-b99c-4c2a-88c5-62bd44d529ac'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('302ebd08-5962-4d3d-8bf1-c6c9b931c1f8'::uuid, 'IMMUNOMONITORING', 'IMMUNODEFICIENCES'),
  ('141f8f03-7f23-4611-a9b3-e327e9644776'::uuid, 'CNV', 'CNV_NGS'),
  ('7d6936b9-38ed-4913-8873-f1de05262a0b'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('3cc70ef2-2745-4280-b934-97b1e1ad25a0'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('6b817a39-764a-4673-8848-5e24ea2885df'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('ca2f7857-e915-4be9-987e-e888f9a46ea3'::uuid, 'CHARGES_VIRALES', 'EBV'),
  ('7a1b1764-b842-4252-bcf2-a5fa12c7d38b'::uuid, 'CHARGES_VIRALES', 'EBV'),
  ('ba9c6dde-8ab0-4820-b44c-7ff2d7fd6197'::uuid, 'CELLULES_SPECIALISEES', 'HEMOGLOBINOPATHIES'),
  ('6011a50d-12fd-4983-b924-27d8aef1c15f'::uuid, 'PROTEINES', 'EPP_SERUM'),
  ('05ff16cb-987b-4b04-83b0-7768a13bb951'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('2f170a0e-6ca3-4a32-b86f-be826c88ff36'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('0a7801c2-c9a1-473c-81d8-83ed3fd7eb9a'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('4036f5b6-515f-4631-bc3f-c5e67f434455'::uuid, 'PROTEINES_INFLAMMATION', 'METABOLISME_MARTIAL'),
  ('a7d19439-7bad-42a0-8589-1166693140f3'::uuid, 'CHIMIE_GENERALE', 'ELECTROLYTES'),
  ('e0177e36-cd68-4571-9665-f9f2cef90c06'::uuid, 'PROTEINES_INFLAMMATION', 'METABOLISME_MARTIAL'),
  ('bce90429-38a2-44f1-9777-fc1823e761c1'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('0da568be-8106-4a53-b6e9-90da29260f64'::uuid, 'HEMOSTASE', 'FIBRINOGENE_DDIMERS'),
  ('ea854c8e-7e65-45a6-a507-5a0cc8d92c25'::uuid, 'FONCTION_HEPATIQUE', 'SYNTHSE_HEPATIQUE'),
  ('1cd83f20-4348-4aba-88d6-b6e61564ac40'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('b65bd0ab-3ece-4dc4-9bdb-08113288a9bf'::uuid, 'CYTOGENETIQUE_CONSTITUTIONNELLE', 'CARYOTYPE_SANG'),
  ('2b3288a8-95b6-498d-a7ae-0e456960a2e7'::uuid, 'CYTOGENETIQUE_CONSTITUTIONNELLE', 'CARYOTYPE_SANG'),
  ('95a419dc-2c70-4c04-970d-3fd8675d5761'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('4ff39314-124f-4b46-a14d-6c4eec66a764'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('0167f918-b891-436d-ad76-86d80d2522ca'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('c8230ebe-d78b-4ce6-932b-5acf3ec8dace'::uuid, 'MYCOLOGIE', 'ANTIFONGIGRAMMES'),
  ('89b2b398-3389-49dc-9adc-fc24fd4622b4'::uuid, 'MYCOLOGIE', 'ANTIFONGIGRAMMES'),
  ('ac443783-1507-445c-b29e-4bd984d6653c'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('2c6dc601-8935-4982-af15-022b86dba35b'::uuid, 'HEMATIMETRIE', 'NUMERATION_FORMULE_SANGUINE'),
  ('5bc28620-8d81-44d7-af31-9f48100a2cd4'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('463a11ba-e032-4bbe-87d4-44822c35be26'::uuid, 'BACTERIENNES', 'SYPHILIS'),
  ('6a6ce6d8-69e5-4705-b0ab-0d41c2f7c810'::uuid, 'HEMOSTASE', 'FACTEURS_COAGULATION'),
  ('6f46bdd7-b7f2-45f5-b4c5-21b0fe1bbd97'::uuid, 'EQUILIBRE_ACIDO_BASIQUE', 'PH_HCO3_BASE_EXCESS'),
  ('ea0283e6-6738-4ab1-a714-856c14d6c4ec'::uuid, 'PARASITOLOGIE_CLINIQUE', 'HEMOPARASITES'),
  ('b12a6c09-740a-4028-9a3f-8306f54d4f99'::uuid, 'SUIVI_THERAPEUTIQUE', 'ANTIBIOTIQUES'),
  ('95f6cd25-ab2d-4dd0-b274-79385bc99188'::uuid, 'FONCTION_HEPATIQUE', 'CHOLESTASE'),
  ('a63872a4-1436-460d-8281-5ef425643bcc'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('06ee6867-9d53-4ebd-87a3-db9214363dcd'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('77ce5963-02a9-42c0-9721-1a306644991b'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('b035af04-0e8d-42c7-8795-70ff0481abd9'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('743e4eca-e5ad-4dfc-a0cb-7e794abcfc63'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('a3103026-c781-460b-96bd-efde13d54c7a'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('ec08a1f0-8a1a-426d-81ea-92d3c2a0630f'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('2d7730a7-e005-4fdb-9d1f-44eff60daea1'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('8fdb7912-73df-4f20-8b3f-b3f4d818f2f0'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('e69169fe-a1c3-483e-a42b-07192458405e'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('60a2c1f2-6cd2-4b1c-87aa-deec2ce0e19c'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('fb41c1d0-5e40-46bf-bc2f-9702753053c6'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('bdd94f76-d541-4df4-907b-d4358c31605e'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('ca85a7ab-2fe0-4a67-86f3-209ab10450a3'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('8276daa0-121e-498b-af17-da4bf1d10886'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('e186ce80-578c-4bb8-a597-df093ec8caad'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('bf63f869-409a-47be-8b01-61fdf19ed1bd'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('3c879ee4-0434-4256-b28b-904d91171d25'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('8eb0d240-a85c-467a-bffe-a347b2bdc2c2'::uuid, 'FONCTION_HEPATIQUE', 'CYTOLYSE'),
  ('b4895d8d-6d00-4995-bfc6-0e8c9a2c0d0b'::uuid, 'FONCTION_HEPATIQUE', 'CYTOLYSE'),
  ('b842a58f-8e70-4742-bc76-ceef2dd63e34'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('3c2ef741-2296-47b4-b9d9-991329b0d140'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('67be4984-834c-4029-b89e-01c426909a5b'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'HEPATITES_AUTOIMMUNES'),
  ('00366e9b-5a94-4ef5-98a2-97152dbe87f9'::uuid, 'PROTEINES_INFLAMMATION', 'INFLAMMATION'),
  ('b34b5411-7ede-41be-bf5a-42a7c59db809'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('c1c5de60-5f8a-4670-a1b3-ee2483b973f9'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_B'),
  ('1e27d98c-44a8-43a9-965f-0152a92f90bf'::uuid, 'METABOLISME_GLUCIDIQUE', 'HEMOGLOBINE_GLYQUEE'),
  ('fd5ec3d9-1d82-4801-9569-2b4c4ada7eb3'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('b0272618-bff3-406e-8137-553a4c06e93f'::uuid, 'GENOTYPAGE_RESISTANCE', 'VHB'),
  ('9fab283b-1122-4273-98c3-d0312baa92ee'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('626326cf-d591-46c5-ac14-ac9daca7d0bc'::uuid, 'PCR_VIRALES', 'HEPATITES'),
  ('07de12ce-bd91-4e74-ac29-3c4188fda483'::uuid, 'BILAN_LIPIDIQUE', 'CHOLESTEROL'),
  ('87be49e8-eca0-4630-95a0-5a996e12a17e'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('c44516b2-59ba-45a8-80fc-1625274e1596'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('333b4d60-bf79-43b9-9683-e59c7261ac40'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('fa27fff6-0f46-40cd-8248-083be2053d97'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('e29957aa-6620-4f69-84da-179f290cde70'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('94aa58e7-981e-40fd-a59b-7b535ed1d8c1'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('67dacb33-7ce4-468f-9dbb-92e5f5606f1c'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('1b5c7581-3911-4004-a431-03fae4926da9'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('fad19de9-4ff2-4915-af4f-b2fb44dd37b0'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('e4e8cee3-3ba1-4849-9621-e115147c40a6'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('e7dbf0fc-7127-4ec5-ab79-9f101accfe14'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('3f583ab4-81c9-4495-8dfd-77de77571aa4'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('71ac84a8-871e-41f5-828d-111a601a3398'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('7a892c35-3ad4-4739-bb16-025fbd7c3392'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('87a11797-555e-4895-bfe2-22a3dfa7c9cd'::uuid, 'BACTERIOLOGIE', 'HEMOCULTURES'),
  ('edd74600-da44-4904-a0d8-c52f6a3fe4e4'::uuid, 'HERPESVIRIDAE', 'HSV'),
  ('9391b557-9375-4367-8311-9cc2931f9745'::uuid, 'PCR_VIRALES', 'HERPESVIRIDAE'),
  ('513ef073-8949-4d46-876c-43ee6e87ef00'::uuid, 'HERPESVIRIDAE', 'HSV'),
  ('0b7bb607-8244-414f-8eee-1f39404cdcea'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('1e631f85-5f40-419e-a195-1959e3feadae'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('77d0c838-66f5-408a-bc75-20494d9bfdea'::uuid, 'GENOTYPAGE_RESISTANCE', 'VIH'),
  ('0b29e7f0-af48-4c58-946a-514779795205'::uuid, 'GENOTYPAGE_RESISTANCE', 'VIH'),
  ('c36ada5a-3a00-46f4-97eb-9eaff364e237'::uuid, 'TYPAGE_HLA', 'CLASSE_I'),
  ('ba00834d-355b-4c78-aa20-637e42c73ffc'::uuid, 'TYPAGE_HLA', 'CLASSE_I'),
  ('a7c23033-67f9-4c22-951f-82a7a231f9ec'::uuid, 'TYPAGE_HLA', 'CLASSE_I'),
  ('92fa7298-a220-4195-bd5e-d631d06a45dd'::uuid, 'TYPAGE_HLA', 'CLASSE_I'),
  ('5659e189-a9d9-408e-a52d-b93f2e5e7b70'::uuid, 'TYPAGE_HLA', 'CLASSE_I'),
  ('30c5bbf7-cbd7-457d-93da-350352ad1d1d'::uuid, 'TYPAGE_HLA', 'CLASSE_II'),
  ('b2f441dd-7952-4477-af23-1780d53518b1'::uuid, 'TYPAGE_HLA', 'CLASSE_II'),
  ('815debfb-d1e3-4415-a53a-5723099ed304'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('ab0883f5-38e7-4b1b-a4a6-d25e3eabe76f'::uuid, 'TYPAGE_HLA', 'CLASSE_II'),
  ('d7798ba7-5909-4ad3-be99-036dcb2d3705'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('fdef6698-cc94-48e9-bc18-6da8eb37f88a'::uuid, 'FONCTION_RENALE', 'AZOTEMIE'),
  ('b955cca8-80ba-44c2-ab37-3e2a772bae8c'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('5a898d70-3da6-4959-8b54-c0b84de2d252'::uuid, 'VIH_RETROVIRUS', 'HTLV'),
  ('d263cbac-e2d9-425f-a143-1712f7afe52f'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('efa81de1-7272-49df-a272-4e7562b869a1'::uuid, 'HEPATITES_VIRALES', 'HEPATITE_C'),
  ('7c4d5217-11bc-4809-ad6e-b98b5aa23aac'::uuid, 'PARASITAIRES', 'ECHINOCOCCOSE'),
  ('2d73f2c2-4146-4099-b266-e6a72dac4d14'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('c5ef69f9-4d13-4ae5-9faa-18508a5c7f66'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('f44cb678-8a84-4b07-ab62-906367406bfc'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('f949b0cb-2f61-4ada-b682-d2535baa3b05'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('4cae8bdf-f8b7-4103-8863-beb89495b019'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('cfdac6ff-38c3-4d60-8ec5-f2179c588dbb'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('432b31e7-62d5-47e8-916e-1745f9989c8b'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('1bbc349f-27d7-4655-ac25-5d6a56aafab2'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('bd7b024a-8b10-420f-9019-035525435781'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('c3bd7400-ad5d-42a5-aa2a-96752fc5e4b1'::uuid, 'PRELEVEMENTS_SPECIFIQUES', 'SURFACES_HYGIENE'),
  ('284b970a-66fa-4266-9ac3-9c6273e8a7f5'::uuid, 'PROTEINES_INFLAMMATION', 'METABOLISME_MARTIAL'),
  ('985f2d94-7827-46df-b312-f5eeea84bba4'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('a60aff98-3e85-46ca-814a-6f97dae4b3f8'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('40690799-5cca-4567-b86a-02acdece1baf'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('dbacf55c-4b9a-4a6c-be34-85bb5274c98f'::uuid, 'IMMUNOFIXATION', 'SERUM'),
  ('74fd5a8c-b3c8-4fd4-b959-d08467815e6f'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('c7f3e0f2-f932-49c1-82de-ed2b9187c410'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('654ff6a1-254f-4ab9-a570-7ffbfccefcc4'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'MALADIE_COELIAQUE'),
  ('e2c382df-6387-49ca-b364-65e920e6f124'::uuid, 'ALLERGOLOGIE', 'IGE_TOTALES'),
  ('d74b1a27-6cfc-4648-b232-90469c3b1770'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('e64fb1e7-108b-4f95-b77c-24cc85a64821'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('9540689b-2d84-45cc-9e6f-c5397355fb72'::uuid, 'ALLERGOLOGIE', 'IGE_SPECIFIQUES'),
  ('3d8d3d1c-b472-4267-bb15-65a2701b8b4f'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'HYPOPHYSE'),
  ('ec5afe68-9cbe-43c4-8384-7cdb9cf20ad0'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('6e7fbeef-1a4c-42c8-a7c9-293615f732d0'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('87659e4e-6bb2-433b-8adf-446f3f08327b'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('c295e739-3c86-4f81-bf28-340fed5222f0'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'MALADIE_COELIAQUE'),
  ('f3a7b605-ac94-4fba-98ec-f4a7eadcbc7b'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('7c5ecace-6332-4544-9825-0443eaa9ebfd'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('4d2bf2cd-6d7b-4f06-ae90-e0ed661238c5'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('58ee22ca-56c7-4e0a-9169-1735daa189be'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('a25ba422-fe43-4dda-8774-377a2336e1d9'::uuid, 'PROTEINES_INFLAMMATION', 'INFLAMMATION'),
  ('86a04965-764a-4f92-98d8-2f40f2f3051e'::uuid, 'IMMUNOPHENOTYPAGE_HEMATO', 'LEUCEMIES_AIGUES'),
  ('9f386309-e3cd-47b6-9200-a04dadd64787'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('d354b374-4f2c-4852-ae88-d7c43eb9878c'::uuid, 'METABOLISME_GLUCIDIQUE', 'HORMONES_PANCREATIQUES'),
  ('bc53a5b4-d5d0-45f2-a489-ccd994b05efe'::uuid, 'METABOLISME_GLUCIDIQUE', 'HORMONES_PANCREATIQUES'),
  ('8bfa961a-f1f4-4824-b074-3379bf53e835'::uuid, 'VITAMINES_OLIGOELEMENTS', 'OLIGOELEMENTS'),
  ('7e47bd94-aed1-4b7f-96d7-99eac1fd76e0'::uuid, 'CHIMIE_GENERALE', 'ELECTROLYTES'),
  ('7ac84a3d-7abf-42d6-bc2b-baebe764765e'::uuid, 'CHIMIE_GENERALE', 'ELECTROLYTES'),
  ('73993775-436c-4711-ae83-f5949583526d'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('9a098377-c0e8-48d7-a960-2be756f1761d'::uuid, 'IMMUNOPHENOTYPAGE_HEMATO', 'LEUCEMIES_AIGUES'),
  ('eb9a8ebb-b5d9-4e88-8612-d6b31713da40'::uuid, 'BACTERIOLOGIE', 'LCR'),
  ('1e231bf4-6fe9-41a7-a3e3-f12ab8c2d50f'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('6769b229-3c1f-4db5-b469-ce6dbd53108a'::uuid, 'CHIMIE_GENERALE', 'ELECTROLYTES'),
  ('cbd1d95e-755e-4c2c-8b3b-b851493aeca9'::uuid, 'IMMUNOCHIMIE', 'CHAINES_LEGERES_LIBRES'),
  ('c859068c-3178-4d72-ab32-fb50d509556e'::uuid, 'IMMUNOCHIMIE', 'CHAINES_LEGERES_LIBRES'),
  ('d3332e7c-0e65-4fc6-9a09-b3515e7513ee'::uuid, 'PARASITOLOGIE_CLINIQUE', 'PARASITES_DIGESTIFS'),
  ('33100712-1be6-4c73-8644-db766de4f18b'::uuid, 'PARASITOLOGIE_CLINIQUE', 'PARASITES_DIGESTIFS'),
  ('fd4d0a0a-7a68-42c5-8c9c-d7445c2ff6e8'::uuid, 'PARASITOLOGIE_CLINIQUE', 'PARASITES_DIGESTIFS'),
  ('5f8711d2-6e47-4cba-ba2c-a591ea63fded'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'ELECTROLYTES_URINAIRES'),
  ('6464ee3c-090e-4dc9-9299-61d2fad9f7df'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('76c4fa6e-ae2e-4473-a4b0-8b4a8aab7e8d'::uuid, 'CHIMIE_GENERALE', 'LACTATE'),
  ('02374fd0-e8f0-43d3-8ca8-fb6dd8571bfa'::uuid, 'IMMUNOCHIMIE', 'CHAINES_LEGERES_LIBRES'),
  ('d4ff696a-e8eb-4b00-a56d-b7427e971680'::uuid, 'IMMUNOCHIMIE', 'CHAINES_LEGERES_LIBRES'),
  ('ac87802c-0d5c-49de-a8e5-17fda7e10efe'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_RESPIRATOIRES'),
  ('a28ad9e3-e970-4e54-971e-82718272d3c8'::uuid, 'BACTERIENNES', 'BORRELIOSE'),
  ('ae618a0f-6882-43ef-9679-fd4f14aa0298'::uuid, 'CHIMIE_GENERALE', 'LACTATE'),
  ('d2af1ee5-65fd-451b-b2f7-e186764ff42f'::uuid, 'ENZYMOLOGIE', 'ENZYMES_TISSULAIRES'),
  ('3a218557-1dc1-4db5-8034-6dd03b027f40'::uuid, 'CHIMIE_GENERALE', 'LACTATE'),
  ('c205ff78-f1f8-4116-b2d3-604767ddc6de'::uuid, 'BILAN_LIPIDIQUE', 'CHOLESTEROL'),
  ('b37ac7a6-00c0-4ecc-80ef-e6d84615f35f'::uuid, 'BILAN_LIPIDIQUE', 'CHOLESTEROL'),
  ('ebeae68f-c825-46a7-9174-50a08b83c47f'::uuid, 'TOXICOLOGIE_D_URGENCE', 'ALCOOLS'),
  ('5152032a-659e-41d9-baaf-6c5ea4e5bae9'::uuid, 'PARASITOLOGIE_CLINIQUE', 'PARASITES_TISSULAIRES'),
  ('accaadd3-7cf3-4e63-9197-545dea6ba94f'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('57c0b9fd-9529-4da8-b32a-4e72fe90d45b'::uuid, 'ENZYMOLOGIE', 'ENZYMES_PANCREATIQUES'),
  ('cb24cc28-7183-4fc3-bb72-e54abde4eaa2'::uuid, 'ENZYMOLOGIE', 'ENZYMES_PANCREATIQUES'),
  ('d91263bf-d3f4-40d2-affe-6ac18f1173fc'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('db8a1036-ceab-48da-800d-483c7688e6a3'::uuid, 'AUTOIMMUNITE_ORGANE_SPECIFIQUE', 'HEPATITES_AUTOIMMUNES'),
  ('20c0c303-b8a4-48bc-b96f-73fdd84344bb'::uuid, 'MARQUEURS_CARDIAQUES', 'RISQUE_CARDIOVASCULAIRE'),
  ('b4b17c21-f671-4d71-98a7-c168c9743ca0'::uuid, 'METABOLISME_GLUCIDIQUE', 'HORMONES_PANCREATIQUES'),
  ('e1497daf-6f5a-4448-8d98-042cdf341fa4'::uuid, 'ANTICORPS_ANTI_HLA', 'IDENTIFICATION'),
  ('df64c8cf-b261-4a03-8a51-f03240677b9f'::uuid, 'ANTICORPS_ANTI_HLA', 'IDENTIFICATION'),
  ('dee93d1f-3f00-4fed-8f47-811187a5b050'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('9b52dd0d-0067-49be-8fff-758551225155'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('86d9ec44-2eed-4d77-bf3d-4c5f167eeafa'::uuid, 'BACTERIENNES', 'BORRELIOSE'),
  ('50a0c137-02e9-4e1e-b6d3-dccb39cc26dc'::uuid, 'BACTERIENNES', 'BORRELIOSE'),
  ('6c2976c6-bab7-4f51-8807-73d167911670'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('b2e214d8-6a0a-4221-99c5-bbbef224e004'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('50389e35-28f7-4029-8279-b58b68a686ad'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('af9dd5cd-406e-43a3-9797-f37fb238a54b'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('6e36f434-d4a0-478a-848e-8e0076aa61b1'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('acb1424d-160f-4ef0-9435-b2971aa716d9'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('34846661-23f0-4244-8e9c-6a861573c9d8'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('c480d7a5-5c53-4f10-b7ed-b807615829ee'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('2d23c8d6-eba1-4891-9a4c-7653f3093077'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('512a9555-a915-4dd6-aa51-0642644eb38e'::uuid, 'GENES_MONOGENIQUES', 'SANGER'),
  ('af440263-ef7d-486e-b35c-f63c6b0658ab'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'MAGNESIUM'),
  ('5a9b54a8-898a-46a4-a207-20aa8c5e6700'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'MAGNESIUM'),
  ('a470f3b7-9a80-44f9-ad82-33826e9f09f7'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'ELECTROLYTES_URINAIRES'),
  ('9484c6a9-db47-4c84-8cb4-18902d5875e1'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('91b50ab9-2409-4831-a06c-7d31b79e2283'::uuid, 'RAPPORTS_URINAIRES', 'ALBUMINE_CREATININE'),
  ('b0f6eb79-77e7-4e03-8f66-fdefc4f399c3'::uuid, 'CYTOGENETIQUE_HEMATO', 'CARYOTYPE_MOELLE'),
  ('b1bfaf43-4bf4-47c4-bc7b-f45739b68037'::uuid, 'CYTOGENETIQUE_HEMATO', 'CARYOTYPE_MOELLE'),
  ('9a26f34b-c138-4254-bf0e-063dce102bbf'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('69a65120-322b-4e3d-9e46-40b22269c2f8'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'VASCULARITES_ANCA'),
  ('3a2d6440-06e7-438d-a92a-3e1bc324f6ea'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('f5716067-cea9-4b26-97e2-c458115583cc'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('ad573e4f-43c6-44d4-a608-dd1258b7627e'::uuid, 'MYCOLOGIE_CLINIQUE', 'MYCOSES_PROFONDES'),
  ('25eb7cda-5c44-49ef-bf89-900bfab07148'::uuid, 'MYCOLOGIE_CLINIQUE', 'MYCOSES_PROFONDES'),
  ('41ea8070-6e4d-4167-8ee7-c135dc23a0d0'::uuid, 'MYCOLOGIE_CLINIQUE', 'MYCOSES_PROFONDES'),
  ('3d33c656-233f-4b6c-9677-c31b5ea76e94'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('98202a5e-8367-461e-ab0d-50d4429328e2'::uuid, 'MYCOLOGIE_CLINIQUE', 'MYCOSES_PROFONDES'),
  ('fead6e0d-82a2-45ec-ab41-c93c793e34a8'::uuid, 'MYCOLOGIE_CLINIQUE', 'MYCOSES_PROFONDES'),
  ('7650e62d-de98-401c-a551-92e1e2bc01e7'::uuid, 'MYCOLOGIE_CLINIQUE', 'MYCOSES_PROFONDES'),
  ('4e4bc2da-ba89-4678-b327-4a7116c21547'::uuid, 'CELLULES_SPECIALISEES', 'CELLULES_NUCLEEES'),
  ('a2e1e907-2724-4417-950c-20e7222c9ec5'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('c6ce72c0-873b-45f1-b5c6-c5ffb479a3bc'::uuid, 'MARQUEURS_CARDIAQUES', 'NECROSE_MYOCARDIQUE'),
  ('797b7a68-058c-411a-8d73-963cd0f67d81'::uuid, 'CHIMIE_GENERALE', 'ELECTROLYTES'),
  ('0fe970b9-b021-4c70-a4cd-37bcc8a5efac'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'ELECTROLYTES_URINAIRES'),
  ('29c5dc9b-9354-4681-8934-4ea05e54f9ac'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('d125fd4d-5d9c-4298-8057-2f0661929b0f'::uuid, 'HEMATIMETRIE', 'NUMERATION_FORMULE_SANGUINE'),
  ('b3043e38-9137-44e7-bec8-02e9acc72589'::uuid, 'HEMATIMETRIE', 'NUMERATION_FORMULE_SANGUINE'),
  ('d26bbdbe-b24c-4ef4-8e8e-8ed835243043'::uuid, 'HEMATIMETRIE', 'NUMERATION_FORMULE_SANGUINE'),
  ('15ea20d7-78e1-4237-9169-52753934ab0f'::uuid, 'HEMATIMETRIE', 'NUMERATION_FORMULE_SANGUINE'),
  ('f95f65e4-eb8c-428d-9596-7a639c1e20ad'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('eacb05a2-85f2-434c-85f3-0016cb854faa'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('0a087a20-fa71-46e6-99f9-a792f118dc7d'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('0d40d4df-ee99-4c7a-9ef5-593101408db9'::uuid, 'MUTATIONS_SOMATIQUES', 'JAK2_CALR_MPL'),
  ('c1373807-c0e8-4e97-bb97-90e9cfcc5eb0'::uuid, 'ADDICTOLOGIE_BIOLOGIQUE', 'OPIACES'),
  ('90296e22-5486-4020-8f97-356d961256a5'::uuid, 'ADDICTOLOGIE_BIOLOGIQUE', 'OPIACES'),
  ('c247c13b-893f-4706-833d-8ceb16143f4c'::uuid, 'PROTEINES_INFLAMMATION', 'INFLAMMATION'),
  ('6c00fd6e-904e-47b4-a216-4adc982cb0df'::uuid, 'CHIMIE_GENERALE', 'OSMOLALITE'),
  ('40da893f-8479-4ca5-bd17-61162d3c0e27'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'OSMOLALITE_DENSITE'),
  ('67cf35a2-bd4f-4520-acd7-44f82f8ab89a'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PTH_VITAMINE_D'),
  ('b84328dd-4f8e-4e76-b276-c94418c9d025'::uuid, 'METABOLISME_GLUCIDIQUE', 'GLYCEMIE'),
  ('cf5149d0-fda2-46de-8faf-d28386342fa2'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('783153a2-f02d-44f5-b4a9-a5cf7566e963'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('97beccfc-53a5-4a72-89cc-9b2b9d9fc47f'::uuid, 'PARASITOLOGIE_CLINIQUE', 'PARASITES_TISSULAIRES'),
  ('8b8d6368-f927-449e-8ad4-a114987ac4f8'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('3091371f-cddc-42f7-aa7d-ba150eb3e4a8'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('7ad5b133-9639-4060-88f6-4cafc35bc2d8'::uuid, 'PROTEINES', 'EPP_URINES'),
  ('0b1c0677-5eda-4d57-9cf9-d8bc3e58c889'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('df18b6e0-2692-4adb-b2e7-2c6c0abefae1'::uuid, 'MARQUEURS_TUMORAUX', 'UROLOGIQUES'),
  ('de3bb851-c7c3-4e14-a4df-158a0cb66ca4'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('d33e20d5-8409-4f06-a7cb-281bd3225d3b'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('bddc9bc4-cd6e-4ec1-b205-5ab2e0c3992e'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('9bdd6e90-7cb6-4c14-9b66-d8fdfa72f28e'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('126ebc92-3b11-4adb-9576-6fe42899ea8a'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('24a30580-de37-41ff-af11-5eada9af5544'::uuid, 'ANATOMOPATHOLOGIE', 'COMPLEMENTAIRE'),
  ('67e30d1a-faa2-4038-a37a-d43d0d380b89'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_RESPIRATOIRES'),
  ('51fd34f8-08ba-4c96-b406-8cddd31ab44c'::uuid, 'IMMUNOMONITORING', 'IMMUNODEFICIENCES'),
  ('024b6467-fbbf-49c3-8777-4015c8d17de9'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('aabf24ab-cddc-4e76-9c60-96cc036bbb50'::uuid, 'FONCTION_HEPATIQUE', 'CHOLESTASE'),
  ('edb9ce9f-28b7-4ff6-a120-84dfcffc4448'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('41f1320c-0b16-4812-808b-3739716318d0'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('0c4c16ac-eebc-408b-8f6d-4bfdc0fe22f0'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PHOSPHORE'),
  ('19ce7224-0b27-4f29-a7af-d432c18364f1'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PHOSPHORE'),
  ('a37016b8-e0ea-4759-b6b8-581c66a4a4ef'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PHOSPHORE'),
  ('0d3f4228-ad65-449f-adbc-a6e0b899d572'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PHOSPHORE'),
  ('80c578b6-0f79-44b2-9f9e-9cd08ee27d2b'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PHOSPHORE'),
  ('8c7a5e86-c3fe-4f88-a762-a0fd8a5203f9'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'ELECTROLYTES_URINAIRES'),
  ('f2246cec-6727-4005-a021-47f710689e1e'::uuid, 'RECUEILS_24H', 'IONS_24H'),
  ('b010c22c-4658-4130-b456-8727bdddc6ca'::uuid, 'RECUEILS_24H', 'IONS_24H'),
  ('ec0096d6-8fb8-442f-8a57-a1b214eb660c'::uuid, 'RECUEILS_24H', 'IONS_24H'),
  ('24e9d4ba-2298-4d71-973f-6e33dc7082df'::uuid, 'RECUEILS_24H', 'IONS_24H'),
  ('55c99b53-3494-4c84-a471-9c93126bae1a'::uuid, 'IMMUNOFIXATION', 'URINES'),
  ('3afd157e-dc04-439d-b65e-1c6cc13804a7'::uuid, 'HEMATIMETRIE', 'NUMERATION_FORMULE_SANGUINE'),
  ('36e3cfc6-d2fd-4dd5-8131-97e9c7d71ac7'::uuid, 'IMMUNOCHIMIE', 'IMMUNOGLOBULINES'),
  ('f8233618-6d43-4535-b003-be7772aee7db'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('45209902-e5af-4517-813c-da3cc978210f'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('9244981c-5d6e-4db1-bc48-3c3fe760d1f3'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('9c9d63b0-f6b4-41a8-8147-a80516383907'::uuid, 'BACTERIOLOGIE', 'LCR'),
  ('7cc55526-883f-4ed3-b7d9-cc14710b033a'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('1bfdb417-c837-4f27-9e48-432fc8ffbff1'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('8e2e3fa8-5103-48db-88b9-d764ec4d21a2'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'VASCULARITES_ANCA'),
  ('274beb70-d9f7-43b8-b242-16004f2a7a21'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'HYPOPHYSE'),
  ('79820776-ed38-4003-9846-ee87231296f4'::uuid, 'PROTEINES_INFLAMMATION', 'INFLAMMATION'),
  ('f246f30f-8bce-494d-8ba9-6168ceb8ecaf'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('b042c698-ad63-440d-aaf3-0f715f0c77f5'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'PROTEINES_URINAIRES'),
  ('dba87dfb-d1d9-409a-b068-e7a49e4996c5'::uuid, 'MARQUEURS_TUMORAUX', 'UROLOGIQUES'),
  ('b57268e2-33ad-40ad-90b5-4022d0ad8a33'::uuid, 'MARQUEURS_TUMORAUX', 'UROLOGIQUES'),
  ('9fa5d274-d416-4c55-aa39-b6708c8744ba'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('c4efab89-b101-49b2-a6d4-be7d5de8c5d8'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('05653f7a-3115-47cb-a01c-5df3e79c005b'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PTH_VITAMINE_D'),
  ('e1887324-f110-49de-b037-6b41f0cafa77'::uuid, 'METABOLISME_PHOSPHOCALCIQUE', 'PTH_VITAMINE_D'),
  ('d3e4d823-fecf-42f5-833e-ee43e1cc5346'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('b0247a08-e9c9-42fe-907c-2a051a170b05'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('cb2b2dc9-5b3b-4034-9848-9c2706b6a00e'::uuid, 'RAPPORTS_URINAIRES', 'ALBUMINE_CREATININE'),
  ('50ffed9d-4380-4fdf-9353-c116a3db7e60'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('48d10938-5cee-404c-a20b-b5bb72b415b0'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('1f38b315-4abd-4ee8-be77-60dd647471b0'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_GENITAUX'),
  ('4644be0c-5055-4e3a-86b9-b589a15c0244'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('55b5127e-0a5c-4005-af5c-cd3b38ab8f9d'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('658564a9-1582-456e-b34c-b19cac92abb8'::uuid, 'CHIMIE_GENERALE', 'ELECTROLYTES'),
  ('9f95f567-916a-4f59-b8ad-3cf4068300b2'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('a665980a-b5c4-4d94-864b-4c6c06f3624a'::uuid, 'RAPPORTS_URINAIRES', 'ALBUMINE_CREATININE'),
  ('4c22c40f-a35c-4783-ae4f-ea275542d575'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'PROTEINES_URINAIRES'),
  ('1711c9f0-738b-4368-af61-21ab380147bc'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('dee09245-9afd-4760-a48a-be8b58fc170e'::uuid, 'HEMATIMETRIE', 'NUMERATION_FORMULE_SANGUINE'),
  ('c1645031-5b96-4ff7-8099-3a217febf6e8'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('e60fe87a-10a6-4bf8-a191-2bca3987e9e6'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('b965c7a3-3219-4982-a6c8-0f24087be4e2'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('ce358430-fcb9-40d1-9110-8d176834f987'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('53526da1-df08-49a6-a9cc-cd7fc9739962'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('c316b7f1-0fb8-4855-9d3b-e7b283791d37'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('2a52bf6f-15a3-4d4e-baa7-819bd0a5a50f'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('48c753a3-44d5-4325-975b-2ce481ed903f'::uuid, 'INFECTIONS_MATERNELLES', 'RUBEOLLE'),
  ('b9acc0b9-3cec-4e4f-8669-9213de346f66'::uuid, 'INFECTIONS_MATERNELLES', 'RUBEOLLE'),
  ('da3fc0d3-7366-4fda-87d5-4d23a134b14b'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('e9e6114b-a5f7-4440-82f6-762133eec348'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('2b103b41-876a-409b-80ee-7841edae271e'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('0eb410b7-a321-46ec-8386-db57fff13430'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('cdd8872a-0d3f-4411-aab3-64a90f9f5798'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('7405723e-399c-43b4-aa37-2f5d9d15bd18'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('6ee05fad-886e-4742-adcc-94585d04a3b6'::uuid, 'MARQUEURS_TUMORAUX', 'AUTRES_MARQUEURS'),
  ('2f0993c2-7dfe-4a1f-a50a-0679195daff4'::uuid, 'AUTOIMMUNITE_SYSTEMIQUE', 'ANA_ENA'),
  ('33668dad-c623-471b-a612-b2338a5f975e'::uuid, 'PARASITOLOGIE_CLINIQUE', 'PARASITES_DIGESTIFS'),
  ('1179045f-bf9d-47c2-8ddb-e9b7d810c82f'::uuid, 'PARASITOLOGIE_CLINIQUE', 'PARASITES_DIGESTIFS'),
  ('b9a7234d-8215-4643-a5c8-dae1c30b565f'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('4ef1a645-4242-46ae-a674-dbcfdba5cca6'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('795af25d-fe7f-41c3-9b53-2c6316254752'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('256b7de1-3b06-4bd1-a95f-3896c36c5456'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'SURRENALES'),
  ('fbd71bca-5f97-44df-a11f-ca1daeb7216d'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('359a5dc4-4aaf-499b-be91-485d5b2347f5'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('4ed8eaaa-2767-42a8-bcb7-4bceafc97853'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('cff6c70f-e940-45e7-aea6-55f9fb69413c'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('4e6f3be6-a01a-4d0d-89fa-85a534185c9d'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('9fd275a9-b1c7-4346-85d8-4b6e487d0e18'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('c8017707-f065-498d-9754-dd81a1be6160'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_GENITAUX'),
  ('2ef7956d-396c-4c83-8d81-65b97d727c12'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_GENITAUX'),
  ('886faec7-b935-454b-a4de-31dbd9176758'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_GENITAUX'),
  ('0ca9a901-3cb1-4c36-be1f-fa386af2cade'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('dde2a219-9961-4a46-b8d1-ddd2bf14a9da'::uuid, 'GENES_MONOGENIQUES', 'NGS_CIBLE'),
  ('7de97bb9-33fd-4ab7-b2cb-4e358dcb5e9f'::uuid, 'BACTERIENNES', 'SYPHILIS'),
  ('befcc4c5-c6ad-448b-b9d2-dfa2c042c675'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'THYROIDE'),
  ('a9ea5dcf-1d3b-4540-bbae-92b94f118a0f'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'THYROIDE'),
  ('b09acac3-e8cc-4a48-9281-69f79950354d'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('ac11daf6-d76b-4e28-8b98-4032a7301f6e'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('d723ce80-a769-48f7-b75c-0f768f22ca23'::uuid, 'IMMUNOMONITORING', 'SOUS_POPULATIONS_LYMPHOCYTAIRES'),
  ('36cc2edf-0b4a-4312-95f9-9472c8710988'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('cf951606-b150-40ba-9b64-d66c2ad7c1ff'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'GONADES'),
  ('cef27454-20e3-49c2-9d5e-ee88fb882f3b'::uuid, 'BILAN_LIPIDIQUE', 'TRIGLYCERIDES'),
  ('a079ae11-5484-4fd1-8ee3-e8d4ee677a9f'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'THYROIDE'),
  ('b35229ff-91d4-486f-9c68-0da691c06087'::uuid, 'TOXICOLOGIE_D_URGENCE', 'DROGUES_ABUS'),
  ('4b6501ab-80f8-4e78-b9ad-1998162eb271'::uuid, 'INFECTIONS_MATERNELLES', 'TOXOPLASMOSE'),
  ('96910bc8-4e8a-43ed-941a-5c5963aaa5a6'::uuid, 'INFECTIONS_MATERNELLES', 'TOXOPLASMOSE'),
  ('34678f82-6b6c-497e-90f2-21d2e932045c'::uuid, 'HEMOSTASE', 'TEMPS_GLOBAUX'),
  ('4d015785-4b5e-4ab3-acac-efb359e70b64'::uuid, 'HEMOSTASE', 'TEMPS_GLOBAUX'),
  ('c3aaf13a-9d53-4bb6-8b3a-0d2890312297'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('b61c32e0-3493-4e0e-aaef-0c144dea7c24'::uuid, 'BACTERIENNES', 'SYPHILIS'),
  ('bf07fc7e-1526-44cc-949b-ff0bcded3eb8'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('0593b4f8-a11a-4d82-93cd-30eb823f8b1a'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'THYROIDE'),
  ('033cd28a-37a8-4ace-92cc-3946554ec228'::uuid, 'PROTEINES_INFLAMMATION', 'METABOLISME_MARTIAL'),
  ('b40c3713-785e-465d-9711-8995cf2e116b'::uuid, 'PROTEINES_INFLAMMATION', 'METABOLISME_MARTIAL'),
  ('dfe5ed0b-8aca-4af6-a3b4-e3708f286ed0'::uuid, 'CYTOGENETIQUE_CONSTITUTIONNELLE', 'CARYOTYPE_SANG'),
  ('9bb89bdc-5f19-40ac-a689-f00040b0a188'::uuid, 'BILAN_LIPIDIQUE', 'TRIGLYCERIDES'),
  ('bdaed6f5-99a9-4522-b2ef-9424d94b7122'::uuid, 'MARQUEURS_CARDIAQUES', 'NECROSE_MYOCARDIQUE'),
  ('c8398c05-0373-4c45-b778-19b99677ed91'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('0bfd10de-abeb-4886-a4c5-b17dc1596411'::uuid, 'ENDOCRINOLOGIE_HORMONOLOGIE', 'THYROIDE'),
  ('cebd1f39-dc42-44ad-b9d8-8cf320e2174e'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('073354ba-1107-4ce1-953b-9a8e28e4cdf8'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('bb8f092a-7f29-4bbb-8d7d-6a6a86abfb46'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('5400cf65-c5c6-4e6f-8f7e-b6e1303e3e07'::uuid, 'FONCTION_RENALE', 'AZOTEMIE'),
  ('32d607d7-3e90-4e6e-b0df-8ea4d1ec3821'::uuid, 'FONCTION_RENALE', 'AZOTEMIE'),
  ('7db5dc17-3a2e-4703-a986-0fff59dd1603'::uuid, 'CHIMIE_URINAIRE_GENERALE', 'AZOTE_URINAIRE'),
  ('7b2340ad-581e-4d34-b997-18f4a858dcf9'::uuid, 'RECUEILS_24H', 'PROTEINES_24H'),
  ('e660295f-de01-468f-b6fc-d3b7fecefc01'::uuid, 'SUIVI_THERAPEUTIQUE', 'ANTI_EPILEPTIQUES'),
  ('4b0eab11-ac82-47fe-bca2-45addfa10c35'::uuid, 'BACTERIENNES', 'SYPHILIS'),
  ('cca06662-d788-4fa6-aa83-e1140038c31c'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('67e816db-a953-480f-8bc3-7eb4499ead83'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_LIPOSOLUBLES'),
  ('dde4dd01-8ca7-4509-8362-4af6e2027d21'::uuid, 'VITAMINES_OLIGOELEMENTS', 'VITAMINES_HYDROSOLUBLES'),
  ('e9819ec8-4321-4cc2-b930-32b2b1b457c1'::uuid, 'PROTEINES_INFLAMMATION', 'PROTEINES_SERIQUES'),
  ('a7a30467-b933-4dd7-865c-2f2f4589f13e'::uuid, 'BILAN_LIPIDIQUE', 'CHOLESTEROL'),
  ('5268395f-7ac0-4a51-9c53-659b6c563e40'::uuid, 'FISH', 'HEMATOLOGIE'),
  ('d24d8f7a-9f94-41de-ab47-5d831fff3e29'::uuid, 'BACTERIOLOGIE', 'PRELEVEMENTS_CUTANES'),
  ('7e531776-f195-4292-97bf-d7345503b0d6'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('c7b337c6-982a-4933-bc83-2b03fae5a4c8'::uuid, 'CNV', 'CNV_NGS'),
  ('ebb713bd-ad92-454d-aa4a-4a10a4edf13a'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('69c6c3b7-6d11-4023-97e2-33e6dfb58dde'::uuid, 'HEMOSTASE', 'TEMPS_GLOBAUX'),
  ('e7bc81b1-f380-443c-b486-f3959a88ae82'::uuid, 'HEMOSTASE', 'TEMPS_GLOBAUX'),
  ('e05fb4bf-ab49-4e59-98b0-ec1accf11257'::uuid, 'PCR_VIRALES', 'AUTRES_VIRUS'),
  ('e08c715e-0b2d-4b7f-be20-3cbe8d12667d'::uuid, 'VITAMINES_OLIGOELEMENTS', 'OLIGOELEMENTS')
) AS updates(id, sec_code, subsec_code)
LEFT JOIN public.lab_sections sec ON sec.code = updates.sec_code
LEFT JOIN public.lab_sub_sections subsec ON subsec.code = updates.subsec_code
WHERE g.id = updates.id;

COMMIT;
