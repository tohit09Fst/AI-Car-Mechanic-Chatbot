from django.urls import path
from .views import (
    ChatAPIView,
    UploadAPIView,
    DiagnosisAPIView,
    BookingAPIView,
    SessionHistoryAPIView,
    APIStatusView
)

urlpatterns = [
    path('chat/', ChatAPIView.as_view(), name='api-chat'),
    path('upload/', UploadAPIView.as_view(), name='api-upload'),
    path('diagnosis/', DiagnosisAPIView.as_view(), name='api-diagnosis'),
    path('booking/', BookingAPIView.as_view(), name='api-booking-create'),
    path('booking/<uuid:booking_id>/', BookingAPIView.as_view(), name='api-booking-detail'),
    path('history/<str:session_id>/', SessionHistoryAPIView.as_view(), name='api-history'),
    path('status/', APIStatusView.as_view(), name='api-status'),
]
