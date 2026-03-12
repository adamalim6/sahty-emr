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
}

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
                    setPhrases(data);
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
