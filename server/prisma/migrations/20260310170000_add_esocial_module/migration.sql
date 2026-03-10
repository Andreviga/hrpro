DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EsocialDocumentType') THEN
    CREATE TYPE "EsocialDocumentType" AS ENUM (
      'event_xml',
      'lote_envio',
      'retorno_recepcao_lote',
      'retorno_processamento_lote',
      'retorno_processamento_evento',
      'consulta',
      'desconhecido'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EsocialProcessingResult') THEN
    CREATE TYPE "EsocialProcessingResult" AS ENUM ('success', 'partial', 'failed', 'pending', 'unknown');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EsocialOccurrenceSeverity') THEN
    CREATE TYPE "EsocialOccurrenceSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO', 'UNKNOWN');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "esocial_documents" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "external_event_id" TEXT,
  "document_type" "EsocialDocumentType" NOT NULL DEFAULT 'desconhecido',
  "event_type" TEXT,
  "employer_registration_type" TEXT,
  "employer_registration_number" TEXT,
  "worker_cpf" TEXT,
  "protocol_number" TEXT,
  "receipt_number" TEXT,
  "status_code" TEXT,
  "status_description" TEXT,
  "processing_result" "EsocialProcessingResult" NOT NULL DEFAULT 'unknown',
  "layout_version" TEXT,
  "namespace_uri" TEXT,
  "xml_hash" TEXT NOT NULL,
  "raw_xml" TEXT NOT NULL,
  "parsed_json" JSONB NOT NULL,
  "parsing_error" TEXT,
  "xsd_validation_status" TEXT,
  "xsd_validation_errors" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "esocial_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "esocial_occurrences" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "occurrence_type_code" TEXT,
  "occurrence_type_label" TEXT,
  "severity" "EsocialOccurrenceSeverity" NOT NULL DEFAULT 'UNKNOWN',
  "code" TEXT,
  "description" TEXT NOT NULL,
  "location" TEXT,
  "logical_xpath" TEXT,
  "official_catalog_description" TEXT,
  "probable_cause" TEXT,
  "suggested_action" TEXT,
  "category" TEXT,
  "is_blocking" BOOLEAN NOT NULL DEFAULT false,
  "is_success_compatible" BOOLEAN NOT NULL DEFAULT false,
  "raw_fragment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "esocial_occurrences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "esocial_message_catalog" (
  "code" TEXT NOT NULL,
  "official_description" TEXT NOT NULL,
  "human_explanation" TEXT,
  "probable_cause" TEXT,
  "suggested_action" TEXT,
  "category" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "esocial_message_catalog_pkey" PRIMARY KEY ("code")
);

CREATE UNIQUE INDEX IF NOT EXISTS "esocial_documents_company_id_xml_hash_key"
ON "esocial_documents"("company_id", "xml_hash");

CREATE INDEX IF NOT EXISTS "esocial_documents_company_id_document_type_idx"
ON "esocial_documents"("company_id", "document_type");

CREATE INDEX IF NOT EXISTS "esocial_documents_company_id_event_type_idx"
ON "esocial_documents"("company_id", "event_type");

CREATE INDEX IF NOT EXISTS "esocial_documents_company_id_receipt_number_idx"
ON "esocial_documents"("company_id", "receipt_number");

CREATE INDEX IF NOT EXISTS "esocial_documents_company_id_protocol_number_idx"
ON "esocial_documents"("company_id", "protocol_number");

CREATE INDEX IF NOT EXISTS "esocial_documents_company_id_worker_cpf_idx"
ON "esocial_documents"("company_id", "worker_cpf");

CREATE INDEX IF NOT EXISTS "esocial_occurrences_code_idx"
ON "esocial_occurrences"("code");

CREATE INDEX IF NOT EXISTS "esocial_occurrences_severity_idx"
ON "esocial_occurrences"("severity");

CREATE INDEX IF NOT EXISTS "esocial_occurrences_source_type_idx"
ON "esocial_occurrences"("source_type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'esocial_documents_company_id_fkey'
      AND table_name = 'esocial_documents'
  ) THEN
    ALTER TABLE "esocial_documents"
      ADD CONSTRAINT "esocial_documents_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'esocial_occurrences_document_id_fkey'
      AND table_name = 'esocial_occurrences'
  ) THEN
    ALTER TABLE "esocial_occurrences"
      ADD CONSTRAINT "esocial_occurrences_document_id_fkey"
      FOREIGN KEY ("document_id") REFERENCES "esocial_documents"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
