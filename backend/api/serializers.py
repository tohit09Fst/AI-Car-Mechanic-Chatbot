from rest_framework import serializers
from .models import ChatSession, ChatMessage, Diagnosis, Booking

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'sender', 'text', 'media_url', 'media_type', 'timestamp']

class DiagnosisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagnosis
        fields = ['id', 'session', 'issue_summary', 'root_cause', 'recommended_service', 'estimated_cost', 'created_at']

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['booking_id', 'session', 'customer_name', 'customer_phone', 'car_model', 'service_requested', 'booking_date', 'status', 'created_at']

class ChatSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)
    diagnoses = DiagnosisSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = ['session_id', 'messages', 'diagnoses', 'created_at']
