import json
import secrets
import os
import mimetypes
from datetime import timedelta
from io import BytesIO
from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponse
from django.conf import settings
from django.core.mail import send_mail
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from manage.db import Database
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

def _sanitize_user(user):
    if not user:
        return user
    safe_user = dict(user)
    safe_user.pop('password', None)
    safe_user.pop('verification_token', None)
    safe_user.pop('verification_sent_at', None)
    safe_user.pop('verification_expires_at', None)
    return safe_user

def _parse_money(value):
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    try:
        cleaned = str(value).replace(',', '').replace(' ', '')
        return float(cleaned)
    except ValueError:
        return 0.0

def _issue_verification_token(user_id):
    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(hours=24)
    Database.update_user(
        user_id,
        verification_token=token,
        verification_sent_at=timezone.now().isoformat(),
        verification_expires_at=expires_at.isoformat(),
        email_verified=False
    )
    return token

def _send_verification_email(user, request):
    token = _issue_verification_token(user['id'])
    verify_url = request.build_absolute_uri(reverse('verify_email', args=[token]))
    subject = 'Verify your email'
    message = (
        f"Hi {user.get('full_name', user['username'])},\n\n"
        "Please verify your email address by clicking the link below:\n"
        f"{verify_url}\n\n"
        "This link expires in 24 hours."
    )
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user['email']])

# Home Page
def index(request):
    return render(request, 'index.html')

# Login
@ensure_csrf_cookie
@require_http_methods(["GET", "POST"])
def login(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            
            user, error = Database.authenticate(username, password)
            if error:
                return JsonResponse({'success': False, 'error': error}, status=401)
            
            request.session['user_id'] = user['id']
            request.session['username'] = user['username']
            request.session['role'] = user['role']
            
            return JsonResponse({
                'success': True,
                'user': _sanitize_user(user),
                'redirect': '/admin' if user['role'] == 'admin' else '/dashboard'
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    
    return render(request, 'login.html')

# Dashboard (User Page)
def dashboard(request):
    if 'user_id' not in request.session:
        return redirect('login')
    
    user = Database.get_user_by_id(request.session['user_id'])
    if not user or user['role'] != 'user':
        return redirect('login')
    
    context = {'user': _sanitize_user(user)}
    return render(request, 'dashboard.html', context)

# Admin Dashboard
def admin(request):
    if 'user_id' not in request.session:
        return redirect('login')
    
    user = Database.get_user_by_id(request.session['user_id'])
    if not user or user['role'] != 'admin':
        return redirect('login')
    
    users = Database.get_all_users()
    context = {'user': _sanitize_user(user), 'all_users': [ _sanitize_user(u) for u in users ]}
    return render(request, 'admin.html', context)

# API: Get payroll history for current user
@require_http_methods(["GET"])
def api_payroll_me(request):
    if 'user_id' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    user = Database.get_user_by_id(request.session['user_id'])
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    history, error = Database.get_payroll_history(user['id'])
    if error:
        return JsonResponse({'error': error}, status=404)

    return JsonResponse({'payroll_history': history})

# API: Admin upsert payroll record for a user
@require_http_methods(["POST"])
@csrf_exempt
def api_payroll_upsert(request, user_id):
    if 'user_id' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    admin_user = Database.get_user_by_id(request.session['user_id'])
    if not admin_user or admin_user['role'] != 'admin':
        return JsonResponse({'error': 'Forbidden'}, status=403)

    try:
        data = json.loads(request.body)
        month = data.get('month')
        if not month:
            return JsonResponse({'error': 'Month is required (YYYY-MM)'}, status=400)

        base_salary = _parse_money(data.get('base_salary'))
        allowances = _parse_money(data.get('allowances'))
        deductions = _parse_money(data.get('deductions'))
        net_salary = base_salary + allowances - deductions

        status = (data.get('status') or '').strip().lower()
        if status not in ('pending', 'in_progress', 'transferred', ''):
            return JsonResponse({'error': 'Invalid status'}, status=400)

        record = {
            'month': month,
            'base_salary': base_salary,
            'allowances': allowances,
            'deductions': deductions,
            'net_salary': net_salary,
            'notes': data.get('notes', ''),
            'updated_at': timezone.now().isoformat()
        }

        existing, _ = Database.get_payroll_record(user_id, month)
        if not existing:
            record['created_at'] = timezone.now().isoformat()
            record['status'] = status or 'pending'
        else:
            record['created_at'] = existing.get('created_at')
            # Preserve status unless explicitly provided
            record['status'] = status or existing.get('status') or 'pending'

        saved_record, error = Database.upsert_payroll_record(user_id, record)
        if error:
            return JsonResponse({'error': error}, status=404)

        return JsonResponse({'success': True, 'record': saved_record})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

# API: Get payroll history for user (Admin only)
@require_http_methods(["GET"])
def api_payroll_user_history(request, user_id):
    if 'user_id' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    admin_user = Database.get_user_by_id(request.session['user_id'])
    if not admin_user or admin_user['role'] != 'admin':
        return JsonResponse({'error': 'Forbidden'}, status=403)

    history, error = Database.get_payroll_history(user_id)
    if error:
        return JsonResponse({'error': error}, status=404)

    return JsonResponse({'payroll_history': history})

# API: Generate payroll PDF (user or admin)
@require_http_methods(["GET"])
def api_payroll_pdf(request, user_id):
    if 'user_id' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    requester = Database.get_user_by_id(request.session['user_id'])
    if not requester:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if requester['role'] != 'admin' and requester['id'] != user_id:
        return JsonResponse({'error': 'Forbidden'}, status=403)

    month = request.GET.get('month')
    if not month:
        return JsonResponse({'error': 'Month is required (YYYY-MM)'}, status=400)

    user = Database.get_user_by_id(user_id)
    if not user:
        return JsonResponse({'error': 'User not found'}, status=404)

    record, error = Database.get_payroll_record(user_id, month)
    if error:
        return JsonResponse({'error': error}, status=404)
    if not record:
        return JsonResponse({'error': 'Payroll record not found'}, status=404)

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title='Slip Gaji')
    styles = getSampleStyleSheet()

    elements = []
    elements.append(Paragraph('Slip Gaji (Payroll Slip)', styles['Title']))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(f"Nama: {user.get('full_name', user.get('username'))}", styles['Normal']))
    elements.append(Paragraph(f"ID: #{user.get('id')}", styles['Normal']))
    elements.append(Paragraph(f"Department: {user.get('department', '-')}", styles['Normal']))
    elements.append(Paragraph(f"Position: {user.get('position', '-')}", styles['Normal']))
    elements.append(Paragraph(f"Periode: {month}", styles['Normal']))
    elements.append(Spacer(1, 12))

    table_data = [
        ['Komponen', 'Jumlah'],
        ['Gaji Pokok', f"Rp {record.get('base_salary', 0):,.2f}"],
        ['Tunjangan', f"Rp {record.get('allowances', 0):,.2f}"],
        ['Potongan', f"Rp {record.get('deductions', 0):,.2f}"],
        ['Total Diterima', f"Rp {record.get('net_salary', 0):,.2f}"]
    ]

    table = Table(table_data, colWidths=[250, 200])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f2f2f2')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
    ]))
    elements.append(table)

    notes = record.get('notes')
    if notes:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Catatan: {notes}", styles['Normal']))

    elements.append(Spacer(1, 24))
    elements.append(Paragraph('Dokumen ini dihasilkan oleh sistem.', styles['Italic']))

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()

    filename = f"slip-gaji-{user.get('username')}-{month}.pdf"
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    return response

