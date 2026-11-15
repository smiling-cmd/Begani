from django.contrib import admin
from .models import PlatformSetting, Payment, Refund, Payout, LedgerEntry

admin.site.register(PlatformSetting)
admin.site.register(Payment)
admin.site.register(Refund)
admin.site.register(Payout)
admin.site.register(LedgerEntry)