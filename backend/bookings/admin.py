from django.contrib import admin
from .models import Booking, BookingStatusHistory

admin.site.register(Booking)
admin.site.register(BookingStatusHistory)
