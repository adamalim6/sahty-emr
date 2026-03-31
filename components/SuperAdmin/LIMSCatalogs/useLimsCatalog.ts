import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';

export const useLimsCatalog = (resource: string) => {
    const queryClient = useQueryClient();
    const queryKey = ['lims-catalog', resource];

    const { data: items, isLoading, error } = useQuery({
        queryKey,
        queryFn: () => api.getLimsCatalog(resource)
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.createLimsCatalogItem(resource, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.updateLimsCatalogItem(resource, id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const deactivateMutation = useMutation({
        mutationFn: (id: string) => api.deactivateLimsCatalogItem(resource, id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const reactivateMutation = useMutation({
        mutationFn: (id: string) => api.reactivateLimsCatalogItem(resource, id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    return {
        items: items || [],
        isLoading,
        error,
        createItem: createMutation.mutateAsync,
        updateItem: updateMutation.mutateAsync,
        deactivateItem: deactivateMutation.mutateAsync,
        reactivateItem: reactivateMutation.mutateAsync,
        isSaving: createMutation.isPending || updateMutation.isPending
    };
};