# API: Get all users (Admin only)
@require_http_methods(["GET"])
def api_users(request):
    if 'user_id' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    user = Database.get_user_by_id(request.session['user_id'])
    if not user or user['role'] != 'admin':
        return JsonResponse({'error': 'Forbidden'}, status=403)
    
    users = Database.get_all_users()
    return JsonResponse({'users': [_sanitize_user(u) for u in users]})

# API: Create user
@require_http_methods(["POST"])
@csrf_exempt
def api_create_user(request):
    if 'user_id' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    user = Database.get_user_by_id(request.session['user_id'])
    if not user or user['role'] != 'admin':
        return JsonResponse({'error': 'Forbidden'}, status=403)
    
    try:
        data = json.loads(request.body)
        new_user, error = Database.create_user(
            username=data.get('username'),
            email=data.get('email'),
            password=data.get('password'),
            full_name=data.get('full_name'),
            role=data.get('role', 'user'),
            department=data.get('department'),
            position=data.get('position'),
            phone=data.get('phone'),
            emergency_contact_name=data.get('emergency_contact_name'),
            emergency_contact_phone=data.get('emergency_contact_phone')
        )
        
        if error:
            return JsonResponse({'success': False, 'error': error}, status=400)
        
        email_error = None
        try:
            _send_verification_email(new_user, request)
        except Exception as e:
            email_error = str(e)

        return JsonResponse({'success': True, 'user': _sanitize_user(new_user), 'email_error': email_error})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

