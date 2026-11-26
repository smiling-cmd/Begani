from django import forms
from django.contrib import admin, messages
from django.contrib.admin.helpers import ActionForm
from django.db import transaction
from django.utils import timezone

from . import services
from .models import LedgerEntry, Payment, Payout, PlatformSetting, Refund, TherapistPayoutAccount


@admin.register(PlatformSetting)
class PlatformSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "updated_at")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("reference", "amount", "status", "phone_masked", "mpesa_receipt", "initiated_at", "paid_at")
    list_filter = ("status", "provider")
    search_fields = ("reference", "mpesa_receipt", "phone_masked")
    date_hierarchy = "initiated_at"


class PayoutActionForm(ActionForm):
    otp = forms.CharField(required=False, label="Paystack OTP")


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ("booking", "therapist", "gross_kes", "commission_kes", "net_kes", "status", "failure_reason", "paid_at")
    list_filter = ("status",)
    search_fields = ("booking__therapist__display_name", "mpesa_reference", "transfer_reference")
    action_form = PayoutActionForm
    actions = ("send_to_mpesa", "finalize_with_otp", "mark_paid")

    @admin.display(description="Therapist")
    def therapist(self, obj):
        return obj.booking.therapist

    @admin.action(description="Send selected payouts to therapists' M-Pesa (Paystack)")
    def send_to_mpesa(self, request, queryset):
        started = 0
        for payout in queryset:
            try:
                result = services.send_payout(payout.pk)
                started += 1
                if result.status == Payout.Status.AWAITING_OTP:
                    self.message_user(request, "Paystack sent you an OTP. Type it in the box next to the action, then run 'Finalize with OTP'.", messages.WARNING)
            except services.PayoutError as exc:
                self.message_user(request, f"{payout}: {exc}", messages.ERROR)
        if started:
            self.message_user(request, f"{started} payout(s) started.", messages.SUCCESS)

    @admin.action(description="Finalize selected payouts with the OTP typed above")
    def finalize_with_otp(self, request, queryset):
        otp = (request.POST.get("otp") or "").strip()
        if not otp:
            self.message_user(request, "Type the OTP in the box next to the action first.", messages.ERROR)
            return
        done = 0
        for payout in queryset:
            try:
                services.finalize_payout(payout.pk, otp)
                done += 1
            except services.PayoutError as exc:
                self.message_user(request, f"{payout}: {exc}", messages.ERROR)
        if done:
            self.message_user(request, f"{done} payout(s) finalized.", messages.SUCCESS)

    @admin.action(description="Mark as paid manually (you sent the M-Pesa yourself)")
    def mark_paid(self, request, queryset):
        done = 0
        with transaction.atomic():
            for payout in queryset.select_for_update().exclude(status=Payout.Status.PAID):
                services.mark_payout_paid(payout)
                done += 1
        self.message_user(request, f"{done} payout(s) marked as paid.", messages.SUCCESS)


@admin.register(TherapistPayoutAccount)
class TherapistPayoutAccountAdmin(admin.ModelAdmin):
    list_display = ("therapist", "account_name", "updated_at")
    exclude = ("phone",)  # encrypted; deliberately not shown in admin


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
