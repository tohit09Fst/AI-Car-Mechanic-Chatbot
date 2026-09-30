import os
import uuid
import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from .models import ChatSession, ChatMessage, Diagnosis, Booking
from .serializers import ChatMessageSerializer, DiagnosisSerializer, BookingSerializer, ChatSessionSerializer

CAR_KEYWORDS = [
    'car', 'vehicle', 'engine', 'brake', 'wheel', 'tire', 'tyre', 'clutch', 'gear', 'transmission',
    'battery', 'oil', 'coolant', 'radiator', 'steering', 'exhaust', 'smoke', 'suspension', 'noise',
    'squeak', 'rattle', 'knock', 'leak', 'ac', 'aircon', 'spark', 'filter', 'check engine', 'mileage',
    'fuel', 'petrol', 'diesel', 'hybrid', 'ev', 'clunk', 'vibration', 'overheating', 'starter', 'alternator',
    'start', 'chalu', 'band', ' आवाज', ' धुआं'
]

NON_CAR_KEYWORDS = [
    'python', 'javascript', 'html', 'css', 'react', 'code', 'programming', 'recipe', 'cook',
    'president', 'weather', 'movie', 'song', 'essay', 'math', 'calculator', 'history', 'geography'
]

def is_car_related(prompt):
    prompt_lower = prompt.lower()
    for kw in NON_CAR_KEYWORDS:
        if re.search(r'\b' + re.escape(kw) + r'\b', prompt_lower) and not any(ck in prompt_lower for ck in ['car', 'vehicle', 'engine', 'mechanic']):
            return False
    if any(kw in prompt_lower for kw in CAR_KEYWORDS):
        return True
    if any(g in prompt_lower for g in ['hi', 'hello', 'hey', 'help', 'good morning', 'good evening']):
        return True
    return False

def generate_technician_response(session, user_message, media_url=None, media_type='none'):
    prompt_lower = (user_message or '').lower()
    
    # Check session history length to know if follow-up is needed
    user_msg_count = session.messages.filter(sender='user').count() if session else 1

    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key and api_key.strip():
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=api_key.strip())
            system_instruction = (
                "You are a Senior Automobile Mechanic Technician.\n"
                "Rules:\n"
                "1. Only handle car/vehicle queries. Politely decline non-car topics.\n"
                "2. If the user mentions a car issue for the first time, DO NOT give an immediate final diagnosis. Ask 2-3 specific follow-up questions first to narrow down the cause (e.g., 'Starter motor crank kar rahi hai?', 'Dashboard par warning light aa rahi hai?', 'Battery recently change hui hai?').\n"
                "3. When the user answers your follow-up questions or gives symptoms, provide a concise diagnosis with Possible Issue and Recommended Service, and remind them to click 'Book Mechanic'."
            )
            
            contents = []
            if media_url:
                rel_path = media_url.replace('/media/', '', 1)
                abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
                if os.path.exists(abs_path):
                    with open(abs_path, 'rb') as f:
                        file_bytes = f.read()
                    mime_map = {'image': 'image/jpeg', 'audio': 'audio/wav', 'video': 'video/mp4'}
                    mime_type = mime_map.get(media_type, 'application/octet-stream')
                    contents.append(types.Part.from_bytes(data=file_bytes, mime_type=mime_type))

            if user_message:
                contents.append(user_message)
            else:
                contents.append(f"Please analyze this uploaded vehicle {media_type} recording and ask follow-up questions or give your mechanic opinion.")

            model_candidates = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash']
            for m in model_candidates:
                try:
                    response = client.models.generate_content(
                        model=m,
                        contents=contents,
                        config={'system_instruction': system_instruction}
                    )
                    if response and response.text:
                        print(f" Successfully generated response via Gemini API ({m})")
                        return response.text.strip(), True
                except Exception as model_err:
                    print(f"Model {m} fallback: {model_err}")
        except Exception as e:
            print(f"⚠️ Gemini API Init Failed ({type(e).__name__}: {e}). Falling back to rule-based technician response.")

    # Rule-based fallback technician logic (Step-by-step follow-up flow)
    if user_msg_count <= 1 and any(k in prompt_lower for k in ['start', 'chalu', 'band', 'no noise', 'stoppin']):
        reply = (
            "Hello! I can help you troubleshoot your vehicle. Before giving a diagnosis, please answer these quick questions:\n\n"
            "🤖 **1. Starter motor crank kar rahi hai (rur-rur sound)?**\n"
            "🤖 **2. Dashboard par koi warning light aa rahi hai?**\n"
            "🤖 **3. Battery recently change hui hai?**"
        )
    elif media_type == 'audio' and user_msg_count <= 1:
        reply = (
            "I received your audio sample. To diagnose accurately:\n\n"
            "🤖 **1. Ye noise acceleration ke vaqt aati hai ya idle par?**\n"
            "🤖 **2. Brake pedal press karne par koi vibration feel hota hai?**"
        )
    elif 'brake' in prompt_lower or 'squeak' in prompt_lower or 'stoppin' in prompt_lower:
        reply = (
            "🔧 **Possible Issue**: Brake Pad Wear / Rotor Surface Glazing\n"
            "📋 **Recommended Service**: Brake Pad Replacement & Rotor Inspection\n\n"
            "You can click **'Book Certified Mechanic'** below to schedule an inspection!"
        )
    elif 'smoke' in prompt_lower or 'overheat' in prompt_lower:
        reply = (
            "🔧 **Possible Issue**: Cooling System Overheat / Coolant Leakage\n"
            "📋 **Recommended Service**: Radiator Flush & Thermostat Replacement\n\n"
            "You can click **'Book Certified Mechanic'** below to schedule an inspection!"
        )
    else:
        reply = (
            "🔧 **Possible Issue**: Weak or Dead Battery / Starter Ignition Failure\n"
            "📋 **Recommended Service**: 12V Battery Replacement & Alternator Load Test\n\n"
            "You can click **'Book Certified Mechanic'** below to schedule an inspection!"
        )
    
    return reply, False

