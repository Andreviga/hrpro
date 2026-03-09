-- AlterTable
ALTER TABLE "EmployeeDocument" ADD COLUMN     "payrollRunId" TEXT;

-- CreateIndex
CREATE INDEX "EmployeeDocument_payrollRunId_employeeId_type_idx" ON "EmployeeDocument"("payrollRunId", "employeeId", "type");

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
