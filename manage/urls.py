from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('login', views.login, name='login'),
    path('register', views.register, name='register'),
    path('verify-email/<str:token>', views.verify_email, name='verify_email'),
    path('dashboard', views.dashboard, name='dashboard'),
    path('admin', views.admin, name='admin'),
    path('logout', views.logout, name='logout'),
    
    # API endpoints
    path('api/users', views.api_users, name='api_users'),
    path('api/users/create', views.api_create_user, name='api_create_user'),
    path('api/users/<int:user_id>/update', views.api_update_user, name='api_update_user'),
    path('api/users/<int:user_id>/delete', views.api_delete_user, name='api_delete_user'),
    path('api/users/<int:user_id>/upload-picture', views.upload_profile_picture, name='upload_profile_picture'),
    path('api/payroll/me', views.api_payroll_me, name='api_payroll_me'),
    path('api/payroll/<int:user_id>/upsert', views.api_payroll_upsert, name='api_payroll_upsert'),
    path('api/payroll/<int:user_id>/history', views.api_payroll_user_history, name='api_payroll_user_history'),
    path('api/payroll/<int:user_id>/pdf', views.api_payroll_pdf, name='api_payroll_pdf'),
]
