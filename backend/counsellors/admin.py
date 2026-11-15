from django.contrib import admin
from .models import TherapistProfile, TherapistVerification, TherapistDocument, AvailabilityPattern, AvailabilitySlot, TeachingAssignment, TherapistReport

admin.site.register(TherapistProfile)
admin.site.register(TherapistVerification)
admin.site.register(TherapistDocument)
admin.site.register(AvailabilityPattern)
admin.site.register(AvailabilitySlot)
admin.site.register(TeachingAssignment)
admin.site.register(TherapistReport)