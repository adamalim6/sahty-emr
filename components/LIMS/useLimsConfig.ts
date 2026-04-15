import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

// === CHAPITRES ===
export const useLimsSectionTree = () => {
    return useQuery({
        queryKey: ['lims-config', 'section-tree'],
        queryFn: () => api.limsConfig.getSectionTree()
    });
};

export const useCreateSectionTree = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.limsConfig.createSectionTree(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'section-tree'] });
        }
    });
};

export const useUpdateSectionTree = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.limsConfig.updateSectionTree(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'section-tree'] });
        }
    });
};

export const useSetSectionTreeStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, actif }: { id: string, actif: boolean }) => api.limsConfig.setSectionTreeStatus(id, actif),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'section-tree'] });
        }
    });
};

// === SOUS-CHAPITRES ===
export const useLimsSubSectionTree = () => {
    return useQuery({
        queryKey: ['lims-config', 'sub-section-tree'],
        queryFn: () => api.limsConfig.getSubSectionTree()
    });
};

export const useCreateSubSectionTree = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.limsConfig.createSubSectionTree(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'sub-section-tree'] });
        }
    });
};

export const useUpdateSubSectionTree = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.limsConfig.updateSubSectionTree(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'sub-section-tree'] });
        }
    });
};

export const useSetSubSectionTreeStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, actif }: { id: string, actif: boolean }) => api.limsConfig.setSubSectionTreeStatus(id, actif),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'sub-section-tree'] });
        }
    });
};

// === DICTIONARIES ===
export const useLimsConfigDictionaries = () => {
    const sousFamilles = useQuery({ queryKey: ['lims-dict', 'sous-familles'], queryFn: () => api.limsConfig.getSousFamilles() });
    const sections = useQuery({ queryKey: ['lims-dict', 'sections'], queryFn: () => api.limsConfig.getSections() });
    const subSections = useQuery({ queryKey: ['lims-dict', 'sub-sections'], queryFn: () => api.limsConfig.getSubSections() });
    const analytes = useQuery({ queryKey: ['lims-dict', 'analytes'], queryFn: () => api.limsConfig.getAnalytes() });
    const methods = useQuery({ queryKey: ['lims-dict', 'methods'], queryFn: () => api.limsConfig.getMethods() });
    const specimens = useQuery({ queryKey: ['lims-dict', 'specimens'], queryFn: () => api.limsConfig.getSpecimenTypes() });
    const containers = useQuery({ queryKey: ['lims-dict', 'containers'], queryFn: () => api.limsConfig.getContainers() });
    const units = useQuery({ queryKey: ['lims-dict', 'units'], queryFn: () => api.limsConfig.getUnits() });
    const sectionTree = useQuery({ queryKey: ['lims-dict', 'section-tree'], queryFn: () => api.limsConfig.getSectionTree() });
    const subSectionTree = useQuery({ queryKey: ['lims-dict', 'sub-section-tree'], queryFn: () => api.limsConfig.getSubSectionTree() });

    return {
        sousFamilles: sousFamilles.data || [],
        sections: sections.data || [],
        subSections: subSections.data || [],
        analytes: analytes.data || [],
        methods: methods.data || [],
        specimens: specimens.data || [],
        containers: containers.data || [],
        units: units.data || [],
        sectionTree: sectionTree.data || [],
        subSectionTree: subSectionTree.data || [],
        isLoading: sousFamilles.isLoading || sections.isLoading || subSections.isLoading ||
                   analytes.isLoading || methods.isLoading || specimens.isLoading ||
                   containers.isLoading || units.isLoading
    };
};

// === PARAMÈTRES (CONTEXTS) ===
export const useLimsContexts = () => {
    return useQuery({
        queryKey: ['lims-config', 'contexts'],
        queryFn: () => api.limsConfig.getAnalyteContexts()
    });
};

export const useCreateLimsContext = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.limsConfig.createAnalyteContext(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'contexts'] });
        }
    });
};

export const useSetLimsContextStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, actif }: { id: string, actif: boolean }) => api.limsConfig.setContextStatus(id, actif),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'contexts'] });
        }
    });
};

// === PROFILES ===
export const useLimsProfiles = (contextId?: string) => {
    return useQuery({
        queryKey: ['lims-config', 'profiles', contextId],
        queryFn: () => api.limsConfig.getReferenceProfiles(contextId!),
        enabled: !!contextId
    });
};

export const useCreateLimsProfile = (contextId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.limsConfig.createReferenceProfile(contextId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'profiles', contextId] });
        }
    });
};

export const useSetLimsProfileStatus = (contextId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, actif }: { id: string, actif: boolean }) => api.limsConfig.setProfileStatus(id, actif),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'profiles', contextId] });
        }
    });
};

// === RULES ===
export const useLimsRules = (profileId?: string) => {
    return useQuery({
        queryKey: ['lims-config', 'rules', profileId],
        queryFn: () => api.limsConfig.getReferenceRules(profileId!),
        enabled: !!profileId
    });
};

export const useCreateLimsRule = (profileId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.limsConfig.createReferenceRule(profileId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'rules', profileId] });
        }
    });
};

export const useSetLimsRuleStatus = (profileId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, actif }: { id: string, actif: boolean }) => api.limsConfig.setRuleStatus(id, actif),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'rules', profileId] });
        }
    });
};

export const useLimsCanonicalValues = (domain?: string) => {
    return useQuery({
        queryKey: ['lims-config', 'canonical-values', domain],
        queryFn: () => api.limsConfig.getCanonicalValues(domain)
    });
};

// === BIOLOGY ACTS ===
export const useLimsBiologyActs = () => {
    return useQuery({
        queryKey: ['lims-config', 'biology-acts'],
        queryFn: () => api.limsConfig.getBiologyActs()
    });
};

export const useLimsBiologyActDetails = (id?: string) => {
    return useQuery({
        queryKey: ['lims-config', 'biology-acts', id],
        queryFn: () => api.limsConfig.getBiologyActDetails(id!),
        enabled: !!id
    });
};

export const useAssignActContext = (actId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.limsConfig.assignActContext(actId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts', actId] });
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts'] });
        }
    });
};

export const useUnassignActContext = (actId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (assignmentId: string) => api.limsConfig.unassignActContext(actId, assignmentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts', actId] });
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts'] });
        }
    });
};

export const useAssignActSpecimenContainer = (actId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.limsConfig.assignActSpecimenContainer(actId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts', actId] });
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts'] });
        }
    });
};

export const useSetActSpecimenContainerDefault = (actId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (containerId: string) => api.limsConfig.setActSpecimenContainerDefault(actId, containerId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts', actId] });
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts'] });
        }
    });
};

export const useUnassignActSpecimenContainer = (actId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (assignmentId: string) => api.limsConfig.unassignActSpecimenContainer(actId, assignmentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts', actId] });
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts'] });
        }
    });
};

export const useAssignActTaxonomy = (actId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => api.limsConfig.assignActTaxonomy(actId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts', actId] });
            queryClient.invalidateQueries({ queryKey: ['lims-config', 'biology-acts'] });
        }
    });
};
