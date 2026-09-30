# AI Car Mechanic Chatbot

A full-stack web-based application where car owners can chat with a virtual Senior Automobile Mechanic Agent for troubleshooting, media-based inspection, diagnosis, and mechanic booking.

- **Live Backend API URL**: [https://ai-car-mechanic-chatbot-ify0.onrender.com](https://ai-car-mechanic-chatbot-ify0.onrender.com)


---

## 🚀 Features

- **React + Vite Frontend**: Lightweight, responsive dark-mode glassmorphic UI built with minimal clean code.
- **Django REST Backend**: Robust SQLite database models and REST endpoints for session history, media uploads, auto-diagnosis, and mechanic booking.
- **Multimodal Support**: Upload image, audio (engine/brake noise), or video files for mechanic analysis.
- **Traditional Logic + Gemini AI Minimization**:
  - Automatically filters and politely rejects non-car queries without incurring AI API costs.
  - Generates intelligent technician responses using Gemini AI when available, or reliable rule-based technician fallback.
- **Auto Diagnosis & Direct Mechanic Booking CTA**:
  - Synthesizes user symptoms into a diagnosis report with root causes and repair cost estimates.
  - Provides a single-click modal to book a certified mechanic and lookup booking status by UUID.

---

## 🛠 Tech Stack

- **Frontend**: React, Vite, Lucide Icons, Vanilla CSS
- **Backend**: Python 3, Django, Django REST Framework, SQLite
- **AI Integration**: Google Gemini API (optional / fallback supported)

---

## 📡 REST API Documentation

| Endpoint | Method | Description | Request Body / Params |
| :--- | :--- | :--- | :--- |
| `/api/chat/` | `POST` | Send message to AI Mechanic | `{"session_id": "...", "message": "...", "media_url": "..."}` |
| `/api/upload/` | `POST` | Upload image/audio/video file | Multipart Form Data `file` |
| `/api/diagnosis/` | `POST` | Generate official diagnosis report | `{"session_id": "..."}` |
| `/api/booking/` | `POST` | Book a certified mechanic | `{"customer_name": "...", "customer_phone": "...", "car_model": "...", "booking_date": "..."}` |
| `/api/booking/{id}/`| `GET` | Get booking details by UUID | Route parameter `id` |
| `/api/history/{id}/`| `GET` | Get full chat & diagnosis history | Route parameter `session_id` |

---

## 🏃 Quick Start Guide

### 1. Backend Setup (Django REST Framework)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install django djangorestframework django-cors-headers google-genai pillow

# Run migrations
python manage.py migrate

# (Optional) Export Gemini API Key
export GEMINI_API_KEY="your_api_key_here"

# Start backend server
python manage.py runserver 0.0.0.0:8000
```
Backend API will run at `http://localhost:8000/api/`.

### 2. Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```
Frontend Web App will run at `http://localhost:5173`.

---

## 🏗 Architecture & Design Decisions

1. **Minimized AI Usage**: Non-car queries are detected via pattern matching before reaching Gemini, preserving API quota and latency.
2. **Offline-Capable Fallback**: When Gemini API key is omitted or rate-limited, the system uses expert rule-based diagnostic patterns.
3. **Simple & Short React UI**: State is centralized cleanly in `App.jsx`, avoiding redundant store overheads while preserving complete UX capabilities (chat, media upload, diagnosis card, booking modal, status lookup).