# API: Update user
@require_http_methods(["PUT"])
@csrf_exempt
def api_update_user(request, user_id):
    if 'user_id' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    user = Database.get_user_by_id(request.session['user_id'])
    if not user or user['role'] != 'admin':
        return JsonResponse({'error': 'Forbidden'}, status=403)
    
    try:
        data = json.loads(request.body)
        updated_user, error = Database.update_user(user_id, **data)
        
        if error:
            return JsonResponse({'success': False, 'error': error}, status=400)
        
        return JsonResponse({'success': True, 'user': _sanitize_user(updated_user)})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

# API: Delete user
@require_http_methods(["DELETE"])
@csrf_exempt
def api_delete_user(request, user_id):
    if 'user_id' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    user = Database.get_user_by_id(request.session['user_id'])
    if not user or user['role'] != 'admin':
        return JsonResponse({'error': 'Forbidden'}, status=403)
    
    try:
        success, error = Database.delete_user(user_id)
        
        if error:
            return JsonResponse({'success': False, 'error': error}, status=400)
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

# Verify Email
def verify_email(request, token):
    user = Database.get_user_by_verification_token(token)
    if not user:
        return render(request, 'verify_email.html', {'status': 'invalid'})

    expires_at = None
    if user.get('verification_expires_at'):
        expires_at = parse_datetime(user.get('verification_expires_at'))
        if expires_at and timezone.is_naive(expires_at):
            expires_at = timezone.make_aware(expires_at, timezone.get_current_timezone())

    if expires_at and timezone.now() > expires_at:
        return render(request, 'verify_email.html', {'status': 'expired'})

    Database.update_user(
        user['id'],
        email_verified=True,
        verification_token=None,
        verification_sent_at=None,
        verification_expires_at=None
    )

    return render(request, 'verify_email.html', {'status': 'success', 'email': user.get('email')})

# Logout
def logout(request):
    request.session.clear()
    return redirect('index')
# User Registration
@ensure_csrf_cookie
@require_http_methods(["GET", "POST"])
def register(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            email = data.get('email')
            password = data.get('password')
            full_name = data.get('full_name')
            
            new_user, error = Database.create_user(
                username=username,
                email=email,
                password=password,
                full_name=full_name,
                role='user'
            )
            
            if error:
                return JsonResponse({'success': False, 'error': error}, status=400)
            
            email_error = None
            try:
                _send_verification_email(new_user, request)
            except Exception as e:
                email_error = str(e)
            
            return JsonResponse({
                'success': True,
                'message': 'Registration successful! Please check your email to verify your account.',
                'email_error': email_error
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    
    return render(request, 'login.html')

# Upload Profile Picture
@require_http_methods(["POST"])
@csrf_exempt
def upload_profile_picture(request, user_id):
    if 'user_id' not in request.session:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    user = Database.get_user_by_id(request.session['user_id'])
    if not user or (user['id'] != user_id and user['role'] != 'admin'):
        return JsonResponse({'error': 'Forbidden'}, status=403)
    
    try:
        if 'profile_picture' not in request.FILES:
            return JsonResponse({'error': 'No file provided'}, status=400)
        
        file = request.FILES['profile_picture']
        
        # Validate file type
        valid_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in valid_types:
            return JsonResponse({'error': 'Invalid file type. Only JPEG, PNG, GIF, and WebP allowed.'}, status=400)
        
        # Validate file size (max 5MB)
        if file.size > 5 * 1024 * 1024:
            return JsonResponse({'error': 'File too large. Max 5MB allowed.'}, status=400)
        
        # Generate unique filename
        ext = mimetypes.guess_extension(file.content_type) or '.jpg'
        filename = f"user_{user_id}_{secrets.token_hex(8)}{ext}"
        
        # Save file
        upload_dir = os.path.join(settings.BASE_DIR, 'manage', 'static', 'img', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, filename)
        
        with open(filepath, 'wb') as f:
            for chunk in file.chunks():
                f.write(chunk)
        
        # Delete old picture if exists
        target_user = Database.get_user_by_id(user_id)
        if target_user and target_user.get('profile_picture'):
            old_pic = os.path.join(upload_dir, os.path.basename(target_user['profile_picture']))
            if os.path.exists(old_pic):
                os.remove(old_pic)
        
        # Update database
        pic_url = f"/static/img/uploads/{filename}"
        Database.update_user(user_id, profile_picture=pic_url)
        
        return JsonResponse({'success': True, 'profile_picture': pic_url})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)