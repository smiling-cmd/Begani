from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, University, ClassGroup, StudentProfile, VerificationCode, ConsentRecord

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ['email', 'role', 'is_active', 'is_staff']
    
    # This controls the "Edit" view
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('phone', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    
    # This controls the "Add" view. We use 'password1' and 'password2' for hashing.
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'phone', 'role', 'is_active', 'is_staff'),
        }),
    )
    
    search_fields = ('email',)
    ordering = ('email',)

admin.site.register(University)
admin.site.register(ClassGroup)
admin.site.register(StudentProfile)
admin.site.register(VerificationCode)
admin.site.register(ConsentRecord)