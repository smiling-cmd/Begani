from django.contrib import admin, messages
from django.db import transaction
from django.utils import timezone

from .models import LedgerEntry, Payment, Payout, PlatformSetting, Refund


@admin.register(PlatformSetting)
class PlatformSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "updated_at")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("reference", "amount", "status", "phone_masked", "mpesa_receipt", "initiated_at", "paid_at")
    list_filter = ("status", "provider")
    search_fields = ("reference", "mpesa_receipt", "phone_masked")
    date_hierarchy = "initiated_at"


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ("booking", "therapist", "gross_kes", "commission_kes", "net_kes", "status", "paid_at")
    list_filter = ("status",)
    search_fields = ("booking__therapist__display_name", "mpesa_reference")
    actions = ("mark_paid",)

    @admin.display(description="Therapist")
    def therapist(self, obj):
        return obj.booking.therapist

    @admin.action(description="Mark selected payouts as paid (after sending the M-Pesa transfer)")
    def mark_paid(self, request, queryset):
        done = 0
        with transaction.atomic():
            for payout in queryset.select_for_update().filter(status=Payout.Status.PENDING):
                payout.status = Payout.Status.PAID
                payout.paid_at = timezone.now()
                payout.save(update_fields=("status", "paid_at"))
                LedgerEntry.objects.create(booking=payout.booking, type=LedgerEntry.Type.PAYOUT_OUT, amount=payout.net_kes)
                LedgerEntry.objects.create(booking=payout.booking, type=LedgerEntry.Type.COMMISSION, amount=payout.commission_kes)
                done += 1
        self.message_user(request, f"{done} payout(s) marked as paid.", messages.SUCCESS)


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ("payment", "amount", "reason", "status", "requested_at", "completed_at")
    list_filter = ("status",)
    actions = ("mark_refunded",)

    @admin.action(description="Mark selected refunds as refunded (after sending the money back)")
    def mark_refunded(self, request, queryset):
        done = 0
        with transaction.atomic():
            for refund in queryset.select_for_update().filter(status=Refund.Status.PENDING):
                refund.status = Refund.Status.SUCCEEDED
                refund.completed_at = timezone.now()
                refund.save(update_fields=("status", "completed_at"))
                LedgerEntry.objects.create(
                    booking=refund.booking, registration=refund.registration,
                    type=LedgerEntry.Type.REFUND_OUT, amount=refund.amount,
                )
                done += 1
        self.message_user(request, f"{done} refund(s) marked as refunded.", messages.SUCCESS)


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("type", "amount", "booking", "registration", "created_at")
    list_filter = ("type",)
