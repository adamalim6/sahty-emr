import { useState, useEffect } from 'react';
import { api } from '../services/api';

export interface SmartPhrase {
    id: string;
    trigger: string;
    trigger_search: string;
    label: string | null;
    description: string | null;
    body_html: string;
    scope: 'tenant' | 'user';
    type?: 'smart_phrase' | 'smart_value';
}

// Built-in smart values
const BUILT_IN_SMART_VALUES: SmartPhrase[] = [
    { id: 'sv_vitals', trigger: 'vitals', trigger_search: 'vitals', label: 'Insérer les dernières constantes', description: 'Valeurs récentes', body_html: '', scope: 'tenant', type: 'smart_value' },
    { id: 'sv_allergies', trigger: 'allergies', trigger_search: 'allergies', label: 'Insérer les allergies actives', description: 'Allergies du patient', body_html: '', scope: 'tenant', type: 'smart_value' },
    { id: 'sv_addictions', trigger: 'addictions', trigger_search: 'addictions', label: 'Insérer les addictions actives', description: 'Addictions du patient', body_html: '', scope: 'tenant', type: 'smart_value' }
];

export function useSmartPhrases() {
    const [phrases, setPhrases] = useState<SmartPhrase[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchPhrases() {
            setIsLoading(true);
            try {
                const data = await api.getSmartPhrases();
                if (isMounted) {
                    const phrasesWithType = data.map(p => ({ ...p, type: 'smart_phrase' as const }));
                    setPhrases(phrasesWithType);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchPhrases();

        return () => {
            isMounted = false;
        };
    }, []);

    return { phrases, isLoading, error };
}

export function useSmartValues() {
    return { values: BUILT_IN_SMART_VALUES };
}
