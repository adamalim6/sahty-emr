import { limsRepository } from '../../repositories/lims/limsRepository';

export const limsService = {
    // === CONTEXTS ===
    getAnalyteContexts: (tenantId: string) => limsRepository.getAnalyteContexts(tenantId),
    createAnalyteContext: (tenantId: string, payload: any) => {
        if (!payload.analyte_id) throw new Error("analyte_id is required");
        return limsRepository.createAnalyteContext(tenantId, payload);
    },
    updateAnalyteContext: (tenantId: string, id: string, payload: any) => limsRepository.updateAnalyteContext(tenantId, id, payload),
    setContextStatus: (tenantId: string, id: string, actif: boolean) => limsRepository.setContextStatus(tenantId, id, actif),

    // === PROFILES ===
    getReferenceProfiles: (tenantId: string, contextId: string) => limsRepository.getReferenceProfiles(tenantId, contextId),
    createReferenceProfile: (tenantId: string, payload: any) => {
        if (!payload.analyte_context_id) throw new Error("analyte_context_id is required");
        return limsRepository.createReferenceProfile(tenantId, payload);
    },
    updateReferenceProfile: (tenantId: string, id: string, payload: any) => limsRepository.updateReferenceProfile(tenantId, id, payload),
    setProfileStatus: (tenantId: string, id: string, actif: boolean) => limsRepository.setProfileStatus(tenantId, id, actif),

    // === RULES ===
    getReferenceRules: (tenantId: string, profileId: string) => limsRepository.getReferenceRules(tenantId, profileId),
    createReferenceRule: (tenantId: string, payload: any) => {
        if (!payload.profile_id) throw new Error("profile_id is required");
        return limsRepository.createReferenceRule(tenantId, payload);
    },
    updateReferenceRule: (tenantId: string, id: string, payload: any) => limsRepository.updateReferenceRule(tenantId, id, payload),
    setRuleStatus: (tenantId: string, id: string, actif: boolean) => limsRepository.setRuleStatus(tenantId, id, actif),

    // === SECTION TREE ===
    getSectionTree: (tenantId: string) => limsRepository.getSectionTree(tenantId),
    createSectionTree: (tenantId: string, payload: any) => limsRepository.createSectionTree(tenantId, payload),
    updateSectionTree: (tenantId: string, id: string, payload: any) => limsRepository.updateSectionTree(tenantId, id, payload),
    setSectionTreeStatus: (tenantId: string, id: string, actif: boolean) => limsRepository.setSectionTreeStatus(tenantId, id, actif),

    // === SUB-SECTION TREE ===
    getSubSectionTree: (tenantId: string) => limsRepository.getSubSectionTree(tenantId),
    createSubSectionTree: (tenantId: string, payload: any) => limsRepository.createSubSectionTree(tenantId, payload),
    updateSubSectionTree: (tenantId: string, id: string, payload: any) => limsRepository.updateSubSectionTree(tenantId, id, payload),
    setSubSectionTreeStatus: (tenantId: string, id: string, actif: boolean) => limsRepository.setSubSectionTreeStatus(tenantId, id, actif),

    // === BIOLOGY ACTS ===
    getBiologyActs: (tenantId: string) => limsRepository.getBiologyActs(tenantId),
    getBiologyActDetails: (tenantId: string, actId: string) => limsRepository.getBiologyActDetails(tenantId, actId),
    assignActContext: (tenantId: string, actId: string, payload: any) => limsRepository.assignActContext(tenantId, actId, payload),
    unassignActContext: (tenantId: string, assignmentId: string) => limsRepository.unassignActContext(tenantId, assignmentId),
    assignActSpecimenContainer: (tenantId: string, actId: string, payload: any) => limsRepository.assignActSpecimenContainer(tenantId, actId, payload),
    unassignActSpecimenContainer: (tenantId: string, assignmentId: string) => limsRepository.unassignActSpecimenContainer(tenantId, assignmentId),
    assignActTaxonomy: (tenantId: string, actId: string, payload: any) => limsRepository.assignActTaxonomy(tenantId, actId, payload),

    getSousFamilles: (tenantId: string) => limsRepository.getSousFamilles(tenantId),
    getSections: (tenantId: string) => limsRepository.getSections(tenantId),
    getSubSections: (tenantId: string) => limsRepository.getSubSections(tenantId),
    getAnalytes: (tenantId: string) => limsRepository.getAnalytes(tenantId),
    getMethods: (tenantId: string) => limsRepository.getMethods(tenantId),
    getSpecimenTypes: (tenantId: string) => limsRepository.getSpecimenTypes(tenantId),
    getContainers: (tenantId: string) => limsRepository.getContainers(tenantId),
    getSpecimenContainerTypes: (tenantId: string) => limsRepository.getSpecimenContainerTypes(tenantId),
    getUnits: (tenantId: string) => limsRepository.getUnits(tenantId),
    getCanonicalValues: (tenantId: string, domain?: string) => limsRepository.getCanonicalValues(tenantId, domain)
};
