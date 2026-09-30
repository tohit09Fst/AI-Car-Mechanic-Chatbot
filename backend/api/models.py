import uuid
from django.db import models

class ChatSession(models.Model):
    session_id = models.CharField(max_length=100, unique=True, default=uuid.uuid4)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Session {self.session_id}"

class ChatMessage(models.Model):
    SENDER_CHOICES = (
        ('user', 'User'),
        ('bot', 'Bot'),
    )
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=10, choices=SENDER_CHOICES)
    text = models.TextField(blank=True, default='')
    media_url = models.CharField(max_length=500, blank=True, null=True)
    media_type = models.CharField(max_length=20, blank=True, default='none') # image, audio, video, none
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sender}: {self.text[:30]}"

class Diagnosis(models.Model):
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='diagnoses')
    issue_summary = models.TextField()
    root_cause = models.TextField(blank=True, default='')
    recommended_service = models.CharField(max_length=255)
    estimated_cost = models.CharField(max_length=100, default='$100 - $250')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Diagnosis for {self.session.session_id}: {self.recommended_service}"

class Booking(models.Model):
    booking_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ChatSession, on_delete=models.SET_NULL, null=True, blank=True)
    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=50)
    car_model = models.CharField(max_length=150)
    service_requested = models.CharField(max_length=255)
    booking_date = models.CharField(max_length=100) # e.g. "2026-10-05 10:00 AM"
    status = models.CharField(max_length=50, default='Confirmed')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Booking {self.booking_id} - {self.customer_name} ({self.car_model})"
