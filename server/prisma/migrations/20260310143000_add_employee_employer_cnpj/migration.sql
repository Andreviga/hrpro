-- Add dedicated employer CNPJ binding per employee
ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "employerCnpj" TEXT;