class ChatAPIView(APIView):
    def post(self, request):
        session_id = request.data.get('session_id')
        message_text = request.data.get('message', '').strip()
        media_url = request.data.get('media_url', None)
        media_type = request.data.get('media_type', 'none')

        if not session_id:
            session = ChatSession.objects.create()
            session_id = str(session.session_id)
        else:
            session, _ = ChatSession.objects.get_or_create(session_id=session_id)

        # Save user message
        if message_text or media_url:
            ChatMessage.objects.create(
                session=session,
                sender='user',
                text=message_text,
                media_url=media_url,
                media_type=media_type
            )

        # Non-car query rejection check
        if message_text and not is_car_related(message_text):
            reply_text = (
                "I am a Senior Automobile Mechanic Agent. "
                "I can only help with car diagnostics, engine issues, and vehicle maintenance. "
                "Please ask a car-related question!"
            )
            used_gemini = False
        else:
            reply_text, used_gemini = generate_technician_response(session, message_text, media_url, media_type)

        # Save bot response
        bot_msg = ChatMessage.objects.create(
            session=session,
            sender='bot',
            text=reply_text,
            media_type='none'
        )

        return Response({
            'session_id': session_id,
            'reply': reply_text,
            'used_gemini': used_gemini,
            'bot_message': ChatMessageSerializer(bot_msg).data
        }, status=status.HTTP_200_OK)

class UploadAPIView(APIView):
    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        ext = file_obj.name.split('.')[-1].lower()
        if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            media_type = 'image'
        elif ext in ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm']:
            media_type = 'audio'
        elif ext in ['mp4', 'mov', 'avi', 'mkv']:
            media_type = 'video'
        else:
            media_type = 'file'

        filename = f"uploads/{uuid.uuid4().hex}_{file_obj.name}"
        saved_path = default_storage.save(filename, ContentFile(file_obj.read()))
        file_url = f"/media/{saved_path}"

        return Response({
            'media_url': file_url,
            'media_type': media_type,
            'filename': file_obj.name
        }, status=status.HTTP_201_CREATED)

class DiagnosisAPIView(APIView):
    def post(self, request):
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({'error': 'session_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = ChatSession.objects.get(session_id=session_id)
        except ChatSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

        user_messages = session.messages.filter(sender='user').values_list('text', flat=True)
        all_text = " ".join(user_messages).lower()

        if 'brake' in all_text or 'squeak' in all_text or 'grind' in all_text or 'stoppin' in all_text:
            summary = "Brake pad wear / Rotor surface glazing detected."
            root_cause = "Friction lining worn down, metallic contact with rotor."
            recommended_service = "Brake Pad Replacement & Rotor Resurfacing"
            estimated_cost = "$150 - $280"
        elif 'smoke' in all_text or 'overheat' in all_text or 'coolant' in all_text:
            summary = "Cooling system thermal overload / Coolant leak."
            root_cause = "Faulty thermostat or radiator hose pressure breakdown."
            recommended_service = "Radiator Flush & Thermostat Replacement"
            estimated_cost = "$220 - $450"
        else:
            summary = "Electrical ignition system failure / Weak battery."
            root_cause = "Battery voltage drops under load below 10.5V."
            recommended_service = "12V Battery Replacement & Alternator Test"
            estimated_cost = "$120 - $200"

        diagnosis = Diagnosis.objects.create(
            session=session,
            issue_summary=summary,
            root_cause=root_cause,
            recommended_service=recommended_service,
            estimated_cost=estimated_cost
        )

        return Response({
            'diagnosis': DiagnosisSerializer(diagnosis).data,
            'can_book': True,
            'message': 'Diagnosis completed successfully. You can now book a mechanic.'
        }, status=status.HTTP_201_CREATED)

class BookingAPIView(APIView):
    def post(self, request):
        customer_name = request.data.get('customer_name')
        customer_phone = request.data.get('customer_phone')
        car_model = request.data.get('car_model')
        service_requested = request.data.get('service_requested', 'General Repair')
        booking_date = request.data.get('booking_date')
        session_id = request.data.get('session_id', None)

        if not (customer_name and customer_phone and car_model and booking_date):
            return Response({'error': 'customer_name, customer_phone, car_model, and booking_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        session = None
        if session_id:
            session = ChatSession.objects.filter(session_id=session_id).first()

        booking = Booking.objects.create(
            session=session,
            customer_name=customer_name,
            customer_phone=customer_phone,
            car_model=car_model,
            service_requested=service_requested,
            booking_date=booking_date,
            status='Confirmed'
        )

        return Response({
            'message': 'Mechanic booking confirmed successfully!',
            'booking': BookingSerializer(booking).data
        }, status=status.HTTP_201_CREATED)

    def get(self, request, booking_id):
        try:
            booking = Booking.objects.get(booking_id=booking_id)
            return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

class SessionHistoryAPIView(APIView):
    def get(self, request, session_id):
        try:
            session = ChatSession.objects.get(session_id=session_id)
            return Response(ChatSessionSerializer(session).data, status=status.HTTP_200_OK)
        except ChatSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

class APIStatusView(APIView):
    def get(self, request):
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        has_key = bool(api_key and api_key != "your_gemini_api_key_here")
        return Response({
            'gemini_configured': has_key,
            'status': 'active' if has_key else 'rule_based_fallback'
        })
