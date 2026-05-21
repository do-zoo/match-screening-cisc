-- AddForeignKey
ALTER TABLE "RegistrationHolder" ADD CONSTRAINT "RegistrationHolder_mandatoryMenuItemId_fkey" FOREIGN KEY ("mandatoryMenuItemId") REFERENCES "VenueMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
