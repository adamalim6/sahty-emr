DO $$
BEGIN
    IF (SELECT count(*) FROM reference.lab_specimen_types) = 0 THEN
        ALTER TABLE reference.lab_specimen_types ADD COLUMN base_specimen TEXT NOT NULL;
        ALTER TABLE reference.lab_specimen_types ADD COLUMN matrix_type TEXT NOT NULL;
    ELSE
        ALTER TABLE reference.lab_specimen_types ADD COLUMN base_specimen TEXT NOT NULL DEFAULT 'OTHER';
        ALTER TABLE reference.lab_specimen_types ADD COLUMN matrix_type TEXT NOT NULL DEFAULT 'OTHER';
        ALTER TABLE reference.lab_specimen_types ALTER COLUMN base_specimen DROP DEFAULT;
        ALTER TABLE reference.lab_specimen_types ALTER COLUMN matrix_type DROP DEFAULT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_specimen_base_tenant ON reference.lab_specimen_types(base_specimen);

CREATE TABLE IF NOT EXISTS reference.lab_container_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    libelle TEXT NOT NULL,
    description TEXT NULL,
    additive_type TEXT NULL,
    tube_color TEXT NULL,
    actif BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reference.lab_specimen_container_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specimen_type_id UUID NOT NULL,
    container_type_id UUID NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    actif BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_specimen
        FOREIGN KEY (specimen_type_id)
        REFERENCES reference.lab_specimen_types(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_container
        FOREIGN KEY (container_type_id)
        REFERENCES reference.lab_container_types(id)
        ON DELETE RESTRICT,

    CONSTRAINT unique_specimen_container
        UNIQUE (specimen_type_id, container_type_id)
);

CREATE UNIQUE INDEX uniq_default_container_per_specimen_tenant
ON reference.lab_specimen_container_types(specimen_type_id)
WHERE is_default = true;
